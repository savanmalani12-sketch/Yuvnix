# Codebase Structure & Directory Layout — Yuvnix

## 1. Directory Tree & Purpose

```text
/Users/savanmalani/Desktop/Savan bhaiiii/Yuvnix/
├── docs/
│   ├── ARCHITECTURE.md          # Database schema, RLS policies, Cloudflare setup
│   └── PRODUCT_SPEC.md          # 12 Inviolable Product Rules & flows
├── public/
│   ├── _redirects               # Cloudflare Pages SPA rewrite rule
│   └── vite.svg                 # Vite logo
├── src/
│   ├── components/
│   │   ├── common/              # Reusable compound UI elements
│   │   │   ├── BrandLogo.tsx           # Scalable Yuvnix logo & community mark
│   │   │   ├── ConfigurationBanner.tsx # Dev warning when Supabase env vars missing
│   │   │   ├── EmptyState.tsx          # Consistent empty list illustration & action
│   │   │   └── StatusBadge.tsx         # Color-coded badge for cart/ride/request statuses
│   │   ├── layout/              # Structural chrome & navigation
│   │   │   ├── AppLayout.tsx           # Global shell (Banner + Header + Outlet + BottomNav)
│   │   │   ├── BottomNav.tsx           # Mobile-first floating bottom navigation
│   │   │   ├── Header.tsx              # Responsive top navigation bar with auth button
│   │   │   └── PageContainer.tsx       # Standard max-width container with responsive padding
│   │   └── ui/                  # Accessible headless primitives (shadcn / Radix)
│   │       ├── avatar.tsx              # Radix UI avatar with initials fallback
│   │       ├── badge.tsx               # Variant-driven tag/pill component
│   │       ├── button.tsx              # Button with CVA variants (default, outline, ghost, etc.)
│   │       ├── card.tsx                # Composable Card, CardHeader, CardTitle, CardContent
│   │       ├── input.tsx               # Standard styled accessible input
│   │       └── label.tsx               # Radix UI accessible form label
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.tsx                 # Supabase session, profile, and auth state provider
│   │   └── useMediaQuery.ts            # Responsive breakpoint listener hook
│   ├── pages/                   # Top-level route pages
│   │   ├── AuthCallbackPage.tsx        # OAuth redirect handler & profile auto-provisioner
│   │   ├── CartsPage.tsx               # Group carts directory & creation entry point
│   │   ├── CommunitiesPage.tsx         # Community discovery & search
│   │   ├── CommunityRequestPage.tsx    # Student submission form for new communities
│   │   ├── HomePage.tsx                # Hero landing page & product value pillars
│   │   ├── NotFoundPage.tsx            # 404 handler with return home action
│   │   ├── ProfilePage.tsx             # Student profile, community memberships & signout
│   │   └── RidesPage.tsx               # Shared rides list & seat reservation entry point
│   ├── schemas/                 # Zod validation schemas
│   │   ├── cart.ts                     # Schemas for creating cart & adding items
│   │   ├── community.ts                # Schema for community creation request form
│   │   ├── index.ts                    # Central barrel export
│   │   └── ride.ts                     # Schemas for creating rides & joining seats
│   ├── services/                # External API clients
│   │   └── supabase.ts                 # Type-safe Supabase client & Google OAuth actions
│   ├── types/                   # Strict TypeScript type definitions
│   │   ├── auth.ts                     # Auth context & session types
│   │   ├── database.ts                 # PostgreSQL database tables, rows, inserts, updates
│   │   ├── domain.ts                   # Domain models, enums & business invariants
│   │   └── index.ts                    # Central barrel export
│   ├── utils/                   # Shared utility functions
│   │   ├── cn.ts                       # clsx + tailwind-merge helper
│   │   ├── env.ts                      # Zod-validated client environment variables
│   │   └── formatters.ts               # Date, currency, time & initials formatters
│   ├── App.tsx                  # QueryClientProvider, AuthProvider, React Router routes
│   ├── index.css                # Tailwind base, components, utilities, and color variables
│   ├── main.tsx                 # React 18 DOM mount point
│   └── vite-env.d.ts            # Vite client type definitions
├── .env.example                 # Template for local environment variables
├── components.json              # shadcn/ui configuration metadata
├── index.html                   # HTML5 entry with Inter font imports & mobile viewport meta
├── package.json                 # Project dependencies and npm scripts
├── postcss.config.js            # PostCSS configuration for Tailwind CSS
├── tailwind.config.js           # Tailwind theme extension & custom color tokens
├── tsconfig.json                # TypeScript project configuration
└── vite.config.ts               # Vite configuration with path aliases & chunk splitting
```

---

## 2. Module Boundaries & Dependency Rules

1. **`src/schemas`**: Pure Zod schemas; has zero UI or React dependencies. Can run anywhere.
2. **`src/types`**: Pure TypeScript type declarations. No runtime logic.
3. **`src/utils`**: Pure functions (formatters, class merging, env parsing).
4. **`src/components/ui`**: Base presentation primitives. Must not import business domain models.
5. **`src/components/common`**: Domain-aware presentation components (e.g. `BrandLogo`, `StatusBadge`).
6. **`src/pages`**: Top-level route views that compose layout, components, and data hooks.
