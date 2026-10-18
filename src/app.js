const express = require("express");
const cors = require("cors");
const {
  erpFindSeller,
  erpSellerExists,
  erpGetSnapshot,
  erpSavePush,
  toPublicSeller
} = require("./erp");

// Origens liberadas: localhost (dev) + producao via env ALLOWED_ORIGINS (csv).
// Ex.: ALLOWED_ORIGINS="http://localhost:4200,https://app.seudominio.com.br"
// A origem do app hospedado no Firebase Hosting (7salesforce) fica nas defaults
// para funcionar mesmo sem a env setada no Render.
// Normaliza origem p/ comparacao exata do CORS: sem espacos e sem "/" final.
// O header `Origin` do navegador nunca tem barra final
// ("https://7salesforce.web.app"), entao "https://7salesforce.web.app/"
// (com barra, ex. copiada da URL) NUNCA daria match e causaria HTTP 0.
const normalizeOrigin = (o) => String(o || "").trim().replace(/\/+$/, "");
const defaultOrigins = [
  "http://localhost:4200",
  "https://7salesforce.web.app",
  "https://7salesforce.firebaseapp.com",
  "https://app.seudominio.com.br"
].map(normalizeOrigin).filter(Boolean);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => normalizeOrigin(s))
  .filter(Boolean);
// União (defaults do app ∪ env ALLOWED_ORIGINS): uma env antiga/esquecida no
// Render nunca mais consegue remover a origem do app da lista e derrubar o
// CORS em producao (HTTP 0 no navegador).
const origins = [...new Set([...defaultOrigins, ...allowedOrigins])];

function isValidDateYYYYMMDD(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

function createApp() {
  const app = express();

  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: "2mb" }));

  // Diagnóstico no boot: imprime no Log do Render quais origens o CORS aceita
  // (se a lista estiver errada, o navegador responde HTTP 0 sem corpo).
  console.log(`[cors] origens permitidas: ${origins.join(", ")}`);

  // Saude (fora do contrato do app; util p/ deploy/emulador).
  app.get("/", (req, res) => res.json({ ok: true, service: "sales-hub-api" }));

  // ---------------------------------------------------------- 1) POST /auth
  app.post("/auth", (req, res) => {
    const { login, senha } = req.body || {};
    if (!login || !senha) {
      return res.status(400).json({ message: "Informe login e senha." });
    }
    // TODO(erp-real): validar contra o cadastro do ERP.
    const seller = erpFindSeller(String(login), String(senha));
    if (!seller) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    return res.json({ seller: toPublicSeller(seller) }); // NUNCA devolve senha
  });

  // ---------------------------------------------------------- 2) GET /pull
  // Leitura idempotente (snapshot da carteira): método correto é GET com query params.
  // Ex.: GET /pull?sellerId=v001&data=2026-10-12
  // Mantido POST /pull como alias depreciado p/ compatibilidade com clientes antigos.
  function handlePull(req, res) {
    const sellerId = (req.query && req.query.sellerId) || (req.body && req.body.sellerId);
    const data = (req.query && req.query.data) || (req.body && req.body.data);
    if (!sellerId) {
      return res.status(400).json({ message: "Informe sellerId." });
    }
    if (!isValidDateYYYYMMDD(data)) {
      return res.status(400).json({ message: "Informe data no formato YYYY-MM-DD." });
    }
    if (!erpSellerExists(String(sellerId))) {
      return res.status(400).json({ message: "sellerId desconhecido." });
    }
    // TODO(erp-real): filtrar no ERP por sellerId (carteira) e data.
    const snapshot = erpGetSnapshot(String(sellerId), String(data));
    return res.json({ snapshot });
  }
  app.get("/pull", handlePull);
  // Alias depreciado: aceita POST p/ não quebrar clientes antigos (Salesforce/app).
  // Novos clientes devem usar GET /pull?sellerId=...&data=YYYY-MM-DD.
  app.post("/pull", handlePull);

  // ---------------------------------------------------------- 3) POST /push
  app.post("/push", (req, res) => {
    const { sellerId, pedidos, visitasConcluidas } = req.body || {};
    if (!sellerId) {
      return res.status(400).json({ message: "Informe sellerId." });
    }
    if (!Array.isArray(pedidos)) {
      return res.status(400).json({ message: "Informe pedidos como array." });
    }
    if (!Array.isArray(visitasConcluidas)) {
      return res.status(400).json({ message: "Informe visitasConcluidas como array." });
    }
    if (!erpSellerExists(String(sellerId))) {
      return res.status(400).json({ message: "sellerId desconhecido." });
    }

    for (const p of pedidos) {
      if (!p || !p.id || !p.clientId || !Array.isArray(p.items) || p.items.length === 0) {
        return res.status(400).json({ message: "Pedido inválido: id, clientId e items são obrigatórios." });
      }
      for (const it of p.items) {
        if (
          !it || !it.productId ||
          !Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0 ||
          !Number.isFinite(Number(it.unitPrice))
        ) {
          return res.status(400).json({ message: "Item de pedido inválido: productId, quantity e unitPrice são obrigatórios." });
        }
      }
    }
    for (const v of visitasConcluidas) {
      if (!v || !v.id || !v.clientId) {
        return res.status(400).json({ message: "Visita inválida: id e clientId são obrigatórios." });
      }
    }

    // TODO(erp-real): gravar no ERP e marcar como sincronizados no ERP.
    const gravados = erpSavePush(String(sellerId), pedidos, visitasConcluidas);
    return res.json({ ok: true, gravados });
  });

  // 404 JSON para qualquer outra rota.
  app.use((req, res) => res.status(404).json({ message: "Rota não encontrada." }));

  // Erro generico: sempre JSON, sem stack em producao.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
      console.error(err);
    }
    const status = err && err.status ? err.status : 500;
    return res.status(status).json({ message: status === 500 ? "Erro interno." : (err.message || "Erro.") });
  });

  return app;
}

module.exports = { createApp, allowedOrigins: origins };
