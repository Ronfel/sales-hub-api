# sales-hub-api — API canônica (hub/tradutor) p/ app de força de vendas

Stack: Node 20 + Express + CORS. Deploy: Firebase Cloud Functions
(região `southamerica-east1`), function única `api` (todas as rotas).

## Endpoints (JSON; datas em "YYYY-MM-DD")

- `POST /auth` → `{ login, senha }` → `{ seller: { id, empresa, login, nome } }` | 401 `{ message: "Credenciais inválidas" }`
- `GET /pull?sellerId=v001&data=YYYY-MM-DD` → `{ snapshot: SalesSnapshot }` (POST /pull com corpo `{ sellerId, data }` mantido como alias depreciado)
- `POST /push` → `{ sellerId, pedidos, visitasConcluidas }` → `{ ok: true, gravados: { pedidos, visitas } }`

Erros: sempre JSON `{ message }` (400/401/404/500). Sem stack em produção.

Documentação de integração para o Salesforce: [`docs/INTEGRACAO_SALESFORCE.md`](docs/INTEGRACAO_SALESFORCE.md).

## Rodar local

```powershell
cd P:\Node\sales-hub-api
npm install
npm run seed  # gera db.json: 50 clientes, 100 pedidos, 3 tabelas, 6 condicoes, 30 produtos, 40 visitas
npm start   # http://localhost:3000
```

> `npm run seed` é determinístico (gera sempre a mesma base). O `push` salva no
> `db.json`, então os dados sobrevivem ao restart. Para voltar ao zero, rode o seed de novo.

Teste rápido (PowerShell):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth -ContentType "application/json" -Body '{"login":"vendedor1","senha":"1234"}'
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/pull?sellerId=v001&data=2026-10-12"
Invoke-RestMethod -Method Post -Uri http://localhost:3000/push -ContentType "application/json" -Body '{"sellerId":"v001","pedidos":[{"id":"ped-teste-001","clientId":"c001","createdAt":"2026-10-12","items":[{"productId":"p001","quantity":2,"unitPrice":19.9}]}],"visitasConcluidas":[{"id":"a-teste-001","clientId":"c001","date":"2026-10-12"}]}'
```

## Deploy (Functions)

1. `npm i -g firebase-tools` e `firebase login`
2. Edite `.firebaserc` com seu `project_id`
3. `firebase deploy --only functions`
4. URL: `https://southamerica-east1-SEU_PROJECT.cloudfunctions.net/api/auth` (idem `/pull`, `/push`)

CORS: origens padrão `http://localhost:4200` + produção placeholder.
Defina `ALLOWED_ORIGINS="http://localhost:4200,https://app.seudominio.com.br"` (csv) para liberar o domínio real.

## ERP real (TODO)

- `src/erp.js`: `erpFindSeller`, `erpGetSnapshot`, `erpSavePush` — trocar o array em memória por chamadas ao ERP.
- `src/app.js`: pontos `TODO(erp-real)` marcando cada integração.
