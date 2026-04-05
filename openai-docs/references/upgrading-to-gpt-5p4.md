# Upgrading to GPT-5.4 (Mar 2026)

**TL;DR**: Drop-in for most chat.completions; gains: 1M context, 2x speed, better reasoning/coding. Migrate tools → tools_v2.[web:42][web:39]

## Why Upgrade
| From | To | Improvement |
|------|----|-------------|
| GPT-4o (retired API Feb 2026) | GPT-5.4 | 3x reasoning; 1M ctx (vs 128K); $4/$16 per M[web:46] |
| GPT-5.3 | GPT-5.4 | +20% benchmarks; auto-thinking chain[web:39] |
| o3 | GPT-5.4 | Unified API; no separate reasoning endpoint |

**Perf**: 95th percentile latency <2s for 10K tokens.[web:42]

## API Changes
### 1. Model ID
```js
// Old
model: 'gpt-4o-2025-02-01'  // Retired

// New
model: 'gpt-5.4'  // Aliases to latest
```

### 2. Tools → tools_v2 (Breaking)
```js
// Old (deprecated)
tools: [{type: 'function', function: {name: 'estimate_refurb'}}]

// New
tools_v2: [{
  type: 'function',
  parser: 'json_schema',  // Or 'json_mode'
  function: {
    name: 'estimate_refurb',
    strict: true,
    description: 'UK property refurb cost',
    parameters: {  // Full JSON Schema
      type: 'object',
      properties: { property_type: {type: 'string'} },
      required: ['property_type']
    }
  }
}]
```
**Validate**: `strict: true` prevents hallucinations.[web:43]

### 3. Context / Streaming
- 1M tokens std (vs 128K).
- `response_format: {type: 'json_schema', json_schema: {...}}` native.

### 4. Rate Limits (Tier 5)
| Model | RPM | TPM |
|-------|-----|-----|
| GPT-5.4 | 10K | 500M[web:46] |
| GPT-5.4-mini | 100K | 5B |

## Migration Steps
1. Update `model: 'gpt-5.4'`.
2. Refactor tools to `tools_v2` + `json_schema`.
3. Test structured outputs: `response_format`.
4. Monitor costs: Use mini for chat.
5. Fallback: Pin `'gpt-5.4-2026-03-04'`.

**rg App Example** (Next.js):
```js
// lib/openai.ts
import OpenAI from 'openai';

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

export async function estimateRefurb(desc: string) {
  const res = await openai.chat.completions.create({
    model: 'gpt-5.4',
    messages: [{role: 'user', content: `Estimate refurb: ${desc}`}],
    tools_v2: [/* schema */],
    temperature: 0.1
  });
  return res.choices.message;
}
```

## Gotchas
- **Deprecated**: `tools`, `function_calling`; use `tools_v2`.
- **Embeddings**: Switch to `text-embedding-4-large` (3072 dim).
- **Errors**: 429 → exponential backoff (new retry lib).
- **Deprecations**: GPT-5.3 EOL Q3 2026.[web:40]

**Full Changelog**: https://platform.openai.com/docs/changelog[web:43]

_Last updated: Apr 2026_
