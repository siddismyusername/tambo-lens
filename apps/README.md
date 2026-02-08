# Tambo Lens — App

> **Next.js application for Tambo Lens.** See the [root README](../README.md) for full project documentation, architecture, and feature overview.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment variables (see below)
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create `.env.local` in this directory:

```env
# Tambo AI SDK key — https://tambo.co
NEXT_PUBLIC_TAMBO_API_KEY=your_tambo_api_key

# Internal PostgreSQL for metadata storage
DATABASE_URL=postgresql://postgres:password@localhost:5432/tambo_lens

# NextAuth secret (generate: openssl rand -base64 32)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# 32-byte hex encryption key (generate: openssl rand -hex 32)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

## Database Setup

```sql
CREATE DATABASE tambo_lens;
```

Then initialize the schema:

```bash
curl -X POST http://localhost:3000/api/init
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | Full-stack framework (App Router) |
| React | 19.2.3 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| Tambo SDK | 0.74+ | Generative UI + AI tools |
| Vercel AI SDK | 6.x | LLM orchestration |
| NextAuth | 5.x beta | Authentication |
| PostgreSQL (pg) | 8.x | Database driver |
| Recharts | 2.x | Chart visualizations |
| shadcn/ui + Radix | Latest | UI component library |
| Zod | 4.x | Schema validation |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # 8 API route groups
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Entry (auth gate → AppShell)
│   └── globals.css
├── components/
│   ├── genui/              # 7 Tambo BYOC visualization components
│   ├── layout/             # AppShell + AppSidebar
│   ├── providers/          # Context providers (App, Dashboard, Tambo, Session)
│   ├── tambo/              # Tambo agent configuration
│   ├── ui/                 # 25+ shadcn/ui primitives
│   └── views/              # 9 application views
├── hooks/                  # Custom React hooks
└── lib/
    ├── connectors/         # Database connectors
    ├── services/           # 6 business logic services
    ├── tambo/              # Component registry + tool definitions
    ├── auth.ts             # NextAuth config
    ├── db.ts               # Internal PostgreSQL client
    ├── encryption.ts       # AES-256-GCM vault
    ├── query-guardrails.ts # SQL validation pipeline
    ├── schemas.ts          # Zod schemas
    └── types.ts            # Type definitions
```

## License

MIT
