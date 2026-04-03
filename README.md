# Refurb Estimator Platform

## Platform Overview
Refurb Estimator is a UK-focused property cost platform combining refurbishment and new-build estimate engines with AI photo analysis, scenario planning, budget tracking, shareable outputs, and a tradesperson ecosystem (profiles, gallery, notifications, and admin tooling).

## Supported Property Types
The platform uses a single `PropertyType` enum across UI, API, and estimator logic. Supported values are:

- `Detached House` — standalone residential homes.
- `Semi-Detached House` — linked pair housing stock.
- `Terraced House` — mid-terrace residential properties.
- `End-Off-Terrace` — end-terrace units with one exposed side.
- `Bungalow` — single-storey residential homes.
- `Cottage` — smaller traditional houses, often with bespoke constraints.
- `Flat / Apartment` — single dwellings in multi-unit buildings.
- `Maisonette` — split-level flats with independent entrances.
- `Townhouse` — multi-storey residential homes on tighter plots.
- `Office` — business workspace developments and fit-outs.
- `Retail` — shopfront and customer-facing commercial units.
- `Industrial` — warehouse/light-industrial construction and refurbishment.
- `Leisure` — hospitality, gym, or venue-led commercial projects.
- `Healthcare` — clinical and care-related buildings with compliance overhead.

## Tech Stack
- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui + Lucide + Tremor charts
- Supabase Auth + PostgreSQL + RLS + Storage
- Zod v4 validation
- Jest test suite
- pdf-lib for estimate PDF export
- Capacitor configuration for iOS packaging

## Getting Started
1. Install dependencies:
```bash
npm install
```
2. Configure environment:
```bash
cp .env.local.example .env.local
```
3. Fill required env vars in `.env.local` (Supabase + OpenAI if using AI photo estimate).
4. Start development server:
```bash
WATCHPACK_POLLING=true npm run dev -- --webpack
```
5. Open [http://localhost:3000](http://localhost:3000).

## Database Migrations (Supabase CLI)
Use Supabase CLI to apply SQL migrations in `supabase/migrations/`.

```bash
supabase db push
```

If creating a new migration:
```bash
npx supabase migration new <name>
```

## API Routes (v1)
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v1/estimate/project` | Refurb project estimate |
| POST | `/api/v1/estimate/pdf` | Generate estimate PDF |
| POST | `/api/v1/estimate/csv` | Generate estimate CSV |
| POST | `/api/v1/estimate/new-build` | New-build estimate |
| POST | `/api/v1/estimate/share` | Create shareable estimate link |
| POST | `/api/v1/ai/photo-estimate` | AI photo-to-estimate |
| GET, PATCH | `/api/v1/profile` | Current user profile |
| GET | `/api/v1/profile/[userId]` | Public tradesperson profile |
| GET, POST | `/api/v1/gallery` | Public gallery list, create gallery item |
| GET, PATCH, DELETE | `/api/v1/gallery/[itemId]` | Read/update/delete gallery item |
| GET | `/api/v1/gallery/my` | Current user gallery items |
| GET | `/api/v1/notifications` | User notifications list |
| POST | `/api/v1/notifications/read` | Mark one/all notifications read |
| GET | `/api/v1/notifications/count` | Unread notification count |
| POST | `/api/v1/upload` | Storage upload endpoint |
| GET, PATCH | `/api/v1/admin/users` | Admin user management |

## AI Design Upload Workflow
`POST /api/v1/ai/upload` accepts a multipart image upload, validates file type/size, stores the image in Supabase Storage (`design-uploads`), creates a signed URL, calls the AI design workflow, and persists generation metadata to `public.design_generations`.

### Required Environment Variables
| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (server session auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key used for storage + metadata persistence |
| `OPENAI_API_KEY` | Yes | API key used by `services/ai.ts` |
| `OPENAI_DESIGN_METADATA_MODEL` | No | Override AI metadata model (default: `gpt-4.1-mini`) |
| `SUPABASE_DESIGN_UPLOAD_BUCKET` | No | Storage bucket name (default: `design-uploads`) |
| `DESIGN_SIGNED_URL_EXPIRY_SECONDS` | No | Signed URL TTL in seconds (default: `3600`) |

### Example curl (authenticated session)
```bash
curl -X POST "http://localhost:3000/api/v1/ai/upload" \
  -H "Cookie: sb-access-token=<access-token>; sb-refresh-token=<refresh-token>" \
  -F "file=@/absolute/path/to/room.jpg;type=image/jpeg" \
  -F "region=london" \
  -F "projectType=loft" \
  -F "promptHint=Bright modern storage-focused loft" \
  -F "width=1024" \
  -F "height=1024"
```

### Example successful response
```json
{
  "bucket": "design-uploads",
  "path": "user-id/2026-04-02/uuid.jpg",
  "signedUrl": "https://<project>.supabase.co/storage/v1/object/sign/design-uploads/...",
  "signedUrlExpirySeconds": 3600,
  "design": {
    "prompt": "Design prompt text...",
    "seed": 998877,
    "width": 1024,
    "height": 1024,
    "region": "london",
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "createdAt": "2026-04-02T10:30:00.000Z"
  }
}
```

## Supplier Pricing Ingestion (B&Q)
Supplier pricing sync is implemented with Playwright scraping + Postgres persistence. Latest supplier prices are used automatically by the new-build estimator API.

### Required Environment Variables
| Variable | Required | Description |
|---|---|---|
| `SUPABASE_DB_URL` | Yes* | Direct Postgres connection string for sync + estimator supplier overrides |
| `DATABASE_URL` | Yes* | Fallback Postgres connection string if `SUPABASE_DB_URL` is not set |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for server-side Supabase operations |

\* Set at least one of `SUPABASE_DB_URL` or `DATABASE_URL`.

### Apply schema
```bash
psql "$SUPABASE_DB_URL" -f db/schema.sql
```

### Run sync job
```bash
npm run sync:bq
```

### Example curl (new-build estimate; supplier overrides auto-applied)
```bash
curl -X POST "http://localhost:3000/api/v1/estimate/new-build" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=<access-token>; sb-refresh-token=<refresh-token>" \
  -d '{
    "propertyType": "Detached House",
    "spec": "standard",
    "totalAreaM2": 180,
    "bedrooms": 4,
    "storeys": 2,
    "postcodeDistrict": "B1",
    "garage": true
  }'
```

## iOS Build
Capacitor setup and iOS workflow are documented in:

- [docs/CAPACITOR.md](./docs/CAPACITOR.md)

## Testing
Run unit tests:
```bash
npm test
```

Recommended local verification:
```bash
npx tsc --noEmit
npm test
npm run build
```

## Deployment
- Web: deploy on Vercel (SSR + App Router routes).
- iOS: build static bundle via Capacitor workflow, then package in Xcode/TestFlight.
