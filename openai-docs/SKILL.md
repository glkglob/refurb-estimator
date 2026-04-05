---
name: openai-docs
description: Official OpenAI API documentation, quickstarts, and best practices for building with ChatGPT, Assistants, embeddings, and tools.
---

# OpenAI Documentation Skill

## When to Use
Use this skill when users ask:
- How to use OpenAI APIs (chat completions, embeddings, fine-tuning, assistants v2)
- Official code examples, parameters, error codes
- Migration guides (e.g., GPT-4o-mini, structured outputs)
- Rate limits, pricing, auth (API keys)

**Examples**:
- "Implement OpenAI Assistants API in Next.js"
- "OpenAI embeddings with Supabase pgvector"
- "Handle OpenAI 429 rate limit errors"

## Don't Use When
- Unofficial tutorials/blogs
- Non-OpenAI topics (Gemini, Anthropic)
- General coding (use other skills)

## Instructions
1. Identify exact API/product from query (e.g., `/v1/chat/completions`)
2. Fetch latest from https://platform.openai.com/docs/
3. Provide: endpoint, params, Python/JS examples, citations
4. Include diffs for versions (e.g., tools -> tools_v2)
5. Cite sections: [web:endpoint]

## References
- [API Reference](https://platform.openai.com/docs/api-reference/)
- [Quickstarts](https://platform.openai.com/docs/quickstart)
- [Guides](https://platform.openai.com/docs/guides/)

## Assets
Use `references/api-ref.md` for full endpoints if needed.
