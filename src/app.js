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
const defaultOrigins = ["http://localhost:4200", "https://app.seudominio.com.br"];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const origins = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;

function isValidDateYYYYMMDD(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

function createApp() {
  const app = express();

  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: "2mb" }));

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

  // ---------------------------------------------------------- 2) POST /pull
  app.post("/pull", (req, res) => {
    const { sellerId, data } = req.body || {};
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
  });

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
