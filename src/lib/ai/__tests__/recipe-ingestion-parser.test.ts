import { describe, it, expect } from 'vitest';

/**
 * Test helper to extract JSON from LLM responses with markdown code fences
 * This mirrors the extractJSON function in recipe-ingestion-parser.ts
 */
function extractJSON(response: string): string {
  // Remove markdown code fences if present (case-insensitive)
  // Handles: ```json, ```JSON, ``` json, or just ```
  const codeBlockMatch = response.match(/```\s*(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return response.trim();
}

describe('extractJSON', () => {
  it('should extract JSON from markdown code block with json tag', () => {
    const input = '```json\n{"name": "Test Recipe"}\n```';
    const result = extractJSON(input);
    expect(result).toBe('{"name": "Test Recipe"}');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should extract JSON from markdown code block without json tag', () => {
    const input = '```\n{"name": "Test Recipe"}\n```';
    const result = extractJSON(input);
    expect(result).toBe('{"name": "Test Recipe"}');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should handle JSON with extra whitespace in code block', () => {
    const input = '```json\n\n{"name": "Test Recipe"}\n\n```';
    const result = extractJSON(input);
    expect(result).toBe('{"name": "Test Recipe"}');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should return raw JSON when no code fences present', () => {
    const input = '{"name": "Test Recipe"}';
    const result = extractJSON(input);
    expect(result).toBe('{"name": "Test Recipe"}');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should handle multiline JSON in code block', () => {
    const input = `\`\`\`json
{
  "name": "Test Recipe",
  "ingredients": ["flour", "sugar"]
}
\`\`\``;
    const result = extractJSON(input);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('Test Recipe');
    expect(parsed.ingredients).toEqual(['flour', 'sugar']);
  });

  it('should handle complex nested JSON in code block', () => {
    const input = `\`\`\`json
{
  "name": "Complex Recipe",
  "ingredients": [
    {
      "quantity": "1",
      "unit": "cup",
      "name": "flour"
    }
  ],
  "instructions": ["Step 1", "Step 2"]
}
\`\`\``;
    const result = extractJSON(input);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('Complex Recipe');
    expect(parsed.ingredients[0].name).toBe('flour');
    expect(parsed.instructions).toHaveLength(2);
  });

  it('should trim whitespace from raw JSON', () => {
    const input = '  \n{"name": "Test Recipe"}\n  ';
    const result = extractJSON(input);
    expect(result).toBe('{"name": "Test Recipe"}');
  });

  it('should handle backticks with language identifier variations', () => {
    const variations = [
      '```json\n{"test": true}\n```',
      '```JSON\n{"test": true}\n```',
      '``` json\n{"test": true}\n```',
      '```\n{"test": true}\n```',
    ];

    variations.forEach(input => {
      const result = extractJSON(input);
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });
});
