# UK Property Refurb Estimator — Codex Prompts (Improved)

## Analysis of Original Prompts

### Issues found across all 9 steps

1. **No AGENTS.md or persistent context** — Each prompt re-explains the project from scratch. Codex performs better when durable guidance lives in an `AGENTS.md` file at the repo root, and prompts stay short and focused on the delta.

2. **Missing "Done when" criteria** — The original prompts say "run the app and confirm" but don't define specific, testable acceptance criteria. Codex is far more reliable when it knows exactly what "done" looks like (tests pass, specific routes return 200, specific types compile).

3. **No file/folder constraints** — Prompts don't specify which existing files to read or avoid touching. Codex can drift into renaming or restructuring things unnecessarily.

4. **Mixed App Router vs Pages Router** — Step 4 references `pages/index.tsx` but the project uses Next.js App Router (`src/app/page.tsx`). This will confuse Codex into generating the wrong file structure.

5. **No verification commands** — The originals say "run and confirm" but don't give Codex the exact commands (`npm run dev -- --webpack`, `npm test`, `npx tsc --noEmit`). Codex needs these to self-verify.

6. **Overly verbose** — Several prompts include explanatory prose that burns context tokens without adding signal. Codex works best with concise, structured instructions.

7. **No error handling strategy** — Steps don't define how to handle invalid input consistently (throw vs return zeroed result). This leads to inconsistent behaviour across steps.

8. **Missing dependency declarations** — Steps that need new packages (Jest, ts-jest) don't explicitly say "install X". Codex may forget or use wrong versions.

9. **No incremental build-on-previous** — Each step should explicitly reference what exists from prior steps. Without this, Codex may regenerate files it shouldn't touch.

10. **Step 8 is too vague** — "Make forms mobile-friendly with simple CSS" gives Codex no design tokens, breakpoints, or visual reference. It will produce generic output.

---

## Setup: Create AGENTS.md first

Before running any step, create this file at the repo root. Codex auto-loads it and follows it for every subsequent prompt.

**File: `AGENTS.md`**

```markdown
# Project: UK Property Refurb Estimator

## Stack
- Next.js 14+ with App Router (NOT Pages Router)
- TypeScript (strict mode)
- Tailwind CSS for styling
- Jest + ts-jest for testing

## Structure
```
src/
├── app/
│   ├── layout.tsx        # Root layout with nav
│   ├── page.tsx          # Quick Estimate (/)
│   ├── rooms/page.tsx    # Detailed Rooms (/rooms)
│   ├── scenarios/page.tsx # Scenario comparison (/scenarios)
│   └── budget/page.tsx   # Budget tracker (/budget)
├── components/           # Reusable React components
└── lib/
    ├── types.ts          # All TypeScript types
    ├── costLibrary.ts    # UK cost data and helpers
    ├── estimator.ts      # Pure calculation engine
    ├── storage.ts        # localStorage utilities
    └── budget.ts         # Budget tracking helpers
```

## Conventions
- Use functional components with hooks. No class components.
- All calculation logic must be pure functions (no DOM, no global state).
- All currency displayed as £ with thousand separators (e.g. £12,500).
- Invalid input (area ≤ 0, missing required fields) → throw a typed Error, never silently return zeros.
- Use `"use client"` directive on any component that uses hooks or browser APIs.
- Keep each file under 200 lines. Extract components when a file gets long.
- All exports must be named exports (no default exports except page components).

## Dev commands
- `WATCHPACK_POLLING=true npm run dev -- --webpack` — start dev server
- `npx tsc --noEmit` — type-check without building
- `npm test` — run Jest tests
- `npm run build` — production build check

## Verification
After every change:
1. Run `npx tsc --noEmit` and fix any type errors.
2. Run `npm test` and fix any failing tests.
3. If UI changed, confirm affected routes return 200 via the dev server.
```

---

## Step 1 — Project scaffold and basic pages

**Goal:** Create a Next.js TypeScript project with 4 pages and shared navigation.

**Context:** Starting from an empty repo. Follow the structure in AGENTS.md.

**Constraints:**
- Use App Router (`src/app/`), not Pages Router.
- Tailwind CSS for styling.
- Navigation must be a shared `<Nav />` component in `src/components/Nav.tsx`, rendered inside `src/app/layout.tsx`.
- Each page renders an `<h1>` with its name and nothing else yet.

**Create these files:**
- `src/app/layout.tsx` — root layout importing `<Nav />`
- `src/app/page.tsx` — "Quick Estimate"
- `src/app/rooms/page.tsx` — "Detailed Rooms"
- `src/app/scenarios/page.tsx` — "Scenarios"
- `src/app/budget/page.tsx` — "Budget Tracker"
- `src/components/Nav.tsx` — horizontal nav with links to all 4 routes
- `tailwind.config.ts` and `postcss.config.js` if not already present
- `README.md` with setup commands: `npm install`, `WATCHPACK_POLLING=true npm run dev -- --webpack`

**Done when:**
- `npx tsc --noEmit` passes with zero errors.
- Dev server starts and all 4 routes (`/`, `/rooms`, `/scenarios`, `/budget`) return 200.
- Each page shows its `<h1>` and the nav links are present.
- Show me the final folder structure.

---

## Step 2 — TypeScript types and cost library

**Goal:** Add the type system and a realistic UK cost data library.

**Context:** Step 1 is complete. Pages and nav work. Do not modify any existing page files.

**Create `src/lib/types.ts` with these types:**
```
Region = "London" | "SouthEast" | "Midlands" | "North" | "Scotland" | "Wales"
FinishLevel = "budget" | "standard" | "premium"
Condition = "poor" | "fair" | "good"
ProjectType = "refurb"  (extend later)
RoomType = "kitchen" | "bathroom" | "bedroom" | "living" | "hallway" | "utility"
CostCategory = "kitchen" | "bathroom" | "electrics" | "plumbing" | "heating" | "windows" | "doors" | "plastering" | "decoration" | "flooring" | "contingency" | "fees"

EstimateInput = { region, projectType, propertyType: string, totalAreaM2: number, condition, finishLevel, rooms?: RoomInput[] }
RoomInput = { id: string, roomType: RoomType, areaM2: number, intensity: "light" | "full", finishLevel: FinishLevel }
CategoryBreakdown = { category: CostCategory, low: number, typical: number, high: number }
EstimateResult = { totalLow: number, totalTypical: number, totalHigh: number, costPerM2: { low, typical, high }, categories: CategoryBreakdown[] }
Scenario = { id: string, name: string, input: EstimateInput, result: EstimateResult, createdAt: string, updatedAt: string, purchasePrice?: number, gdv?: number }

CostLibrary = { baseRefurbPerM2: { low, typical, high }, regionalMultipliers: Record<Region, number>, conditionMultipliers: Record<Condition, number>, finishMultipliers: Record<FinishLevel, number>, categoryPercents: Record<CostCategory, number>, roomBaseRanges: Record<RoomType, { low, typical, high }> }
```

**Create `src/lib/costLibrary.ts`:**
- Export a `defaultCostLibrary: CostLibrary` object with realistic UK data:
  - Base refurb: low £1,000/m², typical £1,800/m², high £3,200/m²
  - Regional multipliers: London 1.25, SouthEast 1.15, Midlands 1.0, North 0.9, Scotland 0.95, Wales 0.95
  - Condition multipliers: poor 1.3, fair 1.0, good 0.8
  - Finish multipliers: budget 0.75, standard 1.0, premium 1.5
  - Category percentages that sum to 1.0 (kitchen ~18%, bathroom ~15%, electrics ~10%, plumbing ~8%, heating ~8%, windows ~6%, doors ~3%, plastering ~5%, decoration ~7%, flooring ~8%, contingency ~7%, fees ~5%)
  - Room base ranges per room type
- Export helper functions: `getRegionalMultiplier(region)`, `getConditionMultiplier(condition)`, `getFinishMultiplier(finish)`

**Done when:**
- `npx tsc --noEmit` passes with zero errors.
- All types and the cost library are properly exported and importable.
- Category percentages sum to exactly 1.0.

---

## Step 3 — Core estimation engine with tests

**Goal:** Implement the pure calculation engine and comprehensive tests.

**Context:** `src/lib/types.ts` and `src/lib/costLibrary.ts` exist from Step 2. Do not modify them unless fixing a type issue.

**Create `src/lib/estimator.ts`:**
```typescript
export function estimateProject(input: EstimateInput, costLibrary: CostLibrary): EstimateResult
```
- Logic: `area × baseRate × regionalMultiplier × conditionMultiplier × finishMultiplier`
- Compute low/typical/high totals
- Split each into categories using `categoryPercents`
- Calculate `costPerM2` for each tier
- Throw `Error("Area must be greater than zero")` if `totalAreaM2 <= 0`
- The function must be pure — no DOM, no side effects, no global state

**Create `src/lib/estimator.test.ts` with these test cases:**
1. Light refurb: 50m² flat, North, fair condition, budget finish → totals in range £33,750–£144,000 (verify the math: 50 × rate × 0.9 × 1.0 × 0.75)
2. Full refurb: 100m² terrace, London, poor condition, premium finish → significantly higher totals, verify London multiplier applied
3. Mid-range: 75m², Midlands, fair, standard → baseline rates with no multiplier adjustment
4. Zero area: should throw `Error("Area must be greater than zero")`
5. Negative area: should throw `Error("Area must be greater than zero")`
6. Category breakdown: verify all category amounts sum to the total (within £1 rounding tolerance)
7. Cost per m²: verify `result.costPerM2.typical ≈ result.totalTypical / input.totalAreaM2`

**Install dependencies if needed:**
- `npm install --save-dev jest ts-jest @types/jest`
- Create `jest.config.ts` with ts-jest preset
- Add `"test": "jest"` to package.json scripts if missing

**Done when:**
- `npx tsc --noEmit` passes.
- `npm test` passes with all 7+ test cases green.
- Show me the test output.

---

## Step 4 — Quick Estimate UI (/)

**Goal:** Wire the estimation engine into an interactive form on the home page.

**Context:** `estimateProject` in `src/lib/estimator.ts` works and passes tests. Nav and layout exist.

**Modify `src/app/page.tsx`:**
- Add `"use client"` directive at the top.
- Build a form with these fields:
  - Region (dropdown, all 6 regions)
  - Property type (text input, e.g. "flat", "terrace", "semi-detached")
  - Total area m² (number input, min 1)
  - Condition (dropdown: poor/fair/good)
  - Finish level (dropdown: budget/standard/premium)
- On submit, call `estimateProject()` with form values and `defaultCostLibrary`.
- Display results in a clear layout:
  - Summary cards showing Low / Typical / High total costs
  - Cost per m² for each tier
  - A table with columns: Category | Low | Typical | High
  - All currency formatted as £ with thousand separators (use `Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })`)
- Validation: show inline error if area is empty or ≤ 0, required dropdowns must be selected.
- Use Tailwind for layout: responsive grid, readable spacing, clean table styling.

**Extract reusable components to `src/components/`:**
- `EstimateForm.tsx` — the form
- `EstimateResults.tsx` — the results display
- `CurrencyDisplay.tsx` — formatted £ value component

**Done when:**
- `npx tsc --noEmit` passes.
- Dev server: `/` shows the form, submitting produces a results table.
- Entering 0 or negative area shows a validation error, not a crash.
- All currency values display with £ and thousand separators.

---

## Step 5 — Detailed Rooms estimator (/rooms)

**Goal:** Build a room-by-room estimator where users add/remove rooms and see live cost breakdowns.

**Context:** Quick Estimate page works. `estimateProject` exists. Types include `RoomInput`.

**Add to `src/lib/estimator.ts`:**
```typescript
export function estimateRooms(
  rooms: RoomInput[],
  baseInput: Pick<EstimateInput, "region" | "condition">,
  costLibrary: CostLibrary
): EstimateResult
```
- For each room: compute cost from `roomBaseRanges[roomType]` × area × regional multiplier × condition multiplier × intensity multiplier (light 0.6, full 1.0) × finish multiplier.
- Aggregate all rooms into a single `EstimateResult` with category breakdowns.
- Throw if any room has `areaM2 <= 0`.
- Throw if rooms array is empty.

**Add tests in `src/lib/estimator.test.ts`:**
- 1 kitchen (20m²) + 1 bathroom (5m²), London, fair, standard → verify totals are plausible
- Empty rooms array → throws
- Room with zero area → throws

**Modify `src/app/rooms/page.tsx`:**
- `"use client"` directive.
- State: array of `RoomInput` objects, default to 1 kitchen + 1 bathroom.
- "Add room" button → appends a new room with sensible defaults.
- "Remove" button on each room row.
- Each room row: roomType dropdown, areaM2 input, intensity toggle (light/full), finishLevel dropdown.
- Region and condition dropdowns at the top (shared across all rooms).
- Live results update as rooms change (use `useEffect` or compute on render).
- Reuse `EstimateResults.tsx` and `CurrencyDisplay.tsx` from Step 4.

**Done when:**
- `npx tsc --noEmit` passes.
- `npm test` passes including new room tests.
- `/rooms` renders, user can add/remove rooms, results update live.

---

## Step 6 — Scenario saving and comparison (/scenarios)

**Goal:** Persist estimates as named scenarios in localStorage and compare them side by side.

**Context:** Quick Estimate and Rooms pages produce `EstimateResult` objects. `Scenario` type exists in `types.ts`.

**Create `src/lib/storage.ts`:**
```typescript
const STORAGE_KEY = "refurb-scenarios";

export function saveScenario(scenario: Scenario): void
export function loadScenarios(): Scenario[]
export function deleteScenario(id: string): void
export function getScenario(id: string): Scenario | null
```
- All functions must be SSR-safe: check `typeof window !== "undefined"` before accessing localStorage.
- Use `crypto.randomUUID()` for new scenario IDs.
- `saveScenario` should upsert (update if same ID exists, insert if new).

**Modify Quick Estimate and Rooms pages:**
- After results are displayed, show a "Save as Scenario" button.
- Clicking opens a small modal/dialog asking for: scenario name (required), purchase price (optional, £), GDV — gross development value (optional, £).
- On save, construct a `Scenario` object and call `saveScenario()`.
- Show a brief success toast/message.

**Create `src/components/SaveScenarioModal.tsx`** — reusable modal component.

**Modify `src/app/scenarios/page.tsx`:**
- `"use client"` directive.
- Load all scenarios from `loadScenarios()` on mount.
- Render a comparison table:
  - Columns: Name | Total (Typical) | £/m² | Purchase Price | GDV | Profit | ROI %
  - Profit = GDV − Purchase Price − Total Typical Cost (show "—" if GDV or purchase price missing)
  - ROI = Profit / (Purchase Price + Total Typical Cost) × 100 (show "—" if not calculable)
- Delete button per row with confirmation.
- Show empty state message if no scenarios saved.

**Done when:**
- `npx tsc --noEmit` passes.
- Save a scenario from Quick Estimate → it appears on `/scenarios`.
- Save a scenario from Rooms → it appears on `/scenarios`.
- Delete works and refreshing the page retains remaining scenarios.
- Profit and ROI calculate correctly when GDV and purchase price are provided.

---

## Step 7 — Budget tracker (/budget)

**Goal:** Track actual spend against planned estimates for a saved scenario.

**Context:** Scenarios are saved in localStorage via `storage.ts`. `CostCategory` and `EstimateResult` types exist.

**Create `src/lib/budget.ts`:**
```typescript
export interface BudgetActuals {
  scenarioId: string;
  actuals: Record<CostCategory, number>;
  updatedAt: string;
}

export function saveBudgetActuals(actuals: BudgetActuals): void
export function loadBudgetActuals(scenarioId: string): BudgetActuals | null
```
- Store in localStorage with key `refurb-budget-{scenarioId}`.
- SSR-safe.

**Modify `src/app/budget/page.tsx`:**
- `"use client"` directive.
- Dropdown to select a saved scenario (loaded from `loadScenarios()`).
- Show empty state if no scenarios exist — link to Quick Estimate page.
- When a scenario is selected, render a table:
  - Columns: Category | Planned (Typical) | Actual | Variance | Status
  - "Actual" column is an editable number input per row.
  - Variance = Actual − Planned.
  - Status: green tick if actual ≤ planned, amber warning if actual ≤ planned × 1.1, red alert if actual > planned × 1.1.
- Summary row at bottom: Total Planned | Total Actual | Total Variance.
- Auto-save actuals to localStorage on every change (debounce 500ms).
- Data persists on page refresh.

**Done when:**
- `npx tsc --noEmit` passes.
- `/budget` shows scenario dropdown, selecting one shows the tracking table.
- Editing actual values persists across page refresh.
- Over-budget rows (>10% over planned) are visually highlighted in red.

---

## Step 8 — UX polish for UK users

**Goal:** Make the app feel polished and usable for non-technical UK property investors.

**Context:** All pages functional. Tailwind CSS in use.

**Specific changes:**

1. **Tooltips/helper text** — Add `title` attributes or small `(?)` info icons next to these terms:
   - "First fix" → "Initial installation of electrical wiring, plumbing pipes, and heating before plastering."
   - "Second fix" → "Final fitting of sockets, taps, radiators, and light fixtures after plastering."
   - "M&E" → "Mechanical & Electrical — heating, ventilation, plumbing, and electrical systems."
   - "Contingency" → "A buffer (typically 5–10%) for unexpected costs during the refurbishment."
   - "GDV" → "Gross Development Value — the estimated market value of the property after refurbishment."
   - "ROI" → "Return on Investment — profit as a percentage of total costs."
   Create a `src/components/InfoTooltip.tsx` component that takes `term` and `explanation` props.

2. **Currency formatting** — Audit all pages. Every £ value must use `Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })`. If `CurrencyDisplay.tsx` exists, ensure it's used everywhere.

3. **Responsive layout** — All forms and tables must be usable at 375px width (iPhone SE):
   - Forms: single column below `sm:` breakpoint.
   - Tables: horizontal scroll wrapper on mobile, or stack into card layout.
   - Nav: collapsible hamburger menu below `md:` breakpoint.
   - Test by resizing browser to 375px.

4. **Form UX:**
   - All required fields show red border + error text if submitted empty.
   - Number inputs have `min`, `step`, and `placeholder` attributes.
   - Submit button shows brief loading state while calculating (even if fast, add 200ms artificial delay for feedback).
   - After successful estimate, smooth scroll to results section.

5. **Empty states** — Every page that depends on data should have a clear empty state:
   - `/scenarios` with no saved scenarios → "No scenarios yet. Create one from the Quick Estimate or Rooms page."
   - `/budget` with no scenarios → "Save a scenario first to start tracking your budget."

**Done when:**
- `npx tsc --noEmit` passes.
- All tooltips render correctly on hover/focus.
- All £ values formatted consistently.
- Layout works at 375px, 768px, and 1280px widths — no horizontal overflow or unreadable text.
- Form validation shows clear inline errors.

---

## Step 9 — Documentation

**Goal:** Write clear documentation for developers and users.

**Context:** All features complete. Do not modify any source code in this step.

**Update `README.md`:**
```markdown
# Refurb Estimator

AI-powered UK property refurbishment cost estimator.

## Prerequisites
- Node.js 18+ (LTS recommended)
- npm 9+

## Setup
npm install
WATCHPACK_POLLING=true npm run dev -- --webpack
Open http://localhost:3000

## Testing
npm test

## Pages
- **/** — Quick Estimate: enter property details, get instant low/typical/high cost breakdown
- **/rooms** — Detailed Rooms: add individual rooms for granular cost estimates
- **/scenarios** — Scenarios: save and compare multiple estimates with profit/ROI analysis
- **/budget** — Budget Tracker: track actual spend against planned costs per category

## Customising Cost Data
Edit `src/lib/costLibrary.ts` to adjust:
- `baseRefurbPerM2` — overall refurb cost per m² (low/typical/high)
- `regionalMultipliers` — price adjustment by UK region
- `conditionMultipliers` — adjustment for property condition
- `finishMultipliers` — adjustment for finish quality level
- `categoryPercents` — how total cost splits across categories (must sum to 1.0)
- `roomBaseRanges` — base cost ranges per room type

## Tech Stack
- Next.js 14+ (App Router, webpack mode)
- TypeScript (strict)
- Tailwind CSS
- Jest + ts-jest

## Build
npm run build
```

**Create `docs/ROADMAP.md`:**
```markdown
# Roadmap

## Phase 2 — Data & persistence
- [ ] User authentication (NextAuth.js or Clerk)
- [ ] Backend database (Supabase or PlanetScale) to replace localStorage
- [ ] Cloud sync of scenarios and budgets across devices

## Phase 3 — Intelligence
- [ ] Live material price API integration (e.g. Travis Perkins, Screwfix price feeds)
- [ ] AI text-to-estimate: describe a project in plain English, get a cost estimate
- [ ] Photo-to-estimate: upload property photos, AI suggests refurb scope and costs
- [ ] Postcode-level pricing using Land Registry and regional trade data

## Phase 4 — Output & sharing
- [ ] Export estimates to PDF with professional formatting
- [ ] Export to Excel/CSV for accountants and lenders
- [ ] Shareable estimate links
- [ ] White-label mode for property professionals

## Phase 5 — Scale
- [ ] Multi-property portfolio dashboard
- [ ] Contractor marketplace integration
- [ ] HMO conversion calculator with licensing requirements
- [ ] Planning permission checker by local authority
```

**Done when:**
- README.md is accurate, commands work as documented.
- `docs/ROADMAP.md` exists with the above content.
- No source code files were modified in this step.
