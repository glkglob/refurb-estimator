# Migration Report: Gemini → Hugging Face

**Date:** 2026-03-22  
**Repository:** [glkglob/refurb-estimator](https://github.com/glkglob/refurb-estimator)  
**PR:** [#4 — refactor: migrate from Google Gemini to Hugging Face Inference](https://github.com/glkglob/refurb-estimator/pull/4)

---

## Summary

Migrated the AI provider from Google Gemini (`@google/generative-ai`) to Hugging Face Inference (`@huggingface/inference`). Both AI routes (pricing-agent and design-agent) now use `InferenceClient.chatCompletion()` with `meta-llama/Llama-3.3-70B-Instruct`. All environment variables have been renamed, tests updated, and validation confirms zero remaining Gemini references.

**PR stats:** 7 files changed, 116 insertions, 349 deletions.

---

## Environment Variable Changes

| Old Variable | New Variable | Status |
|---|---|---|
| `GEMINI_API_KEY` | _(removed)_ | Eliminated — no longer a shared fallback |
| `GEMINI_PRICING_API_KEY` | `HUGGINGFACE_PRICING_API_KEY` | Required (was optional) |
| `GEMINI_DESIGN_API_KEY` | `HUGGINGFACE_REFURB_DESIGN_KEY` | Required (was optional) |

---

## Hugging Face Tokens Created

| Token Name | Scopes | Maps To | Token Prefix |
|---|---|---|---|
| `visualisation-api-key` | `inference`, `read` | `HUGGINGFACE_REFURB_DESIGN_KEY` | `hf_DjK...` |
| `cost-estimation-api-key` | `inference`, `read` | `HUGGINGFACE_PRICING_API_KEY` | `hf_TUE...` |

Both tokens are fine-grained with minimal permissions (inference calls + read access only).

---

## Files Modified

| File | Changes |
|---|---|
| `package.json` | Removed `@google/genai`, `@google/generative-ai`; added `@huggingface/inference` |
| `package-lock.json` | Lockfile regenerated |
| `src/lib/env.ts` | Replaced 3 Gemini env vars with 2 required HF vars in Zod schema |
| `src/lib/env.test.ts` | Updated all test references and assertions for new variable names |
| `src/app/api/v1/ai/pricing-agent/route.ts` | Rewrote to use `InferenceClient.chatCompletion()`, removed `toGeminiPhotoParts()` |
| `src/app/api/v1/ai/design-agent/route.ts` | Rewrote to use `InferenceClient.chatCompletion()`, removed `toGeminiPhotoParts()` |
| `.env.local.example` | Updated section header and variable names |

---

## Items Removed

| Item | Reason |
|---|---|
| `@google/genai` (dependency) | No longer used — Gemini SDK removed |
| `@google/generative-ai` (dependency) | No longer used — Gemini SDK removed |
| `toGeminiPhotoParts()` in both route files | Gemini-specific; photos now passed as text URLs in prompts |
| `GEMINI_API_KEY` env var and all references | Replaced by dedicated per-route HF keys |

No standalone Gemini config files existed, so no directories were removed.

---

## Dependency Changes

| Action | Package | Old Version | New |
|---|---|---|---|
| **Removed** | `@google/genai` | 1.46.0 | — |
| **Removed** | `@google/generative-ai` | 0.24.1 | — |
| **Added** | `@huggingface/inference` | — | latest |

---

## Security Improvements

- `.mcp.json` and `.claude/` confirmed in `.gitignore` (prevents accidental commit of auth tokens)
- Old shared fallback pattern (`GEMINI_DESIGN_API_KEY ?? GEMINI_API_KEY`) eliminated — each route now has its own dedicated, required key
- Both HF tokens scoped with minimal permissions (inference + read only)

---

## Validation Results

| Check | Result |
|---|---|
| Gemini references in source | **0 found** — clean |
| TypeScript compilation (`npx tsc --noEmit`) | **Passed** |
| Test suite (`npm test`) | **All 64 tests passed** |
| `.gitignore` coverage | `.mcp.json` ✓, `.claude/` ✓ |

---

## Manual Steps Required

### Immediate (before deploying)

1. **Merge PR #4**: [refactor: migrate from Google Gemini to Hugging Face Inference](https://github.com/glkglob/refurb-estimator/pull/4)

2. **Update `.env.local`** with the new HF token values:
   ```
   HUGGINGFACE_PRICING_API_KEY=hf_<REDACTED>
   HUGGINGFACE_REFURB_DESIGN_KEY=hf_<REDACTED>
   ```

3. **Update Vercel environment variables**:
   - Remove: `GEMINI_API_KEY`, `GEMINI_PRICING_API_KEY`, `GEMINI_DESIGN_API_KEY`
   - Add: `HUGGINGFACE_PRICING_API_KEY` = `hf_<REDACTED>`
   - Add: `HUGGINGFACE_REFURB_DESIGN_KEY` = `hf_<REDACTED>`

4. **Update any CI/CD pipeline secrets** that reference Gemini keys

### Post-deployment

5. **Revoke old Gemini API keys** in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
6. **Smoke-test** both endpoints:
   - `POST /api/v1/ai/pricing-agent`
   - `POST /api/v1/ai/design-agent`
7. **Monitor** HF API usage at [huggingface.co/settings/billing](https://huggingface.co/settings/billing)

### Recommended (from original audit)

8. Revoke and rotate the Perplexity Agent Proxy token (`agp_019d151f-b25e-7623-825d-728bd3375a4a`) found in `.mcp.json`
9. Add rate limiting to pricing-agent and design-agent endpoints
10. Add authentication to AI endpoints

---

## Architecture After Migration

```
Route B (pricing-agent)    →  HF InferenceClient  →  Llama 3.3 70B  →  Zod validation
Route C (design-agent)     →  HF InferenceClient  →  Llama 3.3 70B  →  Zod validation
Route A (photo-estimate)   →  OpenAI SDK directly  →  GPT-4o         →  Manual type guards
Route D (room designer)    →  OpenAI SDK directly  →  GPT-4.1        →  OpenAI JSON Schema + Zod
```
