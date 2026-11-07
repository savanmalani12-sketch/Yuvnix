# Testing Strategy & Quality Assurance — Yuvnix

## 1. Automated Verification Toolchain

Currently configured npm verification scripts:

```bash
# Typecheck entire codebase without emitting JS
npm run typecheck

# Full production build and bundle verification
npm run build

# Start local Vite development server
npm run dev
```

### Verification Thresholds
- **TypeScript**: Must compile cleanly with **0 errors** under strict mode.
- **Vite Build**: Must generate all production chunks in under 2 seconds.

---

## 2. Product Rule Verification Checklists (Manual & QA)

| Product Rule | Acceptance Verification Test |
|---|---|
| **Rule 1: Physical Residences** | Verify that created communities represent physical buildings (Hostel, PG, Apartment), not colleges. |
| **Rule 2: Optional College** | Verify that a community creation request succeeds with or without `college_affiliation`. |
| **Rule 3: Staff Approval** | Verify that newly requested communities enter `status: 'pending'` and are NOT visible on the public discovery directory until approved. |
| **Rule 4: No Feudal Authority** | Verify that a student who requested a community has standard student privileges (no delete/ban powers over peers). |
| **Rule 5: Verified Pickup Points** | Verify that both `delivery_pickup_point` and `taxi_pickup_point` are mandatory strings with minimum 3 characters. |
| **Rule 6: Multi-Community** | Verify that a student profile can be linked to multiple community IDs in `community_memberships`. |
| **Rule 7: Group Cart Structure** | Verify that a group cart allows line-item additions, quantity modification, and ordering deadline specification. |
| **Rule 8: Shared Ride Structure** | Verify that seat counts cannot exceed vehicle limits (max 6) and seats reserved cannot exceed available seats. |
| **Rule 9 & 10: Peer Settlement** | Verify that no payment gateway checkout popup or merchant credentials are required to complete or lock a cart/ride. |
| **Rule 11: Free for Students** | Verify that zero platform fees or transaction charges appear anywhere in UI. |
| **Rule 12: Google OAuth** | Verify that authentication initiates PKCE Google OAuth and lands on `/auth/callback`. |

---

## 3. Roadmap for Automated Test Suite

- **Unit & Component Testing**: Add Vitest (`@vitejs/plugin-react` + `@testing-library/react`) for testing hooks (`useAuth`), utilities (`formatters`, `env`), and form validation.
- **End-to-End Testing**: Add Playwright for cross-browser smoke tests (Mobile Chrome, Mobile Safari, Desktop).
