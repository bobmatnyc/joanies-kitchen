import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BETA_LAUNCH_DATE } from '@/config/beta';
import { AlphaStamp } from '../AlphaStamp';

// #62: AlphaStamp must show the G16 beta date.
describe('AlphaStamp', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('renders the G16 beta launch date in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(BETA_LAUNCH_DATE).toBe('2027-02-01');
    render(<AlphaStamp />);
    expect(screen.getByText('BETA LAUNCH 2/1/27')).toBeTruthy();
  });
});
