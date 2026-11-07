# Yuvnix 🚀
> **Your people. Your community.**

Yuvnix is a student-first hyperlocal platform connecting students living in **hostels, PGs, and apartments** to coordinate group grocery orders and share taxi rides.

---

## 🛠️ Tech Stack

- **Frontend Core:** React 18, Vite 6, TypeScript (Strict mode)
- **Styling & UI:** Tailwind CSS, shadcn/ui design tokens, Lucide React
- **Routing:** React Router v6
- **Backend & Auth:** Supabase (PostgreSQL 15, Row Level Security, Google OAuth 2.0 PKCE, Realtime)
- **State & Server Cache:** TanStack Query v5 (React Query)
- **Form Handling:** React Hook Form + Zod validation
- **Deployment:** Cloudflare Pages (SPA edge delivery)

---

## 📂 Project Architecture

```text
yuvnix/
├── docs/
│   ├── PRODUCT_SPEC.md          # 12 Foundational Product Rules & User Flows
│   └── ARCHITECTURE.md          # Database schema, RLS policies, Cloudflare setup
├── public/
│   ├── _redirects               # SPA routing rewrite for Cloudflare Pages
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── common/              # BrandLogo, StatusBadge, EmptyState, Banner
│   │   ├── layout/              # AppLayout, Header, BottomNav, PageContainer
│   │   └── ui/                  # shadcn/ui primitives (Button, Card, Badge, Input, Label, Avatar)
│   ├── hooks/                   # useAuth, useMediaQuery
│   ├── pages/                   # Home, Communities, Request, Carts, Rides, Profile, Callback
│   ├── schemas/                 # Zod validation schemas
│   ├── services/                # Supabase client & OAuth wrappers
│   ├── types/                   # Strict TypeScript definitions & PostgreSQL database types
│   ├── utils/                   # cn, formatters, type-safe env validator
│   ├── App.tsx                  # Root Providers & React Router
│   ├── index.css                # Indigo/Violet theme design tokens
│   └── main.tsx                 # DOM entry point
├── .env.example                 # Environment variable templates
├── components.json              # shadcn/ui configuration
└── vite.config.ts               # Vite build config with manual chunk splitting
```

---

## 🚀 Quick Start & Development

### 1. Prerequisites
- **Node.js:** v18.0.0 or later (v20+ recommended)
- **npm:** v9.0.0 or later

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <your-repo-url>
cd Yuvnix
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Provide your Supabase project credentials in `.env`:
```ini
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_APP_URL=http://localhost:5173
VITE_APP_ENV=development
```
> **Security Rule:** Never expose or commit the Supabase `service_role` key. All client interactions use the public anon key protected by PostgreSQL Row Level Security (RLS).

### 4. Running Locally
Start the Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Quality & Verification Scripts

```bash
# Run strict TypeScript typecheck
npm run typecheck

# Run production build & asset chunking
npm run build

# Preview production build locally
npm run preview
```

---

## 🛡️ Foundational Product Rules

1. **Physical Residences Only:** Communities are physical living spaces (e.g. *PDEU Hostel*, *Sunrise PG*, *Friends Apartment*), never colleges.
2. **Optional College Metadata:** Colleges are optional contextual tags on a community.
3. **Staff Verification:** Only authorized Yuvnix support staff approve and create communities from student requests.
4. **Democratic Access:** Submitting a request conveys no permanent admin authority over peers.
5. **Verified Points:** Every community has verified delivery and taxi pickup gates.
6. **Peer-to-Peer:** Students coordinate orders and fares directly; no payment gateway integration in MVP.
7. **Free:** No student is charged fees to use the platform.
8. **Auth:** Google OAuth 2.0 is the official student authentication method.

---

## 🌐 Cloudflare Pages Deployment

1. Connect your GitHub repository to Cloudflare Pages.
2. Set the build settings:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Build Output Directory:** `dist`
3. Add environment variables in Cloudflare Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. The included `public/_redirects` file automatically handles single-page app (SPA) routing for all paths.
