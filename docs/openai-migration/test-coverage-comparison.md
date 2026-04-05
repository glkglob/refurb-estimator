# OpenAI Module Coverage Comparison

Date: 2026-04-05

## Coverage Target

Target for newly introduced OpenAI modules: >= 90% statement coverage.

## Measured Coverage (Final)

Command:

`pnpm test:jest src/lib/openai.test.ts src/lib/ai/adapter.test.ts src/lib/ai/client.test.ts --coverage --collectCoverageFrom='src/lib/openai.ts' --collectCoverageFrom='src/lib/ai/adapter.ts' --collectCoverageFrom='src/lib/ai/client.ts'`

Results:

- Overall (new modules set): 94.02% statements
- `src/lib/openai.ts`: 94.11% statements
- `src/lib/ai/adapter.ts`: 92.5% statements
- `src/lib/ai/client.ts`: 100% statements

## Interim Measurement (Before client wrapper tests)

Command (earlier pass):

`pnpm test:jest src/lib/openai.test.ts src/lib/ai/adapter.test.ts --coverage --collectCoverageFrom='src/lib/openai.ts' --collectCoverageFrom='src/lib/ai/adapter.ts' --collectCoverageFrom='src/lib/ai/client.ts'`

Results:

- Overall (new modules set): 79.1% statements
- `src/lib/ai/client.ts`: 0% statements (no direct wrapper tests at that point)

## Delta

- Added `src/lib/ai/client.test.ts` to validate delegation behavior.
- Improved new-module set from 79.1% to 94.02% statements.
- Migration target met.
