// PM2 process for the API. Start / reload with:  pm2 startOrReload deploy/ecosystem.config.js
// The backend forks its own workers (CLUSTER_WORKERS in abroly_visa_platform_backend/.env),
// so PM2 runs a single process in fork mode.
module.exports = {
    apps: [
        {
            name: "visacrm-api",
            cwd: __dirname + "/../abroly_visa_platform_backend",
            script: "dist/server.js",
            exec_mode: "fork",
            instances: 1,
            env: { NODE_ENV: "production", DISABLE_DAILY_DIGEST: "true" },
            max_memory_restart: "900M",
            time: true,
        },
    ],
};
