# OpenAI Migration Patch Summary

Date: 2026-04-05

## Core Platform Changes

- Added centralized OpenAI runtime module:
  - `src/lib/openai.ts`
- Added provider adapter layer:
  - `src/lib/ai/adapter.ts`
- Replaced shared AI client internals with OpenAI adapter delegation:
  - `src/lib/ai/client.ts`

## AI Workload Migration

- Updated design metadata service to OpenAI provider semantics and optional generated image URL:
  - `src/services/ai.ts`
- Migrated embeddings to OpenAI embedding API:
  - `src/lib/embeddings.ts`
- Updated assistant and photo routes to centralized OpenAI model constants:
  - `src/app/api/v1/assistant/chat/route.ts`
  - `src/app/api/v1/ai/photo-estimate/route.ts`

## Error and Env Standardization

- Updated shared provider error mapping to OpenAI keys/messages:
  - `src/lib/ai/errors.ts`
- Migrated server AI env schema from Gemini to OpenAI + `USE_OPENAI`:
  - `src/lib/env.ts`
  - `src/lib/env.test.ts`
- Updated env diagnostics endpoint to OpenAI:
  - `src/app/api/env-test/route.ts`

## Removed Legacy Gemini Artifacts

- Removed Gemini runtime module and tests:
  - `src/lib/gemini.ts`
  - `src/lib/gemini.test.ts`
- Removed obsolete migration script:
  - `docs/migrate_gemini_to_hf.sh`

## Dependency and Tooling Changes

- Added dependency: `openai`
- Removed dependency: `@google/genai`
- Updated Jest config to remove Gemini-specific module mapping:
  - `jest.config.ts`

## Environment and Docs

- Updated examples to OpenAI key only:
  - `.env.example`
  - `.env.local.example`
- Updated workspace settings to remove Gemini extension toggles:
  - `.vscode/settings.json`
- Updated docs and migration narrative:
  - `README.md`
  - `docs/migration_report.md`

## Test Updates

- Added OpenAI helper + adapter + client tests:
  - `src/lib/openai.test.ts`
  - `src/lib/ai/adapter.test.ts`
  - `src/lib/ai/client.test.ts`
- Updated existing tests for provider/value changes:
  - `src/services/ai.test.ts`
  - `src/lib/ai/errors.test.ts`
  - `src/app/api/v1/ai/design-agent/route.test.ts`
  - `src/app/api/v1/ai/upload/route.test.ts`

## Audit Artifacts

- Pre-migration scan: `docs/openai-migration/gemini-audit-pre.txt`
- Post-migration scan: `docs/openai-migration/gemini-audit-post.txt`
- Audit report: `docs/openai-migration/audit-report.md`
