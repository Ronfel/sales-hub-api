/**
 * Seed da base ficticia (db.json) — MODO TESTE.
 * Deterministico: mesmo resultado a cada execucao.
 * Uso: npm run seed
 */
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "db.json");

function makeRand(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makeRand(20261012);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pad = (n, w) => String(n).padStart(w, "0");
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
function addDays(base, days) {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const cnpj = () => `${pad(int(10, 99), 2)}.${pad(int(100, 999), 3)}.${pad(int(100, 999), 3)}/0001-${pad(int(10, 99), 2)}`;
const cpf = () => `${pad(int(100, 999), 3)}.${pad(int(100, 999), 3)}.${pad(int(100, 999), 3)}-${pad(int(10, 99), 2)}`;

// ------------------------------------------------------------- vendedores
const sellers = [
  { id: "v001", empresa: "Multy Demo", login: "vendedor1", senha: "1234", nome: "Carlos Silva", email: "carlos.silva@multydemo.com.br" },
  { id: "v002", empresa: "Multy Demo", login: "vendedor2", senha: "1234", nome: "Ana Souza", email: "ana.souza@multydemo.com.br" }
];

// ---------------------------------------------------------- tabelas (3)
const priceTables = [
  { id: "t1", code: "TAB01", name: "Atacado", discountPercent: 10 },
  { id: "t2", code: "TAB02", name: "Varejo", discountPercent: 0 },
  { id: "t3", code: "TAB03", name: "Promocional", discountPercent: 15 }
];

// ------------------------------------------------------ condicoes (6)
const paymentConditions = [
  { id: "p1", code: "AVISTA", name: "À vista", days: 0 },
  { id: "p2", code: "7DD", name: "7 dias", days: 7 },
  { id: "p3", code: "14DD", name: "14 dias", days: 14 },
  { id: "p4", code: "30DD", name: "30 dias", days: 30 },
  { id: "p5", code: "3060", name: "30/60 dias", days: 45 },
  { id: "p6", code: "90DD", name: "90 dias", days: 90 }
];

// ---------------------------------------------------------- clientes (50)
const cities = ["São Paulo", "Guarulhos", "Osasco", "Santo André", "São Bernardo do Campo", "Barueri", "Carapicuíba", "Itaquaquecetuba", "Suzano", "Diadema"];
const streets = ["Rua das Flores", "Av. Paulista", "Rua XV de Novembro", "Av. Brasil", "Rua do Comércio", "Av. Central", "Rua São José", "Travessa das Palmeiras", "Av. Independência", "Rua Projetada"];
const bizKinds = ["Padaria", "Mercado", "Mercearia", "Lanchonete", "Restaurante", "Empório", "Açougue", "Hortifruti", "Pet Shop", "Papelaria", "Farmácia", "Bar", "Cafeteria", "Sorveteria", "Pizzaria", "Quitanda", "Doceria", "Churrascaria", "Sacolão", "Conveniência"];
const bizNames = ["Pão Dourado", "Bom Preço", "Estrela", "Central", "São José", "Santa Maria", "Boa Vista", "Primavera", "Vitória", "Progresso", "Aurora", "Esperança", "União", "Liberdade", "Cruzeiro", "Ipiranga", "Paulista", "Bela Vista", "Jardim Sul", "Vila Nova", "Santa Rosa", "São Lucas", "Monte Alto", "Vale Verde", "Porto Seguro", "Recanto", "Tradição", "Fartura", "Sabor & Cia", "Ponto Certo"];
const firstNames = ["João", "Maria", "José", "Ana", "Paulo", "Fernanda", "Ricardo", "Juliana", "Marcos", "Patrícia", "Lucas", "Camila", "Thiago", "Beatriz", "Rafael", "Larissa", "Diego", "Vanessa", "André", "Priscila"];
const lastNames = ["Pereira", "Santos", "Oliveira", "Souza", "Costa", "Almeida", "Carvalho", "Ferreira", "Rodrigues", "Gomes", "Martins", "Araújo", "Barbosa", "Cardoso", "Teixeira", "Moreira", "Correia", "Dias", "Nogueira", "Pinto"];

function makeClient(name, personType) {
  const idx = clients.length;
  const juridica = personType === "Jurídica";
  return {
    id: "c" + pad(idx + 1, 3),
    sellerId: idx % 5 < 3 ? "v001" : "v002",
    personType,
    name,
    document: juridica ? cnpj() : cpf(),
    inscricaoEstadual: juridica ? String(int(100000000, 999999999)) : "",
    email: `${slug(name)}@${juridica ? "empresa.com.br" : "email.com"}`,
    phone: juridica
      ? `(11) 3${pad(int(100, 999), 3)}-${pad(int(1000, 9999), 4)}`
      : `(11) 9${pad(int(1000, 9999), 4)}-${pad(int(1000, 9999), 4)}`,
    city: pick(cities),
    state: "SP",
    address: `${pick(streets)}, ${int(10, 9999)}`,
    priceTableId: pick(["t1", "t2", "t3"]),
    paymentConditionId: pick(["p1", "p2", "p3", "p4", "p5", "p6"]),
    createdAt: addDays("2026-09-01", int(0, 30)),
    synced: true
  };
}

const clients = [];
const usedClientNames = new Set();
let kindSeq = 0;
while (clients.filter((c) => c.personType === "Jurídica").length < 30) {
  const name = `${bizKinds[kindSeq % bizKinds.length]} ${bizNames[int(0, bizNames.length - 1)]}`;
  kindSeq += 1;
  if (usedClientNames.has(name)) continue;
  usedClientNames.add(name);
  clients.push(makeClient(name, "Jurídica"));
}
while (clients.length < 50) {
  const name = `${pick(firstNames)} ${pick(lastNames)}`;
  if (usedClientNames.has(name)) continue;
  usedClientNames.add(name);
  clients.push(makeClient(name, "Física"));
}

// ---------------------------------------------------------- produtos (30)
const productBase = [
  ["Café Torrado 500g", "Alimentos", 18.9], ["Açúcar Refinado 1kg", "Alimentos", 5.49],
  ["Óleo de Soja 900ml", "Alimentos", 7.99], ["Arroz Branco 5kg", "Alimentos", 24.9],
  ["Feijão Carioca 1kg", "Alimentos", 8.49], ["Macarrão Espaguete 500g", "Alimentos", 4.29],
  ["Farinha de Trigo 1kg", "Alimentos", 5.99], ["Leite UHT Integral 1L", "Bebidas", 5.79],
  ["Refrigerante Cola 2L", "Bebidas", 9.99], ["Suco de Laranja 1L", "Bebidas", 7.49],
  ["Água Mineral 500ml", "Bebidas", 2.49], ["Cerveja Pilsen 350ml", "Bebidas", 3.99],
  ["Detergente Neutro 500ml", "Limpeza", 2.99], ["Sabão em Pó 800g", "Limpeza", 11.9],
  ["Desinfetante 2L", "Limpeza", 8.9], ["Água Sanitária 1L", "Limpeza", 3.49],
  ["Esponja Multiuso 3un", "Limpeza", 4.99], ["Sabonete Cremoso 90g", "Higiene", 2.79],
  ["Shampoo 350ml", "Higiene", 14.9], ["Creme Dental 90g", "Higiene", 6.49],
  ["Papel Higiênico 12 rolos", "Higiene", 19.9], ["Fralda Infantil M 32un", "Higiene", 42.9],
  ["Ração Cães Adultos 10kg", "Pet", 89.9], ["Areia Sanitária Gatos 4kg", "Pet", 24.9],
  ["Biscoito Recheado 130g", "Mercearia", 3.29], ["Chocolate ao Leite 90g", "Mercearia", 6.99],
  ["Salgadinho Milho 140g", "Mercearia", 7.49], ["Azeite Extra Virgem 500ml", "Mercearia", 32.9],
  ["Molho de Tomate 340g", "Mercearia", 3.99], ["Milho Verde 200g", "Mercearia", 4.49]
];

const products = productBase.map(([name, category, price], i) => ({
  id: "p" + pad(i + 1, 3),
  sku: "SKU-" + pad(i + 1, 3),
  name,
  category,
  price,
  stock: int(20, 500)
}));

// ----------------------------------------------------------- pedidos (100)
const orderStatuses = ["Pendente", "Em separação", "Enviado", "Entregue"];

const orders = [];
for (let i = 0; i < 100; i++) {
  const client = pick(clients);
  const seller = sellers.find((s) => s.id === client.sellerId);
  const createdAt = addDays("2026-09-15", int(0, 27));
  const items = [];
  const nItems = int(1, 4);
  for (let j = 0; j < nItems; j++) {
    const prod = pick(products);
    items.push({
      productId: prod.id,
      productName: prod.name,
      quantity: int(1, 20),
      unitPrice: prod.price,
      neededDate: addDays(createdAt, int(1, 7)),
      discount: rand() < 0.3 ? Math.round(prod.price * 0.05 * 100) / 100 : 0
    });
  }
  const total = Math.round(items.reduce((a, it) => a + it.quantity * it.unitPrice - (it.discount || 0), 0) * 100) / 100;
  orders.push({
    id: "o" + pad(i + 1, 3),
    clientId: client.id,
    clientName: client.name,
    sellerId: client.sellerId,
    sellerName: seller.nome,
    priceTableId: client.priceTableId,
    paymentConditionId: client.paymentConditionId,
    createdAt,
    items,
    status: orderStatuses[i % orderStatuses.length],
    total,
    synced: true
  });
}
orders.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

// ------------------------------------------------------- agendamentos (40)
const appointments = [];
for (let i = 0; i < 40; i++) {
  const client = pick(clients);
  const date = addDays("2026-10-12", int(0, 14));
  appointments.push({
    id: "a" + pad(i + 1, 3),
    sellerId: client.sellerId,
    clientId: client.id,
    clientName: client.name,
    date,
    time: `${pad(int(8, 17), 2)}:${pick(["00", "15", "30", "45"])}`,
    address: client.address,
    status: i < 28 ? "Agendada" : "Concluída",
    synced: true
  });
}
appointments.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

// --------------------------------------------------------------- saida
const db = { sellers, clients, products, priceTables, paymentConditions, orders, appointments };
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
console.log(`db.json gerado em ${DB_PATH}: ` +
  `${clients.length} clientes, ${orders.length} pedidos, ${products.length} produtos, ` +
  `${priceTables.length} tabelas, ${paymentConditions.length} condicoes, ${appointments.length} visitas.`);
