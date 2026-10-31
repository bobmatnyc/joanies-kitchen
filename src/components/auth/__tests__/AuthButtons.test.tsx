/** #22: the header account menu reads the session user from useSessionUser. */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthButtons } from '@/components/auth/AuthButtons';

type User = {
  id: string;
  name: string | null;
  email: string | null;
  image: null;
  isAdmin: boolean;
};
const auth = vi.hoisted(() => ({ value: { isLoaded: true, user: null as User | null } }));

vi.mock('@/lib/use-session-user', () => ({ useSessionUser: () => auth.value }));
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const ADA: User = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@x.test',
  image: null,
  isAdmin: false,
};

function openMenu(user: User) {
  auth.value = { isLoaded: true, user };
  render(<AuthButtons />);
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
}

beforeEach(() => {
  auth.value = { isLoaded: true, user: null };
});

describe('AuthButtons', () => {
  it('signed out: shows the Sign In link', () => {
    render(<AuthButtons />);
    expect(screen.getByRole('link', { name: /sign in/i }).getAttribute('href')).toBe('/sign-in');
  });

  it.each([
    [true, 1],
    [false, 0],
  ])('isAdmin %s: admin link count %i', (isAdmin, count) => {
    openMenu({ ...ADA, isAdmin });
    expect(screen.queryAllByRole('link', { name: /admin dashboard/i })).toHaveLength(count);
  });

  it.each([
    ['Ada Lovelace', 'ada@x.test', 'Ada Lovelace'],
    [null, 'ada@x.test', 'ada@x.test'],
    [null, '', 'Account'],
  ])('name %s, email %s: menu label %s', (name, email, label) => {
    openMenu({ ...ADA, name, email });
    expect(screen.getByText(label)).toBeTruthy();
  });
});
