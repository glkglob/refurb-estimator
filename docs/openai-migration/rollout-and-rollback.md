# Staging Validation, Rollout, and Rollback Runbook

Date: 2026-04-05

## Staging Validation Plan

## Preconditions

- Staging environment has:
  - `OPENAI_API_KEY` configured
  - `USE_OPENAI=true`
- Supabase staging auth/storage/database are reachable.

## Functional Smoke Tests

1. Pricing flow
- Open `/ai-pricing`
- Submit valid input and optional photos
- Confirm response payload shape is unchanged (`summary`, `categories`, totals, advice)
- Confirm HTTP status and error messages are mapped correctly for invalid payloads

2. Design flow
- Open `/design-agent`
- Submit photos/style/budget
- Confirm structured response renders and save-to-gallery still works
- Verify `/api/v1/ai/upload` persists metadata and returns OpenAI provider/model fields

3. Photo estimate flow
- Open `/photo`
- Upload 1-3 images
- Confirm analysis + estimate payload and PDF export still work

4. Assistant flow
- Exercise `/api/v1/assistant/chat`
- Confirm action schema contract is unchanged for editor/copilot/chat modes

## Security and Persistence Validation

- Validate auth enforcement on all AI endpoints (401 for anonymous requests where required).
- Verify Supabase writes still succeed for design generations/gallery.
- Confirm no RLS regressions in user-scoped reads/writes.

## Logs and Telemetry Checks

- Confirm no legacy provider import/runtime errors.
- Track OpenAI request failures by status bucket (400/401/403/429/5xx).
- Track latency per endpoint and timeout frequency.

## Production Rollout (Controlled)

1. Deploy code with `USE_OPENAI=true`.
2. Start with low-traffic window and canary monitoring.
3. Watch for:
- elevated 429s
- elevated 5xxs
- response-shape validation failures
4. Expand traffic after stability window.

## OpenAI Rate-Limit and Cost Monitoring

For each API response, capture and aggregate available headers (when present):

- `x-ratelimit-limit-requests`
- `x-ratelimit-remaining-requests`
- `x-ratelimit-reset-requests`
- `x-ratelimit-limit-tokens`
- `x-ratelimit-remaining-tokens`
- `x-ratelimit-reset-tokens`

Track cost drivers:

- total tokens per route
- average tokens/request
- image generation count and size
- embedding request volume

Set alert thresholds for sudden spend spikes and sustained 429 rates.

## Rollback Procedure

## Fast rollback (feature-flag)

- Set `USE_OPENAI=false`.
- Redeploy config (or restart environment if needed).
- AI calls are blocked via controlled adapter error path.

## Full rollback (code)

- Revert the migration commit.
- Redeploy previous known-good version.
- Re-run smoke tests for Pricing, Design, Photo, and Assistant routes.

## Post-rollback checks

- Verify endpoint health and auth enforcement.
- Confirm error rates normalize.
- Publish incident summary and next remediation action.
