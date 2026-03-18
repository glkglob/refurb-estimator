# Refurb Estimator

AI-powered UK property refurbishment cost estimator.

## Features (planned)

- Room-by-room refurbishment cost breakdowns
- Regional pricing adjusted by UK postcode
- Predefined templates (HMO conversion, flip to sell, rental refurb)
- Scenario comparison and budget tracking
- Built-in UK material & labour cost library

## Tech Stack

- **Framework:** Next.js (App Router, webpack mode)
- **Language:** TypeScript
- **Styling:** Tailwind CSS

## Getting Started

```bash
npm install
npm run dev -- --webpack
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Home / landing
│   ├── rooms/page.tsx    # Room-by-room estimator
│   ├── scenarios/page.tsx # Scenario comparison
│   └── budget/page.tsx   # Budget summary
├── components/           # Reusable UI components
└── lib/
    ├── costLibrary.ts    # UK cost data
    └── estimator.ts      # Calculation engine
```

## License

Private — all rights reserved.
