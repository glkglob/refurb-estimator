# OpenAI Latest Models (April 2026)

Current frontier: **GPT-5.4** series (released Mar 2026). GPT-4o/GPT-4.1 retired Feb-Mar 2026.[web:39][web:40]

## Key Models

| Model ID | Type | Context | Strengths | Input ($/M tokens) | Output ($/M tokens) |
|----------|------|---------|-----------|--------------------|---------------------|
| gpt-5.4 | Frontier | 1M | Reasoning, coding, agents, tools | 4.00[web:46] | 16.00[web:46] |
| gpt-5.4-mini | Fast | 128K | Chat, fallback | ~0.15 (est.) | ~0.60 (est.)[web:39] |
| gpt-5.4-nano | Budget | 128K | Simple tasks | Lower tier | Lower tier[web:43] |
| gpt-5.3-instant | Speed | 128K | Web search, convo | Similar to mini | Similar to mini[web:39] |
| o3/o4-mini | Reasoning | Varies | Complex logic | Check pricing[web:41] | Check pricing[web:41] |
| text-embedding-4 | Embeddings | - | Semantic search | 0.10 / 1M chars | N/A[web:46] |

**Aliases**: `gpt-5.4-chat-latest` auto-routes to best.[web:45]

## Recent Changes
- Mar 18: GPT-5.4 mini rollout (ChatGPT Free/Go).[web:39]
- Mar 5: GPT-5.4 launch (1M context, Codex tools).[web:42]
- Feb 13: Retired GPT-4o, GPT-4.1 series (ChatGPT only; API intact).[web:40]

**Pricing**: https://openai.com/api/pricing/. Update Apr 2026.[web:46]

## Usage in Code
```js
const response = await openai.chat.completions.create({
  model: 'gpt-5.4',
  messages: [{role: 'user', content: 'Refurb cost estimate'}]
});
```
