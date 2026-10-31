/**
 * #216: extractFirstJsonObject returns the first complete JSON object in a
 * model reply and fails closed on anything it cannot parse.
 */

import { describe, expect, it } from 'vitest';
import { extractFirstJsonObject } from '@/lib/ai/extract-first-json';

const OBJ = { title: 'Soup', ingredients: ['1 onion'], servings: 4 };
const JSON_TEXT = JSON.stringify(OBJ);

describe('extractFirstJsonObject (#216)', () => {
  it.each([
    ['pure JSON', JSON_TEXT],
    ['pure JSON with surrounding whitespace', `\n  ${JSON_TEXT}  \n`],
    ['trailing prose', `${JSON_TEXT}\n\nLet me know if you need {more} detail.`],
    ['a ```json fenced block', `\`\`\`json\n${JSON_TEXT}\n\`\`\``],
    ['leading prose', `Here is the recipe:\n${JSON_TEXT}`],
    ['two objects (first wins)', `${JSON_TEXT}\n{"title": "Other"}`],
  ])('parses %s', (_label, reply) => {
    expect(extractFirstJsonObject(reply)).toEqual(OBJ);
  });

  it('ignores braces and brackets inside strings', () => {
    const value = { title: 'Use {curly} and [square] }', tags: ['a}b'] };
    expect(extractFirstJsonObject(`${JSON.stringify(value)} trailing }`)).toEqual(value);
  });

  it('handles escaped quotes and backslashes inside strings', () => {
    const value = { title: 'Say "hi" } \\', note: 'a\\"}b' };
    expect(extractFirstJsonObject(`${JSON.stringify(value)}\nmore`)).toEqual(value);
  });

  it('throws on truncated JSON', () => {
    expect(() => extractFirstJsonObject('{"title": "Soup", "ingredients": ["1 on')).toThrow(
      /incomplete JSON object/
    );
  });

  it('throws when the reply has no JSON at all', () => {
    expect(() => extractFirstJsonObject('Sorry, I could not find a recipe.')).toThrow(
      /no JSON object/
    );
  });

  it('throws on a balanced but malformed object', () => {
    expect(() => extractFirstJsonObject('{title: Soup}')).toThrow(SyntaxError);
  });
});
