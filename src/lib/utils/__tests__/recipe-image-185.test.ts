/**
 * #185: ingestion stored source-site logos as recipe images. The real URLs below come
 * from the prod scan; the accepted photos are the og:image the data fix used instead.
 */
import { describe, expect, it } from 'vitest';
import {
  getRecipeHero,
  getRecipeHeroImages,
  getRecipeImageUrls,
  isDefinitelySiteAsset,
  isLikelySiteAsset,
  resolveRecipeImage,
  toUsableImageUrl,
} from '../recipe-image';
import { pickRecipeImage, pickRecipeImages } from '../recipe-image-picker';

const LOGOS = [
  'https://omnivorescookbook.com/wp-content/themes/oc2025/images/logo.svg',
  'https://niksharmacooks.com/wp-content/uploads/2022/08/230107-NikSharma-LogoTM-blue.svg',
  'https://lidiasitaly.com/wp-content/themes/lidia/img/signature.png',
  'https://thecookingfoodie.com/wp-content/uploads/2024/08/the-cooking-foodie-logo-optimized.jpg',
  'https://ohmyveggies.com/wp-content/uploads/2021/04/omv-logo-200x70-1.png',
  'https://cookingchew.com/wp-content/uploads/2025/03/MSN-New-Logo-e1741397184120.png',
];

const LIONS_HEAD =
  'https://omnivorescookbook.com/wp-content/uploads/2023/10/230726_Lions-Head-Meatballs_4.jpg';
const ALOO_GOBI = 'https://niksharmacooks.com/wp-content/uploads/2022/11/AlooGobiDSC_5234.jpg';
const PAGE = 'https://omnivorescookbook.com/lions-head-meatballs/';

const PHOTOS = [
  LIONS_HEAD,
  ALOO_GOBI,
  // "logo" inside a longer word (Italian "catalogo") is not a logo.
  'https://lidiasitaly.com/wp-content/uploads/2023/05/catalogo-pasta-fresca.jpg',
  // "icon" only as a whole word: "iconic" and "silicone" stay photos.
  'https://example.com/wp-content/uploads/2024/01/iconic-smash-burger.jpg',
  'https://example.com/uploads/silicone-mold-cake.webp',
  // WordPress thumbnail and a Conde Nast aspect-ratio path are photos.
  'https://example.com/wp-content/uploads/2023/02/soup-150x150.jpg',
  'https://assets.bonappetit.com/photos/5c8a/1:1/w_2560%2Cc_limit/pasta.jpg',
];

// Plausible stored photos that only the full ingestion set flags (code-critic, #185).
const FULL_SET_ONLY = [
  'https://x.test/uploads/Our-Signature-Margarita.jpg',
  'https://x.test/7up-Sprite-Chicken.jpg',
  'https://x.test/c_1x1_soup.jpg',
  'https://cdn.imgix.net/themes/fall/apple-pie.jpg',
];

describe('isLikelySiteAsset (#185)', () => {
  it.each(LOGOS)('rejects the real logo %s', (url) => {
    expect(isLikelySiteAsset(url)).toBe(true);
  });

  it.each(PHOTOS)('accepts the dish photo %s', (url) => {
    expect(isLikelySiteAsset(url)).toBe(false);
  });

  it.each([
    'https://example.com/favicon.ico',
    'https://example.com/assets/icons/share.png',
    'https://example.com/apple-touch-icon.png',
    'https://example.com/img/SiteLogo.png',
    'https://example.com/img/header-sprite.png',
    'https://example.com/img/lazy-placeholder.jpg',
    'https://track.example.com/pixel.gif?id=1',
    'https://example.com/spacer-1x1.gif',
    'data:image/png;base64,iVBORw0KGgo=',
    ...FULL_SET_ONLY,
  ])('rejects the site asset %s', (url) => {
    expect(isLikelySiteAsset(url)).toBe(true);
  });

  it('reads the path only, never the host or query', () => {
    expect(isLikelySiteAsset('https://logos.example.com/soup.jpg?v=logo')).toBe(false);
  });
});

describe('read-side guard (#185)', () => {
  it.each(LOGOS)('toUsableImageUrl drops the real logo %s', (url) => {
    expect(isDefinitelySiteAsset(url)).toBe(true);
    expect(toUsableImageUrl(url)).toBeNull();
  });

  it.each(FULL_SET_ONLY)('toUsableImageUrl keeps the stored photo %s', (url) => {
    expect(toUsableImageUrl(url)).toBe(url);
  });

  it.each(PHOTOS)('toUsableImageUrl keeps the dish photo %s', (url) => {
    expect(toUsableImageUrl(url)).toBe(url);
  });

  it('keeps local placeholder paths and filters lists', () => {
    expect(toUsableImageUrl('/placeholders/generic.svg')).toBe('/placeholders/generic.svg');
    expect(toUsableImageUrl('/ai-tomato-logo.png')).toBe('/ai-tomato-logo.png');
    expect(getRecipeImageUrls(JSON.stringify([LOGOS[4], LIONS_HEAD]))).toEqual([LIONS_HEAD]);
  });

  it('resolves a logo-only recipe to the placeholder', () => {
    const src = resolveRecipeImage({ images: JSON.stringify([LOGOS[0]]), image_url: LOGOS[0] });
    expect(src).toMatch(/^\/placeholders\/[a-z-]+\.svg$/);
  });
});

describe('getRecipeHeroImages (#185)', () => {
  it('is never empty: no image gives the placeholder', () => {
    expect(getRecipeHeroImages({ images: null, image_url: null })).toEqual([
      '/placeholders/generic.svg',
    ]);
  });

  it('uses the tag-themed placeholder', () => {
    expect(getRecipeHeroImages({ tags: '["soup"]' })).toEqual(['/placeholders/soup.svg']);
  });

  it('keeps stored images, then image_url', () => {
    expect(getRecipeHeroImages({ images: [ALOO_GOBI] })).toEqual([ALOO_GOBI]);
    expect(getRecipeHeroImages({ images: '[]', image_url: LIONS_HEAD })).toEqual([LIONS_HEAD]);
  });

  it('gives placeholder alt text only for the placeholder', () => {
    expect(getRecipeHero({ tags: '["soup"]' }).placeholderAlt).toBe('Soup or stew placeholder');
    expect(getRecipeHero({ images: [ALOO_GOBI] }).placeholderAlt).toBeNull();
  });
});

describe('pickRecipeImage (#185)', () => {
  it('logo first, og:image photo second: picks the photo', () => {
    expect(pickRecipeImage({ ogImage: [LOGOS[0], LIONS_HEAD] }, PAGE)).toBe(LIONS_HEAD);
    expect(pickRecipeImage({ contentImages: [LOGOS[1], ALOO_GOBI] }, PAGE)).toBe(ALOO_GOBI);
  });

  it('prefers og:image over JSON-LD, twitter:image and content images', () => {
    expect(
      pickRecipeImage(
        {
          ogImage: LIONS_HEAD,
          jsonLdImage: { '@type': 'ImageObject', url: ALOO_GOBI },
          twitterImage: 'https://example.com/t.jpg',
          contentImages: ['https://example.com/c.jpg'],
        },
        PAGE
      )
    ).toBe(LIONS_HEAD);
  });

  it('falls through a logo og:image to the JSON-LD Recipe.image', () => {
    expect(pickRecipeImage({ ogImage: LOGOS[3], jsonLdImage: [{ url: ALOO_GOBI }] }, PAGE)).toBe(
      ALOO_GOBI
    );
  });

  it('only a logo: NULL, never the site asset', () => {
    expect(pickRecipeImage({ ogImage: LOGOS[2] }, PAGE)).toBeNull();
    expect(pickRecipeImage({ ogImage: LOGOS[5], contentImages: [LOGOS[4]] }, PAGE)).toBeNull();
    expect(pickRecipeImage({}, PAGE)).toBeNull();
  });

  it('applies the full set at ingestion', () => {
    expect(pickRecipeImage({ ogImage: FULL_SET_ONLY[0] }, PAGE)).toBeNull();
  });

  it('resolves a relative og:image against the page URL', () => {
    expect(pickRecipeImage({ ogImage: '/wp-content/uploads/soup.jpg' }, PAGE)).toBe(
      'https://omnivorescookbook.com/wp-content/uploads/soup.jpg'
    );
    expect(pickRecipeImage({ contentImages: ['img/soup.jpg'] }, PAGE)).toBe(
      'https://omnivorescookbook.com/lions-head-meatballs/img/soup.jpg'
    );
  });

  it('still rejects a relative logo, and drops relative paths with no page URL', () => {
    expect(pickRecipeImage({ ogImage: '/wp-content/themes/oc2025/images/logo.svg' }, PAGE)).toBe(
      null
    );
    expect(pickRecipeImage({ ogImage: '/wp-content/uploads/soup.jpg' }, undefined)).toBeNull();
  });

  it('returns up to max distinct photos in candidate order', () => {
    expect(
      pickRecipeImages(
        { ogImage: LIONS_HEAD, contentImages: [LOGOS[0], LIONS_HEAD, ALOO_GOBI] },
        PAGE,
        6
      )
    ).toEqual([LIONS_HEAD, ALOO_GOBI]);
  });
});
