# AGENTS.md — Refurb Estimator Platform

## Stack
- Next.js 16 (App Router), React 19, TypeScript 5.9
- Tailwind CSS v4 (PostCSS plugin — config lives in `src/app/globals.css` via `@theme inline`)
- shadcn/ui (radix-nova style, CSS variables, Lucide icons)
- Tremor charts for data visualisation
- Supabase for auth + PostgreSQL + Row Level Security + Storage
- Zod v4 for input validation
- pdf-lib for PDF generation
- Deployed on Vercel

## File structure
- Pages: `src/app/*/page.tsx`
- API routes: `src/app/api/v1/*/route.ts` (versioned)
- Components: `src/components/*.tsx`
- UI primitives: `src/components/ui/*.tsx`
- Business logic: `src/lib/*.ts`
- Database helpers: `src/lib/supabase/*.ts`
- Global styles + theme tokens: `src/app/globals.css`
- DB migrations: `supabase/migrations/*.sql`

## Conventions
- All colours use HSL CSS variables defined in `:root` inside `globals.css`
- Use `bg-background`, `text-foreground`, `bg-card`, etc. — never hard-code hex
- Prefer shadcn/ui components over raw HTML
- Use Lucide icon imports from `lucide-react`
- `"use client"` directive required for any component using hooks or browser APIs
- All API routes must validate input with Zod schemas
- All API routes that modify data must check auth and role via `requireAuth()` helper
- Database: use Supabase RLS policies. Never trust client-side role checks alone.
- User roles: "customer", "tradesperson", "admin" — stored in `profiles.role`
- File uploads: use Supabase Storage with signed URLs
- Error responses: `{ error: string, code?: string }` with appropriate HTTP status
- Test files: `*.test.ts` alongside source files in `src/lib/`

## Dev commands
- `npm install` — install deps
- `npm run dev` — start dev server (port 3000)
- `npx tsc --noEmit` — type check (MUST pass after every step)
- `npm test` — run Jest tests (MUST pass after every step)
- `npx supabase migration new <name>` — create new migration
