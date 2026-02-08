# Tambo Lens

**An Intent-Driven Generative Analytics Layer for Existing Business Databases**

Tambo Lens is a plug-and-play AI interface that sits on top of your existing databases. Connect your PostgreSQL, MySQL, or MongoDB databases and explore, analyse, and visualize data using natural language — no SQL or dashboard-building required.

## Architecture

```
Frontend (React + Tambo SDK)
 ├─ Conversational UI (Analytics Chat)
 ├─ Generative UI Components (shadcn/ui)
 │   ├─ KPICard, MetricGrid
 │   ├─ DataTable
 │   ├─ BarChart, LineChart, PieChart
 │   └─ SummaryCard
 └─ Dashboard Persistence

Backend (Next.js API Routes)
 ├─ Data Source Management (CRUD + encrypted credentials)
 ├─ Schema Introspection Engine
 ├─ Permission Engine (table-level authorization)
 ├─ Query Guardrails Pipeline (validation + enforcement)
 └─ Query Execution (read-only, auto-LIMIT)

Tambo SDK
 ├─ BYOC Component Registry (7 GenUI components)
 ├─ Tool Registration (run_select_query, describe_table, list_tables)
 ├─ Streaming Responses
 └─ Context Helpers (instructions, time, platform)
```

## Tech Stack

| Layer             | Technology                     |
| ----------------- | ------------------------------ |
| Framework         | Next.js 16 (App Router)        |
| Language          | TypeScript                     |
| Styling           | Tailwind CSS v4                |
| Component System  | shadcn/ui                      |
| Generative UI     | Tambo SDK (`@tambo-ai/react`)  |
| Schema Validation | Zod                            |
| Charts            | Recharts (via shadcn/ui chart) |
| Database Driver   | pg (node-postgres)             |
| Encryption        | AES-256-GCM                    |
| Icons             | Lucide React                   |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (for internal metadata storage)
- A Tambo AI API key ([get one at tambo.co](https://tambo.co))

### 1. Install Dependencies

```bash
cd tambo-lens
npm install
```

### 2. Configure Environment

Edit `.env.local`:

```env
# Tambo AI SDK key
NEXT_PUBLIC_TAMBO_API_KEY=your_tambo_api_key

# Internal PostgreSQL for metadata storage
DATABASE_URL=postgresql://postgres:password@localhost:5432/tambo_lens

# 32-byte hex encryption key for credential vault
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### 3. Initialize Internal Database

Create the `tambo_lens` database in PostgreSQL:

```sql
CREATE DATABASE tambo_lens;
```

Then initialize the schema by calling:

```bash
curl -X POST http://localhost:3000/api/init
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── data-sources/       # CRUD + test, schema, permissions
│   │   ├── dashboards/         # Dashboard persistence
│   │   ├── query/              # Guarded query execution
│   │   └── init/               # Database initialization
│   ├── layout.tsx
│   ├── page.tsx                # Main app entry
│   └── globals.css
├── components/
│   ├── genui/                  # Generative UI components (Tambo BYOC)
│   │   ├── bar-chart.tsx
│   │   ├── data-table.tsx
│   │   ├── kpi-card.tsx
│   │   ├── line-chart.tsx
│   │   ├── metric-grid.tsx
│   │   ├── pie-chart.tsx
│   │   └── summary-card.tsx
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   └── app-sidebar.tsx
│   ├── providers/
│   │   ├── app-context.tsx
│   │   └── tambo-provider.tsx
│   ├── ui/                     # shadcn/ui components (25 components)
│   └── views/
│       ├── analytics-chat.tsx
│       ├── dashboards-view.tsx
│       ├── data-sources-view.tsx
│       ├── permissions-view.tsx
│       └── schema-browser-view.tsx
├── hooks/
│   ├── use-data-sources.ts
│   └── use-mobile.ts
└── lib/
    ├── connectors/
    │   └── postgres.ts         # External DB connection + introspection
    ├── services/
    │   ├── data-source-service.ts
    │   └── query-service.ts
    ├── tambo/
    │   ├── components.ts       # Tambo BYOC component registry
    │   └── tools.ts            # Tambo tool definitions
    ├── db.ts                   # Internal metadata database
    ├── encryption.ts           # AES-256-GCM credential vault
    ├── query-guardrails.ts     # SQL validation pipeline
    ├── schemas.ts              # Zod schemas
    ├── types.ts                # TypeScript type definitions
    └── utils.ts                # Utility functions
```

## Key Features

### Data Source Management

- Connect PostgreSQL databases (MySQL and MongoDB support planned)
- Encrypted credential storage (AES-256-GCM)
- Connection testing
- Auto schema introspection on connect

### Schema Browser

- View tables, columns, types, relationships
- Primary key and foreign key indicators
- Row count estimates
- Refresh / re-introspect capability

### AI Authorization and Permissions

- Table-level allow/deny per data source
- Row limits per table
- Column masking (planned)
- All permissions enforced at query execution time

### Conversational Analytics

- Natural language data exploration
- Multi-turn conversations
- Context-aware follow-ups
- The AI discovers schema, writes queries, and renders visualizations

### Generative UI (Tambo BYOC)

All 7 registered components:

| Component     | Use Case                              |
| ------------- | ------------------------------------- |
| `KPICard`     | Single metrics (revenue, users, rate) |
| `MetricGrid`  | Dashboard overview with multiple KPIs |
| `DataTable`   | Tabular query results                 |
| `BarChart`    | Category comparisons                  |
| `LineChart`   | Time-series trends                    |
| `PieChart`    | Proportional breakdowns               |
| `SummaryCard` | Narrative analysis with highlights    |

### Query Guardrails

- SELECT-only enforcement
- Forbidden keyword blocking (INSERT, DROP, DELETE, etc.)
- Table authorization verification
- Masked column protection
- Auto-LIMIT enforcement
- Multi-statement prevention
- 30-second query timeout
- Full audit logging

## Security Model

1. **Encrypted credentials** — Database passwords encrypted with AES-256-GCM
2. **Read-only access** — Only SELECT queries permitted
3. **No direct DB access from frontend** — All queries go through API with guardrails
4. **Explicit allowlists** — AI only accesses tables the user has authorized
5. **Audit trail** — Every query attempt is logged
6. **Statement timeout** — 30-second maximum to prevent runaway queries

## API Endpoints

| Method   | Endpoint                             | Description                         |
| -------- | ------------------------------------ | ----------------------------------- |
| `POST`   | `/api/init`                          | Initialize internal database schema |
| `GET`    | `/api/data-sources`                  | List all data sources               |
| `POST`   | `/api/data-sources`                  | Add a new data source               |
| `GET`    | `/api/data-sources/[id]`             | Get data source details             |
| `POST`   | `/api/data-sources/[id]`             | Test connection                     |
| `DELETE` | `/api/data-sources/[id]`             | Remove a data source                |
| `GET`    | `/api/data-sources/[id]/schema`      | Get cached schema                   |
| `POST`   | `/api/data-sources/[id]/schema`      | Force re-introspect                 |
| `GET`    | `/api/data-sources/[id]/permissions` | Get permissions                     |
| `PUT`    | `/api/data-sources/[id]/permissions` | Update permissions                  |
| `POST`   | `/api/query`                         | Execute a guarded query             |
| `GET`    | `/api/dashboards`                    | List dashboards                     |
| `POST`   | `/api/dashboards`                    | Save a dashboard                    |

## License

MIT
