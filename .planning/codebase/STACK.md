# Technology Stack & Tooling — Yuvnix

## 1. Runtime & Environment Overview
Yuvnix is a modern, mobile-first Single Page Application (SPA) engineered for university campus student communities.

- **Frontend Runtime**: React 18.3.1 running inside modern mobile and desktop browsers (iOS Safari, Android Chrome, Desktop Chrome/Edge/Firefox).
- **Build & Development Tooling**: Vite 6.1.0 with `@vitejs/plugin-react` 4.3.4 and TypeScript 5.7.3 in strict mode (`tsc -b`).
- **Backend-as-a-Service (BaaS)**: Supabase (PostgreSQL 15, Supabase Auth with Google OAuth PKCE, Supabase Realtime).
- **Target Hosting & Edge Delivery**: Cloudflare Pages with edge-routed SPA history rewrite (`public/_redirects`).

---

## 2. Core Dependencies Analysis (`package.json`)

### Core Framework & Routing
- **`react` (`^18.3.1`) & `react-dom` (`^18.3.1`)**: React 18 concurrent features, declarative UI, component lifecycle.
- **`react-router-dom` (`^6.28.2`)**: Client-side navigation, nested layout routing via `<Outlet />`, dynamic URL params, auth redirects.

### State & Asynchronous Data Fetching
- **`@tanstack/react-query` (`^5.66.0`)**: 
  - Server-state caching, automatic cache invalidation, background refetching, and query deduplication.
  - Default configured with 3-minute `staleTime`, single retry, and `refetchOnWindowFocus: false` to minimize unnecessary mobile data egress.

### Backend & Cloud Services
- **`@supabase/supabase-js` (`^2.48.1`)**:
  - Official isomorphic Supabase JavaScript client configured strictly with public anon key.
  - Enforces client-side type-safety using generated PostgreSQL schema definitions (`Database` type).
  - Handles PKCE Google OAuth sessions, automatic JWT refresh, and real-time WebSocket subscriptions.

### Form Handling & Schema Validation
- **`react-hook-form` (`^7.54.2`)**: Uncontrolled high-performance form state management with minimal re-renders.
- **`zod` (`^3.24.2`)**: TypeScript-first runtime schema validation for forms, environment variables, and API responses.
- **`@hookform/resolvers` (`^3.10.0`)**: Seamless bridge linking Zod schemas with React Hook Form validation.

### UI Primitives & Styling
- **`tailwindcss` (`^3.4.17`)**: Utility-first CSS framework configured with custom semantic HSL color tokens.
- **`@radix-ui/react-*`**: Unstyled, accessible UI primitives:
  - `@radix-ui/react-avatar` (`^1.1.3`): Fallback-aware profile avatars.
  - `@radix-ui/react-dialog` (`^1.1.6`): Accessible modals and dialogs.
  - `@radix-ui/react-dropdown-menu` (`^2.1.6`): Accessible action menus.
  - `@radix-ui/react-label` (`^2.1.2`): WCAG-compliant form labels.
  - `@radix-ui/react-separator` (`^1.1.2`): Accessible visual dividers.
  - `@radix-ui/react-slot` (`^1.1.2`): Composable polymorphism for buttons and cards.
- **`class-variance-authority` (`^0.7.1`)**: Type-safe component variant generation (e.g. Button variants, Badge variants).
- **`clsx` (`^2.1.1`) & `tailwind-merge` (`^3.0.1`)**: Robust class concatenation without Tailwind specificity conflicts (wrapped in `@/utils/cn`).
- **`lucide-react` (`^0.475.0`)**: Lightweight, tree-shakeable SVG icon library.

---

## 3. Build & Bundling Pipeline (`vite.config.ts`)

Vite is configured with intentional manual chunk splitting to keep initial bundle load under 50kB gzip on mobile networks:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-ui': ['@radix-ui/react-slot', 'lucide-react', 'clsx', 'tailwind-merge'],
        'vendor-supabase': ['@supabase/supabase-js'],
        'vendor-query': ['@tanstack/react-query'],
      },
    },
  },
}
```

### Build Metrics
- **Build Duration**: ~1.09 seconds
- **Production Asset Output**:
  - `vendor-ui`: ~20 kB (6.05 kB gzip)
  - `vendor-query`: ~26 kB (8.09 kB gzip)
  - `vendor-react`: ~164 kB (53.9 kB gzip)
  - `vendor-supabase`: ~225 kB (59.2 kB gzip)
  - `index.css`: ~30 kB (6.1 kB gzip)
