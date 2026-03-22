/**
 * Remove markdown code fences that LLMs sometimes wrap around JSON output.
 */
export function stripCodeFences(value: string): string {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Parse a JSON string, stripping any surrounding code fences first.
 */
export function parseJson(text: string): unknown {
  return JSON.parse(stripCodeFences(text));
}
