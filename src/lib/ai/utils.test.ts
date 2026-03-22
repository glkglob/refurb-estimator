import { stripCodeFences, parseJson } from "./utils";

describe("stripCodeFences", () => {
  test("removes ```json prefix and trailing ```", () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });

  test("removes ``` prefix without language tag", () => {
    const input = '```\n{"key": "value"}\n```';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });

  test("returns plain text unchanged", () => {
    const input = '{"key": "value"}';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });

  test("trims whitespace", () => {
    const input = '  \n```json\n{"a": 1}\n```  \n';
    expect(stripCodeFences(input)).toBe('{"a": 1}');
  });

  test("handles case-insensitive ```JSON", () => {
    const input = '```JSON\n{"a": 1}\n```';
    expect(stripCodeFences(input)).toBe('{"a": 1}');
  });
});

describe("parseJson", () => {
  test("parses plain JSON", () => {
    const result = parseJson('{"name": "test"}');
    expect(result).toEqual({ name: "test" });
  });

  test("parses JSON wrapped in code fences", () => {
    const result = parseJson('```json\n{"name": "test"}\n```');
    expect(result).toEqual({ name: "test" });
  });

  test("throws on invalid JSON", () => {
    expect(() => parseJson("not json")).toThrow();
  });

  test("parses arrays", () => {
    const result = parseJson("[1, 2, 3]");
    expect(result).toEqual([1, 2, 3]);
  });
});
