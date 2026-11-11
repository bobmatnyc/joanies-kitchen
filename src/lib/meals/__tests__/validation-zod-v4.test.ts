/**
 * Why: #308 moved to zod v4, where .partial() keeps .default() and uuid() demands
 * RFC version/variant bits. Both would change what the meal schemas accept or emit.
 * What: pins the zod v3 behavior the meal schemas keep.
 */

import { describe, expect, it } from 'vitest';
import { createMealSchema, updateMealSchema, uuidSchema } from '../validation';

describe('meal schemas under zod v4 (#308)', () => {
  it('update leaves out fields the caller did not send', () => {
    expect(updateMealSchema.parse({ name: 'Soup night' })).toEqual({ name: 'Soup night' });
  });

  it('create still fills serves, is_template and is_public defaults', () => {
    const parsed = createMealSchema.parse({ name: 'Soup night', description: 'Warm' });
    expect(parsed).toMatchObject({ serves: 4, is_template: false, is_public: false });
  });

  it('ID check accepts any 8-4-4-4-12 hex string, as zod v3 uuid() did', () => {
    expect(uuidSchema.safeParse('00000000-0000-0000-0000-0000000000a1').success).toBe(true);
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});
