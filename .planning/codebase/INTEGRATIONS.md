# External Integrations & Service Contracts — Yuvnix

## 1. Supabase Backend Integration

### 1.1 Client Configuration (`src/services/supabase.ts`)
The client is instantiated with the public anon key (`VITE_SUPABASE_ANON_KEY`) and project URL (`VITE_SUPABASE_URL`):
- **Session Persistence**: Enabled via browser `localStorage`.
- **Auto-Refresh**: Enabled; automatically exchanges expiring JWTs.
- **PKCE Flow**: `flowType: 'pkce'` is enforced for secure browser-based OAuth token exchange without exposing authorization codes.
- **Realtime Rate Limiting**: Capped at `eventsPerSecond: 10` to avoid overwhelming low-power mobile devices.

### 1.2 Invariant Security Rules
- **NEVER** expose the Supabase `service_role` key in frontend code, git commits, or client environment variables.
- All database authorization logic resides server-side in PostgreSQL **Row Level Security (RLS)** policies.

---

## 2. Authentication: Google OAuth 2.0 Integration

### 2.1 Flow Architecture
1. Student clicks **"Sign in with Google"** on desktop header or mobile profile/request page.
2. `signInWithGoogle()` calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/auth/callback' } })`.
3. Student authenticates on Google accounts screen.
4. Google redirects back to `/auth/callback`.
5. `AuthCallbackPage.tsx` handles hash fragment / code extraction:
   - Fetches active session from Supabase.
   - Verifies if `profiles` record exists for the student's `auth.uid()`.
   - If first login, automatically provisions user profile (`id`, `email`, `full_name`, `role: 'student'`).
   - Redirects student seamlessly to their destination (default `/communities`).

---

## 3. Cloudflare Pages Deployment Integration

### 3.1 SPA History Rewrite Rule (`public/_redirects`)
To support client-side React Router navigation without 404 errors when deep-linking or refreshing routes like `/communities/request`, Cloudflare Pages requires an edge rewrite rule:
```text
/*    /index.html   200
```
This file resides in `public/_redirects` and is copied automatically into `dist/` upon executing `npm run build`.

---

## 4. Intentional Non-Integrations (The Zero-Gateway Invariant)

### 4.1 No Payment Gateways (Razorpay / Stripe / Paytm)
- **Deliberate Design Decision**: Yuvnix does not integrate payment gateways in its MVP.
- **Why**:
  - Eliminates merchant KYC overhead, payment gateway transaction fees (2%–3%), chargeback liabilities, and RBI financial escrow compliance requirements.
  - Students already have ubiquitous zero-fee direct UPI apps (Google Pay, PhonePe, Paytm).
  - External bills from Zepto/Blinkit/Uber/Ola are settled peer-to-peer directly between students.

### 4.2 No Proprietary Delivery Fleets or Dark Stores
- Yuvnix does not compete with Zepto or Blinkit; it serves as a **coordination and batching layer** on top of existing services.
- Students place their orders directly in their existing commercial apps and use Yuvnix to coordinate consolidation to the verified community delivery point.
