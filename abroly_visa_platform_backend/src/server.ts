import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from "cors"
import http from 'http'
import path from 'path';
import fs from 'fs'
import cluster from 'cluster';
import os from 'os';
import dotenv from 'dotenv';
import sequelize from './config/dbconfig';
import v1_routes from './v1/routes';
import { startScheduler } from './services/scheduler';
import { migratePublicFiles, serveSignedFile } from './helpers/privateFiles';
import { serveMedia } from './helpers/storage';
import { setupRealtimePrimary, startRealtime } from './services/realtime';
import { captureUnhandledError, platformErrorCaptureMiddleware } from './middleware/platformErrorCapture';

dotenv.config();

// CLUSTER_WORKERS caps the worker count (e.g. 2 in local dev so nodemon restarts are quick); default: one per CPU
const numCPUs = parseInt(process.env.CLUSTER_WORKERS || "") || os.cpus().length;
const port = parseInt(process.env.SERVER_PORT) || 4001;

if (cluster.isPrimary) {
  // 🧠 Primary process (master)
  console.log(`🧠 Primary process PID: ${process.pid}`);
  console.log(`🚀 Spawning ${numCPUs} worker processes...`);

  // relays realtime chat events between workers
  setupRealtimePrimary();

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`⚠️ Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // 👷 Each worker runs this
  const app = express();
  const server = http.createServer(app);
  // realtime chat updates (WebSocket at /socket.io)
  startRealtime(server);

  // ✅ Initialize connections per worker
  const startServer = async () => {
    try {
      // Configure CORS based on environment
      const corsOptions = {
        origin: function (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) {
          // Allow requests with no origin (like mobile apps, curl requests)
          if (!origin) return callback(null, true);

          const allowedOrigins = 
          [
              "http://localhost:5173",
              "http://localhost:5174",
              "http://localhost:5175",
          ];

          // Check if origin is in allowed list
          if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
          } 
          // Agency portals + shared panels on our production domains
          else {
            try {
              const url = new URL(origin);
              const hostname = url.hostname;
              const allowedHost =
                hostname === "techxuniverse.com" || hostname.endsWith(".techxuniverse.com") ||
                hostname === "techxsolutions.io" || hostname.endsWith(".techxsolutions.io") ||
                hostname === "visacrm.in" || hostname.endsWith(".visacrm.in");
              if (allowedHost) {
                callback(null, true);
              } else {
                console.log("CORS blocked for origin:", origin);
                callback(null, true); // Temporarily allow all origins for debugging
              }
            } catch (e) {
              console.log("Invalid origin format:", origin);
              callback(null, true); // Temporarily allow all origins for debugging
            }
          }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "X-Requested-With",
          "Accept",
          "Origin",
          "X-HTTP-Method-Override",
          "X-Forwarded-For",
          "X-Forwarded-Proto",
          "X-Forwarded-Host",
          "X-Agency-UUID"
        ],
        exposedHeaders: [
          "Access-Control-Allow-Origin",
          "Access-Control-Allow-Methods",
          "Access-Control-Allow-Headers"
        ],
      };

      app.use(cors(corsOptions));

      // keep the raw body: Meta webhooks are verified with an HMAC of the exact bytes
      app.use(express.json({
        limit: "5mb",
        verify: (req: any, _res, buf) => { req.rawBody = buf }
      }))
      app.use(bodyParser.json({ limit: "50mb" }));
      app.use(bodyParser.urlencoded({ extended: true }))

      app.get("/health", (req: Request, res: Response) => {
        res.status(200).json({
          health: "Good!"
        })
      })

      // Capture live API failures for SaaS Monitoring (application errors only — not host metrics)
      app.use(platformErrorCaptureMiddleware);

      // Construct the absolute path to the public directory
      const publicDirectoryPath = path.join(__dirname, '..', 'public');

      // Serve files from the public directory under the "/public" route
      // private files (student documents, payment proofs, reports): signed, expiring links only.
      // Registered before /public so these folders are never served publicly, even before migration.
      app.get('/api/v1/files/:folder/*', serveSignedFile)
      // public images stored in S3 (agencies/<uuid>/<folder>/<name>) - redirects to a short-lived S3 link
      app.get('/api/v1/media/*', serveMedia)
      app.use(['/public/student_docs', '/public/subscription_proof', '/public/reports'], (_req: Request, res: Response) => res.status(404).send('Not found'))
      app.use('/public', express.static(publicDirectoryPath));

      app.use("/api/v1", v1_routes)

      app.use((err: any, req: Request, res: Response, next: NextFunction) => {
        console.error('Global Error Handler:', err.stack);
        const statusCode = err.statusCode || 500;
        captureUnhandledError(err, req, statusCode);
        res.status(statusCode).json({
          success: false,
          message: err.message || 'Internal Server Error',
        });
      });

      const connectDB = async () => {
        try {
          // Just verify connection - no model syncing (use npm run db:sync for that)
          await sequelize.authenticate();
          console.log(`✅ MySQL connection ready in worker ${process.pid}`);
          
          // Set up model associations only (no syncing/altering)
          // This ensures relationships work without modifying the database
          const ModelInitializer = (await import('./config/modelInitializer')).default;
          const initializer = ModelInitializer.getInstance();
          
          // Set up associations without syncing (only once per worker)
          if (!initializer.isModelInitialized()) {
            initializer.setupAssociationsOnly();
          }
          
          // Create default folders (only in worker 1 to avoid race conditions)
          if (cluster.worker && cluster.worker.id === 1) {
            createDefaultFolders("profiles")
            createDefaultFolders("testimonials")
            createDefaultFolders("content_writing_files")
            createDefaultFolders("courses")
            createDefaultFolders("course_chapter_items")
            createDefaultFolders("service_info")
            createDefaultFolders("certificates")
            createDefaultFolders("banners")
            createDefaultFolders("event_images")
          }

          // move documents out of the public folder (no-op once done)
          if (cluster.worker && cluster.worker.id === 1) migratePublicFiles()

          app.locals.db = sequelize; // Add the Sequelize instance to app.locals
        } catch (error) {
          console.error(`❌ ERROR TO CONNECT DB in worker ${process.pid}:`, error);
          throw error; // Re-throw to handle in startServer catch block
        }
      };

      /** ---------------- START SERVER ---------------- */
      server.listen(port, "0.0.0.0", async () => {
        console.log(`✅ Worker ${process.pid} running on port ${port}`);
        
        await connectDB();

        try {
          const { refreshMetaConfig } = await import("./services/metaSettings");
          const meta = await refreshMetaConfig(true);
          if (meta.appId && meta.appSecret && meta.publicApi) {
            console.log(`📘 Meta Lead Ads ready (app ${meta.appId})`);
          } else {
            console.log("📘 Meta Lead Ads not configured yet (set META_* env or SaaS → Meta / Facebook)");
          }
        } catch (error) {
          console.warn("Meta settings load skipped", error);
        }
        
        
        // ⚡ Socket should start only in one worker
        if (cluster.worker && cluster.worker.id === 1) {
          console.log("⚡ Socket initialized in worker 1");
          // socketStartFn();
        }

        // ⏰ Start cron jobs only in worker 1
        if (cluster.worker && cluster.worker.id === 1) {
          console.log("⏰ Starting cron jobs in worker 1...");
          // CronJobs.cronInit();
          startScheduler();
        }
      });
    } catch (error) {
      console.error(`❌ Worker ${process.pid} failed to start:`, error);
      process.exit(1);
    }
  };

  startServer();
}



// Check if the folder exists, if not, create it
async function createDefaultFolders(folderPath: string) {


  if (!fs.existsSync(`public`)) {
    fs.mkdir(`public`, { recursive: true }, (err) => {
      if (err) {
        console.error('Error creating folder:', err);
      } else {
        console.log('Folder created successfully.');
      }
    });
  }

  if (!fs.existsSync(`public/${folderPath}`)) {
    fs.mkdir(`public/${folderPath}`, { recursive: true }, (err) => {
      if (err) {
        console.error('Error creating folder:', err);
      } else {
        console.log('Folder created successfully.');
      }
    });
  }
}
