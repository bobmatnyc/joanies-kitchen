/**
 * #12: `toRecipeInt` must turn any extractor value into an integer or null
 * before it reaches the integer recipe columns.
 */

import { describe, expect, it } from 'vitest';
import { toRecipeInt } from '../recipe-int';

describe('toRecipeInt', () => {
  it.each([
    // numbers
    [4, 4],
    [45, 45],
    [2.7, 2],
    [0, null],
    [-3, null],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
    [3_000_000_000, null],
    // numeric strings
    ['4', 4],
    [' 12 ', 12],
    ['1.5', 1],
    ['0', null],
    ['-3', null],
    // ranges take the low end
    ['4 to 6', 4],
    ['8-12', 8],
    ['8 to 12', 8],
    ['4 - 6', 4],
    // a minus only negates when it touches the digits
    ['Prep - 30 min', 30],
    // a unit keeps its leading quantity
    ['3 quarts', 3],
    ['Serves 4', 4],
    // nothing numeric
    ['a crowd', null],
    ['', null],
    [null, null],
    [undefined, null],
    [{}, null],
  ])('toRecipeInt(%j) → %j', (input, expected) => {
    expect(toRecipeInt(input)).toBe(expected);
  });
});
