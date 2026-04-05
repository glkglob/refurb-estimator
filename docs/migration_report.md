# OpenAI Integration Migration Report

Date: 2026-04-05

## Summary

The repository has been migrated to a centralized OpenAI-only architecture for AI workloads. All shared AI client access now routes through:

- `src/lib/openai.ts`
- `src/lib/ai/adapter.ts`
- `src/lib/ai/client.ts`

This preserves existing API response contracts while replacing provider internals.

## Feature Flag

- Runtime switch: `USE_OPENAI` (default: `true`)
- Behavior:
  - `true`: OpenAI calls are enabled.
  - `false`: AI adapter rejects requests with a controlled error, which can be used as an emergency kill switch during rollout.

## Runtime Provider Surface

- Text/chat: `openai.chat.completions.create`
- Vision chat: `openai.chat.completions.create` with `image_url` content parts
- Image generation: `openai.images.generate`
- Embeddings: `openai.embeddings.create`

## Files Updated

- `src/lib/openai.ts`
- `src/lib/ai/adapter.ts`
- `src/lib/ai/client.ts`
- `src/lib/embeddings.ts`
- `src/lib/env.ts`
- `src/services/ai.ts`
- `src/app/api/v1/assistant/chat/route.ts`
- `src/app/api/v1/ai/photo-estimate/route.ts`
- `src/app/api/env-test/route.ts`
- `src/services/qdrant.ts`
- `.env.example`
- `.env.local.example`
- `jest.config.ts`

## Dependency Changes

- Added: `openai`
- Removed: legacy provider SDK dependency

## Validation Checklist

- TypeScript checks pass.
- Lint checks pass.
- Targeted Jest suites for AI client/adapter/routes/services pass.
- Repository-wide provider scan confirms no runtime legacy provider SDK imports remain.

## Rollout Plan

1. Deploy to staging with `USE_OPENAI=true`.
2. Validate end-to-end flows on:
   - `/ai-pricing`
   - `/design-agent`
   - `/photo`
3. Verify Supabase auth and persistence behavior on AI endpoints.
4. Monitor API errors, status codes, and latency.
5. During production rollout, track OpenAI rate-limit and cost telemetry.

## Rollback Procedure

1. Immediate mitigation: set `USE_OPENAI=false` to disable AI provider calls.
2. Full rollback: revert the migration commit and redeploy.
3. Re-run smoke tests after rollback to verify endpoint recovery.
