<p align="center">
  <h1 align="center">🔍 Tambo Lens</h1>
  <p align="center"><strong>Intent-Driven Generative Analytics for Your Business Databases</strong></p>
  <p align="center">
    Connect your databases. Ask questions in plain English. Get instant visualizations.
  </p>
</p>

---

## Overview

Tambo Lens is an AI-powered analytics platform that transforms how you interact with your business data. Instead of writing SQL queries or building dashboards manually, simply connect your existing databases and explore your data through natural language conversations. The AI understands your schema, writes optimized queries, and renders beautiful interactive visualizations — all in real time.

Built with the [Tambo AI SDK](https://tambo.co) for generative UI, Tambo Lens delivers a plug-and-play experience: connect a PostgreSQL database and start asking questions within minutes.

## ✨ Key Features

| Feature | Description |
|---|---|
| **🤖 Conversational AI Analytics** | Ask data questions in natural language — the AI discovers schema, writes SQL, and renders results |
| **🎨 Generative UI Components** | 7 AI-driven visualization components (KPI cards, charts, tables, grids) rendered on the fly |
| **🔌 Multi-Source Data Connectors** | Connect PostgreSQL databases with encrypted credential storage (MySQL & MongoDB planned) |
| **📊 Dashboard Persistence** | Save, load, and manage custom dashboards built from AI-generated visualizations |
| **🛡️ Query Guardrails** | SELECT-only enforcement, forbidden keyword blocking, table authorization, auto-LIMIT, and audit logging |
| **🔐 Encrypted Credential Vault** | AES-256-GCM encryption for all stored database credentials |
| **🔍 Schema Introspection** | Auto-discover tables, columns, types, primary keys, foreign keys, and row counts |
| **⚙️ AI-Powered Permissions** | Table-level allow/deny, row limits, and column masking enforced at query execution time |
| **🚨 Anomaly Detection** | Real-time anomaly alerts with severity levels (critical, warning, info) |
| **📄 Report Generation** | Generate shareable Markdown reports from analytics conversations |
| **💬 Chat History** | Multi-turn conversation support with session history and context-aware follow-ups |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React 19)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Analytics     │  │ Generative   │  │  Dashboard       │  │
│  │ Chat UI      │  │ UI (7 BYOC)  │  │  Persistence     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
│         │                 │                  │              │
│  ┌──────┴─────────────────┴──────────────────┴───────────┐  │
│  │               Tambo AI SDK (React)                    │  │
│  │   Component Registry · Tools · Streaming · Context    │  │
│  └───────────────────────┬───────────────────────────────┘  │
├──────────────────────────┼──────────────────────────────────┤
│                Backend (Next.js 16 API Routes)              │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │ Data Source  │  │  Schema     │  │  Query Execution   │  │
│  │ Management  │  │ Introspect  │  │  + Guardrails      │  │
│  └──────┬──────┘  └─────────────┘  └────────┬───────────┘  │
│  ┌──────┴──────┐  ┌─────────────┐  ┌────────┴───────────┐  │
│  │ Permission  │  │  Encrypted  │  │  Anomaly Detection │  │
│  │ Engine      │  │  Vault      │  │  Service           │  │
│  └─────────────┘  └─────────────┘  └────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    PostgreSQL (Metadata)                     │
│         Data sources · Permissions · Dashboards · Users     │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) | Full-stack React framework with API routes |
| **Language** | TypeScript 5 | Type-safe development |
| **UI Library** | React 19 | Component-based UI |
| **Styling** | Tailwind CSS v4 | Utility-first CSS |
| **Component System** | [shadcn/ui](https://ui.shadcn.com/) + Radix UI | 25+ accessible UI primitives |
| **AI / GenUI** | [Tambo SDK](https://tambo.co) (`@tambo-ai/react`, `@tambo-ai/typescript-sdk`) | Generative UI, tool registration, streaming |
| **AI Provider** | [Vercel AI SDK](https://sdk.vercel.ai/) + OpenAI | LLM orchestration |
| **Authentication** | NextAuth v5 (beta) | Session-based auth with credentials provider |
| **Database Driver** | node-postgres (`pg`) | PostgreSQL connectivity |
| **Encryption** | AES-256-GCM (Node.js crypto) | Credential vault |
| **Charts** | [Recharts](https://recharts.org/) | Data visualization |
| **Validation** | [Zod](https://zod.dev/) | Runtime schema validation |
| **Icons** | [Lucide React](https://lucide.dev/) | SVG icon library |
| **Markdown** | react-markdown + remark-gfm | Rich text rendering for reports |
| **Date Utilities** | date-fns | Date formatting and manipulation |
| **Notifications** | Sonner | Toast notifications |

## 🎨 Generative UI Components

Tambo Lens uses the Tambo SDK's **Bring Your Own Components (BYOC)** system to register 7 visualization components that the AI can render dynamically:

| Component | Use Case | Example |
|---|---|---|
| `KPICard` | Single metric display | Revenue: $1.2M (+12%) |
| `MetricGrid` | Multi-KPI dashboard overview | 4-6 metrics at a glance |
| `DataTable` | Tabular query results | Full result sets with sorting |
| `BarChart` | Category comparisons | Sales by region |
| `LineChart` | Time-series trends | Revenue over 12 months |
| `PieChart` | Proportional breakdowns | Market share distribution |
| `SummaryCard` | Narrative analysis | AI-written insight summaries |

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** (for internal metadata storage)
- **Tambo AI API key** — [get one at tambo.co](https://tambo.co)
- **OpenAI API key** (used by Tambo under the hood)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/tambo-lens.git
cd tambo-lens/apps
npm install
```

### 2. Configure Environment

Create `.env.local` in the `apps/` directory:

```env
# Tambo AI SDK key
NEXT_PUBLIC_TAMBO_API_KEY=your_tambo_api_key

# Internal PostgreSQL for metadata storage
DATABASE_URL=postgresql://postgres:password@localhost:5432/tambo_lens

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# 32-byte hex encryption key for credential vault
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### 3. Initialize the Database

Create the PostgreSQL database:

```sql
CREATE DATABASE tambo_lens;
```

Start the dev server and initialize the schema:

```bash
npm run dev
```

Then call the init endpoint:

```bash
curl -X POST http://localhost:3000/api/init
```

### 4. Start Exploring

Open [http://localhost:3000](http://localhost:3000), create an account, connect a PostgreSQL data source, and start asking questions!

**Example prompts:**
- _"Show me total revenue by month for the last year"_
- _"What are the top 10 customers by order count?"_
- _"Compare sales across regions as a bar chart"_
- _"Give me a KPI overview of our key business metrics"_

## 📁 Project Structure

```
tambo-lens/
└── apps/                          # Next.js application
    ├── src/
    │   ├── app/
    │   │   ├── api/
    │   │   │   ├── anomalies/     # Anomaly detection endpoints
    │   │   │   ├── auth/          # NextAuth authentication
    │   │   │   ├── dashboards/    # Dashboard CRUD
    │   │   │   ├── data-sources/  # Data source management + schema
    │   │   │   ├── init/          # Database initialization
    │   │   │   ├── query/         # Guarded SQL execution
    │   │   │   ├── reports/       # Report generation
    │   │   │   └── suggestions/   # AI-suggested questions
    │   │   ├── layout.tsx         # Root layout with SessionProvider
    │   │   ├── page.tsx           # Entry point (auth gate → AppShell)
    │   │   └── globals.css        # Tailwind CSS globals
    │   │
    │   ├── components/
    │   │   ├── genui/             # 7 Tambo BYOC visualization components
    │   │   ├── layout/            # AppShell + AppSidebar
    │   │   ├── providers/         # App, Dashboard, Tambo, Session providers
    │   │   ├── tambo/             # Tambo agent configuration
    │   │   ├── ui/                # 25+ shadcn/ui primitives
    │   │   └── views/             # All application views
    │   │       ├── analytics-chat.tsx
    │   │       ├── alerts-feed.tsx
    │   │       ├── auth-view.tsx
    │   │       ├── chat-history-panel.tsx
    │   │       ├── dashboards-view.tsx
    │   │       ├── data-sources-view.tsx
    │   │       ├── permissions-view.tsx
    │   │       ├── report-view.tsx
    │   │       └── schema-browser-view.tsx
    │   │
    │   ├── hooks/                 # Custom React hooks
    │   │   ├── use-anomalies.ts
    │   │   ├── use-data-sources.ts
    │   │   ├── use-report.ts
    │   │   └── use-suggested-questions.ts
    │   │
    │   └── lib/
    │       ├── connectors/        # Database connectors (PostgreSQL)
    │       ├── services/          # Business logic services
    │       │   ├── anomaly-service.ts
    │       │   ├── auth-service.ts
    │       │   ├── data-source-service.ts
    │       │   ├── query-service.ts
    │       │   ├── report-service.ts
    │       │   └── suggestion-service.ts
    │       ├── tambo/             # Tambo component registry + tools
    │       ├── auth.ts            # NextAuth configuration
    │       ├── db.ts              # Internal PostgreSQL client
    │       ├── encryption.ts      # AES-256-GCM vault
    │       ├── query-guardrails.ts # SQL validation pipeline
    │       ├── schemas.ts         # Zod schemas
    │       └── types.ts           # TypeScript type definitions
    │
    ├── public/                    # Static assets
    ├── package.json
    ├── next.config.ts
    └── tsconfig.json
```

## 🔒 Security Model

| Layer | Protection |
|---|---|
| **Credential Storage** | AES-256-GCM encryption with unique IVs per credential |
| **Query Execution** | SELECT-only — INSERT, UPDATE, DELETE, DROP, ALTER all blocked |
| **Table Authorization** | Explicit allowlists — AI only accesses tables the user has authorized |
| **Row Limits** | Per-table row limits enforced at query time |
| **Column Masking** | Sensitive columns can be hidden from AI queries |
| **Multi-Statement Prevention** | Only single SQL statements allowed per request |
| **Statement Timeout** | 30-second maximum to prevent runaway queries |
| **Audit Trail** | Every query attempt is logged with timestamp and result |
| **Authentication** | NextAuth v5 session-based auth with bcrypt password hashing |
| **No Direct DB Access** | All queries routed through API guardrails — no frontend-to-DB connection |

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/init` | Initialize internal database schema |
| `POST` | `/api/auth/signup` | Create a new user account |
| `GET` | `/api/data-sources` | List all data sources |
| `POST` | `/api/data-sources` | Add a new data source |
| `GET` | `/api/data-sources/[id]` | Get data source details |
| `POST` | `/api/data-sources/[id]` | Test connection |
| `DELETE` | `/api/data-sources/[id]` | Remove a data source |
| `GET` | `/api/data-sources/[id]/schema` | Get cached schema |
| `POST` | `/api/data-sources/[id]/schema` | Force re-introspect |
| `GET` | `/api/data-sources/[id]/permissions` | Get table permissions |
| `PUT` | `/api/data-sources/[id]/permissions` | Update permissions |
| `POST` | `/api/query` | Execute a guarded SQL query |
| `GET` | `/api/dashboards` | List saved dashboards |
| `POST` | `/api/dashboards` | Save a dashboard |
| `GET` | `/api/reports/[id]` | Get a report |
| `POST` | `/api/reports` | Generate a report |
| `GET` | `/api/anomalies` | List anomalies |
| `POST` | `/api/anomalies/scan` | Trigger anomaly scan |
| `GET` | `/api/suggestions` | Get AI-suggested questions |

## 🧩 How It Works

1. **Connect** — Add your PostgreSQL database with connection credentials (encrypted at rest)
2. **Discover** — Tambo Lens auto-introspects your schema: tables, columns, types, keys
3. **Authorize** — Set table-level permissions to control what the AI can access
4. **Ask** — Type natural language questions in the Analytics Chat
5. **Visualize** — The AI writes SQL, executes it through guardrails, and renders GenUI components
6. **Save** — Pin visualizations to persistent dashboards for later reference
7. **Share** — Generate Markdown reports from your analytics sessions

## 📜 License

MIT

---
## Contributors
-Siddharth
-JAY
-Shubham

<p align="center">
  Built with <a href="https://tambo.co">Tambo AI</a> · <a href="https://nextjs.org">Next.js</a> · <a href="https://ui.shadcn.com">shadcn/ui</a>
</p>
