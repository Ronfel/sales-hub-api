/**
 * ERP ficticio com persistencia em db.json (MODO TESTE).
 * Gere/regere com: npm run seed
 * TODO(erp-real): substituir as funcoes erp* por chamadas ao ERP do cliente.
 */
const { loadDb, saveDb } = require("./store");

function db() {
  return loadDb();
}


function erpFindSeller(login, senha) {
  return db().sellers.find((s) => s.login === login && s.senha === senha) || null;
}

function erpSellerExists(sellerId) {
  return db().sellers.some((s) => s.id === sellerId);
}

function toPublicSeller(s) {
  return { id: s.id, empresa: s.empresa, login: s.login, nome: s.nome };
}

function toPublicClient(c) {
  const { sellerId, ...rest } = c;
  return rest;
}

function toPublicAppointment(a) {
  const { sellerId, ...rest } = a;
  return rest;
}

function erpGetSnapshot(sellerId, data) {
  const d = db();
  const sellerClients = d.clients.filter((c) => c.sellerId === sellerId);
  const sellerOrders = d.orders.filter(
    (o) => o.sellerId === sellerId && String(o.createdAt).slice(0, 10) >= data
  );
  const sellerAppointments = d.appointments.filter(
    (a) => a.sellerId === sellerId && String(a.date).slice(0, 10) >= data
  );
  return {
    clients: sellerClients.map(toPublicClient),
    products: [...d.products],
    priceTables: [...d.priceTables],
    paymentConditions: [...d.paymentConditions],
    orders: sellerOrders.map((o) => ({ ...o })),
    appointments: sellerAppointments.map(toPublicAppointment),
    lastSyncedAt: new Date().toISOString()
  };
}

function erpSavePush(sellerId, pedidos, visitasConcluidas) {
  const d = db();
  const seller = d.sellers.find((s) => s.id === sellerId);
  let pedidosCount = 0;
  let visitasCount = 0;
  for (const p of pedidos) {
    const total = (p.items || []).reduce(
      (acc, it) => acc + Number(it.quantity) * Number(it.unitPrice) - Number(it.discount || 0),
      0
    );
    const record = {
      ...p, sellerId,
      sellerName: seller ? seller.nome : (p.sellerName || ""),
      total: Math.round(total * 100) / 100,
      synced: true
    };
    const idx = d.orders.findIndex((o) => o.id === record.id);
    if (idx >= 0) d.orders[idx] = record;
    else d.orders.push(record);
    pedidosCount += 1;
  }
  for (const v of visitasConcluidas) {
    const idx = d.appointments.findIndex((a) => a.id === v.id);
    if (idx >= 0) {
      d.appointments[idx] = { ...d.appointments[idx], ...v, sellerId, status: "Concluída", synced: true };
    } else {
      d.appointments.push({ ...v, sellerId, status: "Concluída", synced: true });
    }
    visitasCount += 1;
  }
  saveDb();
  return { pedidos: pedidosCount, visitas: visitasCount };
}

module.exports = {
  erpFindSeller, erpSellerExists, erpGetSnapshot, erpSavePush, toPublicSeller
};
