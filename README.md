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

## Raycast Integration
- Raycast extension lives in [`raycast-extension`](./raycast-extension)
- It calls `POST /api/estimate/project` to run quick estimates from Raycast
- Setup instructions: [`raycast-extension/README.md`](./raycast-extension/README.md)
