// #155: a hero image that fails to load (the live top-50 #1 recipe's local file 404s)
// must leave the rotation, never stay on screen as a broken-image icon.
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnimatedRecipeBackground } from '../AnimatedRecipeBackground';

vi.mock('next/image', () => ({
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    // biome-ignore lint/performance/noImgElement: test stand-in for next/image
    <img src={src} alt={alt} onError={onError} />
  ),
}));

const DEAD = '/images/recipes/joanie-crab-salad.jpg';
const GOOD = 'https://cdn.example.com/steakburger.png';

function srcs(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
}

describe('AnimatedRecipeBackground', () => {
  it('drops an image that fails to load and shows the next one', () => {
    const { container } = render(<AnimatedRecipeBackground images={[DEAD, GOOD]} />);
    const dead = container.querySelector(`img[src="${DEAD}"]`);
    expect(dead).not.toBeNull();

    fireEvent.error(dead as HTMLImageElement);

    expect(srcs(container)).toEqual([GOOD]);
  });

  it('renders nothing when every image fails, leaving the hero gradient', () => {
    const { container } = render(<AnimatedRecipeBackground images={[DEAD]} />);

    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing when there are no images', () => {
    const { container } = render(<AnimatedRecipeBackground images={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
