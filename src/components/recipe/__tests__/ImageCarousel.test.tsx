// #173: a failing image must swap to a real static fallback once, never loop on a missing route.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IMAGE_ERROR_FALLBACK_SRC } from '@/lib/utils/image-fallback';
import { ImageCarousel, ImageGrid } from '../ImageCarousel';

vi.mock('@/components/admin/RecipeImageFlag', () => ({ RecipeImageFlag: () => null }));

const BROKEN = ['https://example.invalid/a.jpg', 'https://example.invalid/b.jpg'];

function srcAttr(img: HTMLElement): string | null {
  return img.getAttribute('src');
}

describe('ImageCarousel onError (#173)', () => {
  it('falls back to the static asset once and ignores a second error', () => {
    render(<ImageCarousel images={BROKEN} title="Soup" />);
    const main = screen.getByAltText('Soup - Image 1');

    fireEvent.error(main);
    expect(srcAttr(main)).toBe(IMAGE_ERROR_FALLBACK_SRC);

    // Spy on later src writes: a failing fallback must not be reassigned.
    const setter = vi.spyOn(main, 'src', 'set');
    fireEvent.error(main);
    expect(setter).not.toHaveBeenCalled();
    expect(srcAttr(main)).toBe(IMAGE_ERROR_FALLBACK_SRC);
  });

  it('applies the same one-shot fallback to thumbnails and the grid', () => {
    render(<ImageCarousel images={BROKEN} title="Soup" />);
    for (const thumb of screen.getAllByAltText(/^Thumbnail/)) {
      fireEvent.error(thumb);
      expect(srcAttr(thumb)).toBe(IMAGE_ERROR_FALLBACK_SRC);
    }
    render(<ImageGrid images={BROKEN} />);
    const cell = screen.getByAltText('Recipe image 1');
    fireEvent.error(cell);
    fireEvent.error(cell);
    expect(srcAttr(cell)).toBe(IMAGE_ERROR_FALLBACK_SRC);
  });

  it('points at an asset that exists under public/', () => {
    expect(existsSync(path.join(process.cwd(), 'public', IMAGE_ERROR_FALLBACK_SRC))).toBe(true);
  });
});

describe('no missing placeholder route (#173)', () => {
  it('leaves no api placeholder reference in src/', () => {
    const needle = ['/api', 'placeholder'].join('/');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name !== '__tests__') walk(full);
        } else if (/\.(tsx?|jsx?|mdx?)$/.test(name) && !/\.test\./.test(name)) {
          if (readFileSync(full, 'utf8').includes(needle)) hits.push(full);
        }
      }
    };
    walk(path.join(process.cwd(), 'src'));
    expect(hits).toEqual([]);
  });
});
