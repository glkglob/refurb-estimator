# Gemini Artifact Audit Report

Date: 2026-04-05

## Scope

Repository-wide scan for Gemini artifacts:

- SDK imports (`@google/genai`, `@google/generative-ai`, `GoogleGenerativeAI`, `GoogleGenAI`)
- Environment variables (`GEMINI_*`, `GOOGLE_GEMINI_API`)
- Provider labels and model literals
- API routes (`src/app/api/**`)
- Shared libraries/services (`src/lib/**`, `src/services/**`)
- Scripts/config/docs (`docs/**`, `.env*`, `package.json`, `jest.config.ts`, workspace settings)

## Programmatic Scan Commands

Pre-migration scan output:

- `docs/openai-migration/gemini-audit-pre.txt`

Post-migration scan output:

- `docs/openai-migration/gemini-audit-post.txt`

## Pre-Migration Results

- Total matches: 166
- Full line-by-line inventory: `docs/openai-migration/gemini-audit-pre.txt`

Grouped by file (match counts):

- 38 `docs/migrate_gemini_to_hf.sh`
- 24 `src/lib/gemini.test.ts`
- 18 `src/lib/env.test.ts`
- 12 `docs/migration_report.md`
- 10 `src/lib/env.ts`
- 10 `src/lib/ai/client.ts`
- 8 `src/services/ai.ts`
- 7 `src/lib/gemini.ts`
- 7 `src/app/api/env-test/route.ts`
- 6 `.env.local.example`
- 4 `src/services/ai.test.ts`
- 4 `src/lib/ai/errors.ts`
- 3 `src/lib/embeddings.ts`
- 3 `pnpm-lock.yaml`
- 2 `src/app/api/v1/ai/upload/route.test.ts`
- 2 `jest.config.ts`
- 2 `.vscode/settings.json`
- 1 `src/lib/ai/errors.test.ts`
- 1 `src/app/api/v1/assistant/chat/route.ts`
- 1 `src/app/api/v1/ai/photo-estimate/route.ts`
- 1 `src/app/api/v1/ai/design-agent/route.test.ts`
- 1 `package.json`
- 1 `.env.example`

## Post-Migration Results

- Result: no Gemini references found outside migration-audit artifacts.
- Verification file: `docs/openai-migration/gemini-audit-post.txt`

Notes:

- The pre-migration inventory file intentionally preserves historical matches as audit evidence.
- This means Gemini strings still exist only in dedicated audit artifacts, not active runtime code paths.
