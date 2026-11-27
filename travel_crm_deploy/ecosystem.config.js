// PM2 process for the Travel CRM API. Start / reload with:  pm2 startOrReload deploy/ecosystem.config.js
// The backend forks its own workers (CLUSTER_WORKERS in travel_crm_backend/.env), so PM2 runs one process in fork mode.
// The Visa CRM runs separately (/opt/visacrm, PM2 process visacrm-api, port 4001).
module.exports = {
    apps: [
        {
            name: "travelcrm-api",
            cwd: __dirname + "/../travel_crm_backend",
            script: "dist/server.js",
            exec_mode: "fork",
            instances: 1,
            env: { NODE_ENV: "production" },
            max_memory_restart: "900M",
            time: true,
        },
    ],
};
