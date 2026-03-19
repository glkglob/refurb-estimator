# Raycast Extension

This extension lets you run a **Quick Estimate** directly inside Raycast by calling your Next.js API endpoint:

- `POST /api/estimate/project`

## Setup

1. Start the web app:

```bash
cd /Users/capp/Documents/uk-property-refurb-estimator
WATCHPACK_POLLING=true npm run dev -- --webpack
```

2. In a new terminal, install extension deps:

```bash
cd /Users/capp/Documents/uk-property-refurb-estimator/raycast-extension
npm install
```

3. Run the Raycast extension in development:

```bash
npm run dev
```

4. In Raycast extension preferences, set:

- `API Base URL` → `http://localhost:3000` (or your deployed app URL)

## Command

- **Quick Estimate**: enter region, property type, area, condition, and finish level to get low/typical/high totals and full category breakdown.
