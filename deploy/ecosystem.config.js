// PM2 processes for the two APIs. Start / reload with:  pm2 startOrReload deploy/ecosystem.config.js
//   visacrm-api    Visa CRM   (abroly_visa_platform_backend, SERVER_PORT 4001, its own database)
//   travelcrm-api  Travel CRM (travel_crm_backend, SERVER_PORT 4002, its own database)
// Each backend forks its own workers (CLUSTER_WORKERS in its .env), so PM2 runs one process each in fork mode.
const fs = require("fs");
const path = require("path");

const api = (name, folder) => ({
    name,
    cwd: path.join(__dirname, "..", folder),
    script: "dist/server.js",
    exec_mode: "fork",
    instances: 1,
    env: { NODE_ENV: "production" },
    max_memory_restart: "900M",
    time: true,
});

module.exports = {
    apps: [
        api("visacrm-api", "abroly_visa_platform_backend"),
        // only once the Travel CRM has been set up (deploy/TRAVEL_CRM_SETUP.md)
        ...(fs.existsSync(path.join(__dirname, "..", "travel_crm_backend", ".env")) ? [api("travelcrm-api", "travel_crm_backend")] : []),
    ],
};
