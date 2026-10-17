const { onRequest } = require("firebase-functions/v2/https");
const { createApp } = require("./src/app");

const app = createApp();

// Unica function HTTP — atende /auth, /pull e /push.
exports.api = onRequest({ region: "southamerica-east1" }, app);
