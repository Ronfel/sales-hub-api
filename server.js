const { createApp } = require("./src/app");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0"; // obrigatorio no Render/Railway
const app = createApp();

app.listen(PORT, HOST, () => {
  console.log(`sales-hub-api ouvindo em http://${HOST}:${PORT}`);
});
