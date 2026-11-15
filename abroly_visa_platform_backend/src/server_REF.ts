import express, { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import http from "http";
import path from "path";
import cors from "cors";
import cluster from "cluster";
import os from "os";
import dotenv from "dotenv";

dotenv.config();

const numCPUs = os.cpus().length;
const PORT: number = Number(process.env.PORT) || 4020;
const ISLOCAL = process.env.ISLOCAL === "yes";

const allowedOrigins: string[] = [
  "https://zyaane.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
];

if (cluster.isPrimary) {
  // 🧠 Primary process (master)
  console.log(`🧠 Primary process PID: ${process.pid}`);
  console.log(`🚀 Spawning ${numCPUs} worker processes...`);

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

  // ✅ Initialize connections per worker
  const startServer = async () => {
    try {
      // await sequelize.authenticate();



      /** ---------------- MIDDLEWARE ---------------- */
      if (ISLOCAL) {
        app.use(cors());
      } else {
        app.use(cors({
          origin: function (origin: any, callback: any) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
              callback(null, true);
            } else {
              callback(new Error("Not allowed by CORS"));
            }
          },
          methods: ["GET", "POST", "PUT", "DELETE"],
          allowedHeaders: ["Content-Type", "Authorization"],
        }));
      }

      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));

      /** ---------------- START SERVER ---------------- */
      server.listen(PORT, "0.0.0.0", async () => {
        console.log(`✅ Worker ${process.pid} running on port ${PORT}`);

        // swaggerDocs(app);
        // associateModels();
        // createPredefineRecords();

        // ⚡ Socket should start only in one worker
        if (cluster.worker && cluster.worker.id === 1) {
          console.log("⚡ Socket initialized in worker 1");
          // socketStartFn();
        }

        // ⏰ Start cron jobs only in worker 1
        if (cluster.worker && cluster.worker.id === 1) {
          console.log("⏰ Starting cron jobs in worker 1...");
          // StartCronJobs();
        }
      });
    } catch (error) {
      console.error(`❌ Worker ${process.pid} failed to start:`, error);
      process.exit(1);
    }
  };

  startServer();
}