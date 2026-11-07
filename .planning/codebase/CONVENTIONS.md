# Engineering Conventions & Coding Standards — Yuvnix

## 1. TypeScript Strictness

- **Strict Type Checking**: `strict: true` in `tsconfig.json`.
- **Zero `any` Policy**: Never use `any`. Use unknown, generics, or defined domain/database types.
- **Path Aliasing**: Always import via the `@/` alias (e.g. `@/components/ui/button`, `@/types`, `@/utils/cn`).
- **Unused Declarations**: Clean up unused imports and variables immediately; TypeScript is configured to flag unused locals.

---

## 2. Component Design & Architecture

### 2.1 Functional Components
- Define React components with standard functional component syntax:
  ```tsx
  export const MyComponent: React.FC<MyComponentProps> = ({ propA, propB }) => { ... };
  ```
- Always pass `className` to reusable UI components and merge with `cn()` to allow callers to override or extend styles.

### 2.2 Reusable Headless Primitives
- Primitive components in `src/components/ui/` follow the **shadcn/ui** and **Radix UI** pattern.
- Use `class-variance-authority` (`cva`) to define component variants (e.g., `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`).

---

## 3. Form Validation with React Hook Form & Zod

- Never write manual `onChange` handlers for form validation.
- Define a single source of truth Zod schema in `src/schemas/`.
- Infer the TypeScript input type directly from the schema:
  ```typescript
  export type MyFormInput = z.infer<typeof myFormSchema>;
  ```
- Wire into `useForm` via `resolver: zodResolver(myFormSchema)`.

---

## 4. Database & API Conventions

- **Database Column Naming**: Snake case (`snake_case`) matching PostgreSQL standards (e.g. `community_id`, `created_by_user_id`, `delivery_pickup_point`).
- **Frontend Domain Models**: Typed interfaces in `src/types/domain.ts` mirror database rows with type-safe enums.
- **Client Supabase Calls**:
  - Always check `isSupabaseConfigured()` before issuing queries.
  - Wrap database operations in TanStack Query (`useQuery` / `useMutation`) for caching and deduplication.

---

## 5. Mobile-First Styling & Design Palette

### 5.1 Color Tokens
- Primary palette: Modern Indigo (`#4f46e5` / `hsl(var(--primary))`) with Violet accent (`brand-violet: #7c3aed`).
- Dark mode compatibility: Semantic CSS variables (`hsl(var(--background))`, `hsl(var(--foreground))`, `hsl(var(--muted))`).

### 5.2 Responsive Layout
- Design for **mobile screens first** (375px–430px viewports).
- Use `PageContainer` with standard max-width boundaries (`sm`, `md`, `lg`, `xl`).
- Maintain a minimum 44px tap target on all buttons and interactive controls.
