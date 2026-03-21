# AGENTS.md — Refurb Estimator

## Stack
- Next.js 15 (App Router), React 19, TypeScript 5
- Tailwind CSS v4 (PostCSS plugin, NOT tailwind.config.js — config lives in `src/app/globals.css` via `@theme inline`)
- shadcn/ui (radix-nova style, CSS variables, Lucide icons)
- Tremor charts for data visualisation
- Supabase for auth + Postgres

## File structure
- Pages: `src/app/*/page.tsx`
- Components: `src/components/*.tsx`
- UI primitives: `src/components/ui/*.tsx`
- Business logic: `src/lib/*.ts`
- Global styles + theme tokens: `src/app/globals.css`

## Conventions
- All colours use HSL CSS variables defined in `:root` inside `globals.css`
- Use `bg-background`, `text-foreground`, `bg-card`, etc. — never hard-code hex in component classes
- Prefer shadcn/ui components over raw HTML
- Use Lucide icon imports from `lucide-react`
- `"use client"` directive required for any component using hooks or browser APIs
- Keep existing Supabase auth logic untouched
- Do NOT modify files in `src/lib/` (estimator logic, cost library, types) unless explicitly told to

## Dev commands
- `npm install` — install deps
- `npm run dev` — start dev server (port 3000)
- `npx tsc --noEmit` — type check
- `npm test` — run Jest tests
