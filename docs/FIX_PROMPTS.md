# Refurb Estimator — Fix & Polish Prompts for Codex

Steps 14–19 continue from the existing 13-step build. Run them in order.

> **Before you start:** Push the AGENTS.md update below first, then run each step as a separate Codex task.

---

## AGENTS.md Update

Add this section to the bottom of your existing `AGENTS.md` (create the file at repo root if it doesn't exist):

```markdown
# Project: UK Property Refurb Estimator

## Stack
- Next.js 16.2.0 with App Router (`src/app/`) — NEVER create a `pages/` directory
- TypeScript strict mode
- Tailwind CSS v4 (CSS-only config via `@import "tailwindcss"` in globals.css — there is NO tailwind.config.ts)
- shadcn/ui components in `src/components/ui/`
- Tremor charts (`@tremor/react`) for data visualisation
- Supabase Auth + PostgreSQL with localStorage fallback
- Jest + ts-jest for unit tests (15 tests in `src/lib/estimator.test.ts`)

## Key rules
- All interactive components MUST have `"use client"` directive at the top
- DO NOT use Playwright or any browser tools. Verify with `npx tsc --noEmit` and `npm test`. The user will check the UI manually.
- DO NOT use `desktop_commander` or `start_process`
- Run dev server with: `WATCHPACK_POLLING=true npm run dev -- --webpack`
- Install packages with: `npm install --legacy-peer-deps` (Tremor needs React 18, project uses React 19)

## Structure
```
src/
├── app/
│   ├── globals.css           # Tailwind v4 CSS config + theme variables
│   ├── layout.tsx            # Root layout (Geist font, Toaster, TooltipProvider)
│   ├── page.tsx              # Quick Estimate (/)
│   ├── rooms/page.tsx        # Detailed Rooms (/rooms)
│   ├── scenarios/page.tsx    # Scenario Comparison (/scenarios)
│   ├── budget/page.tsx       # Budget Tracker (/budget)
│   └── auth/
│       ├── login/page.tsx
│       ├── signup/page.tsx
│       └── forgot-password/page.tsx
├── components/
│   ├── Header.tsx            # Main nav with mobile Sheet drawer
│   ├── Layout.tsx            # Shell wrapper (Header + main)
│   ├── EstimateForm.tsx      # Quick Estimate form with validation
│   ├── EstimateResults.tsx   # Results display (cards, donut chart, table)
│   ├── SaveScenarioModal.tsx # Dialog for saving a scenario
│   ├── CurrencyDisplay.tsx   # GBP formatter component
│   ├── TermTooltip.tsx       # Info tooltip (Contingency, Fees, GDV, ROI)
│   └── ui/                   # shadcn/ui primitives (DO NOT edit these)
├── hooks/
│   └── use-toast.ts
├── lib/
│   ├── types.ts              # All TypeScript types
│   ├── costLibrary.ts        # UK cost data with regional multipliers
│   ├── estimator.ts          # Pure calculation engine
│   ├── estimator.test.ts     # Jest tests (15 passing)
│   ├── storage.ts            # localStorage CRUD for scenarios
│   ├── budget.ts             # localStorage CRUD for budget actuals
│   ├── dataService.ts        # Unified data layer (Supabase if auth'd, localStorage fallback)
│   ├── utils.ts              # cn() utility
│   └── supabase/
│       ├── client.ts         # Browser Supabase client
│       ├── server.ts         # Server Supabase client
│       ├── middleware.ts      # Auth middleware (protected routes)
│       └── db.ts             # Supabase CRUD (6 functions)
└── middleware.ts              # Next.js middleware entry point

## Theme
- Primary colour: teal (HSL 166 91% 30%)
- Background: warm off-white (HSL 40 20% 98%)
- Cards: white with subtle ring border
- Destructive: red (HSL 0 84% 60%)
- Font: Geist sans-serif
```

## Verification
After every change, run:
1. `npx tsc --noEmit` — must pass with zero errors
2. `npm test` — all 15 tests must pass
3. Do NOT start a dev server or use Playwright
```

---

## Step 14 — Visual Polish

### Goal
Fix the donut chart colours, add visual hierarchy to summary cards, capitalise dropdown values, and improve the cost breakdown table styling.

### Context
- `src/components/EstimateResults.tsx` — renders the results section. The `DonutChart` currently passes a `colors` array but the chart renders as solid black because Tremor v3 in Tailwind v4 can't resolve named colour tokens. The summary cards (Low/Typical/High) all look identical. The table needs better row styling.
- `src/components/EstimateForm.tsx` — renders dropdowns. The `conditions` array contains lowercase values `["poor", "fair", "good"]` and `finishLevels` contains `["budget", "standard", "premium"]`. These render as-is in the `<SelectItem>`.
- `src/app/rooms/page.tsx` — also has dropdowns for conditions, room types, and finish levels that need capitalisation.

### Constraints
- Do NOT edit any files in `src/components/ui/`.
- Do NOT change the data model or types.
- Keep all existing functionality working.

### Tasks

#### 14a — Fix donut chart
In `src/components/EstimateResults.tsx`:
1. Replace the Tremor named `colors` prop with explicit hex colours that match the teal/slate theme:
```tsx
colors={[
  "#0d9488",  // teal-600
  "#06b6d4",  // cyan-500
  "#3b82f6",  // blue-500
  "#6366f1",  // indigo-500
  "#64748b",  // slate-500
  "#10b981",  // emerald-500
  "#f59e0b",  // amber-500
  "#8b5cf6",  // violet-500
  "#f43f5e",  // rose-500
  "#78716c",  // stone-500
  "#84cc16",  // lime-500
  "#f97316",  // orange-500
]}
```
2. Add `showTooltip` prop to the DonutChart.
3. Below the DonutChart, add a simple flex-wrap legend showing coloured dots with category names:
```tsx
<div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
  {donutData.map((item, i) => (
    <div key={item.name} className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
      />
      <span>{item.name}</span>
    </div>
  ))}
</div>
```
Define `CHART_COLORS` as a `const` array at the top of the file with the hex values above.

#### 14b — Add hierarchy to summary cards
In `src/components/EstimateResults.tsx`, update the summary cards section:
- **Low card:** Add a green-tinted left border: `className="flex-1 border-l-4 border-l-emerald-400 shadow-sm"`
- **Typical card:** Make it stand out as the primary card: `className="flex-1 border-l-4 border-l-primary bg-primary/5 shadow-md"`. Change the label to include a small badge: add `<Badge variant="secondary" className="ml-2 text-[10px]">Recommended</Badge>` next to the "Typical" text.
- **High card:** Add an amber-tinted left border: `className="flex-1 border-l-4 border-l-amber-400 shadow-sm"`

Import `Badge` from `@/components/ui/badge`.

#### 14c — Capitalise dropdown display values
In `src/components/EstimateForm.tsx`:
- For the `conditions` dropdown, change the `<SelectItem>` children from `{condition}` to `{condition.charAt(0).toUpperCase() + condition.slice(1)}`.
- For the `finishLevels` dropdown, same capitalisation: `{finish.charAt(0).toUpperCase() + finish.slice(1)}`.
- The `regions` and `propertyTypes` arrays are already capitalised — leave them alone.

In `src/app/rooms/page.tsx`:
- Apply the same capitalisation to `conditions`, `roomTypes`, and `finishLevels` dropdown display text.
- Keep the `value` prop unchanged (lowercase) — only the display text changes.

#### 14d — Improve cost breakdown table
In `src/components/EstimateResults.tsx`, the table already has alternating rows (`bg-card` / `bg-muted/20`) and a `bg-muted/60` header. Add:
1. `hover:bg-muted/40` to every `<TableRow>` in the body (add to the existing className).
2. Bold the "Typical" column header: change the Typical `<TableHead>` to include `className="px-4 font-semibold text-foreground"`.
3. Bold the Typical column values: wrap the Typical `<TableCell>` content with `<span className="font-medium">`.

### Done when
1. `npx tsc --noEmit` passes with zero errors.
2. `npm test` — all 15 tests pass.
3. No new lint warnings.

---

## Step 15 — Unlock Pages for Testers

### Goal
Remove the auth-gate redirect on `/scenarios` and `/budget` so unauthenticated users can access these pages with localStorage data. Show a subtle sign-in prompt instead of blocking access.

### Context
- `src/lib/supabase/middleware.ts` — contains `PROTECTED_ROUTES = ["/scenarios", "/budget"]`. When no user session exists, the middleware redirects to `/auth/login`. This blocks testers from seeing 50% of the app.
- `src/lib/dataService.ts` — the unified data layer already falls back to localStorage when the user is not authenticated. The pages will work fine without auth.
- `src/app/scenarios/page.tsx` and `src/app/budget/page.tsx` — both already handle loading errors gracefully with fallback data.

### Constraints
- Do NOT remove the Supabase auth system — it must still work for signed-in users.
- Do NOT change any `src/lib/` files.
- Do NOT edit any files in `src/components/ui/`.

### Tasks

#### 15a — Remove auth redirect
In `src/lib/supabase/middleware.ts`:
1. Change `PROTECTED_ROUTES` to an empty array: `const PROTECTED_ROUTES: string[] = [];`
2. Leave the rest of the middleware unchanged (session refresh, logged-in redirect from auth pages).

#### 15b — Add sign-in prompt banner
Create a new component `src/components/AuthBanner.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function AuthBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return;
    }

    let isActive = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (isActive && !data.user) {
        setShow(true);
      }
    });

    return () => { isActive = false; };
  }, []);

  if (!show) {
    return null;
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
      <span>Your data is saved locally. </span>
      <Button variant="link" className="h-auto p-0 text-sm font-medium text-primary" asChild>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <span> to sync across devices.</span>
    </div>
  );
}
```

#### 15c — Add banner to pages
In `src/app/scenarios/page.tsx`:
- Import `AuthBanner` from `@/components/AuthBanner`.
- Add `<AuthBanner />` immediately after the `<h1>` heading, before the loading/error messages.

In `src/app/budget/page.tsx`:
- Same: import and add `<AuthBanner />` after the `<h1>` heading.

In `src/app/page.tsx` (Quick Estimate):
- Same: import and add `<AuthBanner />` after the `<p>` subtitle text (before `<div id="estimate-form">`).

In `src/app/rooms/page.tsx`:
- Same: import and add `<AuthBanner />` after the page heading.

### Done when
1. `npx tsc --noEmit` passes with zero errors.
2. `npm test` — all 15 tests pass.
3. Navigating to `/scenarios` and `/budget` while logged out shows the page content (not a redirect to login).
4. The sign-in banner appears on all four main pages when not logged in.
5. When logged in, the banner does not appear.

---

## Step 16 — Footer, Empty States, and Validation Polish

### Goal
Add a site footer, improve empty states on Scenarios and Budget pages, and ensure form validation is clearly visible.

### Context
- `src/components/Layout.tsx` — the shell wrapper. Currently has Header + main content. No footer.
- `src/app/scenarios/page.tsx` — already has a basic empty state card with links. Needs enhancement.
- `src/app/budget/page.tsx` — needs an empty state for when no scenarios exist yet.
- `src/components/EstimateForm.tsx` — already has per-field validation with red error text and red borders. This is working but could use a summary toast.

### Constraints
- Do NOT edit any files in `src/components/ui/`.
- Do NOT change the data model or types.
- Keep the existing validation logic in `EstimateForm.tsx`.

### Tasks

#### 16a — Add footer
In `src/components/Layout.tsx`:
1. Add a `<footer>` below `<main>`:
```tsx
<footer className="mt-auto border-t border-border bg-muted/30 py-6">
  <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
    <p className="text-xs text-muted-foreground">
      Estimates are indicative only, based on average UK refurbishment costs.
      Actual costs vary by property, specification, and contractor.
    </p>
    <p className="mt-1 text-xs text-muted-foreground">
      © 2026 Refurb Estimator
    </p>
  </div>
</footer>
```
2. Update the wrapper `<div>` to use `flex flex-col` so the footer sticks to the bottom:
```tsx
<div className="flex min-h-screen flex-col bg-background text-foreground">
  <Header />
  <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
  <footer>...</footer>
</div>
```

#### 16b — Improve empty state on Scenarios page
In `src/app/scenarios/page.tsx`, replace the existing empty state card (the `sortedScenarios.length === 0` block) with:
```tsx
<Card className="py-12 text-center shadow-sm">
  <CardContent className="space-y-3">
    <p className="text-lg font-medium text-foreground">No scenarios saved yet</p>
    <p className="text-sm text-muted-foreground">
      Run an estimate and click &ldquo;Save as Scenario&rdquo; to start comparing options.
    </p>
    <div className="flex justify-center gap-2 pt-2">
      <Button variant="default" asChild>
        <Link href="/">Quick Estimate</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/rooms">Detailed Rooms</Link>
      </Button>
    </div>
  </CardContent>
</Card>
```
Make sure `Button` is imported (it already is).

#### 16c — Improve empty state on Budget page
In `src/app/budget/page.tsx`, find the empty state (when `scenarios.length === 0` after loading). Replace it with:
```tsx
<Card className="py-12 text-center shadow-sm">
  <CardContent className="space-y-3">
    <p className="text-lg font-medium text-foreground">No scenarios to track</p>
    <p className="text-sm text-muted-foreground">
      Save a scenario first, then come back here to track actual spend against your estimate.
    </p>
    <div className="flex justify-center gap-2 pt-2">
      <Button variant="default" asChild>
        <Link href="/">Quick Estimate</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/rooms">Detailed Rooms</Link>
      </Button>
    </div>
  </CardContent>
</Card>
```
Make sure `Button` is imported.

#### 16d — Add validation toast
In `src/app/page.tsx`, when the form validation fails, a `submitError` string is shown. But the validation happens inside `EstimateForm.tsx` and never triggers the parent error state.

In `src/components/EstimateForm.tsx`:
1. Add a prop `onValidationError?: () => void` to `EstimateFormProps`.
2. In the `handleSubmit` function, after `setErrors(validationErrors)`, if there are errors, call `onValidationError?.()` and then return.
3. In `src/app/page.tsx`, pass `onValidationError` to `EstimateForm`:
```tsx
<EstimateForm
  key={formKey}
  onSubmit={handleSubmit}
  onValidationError={() =>
    toast({
      title: "Missing fields",
      description: "Please fill in all required fields before calculating.",
      variant: "destructive",
    })
  }
/>
```

### Done when
1. `npx tsc --noEmit` passes with zero errors.
2. `npm test` — all 15 tests pass.
3. A footer is visible at the bottom of every page.
4. Empty Scenarios page shows a centered card with CTA buttons.
5. Empty Budget page shows a centered card with CTA buttons.
6. Submitting the Quick Estimate form with empty fields shows a destructive toast.

---

## Step 17 — Loading States and Error Boundaries

### Goal
Add loading spinners to buttons during async operations and create error boundary pages for graceful crash recovery.

### Context
- `src/app/page.tsx` — the "Calculate estimate" action is synchronous (pure function call), but "Save as Scenario" is async.
- `src/app/scenarios/page.tsx` — `loadScenarios()` is async but only shows "Loading scenarios..." text.
- `src/app/budget/page.tsx` — same pattern.
- Next.js App Router supports `error.tsx` files for automatic error boundaries.

### Constraints
- Do NOT edit any files in `src/components/ui/`.
- Do NOT change any `src/lib/` files.
- All new files must use `"use client"` where needed.

### Tasks

#### 17a — Add loading spinner to Save Scenario
In `src/app/page.tsx`:
1. Add a `[isSaving, setIsSaving]` state (default `false`).
2. Wrap the `handleSaveScenario` function body:
   - Set `setIsSaving(true)` at the start.
   - Set `setIsSaving(false)` in a `finally` block.
3. On the "Save as Scenario" `<Button>`, add `disabled={isSaving}`.
4. Import `Loader2` from `lucide-react`. When `isSaving` is true, show a spinning icon:
```tsx
<Button type="button" variant="default" onClick={() => setIsSaveModalOpen(true)} disabled={isSaving}>
  {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
  Save as Scenario
</Button>
```

#### 17b — Add skeleton loading to Scenarios page
In `src/app/scenarios/page.tsx`, replace the loading text `"Loading scenarios..."` with skeleton cards:
```tsx
{isLoading ? (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <Card key={i} className="shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    ))}
  </div>
) : null}
```

#### 17c — Add skeleton loading to Budget page
In `src/app/budget/page.tsx`, same pattern — replace the loading text with skeleton cards (same JSX as 17b).

#### 17d — Add global error boundary
Create `src/app/error.tsx`:
```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <section className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md text-center shadow-sm">
        <CardContent className="space-y-4 p-8">
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
          <Button variant="default" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
```

#### 17e — Add not-found page
Create `src/app/not-found.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <section className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md text-center shadow-sm">
        <CardContent className="space-y-4 p-8">
          <h2 className="text-lg font-semibold text-foreground">Page not found</h2>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button variant="default" asChild>
            <Link href="/">Go to Quick Estimate</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
```

### Done when
1. `npx tsc --noEmit` passes with zero errors.
2. `npm test` — all 15 tests pass.
3. `src/app/error.tsx` and `src/app/not-found.tsx` exist and export default components.
4. The Scenarios and Budget pages show skeleton cards while loading.
5. Navigating to `/nonexistent` shows the "Page not found" card.

---

## Step 18 — Code Cleanup

### Goal
Remove dead files, update the roadmap, and clean up the repository.

### Context
- `src/styles/globals.css` — old scaffold file, not imported anywhere. Dead code.
- `tailwind.config.ts` — Tailwind v3 config file. The project uses Tailwind v4 with CSS-only config in `src/app/globals.css`. This file is not referenced anywhere and causes confusion.
- `docs/ROADMAP.md` — Phase 2 tasks (auth, database, cloud sync) are all complete but still shown as `[ ]`.
- Old `app/` directory files at root level (`app/budget/page.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/rooms/page.tsx`, `app/scenarios/page.tsx`, `components/SiteLayout.tsx`) — these were from the initial scaffold before moving to `src/app/`. Check if they still exist and delete them.

### Constraints
- Do NOT delete or modify anything in `src/`.
- Do NOT change any functionality.

### Tasks

#### 18a — Delete dead files
Delete these files if they exist:
- `src/styles/globals.css`
- `tailwind.config.ts`
- `app/budget/page.tsx`
- `app/layout.tsx`
- `app/page.tsx`
- `app/rooms/page.tsx`
- `app/scenarios/page.tsx`
- `components/SiteLayout.tsx`

#### 18b — Update ROADMAP.md
Replace `docs/ROADMAP.md` with:
```markdown
# Roadmap

## Phase 1 — MVP ✅
- [x] Pure calculation engine with UK cost data
- [x] Quick Estimate page (whole-property)
- [x] Detailed Rooms page (room-by-room)
- [x] Scenario Comparison page with charts
- [x] Budget Tracker with variance analysis
- [x] 15 unit tests passing
- [x] Deployed to Vercel

## Phase 2 — Data & Persistence ✅
- [x] Supabase Auth (email/password)
- [x] Supabase PostgreSQL database
- [x] Cloud sync with localStorage fallback
- [x] Login, signup, forgot-password flows

## Phase 3 — Visual & UX Polish ✅
- [x] shadcn/ui component library
- [x] Tremor charts (donut + bar)
- [x] Teal/slate theme with CSS variables
- [x] Mobile responsive layout with Sheet drawer nav
- [x] Tooltips for financial terms (Contingency, Fees, GDV, ROI)

## Phase 4 — Intelligence (Next)
- [ ] Live material price API integration (Travis Perkins, Screwfix)
- [ ] AI text-to-estimate: describe a project, get a cost estimate
- [ ] Photo-to-estimate: upload property photos, AI suggests scope and costs
- [ ] Postcode-level pricing using Land Registry and regional trade data

## Phase 5 — Output & Sharing
- [ ] Export estimates to PDF with professional formatting
- [ ] Export to Excel/CSV for accountants and lenders
- [ ] Shareable estimate links
- [ ] White-label mode for property professionals

## Phase 6 — Scale
- [ ] Multi-property portfolio dashboard
- [ ] Contractor marketplace integration
- [ ] HMO conversion calculator with licensing requirements
- [ ] Planning permission checker by local authority
```

#### 18c — Create AGENTS.md
Create `AGENTS.md` at the repo root with the content from the "AGENTS.md Update" section at the top of this document.

### Done when
1. `npx tsc --noEmit` passes with zero errors.
2. `npm test` — all 15 tests pass.
3. `tailwind.config.ts` does not exist.
4. `src/styles/globals.css` does not exist.
5. `docs/ROADMAP.md` shows Phase 1–3 as complete.
6. `AGENTS.md` exists at the repo root.

---

## Step 19 — Mobile Responsive Fixes

### Goal
Verify and fix the mobile layout at 375px width (iPhone SE). Ensure the hamburger menu works, forms stack to single column, charts don't overflow, and tables scroll horizontally.

### Context
- `src/components/Header.tsx` — uses a `Sheet` drawer for mobile nav (triggered by hamburger icon), visible at `md:hidden`. Desktop nav is `hidden md:flex`.
- Form grids use `grid-cols-1 sm:grid-cols-2` — should stack on mobile.
- The cost breakdown table has `min-w-[760px]` inside an `overflow-x-auto` wrapper — needs the wrapper.
- Tremor charts may overflow their container on very narrow screens.

### Constraints
- Do NOT edit any files in `src/components/ui/`.
- Do NOT change any `src/lib/` files.
- Test by examining the code for responsive issues — do NOT use Playwright.

### Tasks

#### 19a — Ensure charts are responsive
In `src/components/EstimateResults.tsx`:
1. Verify the donut chart has `className="h-56 md:h-72"` (it does).
2. Wrap the donut chart card content in `<div className="overflow-x-auto">` to prevent horizontal overflow.

In `src/app/scenarios/page.tsx`:
1. Wrap each `BarChart` in `<div className="overflow-x-auto">`.
2. Add `className="min-w-[500px]"` to each `BarChart` so it scrolls gracefully on narrow screens instead of squishing.

In `src/app/budget/page.tsx`:
1. Same: wrap the BarChart in `<div className="overflow-x-auto">` and add `min-w-[500px]`.

#### 19b — Ensure tables scroll on mobile
In `src/components/EstimateResults.tsx`:
1. The table already has `min-w-[760px]`. Verify the parent `<Card>` wraps it in `overflow-x-auto`. If not, add it:
```tsx
<CardContent className="overflow-x-auto space-y-2 p-0">
```

In `src/app/scenarios/page.tsx`:
1. The scenario table wrapper already has `overflow-x-auto rounded-lg border`. Verify `min-w-[960px]` is on the Table. This is correct.

In `src/app/budget/page.tsx`:
1. Same check — ensure the budget table has `overflow-x-auto` on its wrapper and `min-w-` on the Table.

#### 19c — Fix summary cards on mobile
In `src/components/EstimateResults.tsx`:
1. The summary cards use `flex flex-col gap-4 md:flex-row`. This is correct — they stack on mobile and go horizontal on desktop.
2. Make sure the currency amounts don't wrap awkwardly. Add `whitespace-nowrap` to the price `<p>`:
```tsx
<p className="whitespace-nowrap text-2xl font-semibold">
```

#### 19d — Verify mobile nav
In `src/components/Header.tsx`:
1. The hamburger button is `md:hidden` — correct.
2. The Sheet drawer uses `side="right"` and `w-[85vw] max-w-sm` — correct.
3. Verify that `SheetClose` wraps every nav link so the drawer closes on navigation — it does.
4. No changes needed unless TypeScript check reveals issues.

### Done when
1. `npx tsc --noEmit` passes with zero errors.
2. `npm test` — all 15 tests pass.
3. All charts are wrapped in `overflow-x-auto` containers.
4. All data tables have `overflow-x-auto` on their wrapper elements.
5. Summary card prices have `whitespace-nowrap`.

---

## Summary: Run Order

| Step | Focus | Files changed | Risk |
|------|-------|---------------|------|
| 14 | Visual polish | EstimateResults.tsx, EstimateForm.tsx, rooms/page.tsx | Low |
| 15 | Unlock pages | supabase/middleware.ts, AuthBanner.tsx (new), 4 page files | Medium |
| 16 | Footer + empty states | Layout.tsx, scenarios/page.tsx, budget/page.tsx, EstimateForm.tsx, page.tsx | Low |
| 17 | Loading + errors | page.tsx, scenarios/page.tsx, budget/page.tsx, error.tsx (new), not-found.tsx (new) | Low |
| 18 | Cleanup | Delete dead files, update ROADMAP.md, create AGENTS.md | None |
| 19 | Mobile responsive | EstimateResults.tsx, scenarios/page.tsx, budget/page.tsx | Low |

After each step, verify locally with `npx tsc --noEmit` and `npm test`, then commit and push. Vercel will auto-deploy.
