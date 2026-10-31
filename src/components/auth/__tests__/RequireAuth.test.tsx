/** #22: RequireAuth gates on useSessionUser and starts Google sign-in directly. */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '@/components/auth/RequireAuth';

const auth = vi.hoisted(() => ({ value: { isLoaded: true, user: null as { id: string } | null } }));
const signIn = vi.hoisted(() => vi.fn());

vi.mock('@/lib/use-session-user', () => ({ useSessionUser: () => auth.value }));
vi.mock('next-auth/react', () => ({ signIn }));

beforeEach(() => {
  signIn.mockReset();
  auth.value = { isLoaded: true, user: null };
});

describe('RequireAuth', () => {
  it.each([
    [true, /sign in to continue/i],
    [false, /^sign in$/i],
  ])(
    'signed out (card %s): the prompt button starts Google sign-in back to this page',
    (showAsCard, name) => {
      render(
        <RequireAuth featureName="Feature" showAsCard={showAsCard}>
          <p>secret</p>
        </RequireAuth>
      );
      expect(screen.queryByText('secret')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name }));
      expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: window.location.href });
    }
  );

  it.each([
    ['signed out', null],
    ['signed in', { id: 'u1' }],
  ])('loading (%s): renders only the pulsing lock, no children and no button', (_, user) => {
    auth.value = { isLoaded: false, user };
    const { container } = render(
      <RequireAuth featureName="Feature">
        <p>secret</p>
      </RequireAuth>
    );
    expect(screen.queryByText('secret')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('.animate-pulse svg')).not.toBeNull();
  });

  it('signed in: renders the children', () => {
    auth.value = { isLoaded: true, user: { id: 'u1' } };
    render(
      <RequireAuth featureName="Feature">
        <p>secret</p>
      </RequireAuth>
    );
    expect(screen.getByText('secret')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
