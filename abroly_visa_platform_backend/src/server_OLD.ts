import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from "cors"
import https from 'https'
import http from 'http'
import path from 'path';
import fs from 'fs'
import sequelize from './config/dbconfig';
import v1_routes from './v1/routes';

const app = express();

const server = http.createServer(app);
const port = parseInt(process.env.SERVER_PORT) || 4001;

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
    // Check if origin matches *.techxuniverse.com pattern (any subdomain)
    else {
      try {
        const url = new URL(origin);
        const hostname = url.hostname;
        
        // Allow techxuniverse.com and all its subdomains (*.techxuniverse.com)
        if (hostname === 'techxuniverse.com' || hostname.endsWith('.techxuniverse.com')) {
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
    "X-Forwarded-Host"
  ],
  exposedHeaders: [
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers"
  ],
};

app.use(cors(corsOptions));

app.use(express.json())
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true }))

// app.get('/', (req: Request, res: Response) => {
//   res.send('Hello, World!');
// });


app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    health: "Good!"
  })
})

// Construct the absolute path to the public directory
const publicDirectoryPath = path.join(__dirname, '..', 'public');

// Serve files from the public directory under the "/public" route
app.use('/public', express.static(publicDirectoryPath));

app.use("/api/v1", v1_routes)

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Global Error Handler:', err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});


const connectDB = async () => {
  // Initialize models and associations
  const ModelInitializer = (await import('./config/modelInitializer')).default;
  const initializer = ModelInitializer.getInstance();
  
  const syncOptions = {
    alter: process.env.NODE_ENV !== 'production',
    force: false
  };
  
  await initializer.initializeModels(syncOptions);

  await sequelize
    .authenticate()
    .then(() => {
      console.log("MySQL connected..");
      // create default folders
      createDefaultFolders("profiles")
      createDefaultFolders("testimonials")
      createDefaultFolders("content_writing_files")
      createDefaultFolders("courses")
      createDefaultFolders("course_chapter_items")
      createDefaultFolders("service_info")
      createDefaultFolders("certificates")
      createDefaultFolders("banners")
      createDefaultFolders("event_images")
      createDefaultFolders("student_docs")
      createDefaultFolders("subscription_proof")
      createDefaultFolders("reports")
    })
    .catch((e) => {
      console.error("ERROR TO CONNECT DB", e.toString());
    });

  app.locals.db = sequelize; // Add the Sequelize instance to app.locals
  // app.locals.modelsv1 = modelsv1;

};



server.listen(port, '0.0.0.0', () => {
  connectDB();
  // swaggerDocs(app)
  // start cron job
  // CronJobs.cronInit();
  console.log(`Server is running at http://localhost:${port}`);
});



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
