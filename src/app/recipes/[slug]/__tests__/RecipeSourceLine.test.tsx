/**
 * Tdb: show recipe source (Bob 2026-11-09) — the rendered "Source" line.
 */
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RecipeSourceLine } from '@/components/recipe/RecipeSourceLine';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('RecipeSourceLine', () => {
  it('renders nothing for a null source', () => {
    const { container } = render(<RecipeSourceLine source={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('an external link opens in a new tab with nofollow noopener noreferrer', () => {
    render(
      <RecipeSourceLine
        source={{ kind: 'site', label: 'epicurious.com', href: 'https://epicurious.com/' }}
      />
    );
    const link = screen.getByRole('link', { name: 'epicurious.com' });
    expect(link.getAttribute('href')).toBe('https://epicurious.com/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('nofollow noopener noreferrer');
  });

  it('a chef links internally, and the original page externally', () => {
    render(
      <RecipeSourceLine
        source={{
          kind: 'chef',
          label: 'Dan Barber',
          href: '/chef/dan-barber',
          secondary: { label: 'original on bluehill.com', href: 'https://bluehill.com/r' },
        }}
      />
    );
    const chef = screen.getByRole('link', { name: 'Dan Barber' });
    expect(chef.getAttribute('href')).toBe('/chef/dan-barber');
    expect(chef.getAttribute('target')).toBeNull();
    const original = screen.getByRole('link', { name: 'original on bluehill.com' });
    expect(original.getAttribute('target')).toBe('_blank');
    expect(original.getAttribute('rel')).toBe('nofollow noopener noreferrer');
  });

  it('plain text has no link', () => {
    render(<RecipeSourceLine source={{ kind: 'text', label: 'Dan Barber' }} />);
    expect(screen.getByTestId('recipe-source').textContent).toBe('Source: Dan Barber');
    expect(screen.queryByRole('link')).toBeNull();
  });
});
