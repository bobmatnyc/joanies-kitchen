import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserAvatar } from '../UserAvatar';

const IMG = 'https://lh3.googleusercontent.com/a/abc=s96-c';

describe('UserAvatar', () => {
  it('renders the picture with name alt text and no referrer', () => {
    render(<UserAvatar image={IMG} name="Ada Lovelace" email="ada@x.com" />);
    const img = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(img.getAttribute('src')).toBe(IMG);
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('falls back to name initials when the image fails to load', () => {
    render(<UserAvatar image={IMG} name="Ada Lovelace" email="ada@x.com" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('AL')).toBeTruthy();
  });

  it.each([
    [null, 'ada@x.com', 'A'],
    ['Grace', null, 'G'],
  ])('uses initials with no image (name=%s, email=%s)', (name, email, initials) => {
    render(<UserAvatar image={null} name={name} email={email} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(initials)).toBeTruthy();
  });
});
