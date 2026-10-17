/**
 * Persistencia em db.json (MODO TESTE).
 * Carrega uma vez (cache) e salva no disco a cada push.
 * Em host gratuito (Render/Railway) o disco e efemero: se db.json nao
 * existir (primeiro boot), gera automaticamente via scripts/seed.js.
 * TODO(erp-real): remover este modulo e chamar o ERP de verdade em src/erp.js.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "db.json");

let cache = null;

function ensureDbExists() {
  if (fs.existsSync(DB_PATH)) return;
  try {
    console.log(`[store] db.json nao encontrado em ${DB_PATH}, gerando seed...`);
    execSync("node scripts/seed.js", {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      env: { ...process.env, DB_PATH },
    });
  } catch (e) {
    console.error("[store] falha ao gerar seed automatico:", e.message);
  }
}

function loadDb() {
  if (!cache) {
    ensureDbExists();
    const raw = fs.readFileSync(DB_PATH, "utf8");
    cache = JSON.parse(raw);
  }
  return cache;
}

function saveDb() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    // Disco somente-leitura / efemero: nao derruba o push em producao.
    console.error("[store] aviso: nao consegui persistir db.json:", e.message);
  }
}

module.exports = { loadDb, saveDb, DB_PATH };
