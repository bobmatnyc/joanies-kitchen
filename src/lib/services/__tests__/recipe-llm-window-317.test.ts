/**
 * #317: an early bare "Ingredients"/"Method" heading (nav, intro) beat a real
 * recipe card far down the page, so the LLM window missed the card.
 */

import { describe, expect, it } from 'vitest';
import { LLM_CONTENT_CAP, selectLlmContent } from '@/lib/services/recipe-llm-window';

const PROSE =
  'We spent the summer testing this dish in a tiny kitchen with a stubborn oven, and every ' +
  'batch taught us something new about patience, heat and the value of good butter.\n\n';

const CARD = [
  '### Lemon Bars',
  '',
  '*   **Servings:** 16 bars',
  '',
  '*   1 1/2 cups all-purpose flour',
  '*   1 cup unsalted butter, softened',
  '*   2 cups granulated sugar',
  '*   4 large eggs',
  '',
  'Press the crust into the pan and bake until golden.',
].join('\n');

describe('selectLlmContent early heading (#317)', () => {
  it('sends a card at 20k+ when a non-card Ingredients heading sits early', () => {
    const intro = '## Ingredients\n\nRead on for why each one matters in this recipe.\n\n';
    const page =
      `Title: lemon bars\n\n${PROSE.repeat(3)}${intro}${PROSE.repeat(120)}` +
      `${CARD}\n\n${PROSE.repeat(10)}`;
    expect(page.indexOf('## Ingredients')).toBeLessThan(2000);
    expect(page.indexOf('### Lemon Bars')).toBeGreaterThan(20000);
    const sent = selectLlmContent(page);
    expect(sent).toContain(CARD);
    expect(sent.length).toBeLessThanOrEqual(LLM_CONTENT_CAP);
  });
});
