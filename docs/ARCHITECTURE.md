# Yuvnix System Architecture

> **Version:** 1.0.0 (Foundation)  
> **Lead Architect:** Senior Frontend Engineer & Architect  
> **Target Deployment:** Cloudflare Pages + Supabase PostgreSQL (Managed Edge)

---

## 1. Architectural Overview

Yuvnix is engineered as a high-performance, mobile-first Single Page Application (SPA) backed by Supabase as a Backend-as-a-Service (PostgreSQL, Row Level Security, Auth, and Realtime WebSocket subscriptions).

```mermaid
graph TD
    subgraph Client ["Client Layer (Cloudflare Pages CDN Edge)"]
        Browser[Student Mobile & Desktop Browsers]
        ViteSPA[React 18 + Vite + TypeScript SPA]
        Tailwind[Tailwind CSS + shadcn/ui Design System]
        Router[React Router v6]
        QueryCache[TanStack Query Server Cache]
        ZodValidator[Zod Schema Validation]
    end

    subgraph Backend ["Backend & Data Layer (Supabase Managed Cloud)"]
        Auth[Supabase Auth (Google OAuth 2.0 PKCE)]
        PostgreSQL[(PostgreSQL 15 Database)]
        RLS[Row Level Security Engine]
        RealtimeWS[Realtime Engine / WebSockets]
    end

    Browser --> ViteSPA
    ViteSPA --> Router
    Router --> QueryCache
    QueryCache --> ZodValidator
    ZodValidator -->|Anon Key HTTPS| RLS
    RLS --> PostgreSQL
    Browser -->|Google Sign-In| Auth
    Auth -->|JWT Session| RLS
    PostgreSQL -->|Change Events| RealtimeWS
    RealtimeWS -->|WebSockets| QueryCache
```

---

## 2. Technology Stack & Decision Matrix

| Layer | Technology | Architectural Rationale |
| :--- | :--- | :--- |
| **Build Tool & Runtime** | Vite + React 18 + TypeScript | Instant HMR in development; sub-second production builds; strict type safety prevents runtime regressions. |
| **Styling & Design System** | Tailwind CSS + shadcn/ui | Radix UI accessible primitives coupled with tokenized CSS variables (`hsl(var(--primary))`) ensuring a mobile-first student aesthetic. |
| **Routing** | React Router v6 | Declarative layout nesting (`AppLayout`, `Header`, `BottomNav`) and route segment guards. |
| **Server State & Cache** | TanStack Query v5 | Automatic background refetching, cache invalidation, deduplication, and optimistic mutation handling. |
| **Form Management** | React Hook Form + Zod | Uncontrolled performant form inputs with compile-time inferred type validation via Zod schemas. |
| **Database & Auth** | Supabase (PostgreSQL 15) | Relational integrity, built-in Google OAuth PKCE flow, and real-time database event broadcasting. |
| **CDN & Edge Hosting** | Cloudflare Pages | Sub-50ms TTFB across Indian telecommunications networks, integrated GitHub deployment pipeline. |

---

## 3. Directory Structure

```text
yuvnix/
├── docs/
│   ├── PRODUCT_SPEC.md          # 12 Core Product Rules, Personas & Workflows
│   └── ARCHITECTURE.md          # Complete technical design & database schema
├── public/
│   ├── _redirects               # Cloudflare Pages SPA rewrite rule
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── common/              # BrandLogo, StatusBadge, EmptyState, Banner
│   │   ├── layout/              # AppLayout, Header, BottomNav, PageContainer
│   │   └── ui/                  # shadcn/ui primitives (Button, Card, Badge, Input, Label, Avatar)
│   ├── hooks/                   # useAuth, useMediaQuery, custom utility hooks
│   ├── pages/                   # Route views: Home, Communities, Request, Carts, Rides, Profile
│   ├── schemas/                 # Zod runtime schemas (community, cart, ride)
│   ├── services/                # Supabase client configuration & auth handlers
│   ├── types/                   # TypeScript interfaces (Database, Domain, Auth)
│   ├── utils/                   # cn, formatters, type-safe env parser
│   ├── App.tsx                  # Root component with Providers & React Router
│   ├── index.css                # Tailwind base directives & color design tokens
│   ├── main.tsx                 # React DOM mount
│   └── vite-env.d.ts            # Client environment typing
├── .env.example                 # Environment variable template
├── components.json              # shadcn/ui CLI configuration
├── index.html                   # HTML template with mobile viewport optimizations
├── package.json                 # Dependency manifests & build scripts
├── postcss.config.js            # PostCSS configuration
├── tailwind.config.js           # Indigo/Violet theme tokens & keyframes
├── tsconfig.json                # Strict TypeScript configuration
└── vite.config.ts               # Vite configuration with chunk splitting & path aliases
```

---

## 4. PostgreSQL Database Schema & Security (DDL)

The schema enforces data integrity, foreign keys, and Row Level Security (RLS) directly inside PostgreSQL.

```sql
-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enumerated Types
CREATE TYPE user_role AS ENUM ('student', 'support_staff', 'admin');
CREATE TYPE residential_type AS ENUM ('hostel', 'pg', 'apartment', 'other');
CREATE TYPE community_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE group_cart_status AS ENUM ('open', 'locked', 'ordered', 'completed', 'cancelled');
CREATE TYPE shared_ride_status AS ENUM ('open', 'full', 'departed', 'completed', 'cancelled');

-- 3. Profiles Table (Linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone_number TEXT,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Communities Table (Physical residential locations only)
CREATE TABLE public.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    type residential_type NOT NULL,
    college_affiliation TEXT, -- Optional contextual metadata
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    delivery_pickup_point TEXT NOT NULL, -- Verified gate / desk
    taxi_pickup_point TEXT NOT NULL,     -- Verified cab curb
    is_verified BOOLEAN NOT NULL DEFAULT true,
    active_member_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Community Memberships Table (Multi-community support)
CREATE TABLE public.community_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (community_id, user_id)
);

-- 6. Community Creation Requests (Subject to Support Staff approval)
CREATE TABLE public.community_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    proposed_name TEXT NOT NULL,
    proposed_type residential_type NOT NULL,
    college_affiliation TEXT,
    address TEXT NOT NULL,
    proposed_delivery_pickup_point TEXT NOT NULL,
    proposed_taxi_pickup_point TEXT NOT NULL,
    status community_request_status NOT NULL DEFAULT 'pending',
    reviewed_by_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Group Grocery Carts Table
CREATE TABLE public.group_carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    store_name TEXT,
    status group_cart_status NOT NULL DEFAULT 'open',
    lock_at TIMESTAMPTZ NOT NULL,
    pickup_instructions TEXT,
    total_estimated_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Cart Items Table
CREATE TABLE public.cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES public.group_carts(id) ON DELETE CASCADE,
    added_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_estimate NUMERIC(10, 2),
    notes TEXT,
    is_fulfilled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Shared Taxi Rides Table
CREATE TABLE public.shared_rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pickup_point TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_time TIMESTAMPTZ NOT NULL,
    total_seats INT NOT NULL CHECK (total_seats > 0),
    available_seats INT NOT NULL CHECK (available_seats >= 0),
    estimated_cost_per_seat NUMERIC(10, 2),
    status shared_ride_status NOT NULL DEFAULT 'open',
    luggage_details TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Ride Participants Table
CREATE TABLE public.ride_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID NOT NULL REFERENCES public.shared_rides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    seats_reserved INT NOT NULL DEFAULT 1 CHECK (seats_reserved > 0),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    notes TEXT,
    UNIQUE (ride_id, user_id)
);

-- 11. Chat Messages Table (Realtime communication for carts and rides)
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_type TEXT NOT NULL CHECK (conversation_type IN ('cart', 'ride')),
    context_id UUID NOT NULL,
    sender_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

---

## 5. Row Level Security (RLS) Policies

All tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Zero unauthorized queries reach the database.

- **Profiles:**
  - `SELECT`: Any authenticated user can read public profile summaries.
  - `UPDATE`: Users can update only their own profile (`auth.uid() = id`).
- **Communities:**
  - `SELECT`: Public read access for verified communities (`is_verified = true`).
  - `INSERT / UPDATE`: Restricted to `support_staff` and `admin` roles only.
- **Community Requests:**
  - `SELECT`: Students can view their own submitted requests; support staff can view all.
  - `INSERT`: Any authenticated student can submit a request with `status = 'pending'`.
  - `UPDATE`: Only support staff can update review status.
- **Group Carts & Rides:**
  - `SELECT`: Authenticated members of the parent community can view active carts and rides.
  - `INSERT`: Members can create carts and rides within their communities.
- **Chat Messages:**
  - `SELECT & INSERT`: Only participants belonging to that specific cart or ride can post/read messages.

---

## 6. Cloudflare Pages Deployment Pipeline

### Deployment Settings
- **Framework Preset:** `Vite`
- **Build Command:** `npm run build`
- **Build Output Directory:** `dist`
- **Node.js Version:** `>= 20.0.0`
- **Root Directory:** `/`

### SPA Routing Rule
The `public/_redirects` file guarantees that direct deep links (e.g. `/communities/request`, `/carts`) do not return 404 from Cloudflare:
```text
/*  /index.html  200
```
