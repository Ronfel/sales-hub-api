# sales-hub-api — Documentação de Integração para o Salesforce

> Contrato da API para consumo a partir do Salesforce (Apex HTTP Callout, External Services ou MuleSoft).
> Gerado do código-fonte (`src/app.js`, `src/erp.js`, `db.json`) — havendo divergência, o código vale.
> Versão 1.0.0 · 2026-10-16

## 1. Visão geral

API canônica (hub/tradutor) que expõe os dados de força de vendas — clientes, produtos, tabelas de preço, condições de pagamento, pedidos e visitas — para o app de campo e para sistemas externos (Salesforce).

- **Stack:** Node 20 + Express; deploy em Firebase Cloud Functions (região `southamerica-east1`), function única `api`.
- **Padrão:** JSON sobre HTTPS, UTF-8, stateless (sem sessão nem cookies).
- **Operações:** 3 `POST` (`/auth`, `/pull`, `/push`) + `GET /` de saúde.
- **Modo atual:** MODO TESTE, persistindo em `db.json` com dados fictícios. Os marcadores `TODO(erp-real)` apontam o que será trocado por chamadas ao ERP real; **este contrato não muda** com essa troca.

## 2. Ambientes

| Ambiente | URL base |
|---|---|
| Local (dev) | `http://localhost:3000` |
| Produção | `https://southamerica-east1-<SEU_PROJECT>.cloudfunctions.net/api` |

Rotas = URL base + `/auth`, `/pull`, `/push` (ex.: `https://southamerica-east1-multy.cloudfunctions.net/api/auth`).

**Health check (monitoramento):** `GET /` → `200 {"ok":true,"service":"sales-hub-api"}`

## 3. Padrões de comunicação

| Item | Regra |
|---|---|
| Método | `POST` nas 3 operações, corpo JSON |
| Request header | `Content-Type: application/json` **obrigatório** — sem ele o corpo não é interpretado e a resposta é `400` |
| Codificação | UTF-8 |
| Datas | sempre `"YYYY-MM-DD"` (string); timestamp em ISO-8601 (`lastSyncedAt`) |
| Tamanho máximo do corpo | 2 MB |
| Sucesso | `200` + JSON |
| Erro | sempre JSON `{ "message": "..." }` com status `400/401/404/500`, sem stack trace |
| Autorização | **não há header nem token** — ver §4 |
| CORS | **Não afeta o Salesforce** (callout é servidor↔servidor, sem header `Origin`). Só vale para consumo via navegador: origens padrão `http://localhost:4200` e `https://app.seudominio.com.br`, ajustáveis pela env `ALLOWED_ORIGINS` (csv) |

## 4. Autenticação — fluxo em 2 passos

```
1) POST /auth   { login, senha }           → 200 { seller: { id, ... } }
2) POST /pull   { sellerId, data }         → 200 { snapshot }
   POST /push   { sellerId, pedidos, ... } → 200 { ok, gravados }
```

- `/auth` **valida as credenciais e devolve o vendedor** (incluindo o `id`). Use esse `id` como `sellerId` nas chamadas seguintes.
- **A API hoje não emite token nem exige `Authorization`.** `/pull` e `/push` apenas verificam se o `sellerId` existe. Ou seja: o "login" é um passo de contrato, não uma proteção real.
- **Ponto de atenção para a revisão de segurança do Salesforce:** quem souber um `sellerId` acessa `/pull` e `/push` sem se autenticar. Há pendência de implementar **token Bearer**; quando isso acontecer, a única mudança será o header `Authorization: Bearer <token>` (configurável na Named Credential) — **os corpos das requisições não mudam**.

**Credenciais de demonstração (ambiente test):**

| login | senha | sellerId |
|---|---|---|
| `vendedor1` | `1234` | `v001` |
| `vendedor2` | `1234` | `v002` |

> Sempre confirme o `id` retornado pelo `/auth` e use-o como `sellerId` — não assuma o valor.

## 5. Endpoints

### 5.1 POST /auth

**Request**

```json
{ "login": "vendedor1", "senha": "1234" }
```

**Response 200**

```json
{ "seller": { "id": "v001", "empresa": "Multy Demo", "login": "vendedor1", "nome": "Carlos Silva" } }
```

**Erros:** `400 {"message":"Informe login e senha."}` · `401 {"message":"Credenciais inválidas"}`

> A senha nunca é devolvida. O campo `email` existe na base mas **ainda não é exposto** nesta resposta (pendência — ver §10).

### 5.2 POST /pull

**Request**

```json
{ "sellerId": "v001", "data": "2026-10-12" }
```

| Campo | Obrig | Descrição |
|---|---|---|
| `sellerId` | sim | carteira do vendedor (retornado por `/auth`) |
| `data` | sim | `YYYY-MM-DD` — corte **incremental**: retorna `orders` com `createdAt >= data` e `appointments` com `date >= data`. `clients`, `products`, `priceTables` e `paymentConditions` vêm **completos** (não filtrados por data) |

**Response 200** (exemplo com 1 registro por coleção):

```json
{
  "snapshot": {
    "clients": [
      { "id": "c001", "personType": "Jurídica", "name": "Padaria Aurora", "document": "11.428.108/0001-71", "inscricaoEstadual": "694654894", "email": "padariaaurora@empresa.com.br", "phone": "(11) 3838-9150", "city": "São Bernardo do Campo", "state": "SP", "address": "Rua do Comércio, 7530", "priceTableId": "t1", "paymentConditionId": "p2", "createdAt": "2026-10-01", "synced": true }
    ],
    "products": [
      { "id": "p001", "sku": "SKU-001", "name": "Café Torrado 500g", "category": "Alimentos", "price": 18.9, "stock": 257 }
    ],
    "priceTables": [
      { "id": "t1", "code": "TAB01", "name": "Atacado", "discountPercent": 10 }
    ],
    "paymentConditions": [
      { "id": "p1", "code": "AVISTA", "name": "À vista", "days": 0 }
    ],
    "orders": [
      { "id": "o053", "clientId": "c037", "clientName": "Vanessa Martins", "sellerId": "v001", "sellerName": "Carlos Silva", "priceTableId": "t1", "paymentConditionId": "p2", "createdAt": "2026-09-15", "items": [ { "productId": "p022", "productName": "Fralda Infantil M 32un", "quantity": 3, "unitPrice": 42.9, "neededDate": "2026-09-20", "discount": 0 } ], "status": "Pendente", "total": 128.7, "synced": true }
    ],
    "appointments": [
      { "id": "a021", "clientId": "c045", "clientName": "Patrícia Dias", "date": "2026-10-12", "time": "08:00", "address": "Travessa das Palmeiras, 1550", "status": "Agendada", "synced": true }
    ],
    "lastSyncedAt": "2026-10-16T12:00:00.000Z"
  }
}
```

> Em produção a base tem ~50 clientes, 30 produtos, 3 tabelas, 6 condições e os pedidos/visitas desde `data`.
> Campos `sellerId` de `clients` e `appointments` são **removidos** na resposta (escopo por carteira). Use `lastSyncedAt` como marca da última sincronização.

**Erros (todos `400`):** `Informe sellerId.` · `Informe data no formato YYYY-MM-DD.` · `sellerId desconhecido.`

### 5.3 POST /push

**Request (exemplo completo)**

```json
{
  "sellerId": "v001",
  "pedidos": [
    {
      "id": "ped-teste-001",
      "clientId": "c001",
      "createdAt": "2026-10-12",
      "priceTableId": "t1",
      "paymentConditionId": "p2",
      "items": [
        { "productId": "p001", "quantity": 2, "unitPrice": 18.9, "discount": 0, "neededDate": "2026-10-18" }
      ]
    }
  ],
  "visitasConcluidas": [
    { "id": "a-teste-001", "clientId": "c001", "date": "2026-10-12", "time": "10:00", "address": "Rua do Comércio, 7530" }
  ]
}
```

**Campos de `pedidos[]`:**

| Campo | Tipo | Obrig | Observação |
|---|---|---|---|
| `id` | string | sim | chave de **upsert** — reenviar o mesmo `id` atualiza o pedido |
| `clientId` | string | sim | id de cliente existente |
| `items` | array | sim | ao menos 1 item |
| `items[].productId` | string | sim | id de produto existente |
| `items[].quantity` | number | sim | > 0 |
| `items[].unitPrice` | number | sim | preço unitário |
| `items[].discount` | number | não | desconto do item (padrão 0) |
| `createdAt` | string | não* | ***recomendado** — sem `createdAt` o pedido não aparece em pulls futuros (filtro por `data`) |
| `priceTableId`, `paymentConditionId`, `status`, `clientName`, `productName`, `neededDate` | string | não | gravados como enviados |
| `total`, `synced`, `sellerId`, `sellerName` | — | ignorados | definidos pela API (`total = Σ(qtd×preço) − desconto`, 2 casas; `synced = true`) |

**Campos de `visitasConcluidas[]`:**

| Campo | Tipo | Obrig | Observação |
|---|---|---|---|
| `id` | string | sim | chave de upsert |
| `clientId` | string | sim | id de cliente existente |
| `date`, `time`, `address`, `clientName` | string | não | recomendados |
| `status`, `synced` | — | ignorados | API grava `status: "Concluída"` e `synced: true` |

**Response 200**

```json
{ "ok": true, "gravados": { "pedidos": 1, "visitas": 1 } }
```

**Erros (`400`):** `Informe sellerId.` · `Informe pedidos como array.` · `Informe visitasConcluidas como array.` · `sellerId desconhecido.` · `Pedido inválido: id, clientId e items são obrigatórios.` · `Item de pedido inválido: productId, quantity e unitPrice são obrigatórios.` · `Visita inválida: id e clientId são obrigatórios.`

### 5.4 GET / (saúde)

`200 {"ok":true,"service":"sales-hub-api"}` — usar em monitoramento.

## 6. Estruturas de dados

IDs são strings estáveis (`c001`, `p001`, `t1`, `p1`, `o053`, `a021`...).

**Seller** (retorno do `/auth`)

| Campo | Tipo |
|---|---|
| `id` | string |
| `empresa` | string |
| `login` | string |
| `nome` | string |

**Client** (`sellerId` removido no pull)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | |
| `personType` | string | `"Física"` ou `"Jurídica"` |
| `name` | string | |
| `document` | string | CPF/CNPJ |
| `inscricaoEstadual` | string | |
| `email`, `phone` | string | |
| `city`, `state`, `address` | string | |
| `priceTableId` | string | referência a PriceTable |
| `paymentConditionId` | string | referência a PaymentCondition |
| `createdAt` | string | `YYYY-MM-DD` |
| `synced` | boolean | |

**Product**

| Campo | Tipo |
|---|---|
| `id`, `sku`, `name`, `category` | string |
| `price` | number |
| `stock` | number |

**PriceTable**

| Campo | Tipo |
|---|---|
| `id`, `code`, `name` | string |
| `discountPercent` | number |

**PaymentCondition**

| Campo | Tipo |
|---|---|
| `id`, `code`, `name` | string |
| `days` | number (dias) |

**Order**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | chave de upsert no push |
| `clientId`, `clientName` | string | |
| `sellerId`, `sellerName` | string | carteira do vendedor |
| `priceTableId` | string | referência a PriceTable |
| `paymentConditionId` | string | referência a PaymentCondition |
| `createdAt` | string | `YYYY-MM-DD` |
| `items` | OrderItem[] | |
| `status` | string | ex.: `"Pendente"`, `"Enviado"` |
| `total` | number | calculado pela API |
| `synced` | boolean | |

**OrderItem**

| Campo | Tipo |
|---|---|
| `productId`, `productName` | string |
| `quantity` | number |
| `unitPrice` | number |
| `neededDate` | string (`YYYY-MM-DD`) |
| `discount` | number |

**Appointment** (`sellerId` removido no pull)

| Campo | Tipo | Descrição |
|---|---|---|
| `id`, `clientId`, `clientName` | string | |
| `date` | string | `YYYY-MM-DD` |
| `time` | string | `HH:MM` |
| `address` | string | |
| `status` | string | `"Agendada"`, `"Concluída"` |
| `synced` | boolean | |

## 7. Erros — resumo

| Status | Quando | Body |
|---|---|---|
| 400 | corpo/campo inválido (ver tabelas da §5) | `{ "message": "..." }` |
| 401 | `/auth` com credenciais erradas | `{ "message": "Credenciais inválidas" }` |
| 404 | rota inexistente | `{ "message": "Rota não encontrada." }` |
| 500 | falha inesperada | `{ "message": "Erro interno." }` |

> Nunca há stack trace. Trate qualquer `status >= 300` lendo o `message` do corpo.

## 8. No Salesforce — notas práticas

### 8.1 Named Credential

- Setup → Named Credential → **Nova**: URL base do ambiente (ex.: `https://...cloudfunctions.net/api`), autenticação **No Authentication** (a API não exige header hoje).
- Quando existir token Bearer: mudar para header `Authorization` — **nenhuma mudança nos corpos** das requisições.
- CORS não precisa de tratativa: callout do Salesforce é servidor↔servidor e não envia `Origin`.

### 8.2 Exemplo Apex (auth → pull → push)

```apex
public with sharing class SalesHubClient {
    // Named Credential "SalesHubApi" apontando para a URL base da API
    private static final String BASE = 'callout:SalesHubApi';

    public static Map<String, Object> auth(String login, String senha) {
        HttpResponse r = post('/auth', new Map<String, Object>{ 'login' => login, 'senha' => senha });
        Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(r.getBody());
        return (Map<String, Object>) root.get('seller'); // { id, empresa, login, nome }
    }

    public static Map<String, Object> pull(String sellerId, String data) {
        // data = 'YYYY-MM-DD'
        HttpResponse r = post('/pull', new Map<String, Object>{ 'sellerId' => sellerId, 'data' => data });
        Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(r.getBody());
        return (Map<String, Object>) root.get('snapshot');
    }

    public static Map<String, Object> push(String sellerId, List<Object> pedidos, List<Object> visitas) {
        HttpResponse r = post('/push', new Map<String, Object>{
            'sellerId' => sellerId,
            'pedidos' => pedidos,
            'visitasConcluidas' => visitas
        });
        return (Map<String, Object>) JSON.deserializeUntyped(r.getBody()); // { ok, gravados }
    }

    private static HttpResponse post(String path, Object body) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(BASE + path);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(30000);
        req.setBody(JSON.serialize(body));
        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() >= 300) { // corpo sempre { "message": "..." }
            throw new CalloutException('sales-hub-api ' + res.getStatusCode() + ': ' + res.getBody());
        }
        return res;
    }
}
```

### 8.3 Limites e boas práticas

- **Governor limits:** 100 callouts por transação; timeout máximo de 120 s (use 30 s — a API responde em milissegundos).
- **Retry:** `/auth` e `/pull` não têm efeito colateral (retry livre); `/push` é upsert por `id` — retry seguro, não duplica.
- **Incremental:** guarde a última `data` sincronizada (ou `snapshot.lastSyncedAt`) e use como parâmetro do próximo pull.
- **Volume:** o snapshot atual é pequeno (ordem de dezenas/centenas de KB) e cabe folgado nos limites de callout/heap; se a base crescer, avaliar paginação (futuro).
- **Envio:** corpo máximo de 2 MB no `/push`.

### 8.4 Mapeamento sugerido para objetos Salesforce

| Entidade da API | Objeto Salesforce |
|---|---|
| `clients` | Account (ou Person Account / Lead) |
| `products` | Product2 |
| `priceTables` | Pricebook2 |
| `paymentConditions` | Custom Metadata ou picklist |
| `orders` | Order (ou custom `Pedido__c`) |
| `appointments` | Event (ou custom `Visita__c`) |
| `seller` | User / Custom Permission — guarde `seller.id` na sessão |

### 8.5 Sequência de sincronização recomendada

1. `/auth` no login do usuário → guarde `seller.id`.
2. `/pull` com `data` = última data sincronizada.
3. Mapear o `snapshot` para os objetos Salesforce.
4. `/push` com pedidos/visitas pendentes de envio.
5. Repetir via Scheduled Apex (ex.: a cada 15–60 min).

## 9. Exemplos prontos (validação fora do Salesforce)

PowerShell — mesmos do `README.md`:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth -ContentType "application/json" -Body '{"login":"vendedor1","senha":"1234"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/pull -ContentType "application/json" -Body '{"sellerId":"v001","data":"2026-10-12"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/push -ContentType "application/json" -Body '{"sellerId":"v001","pedidos":[{"id":"ped-teste-001","clientId":"c001","createdAt":"2026-10-12","items":[{"productId":"p001","quantity":2,"unitPrice":19.9}]}],"visitasConcluidas":[{"id":"a-teste-001","clientId":"c001","date":"2026-10-12"}]}'
```

cURL:

```bash
curl -X POST http://localhost:3000/auth -H "Content-Type: application/json" -d '{"login":"vendedor1","senha":"1234"}'
curl -X POST http://localhost:3000/pull -H "Content-Type: application/json" -d '{"sellerId":"v001","data":"2026-10-12"}'
curl -X POST http://localhost:3000/push -H "Content-Type: application/json" -d '{"sellerId":"v001","pedidos":[{"id":"ped-teste-001","clientId":"c001","createdAt":"2026-10-12","items":[{"productId":"p001","quantity":2,"unitPrice":19.9}]}],"visitasConcluidas":[{"id":"a-teste-001","clientId":"c001","date":"2026-10-12"}]}'
```

## 10. Pendências conhecidas (transparência)

1. **Token Bearer** em `/pull` e `/push` — hoje não há proteção real (relevante para a revisão de segurança).
2. **Expor `email`** do vendedor no `/auth` — o campo já existe na base (seed/db.json), mas não é retornado.
3. **ERP real** — substituição do `db.json` (marcadores `TODO(erp-real)`); o contrato permanece.
4. **OpenAPI/Swagger** ainda não existe — este documento é o contrato. Se preferirem importar como External Service no Salesforce, podemos gerar um `openapi.yaml` equivalente.




