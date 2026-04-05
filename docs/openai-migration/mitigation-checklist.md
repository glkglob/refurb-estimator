# OpenAI Migration Mitigation Checklist

Date: 2026-04-05

## 1. Runtime Feature Flag

- [x] Added `USE_OPENAI` runtime switch (default `true`).
- [x] Enforced flag in centralized adapter before API calls.
- [x] Added fallback behavior: explicit controlled error when disabled.

## 2. Centralized Provider Client

- [x] Added `src/lib/openai.ts` with centralized OpenAI client export.
- [x] Added API key validation guard (`OPENAI_API_KEY`).

## 3. Adapter Layer

- [x] Added `src/lib/ai/adapter.ts`.
- [x] Mapped chat/vision requests to OpenAI message formats.
- [x] Mapped OpenAI responses back to existing route contract.
- [x] Added image generation adapter (`openai.images.generate`).

## 4. Route and Service Migration

- [x] Migrated pricing, design, photo, and assistant flows to OpenAI-backed shared client.
- [x] Updated upload design service provider metadata to OpenAI.
- [x] Migrated embeddings from Gemini to OpenAI embeddings.

## 5. Error Handling and Logging

- [x] Standardized provider error mapping for API key, rate-limit, malformed JSON, auth, model-not-found.
- [x] Preserved route-level request ID and structured error logging behavior.

## 6. Dependencies and Config

- [x] Removed Gemini SDK dependency (`@google/genai`).
- [x] Added OpenAI SDK dependency (`openai`).
- [x] Removed Gemini-specific Jest mapping.

## 7. Environment Variables

- [x] Replaced Gemini env examples with OpenAI key only.
- [x] Updated env validation schema/tests to OpenAI naming.
- [x] Updated env diagnostics endpoint to OpenAI variable checks.

## 8. Documentation

- [x] Updated migration report to OpenAI-only architecture.
- [x] Updated README feature-flag documentation.
- [x] Added audit + patch + coverage + rollout docs under `docs/openai-migration/`.

## 9. Testing

- [x] Added/updated tests for:
  - OpenAI client helper
  - OpenAI adapter
  - Shared AI client wrapper
  - Existing AI routes/services/env tests
- [x] Verified focused new-module coverage >= 90%.

## 10. Validation

- [x] TypeScript check passed (`pnpm typecheck:test`).
- [x] Lint passed with unrelated pre-existing warning only.
- [x] Post-migration scan reports no Gemini references in active code/config/docs.

## 11. Rollout Safety

- [x] Rollback documented via feature flag disable and commit revert options.
- [x] Staging and production validation steps documented with monitoring guidance.
