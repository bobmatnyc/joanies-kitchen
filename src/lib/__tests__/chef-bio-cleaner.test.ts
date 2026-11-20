// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bioNeedsRepair, cleanScrapedBio } from '@/lib/chef-bio-cleaner';

// Shaped like the stored bio of chef Anja Eckert: the first 500 characters of a
// Jina-scraped About page — navigation, social links and a newsletter promo.
const ANJA_ECKERT_STYLE_BIO = `Title: About

URL Source: https://example-food-blog.de/about

Markdown Content:
Skip to content

[Instagram](https://instagram.com/x)[Pinterest](https://pinterest.com/x)[Facebook](https://facebook.com/x)

*   [Home](https://example-food-blog.de/)
*   [Recipes](https://example-food-blog.de/recipes)
*   [About](https://example-food-blog.de/about)
*   [Shop](https://example-food-blog.de/shop)

Subscribe to my newsletter and get my free eBook with 10 easy plant-based dinners!

[![Image 1: logo](https://example-food-blog.de/logo.png)](https://example-food-blog.de/)
Search`;

const REAL_BIO_WITH_NAV = `Anja is a Berlin-based cook who builds vegetarian meals around seasonal produce and pantry staples.
She trained as a pastry chef before writing about zero-waste home cooking for more than a decade.

*   [Home](https://example.com/)
*   [Recipes](https://example.com/recipes)
[Instagram](https://instagram.com/x) [Pinterest](https://pinterest.com/x)
© 2024 All rights reserved.`;

describe('cleanScrapedBio', () => {
  it('returns empty for chrome-only input', () => {
    expect(cleanScrapedBio(ANJA_ECKERT_STYLE_BIO)).toBe('');
  });

  it('keeps the prose of a real bio and drops trailing nav', () => {
    expect(cleanScrapedBio(REAL_BIO_WITH_NAV)).toBe(
      'Anja is a Berlin-based cook who builds vegetarian meals around seasonal produce and pantry staples. ' +
        'She trained as a pastry chef before writing about zero-waste home cooking for more than a decade.'
    );
  });

  it('keeps a one-paragraph bio that names social networks', () => {
    const maria =
      'Maria is a chef from Oaxaca who cooks with heirloom corn and wild greens. ' +
      'Her videos reach over a million people on Instagram and YouTube every month. ' +
      'She is the author of three books.';
    expect(cleanScrapedBio(maria)).toBe(maria);
    expect(bioNeedsRepair(maria)).toBe(false);
  });

  it('keeps a short single-sentence bio', () => {
    const tom = 'Chef Tom runs a farm-to-table kitchen in Vermont.';
    expect(cleanScrapedBio(tom)).toBe(tom);
    expect(bioNeedsRepair(tom)).toBe(false);
  });

  it('drops only the chrome sentences inside a prose paragraph', () => {
    expect(
      cleanScrapedBio(
        'Dr. Lee cooks Korean food at home in Ohio. Follow me on Instagram! ' +
          'Sign up for my newsletter to get new recipes. Visit www.example.com today.'
      )
    ).toBe('Dr. Lee cooks Korean food at home in Ohio.');
  });

  it('does not treat ordinary prose as a URL', () => {
    const bio = 'She trained in Mexico. Co-owner of a small bakery, she also teaches classes.';
    expect(cleanScrapedBio(bio)).toBe(bio);
  });

  it('cuts long prose at a sentence boundary within the length bound', () => {
    const sentence = 'She cooks seasonal vegetables with care and wastes nothing at all. ';
    const out = cleanScrapedBio(sentence.repeat(40));
    expect(out.length).toBeLessThanOrEqual(1000);
    expect(out.endsWith('.')).toBe(true);
  });
});

describe('bioNeedsRepair', () => {
  it('flags an Anja Eckert style bio', () => {
    expect(bioNeedsRepair(ANJA_ECKERT_STYLE_BIO)).toBe(true);
  });

  it('leaves a clean prose bio alone', () => {
    expect(
      bioNeedsRepair(
        'Anja is a Berlin-based cook who builds vegetarian meals around seasonal produce and pantry staples.'
      )
    ).toBe(false);
    expect(bioNeedsRepair(null)).toBe(false);
  });
});
