/**
 * Admin managers must call their list action once on mount. An unmemoized
 * loader in the effect's deps re-ran the effect after every state update and
 * looped server-action POSTs while the admin page was open.
 */

import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAllBackgrounds: vi.fn(),
  createBackground: vi.fn(),
  deleteBackground: vi.fn(),
  reorderBackground: vi.fn(),
  updateBackground: vi.fn(),
  getAllPhotosAdmin: vi.fn(),
  deletePhoto: vi.fn(),
  reorderPhotos: vi.fn(),
  updatePhoto: vi.fn(),
}));

vi.mock('@/app/actions/hero-backgrounds', () => ({
  getAllBackgrounds: mocks.getAllBackgrounds,
  createBackground: mocks.createBackground,
  deleteBackground: mocks.deleteBackground,
  reorderBackground: mocks.reorderBackground,
  updateBackground: mocks.updateBackground,
}));
vi.mock('@/app/actions/slideshow', () => ({
  getAllPhotosAdmin: mocks.getAllPhotosAdmin,
  deletePhoto: mocks.deletePhoto,
  reorderPhotos: mocks.reorderPhotos,
  updatePhoto: mocks.updatePhoto,
}));
vi.mock('@vercel/blob/client', () => ({ upload: vi.fn() }));

import { HeroBackgroundManager } from '../HeroBackgroundManager';
import { SlideshowManager } from '../SlideshowManager';

/** Lets pending action promises resolve and the resulting re-renders commit. */
async function flushRenders(rounds = 10) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe('admin manager load count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllBackgrounds.mockResolvedValue({ success: true, data: [] });
    mocks.getAllPhotosAdmin.mockResolvedValue([]);
  });

  it('HeroBackgroundManager calls getAllBackgrounds exactly once on mount', async () => {
    render(<HeroBackgroundManager />);
    await flushRenders();

    // The empty state proves the load resolved and its state updates committed.
    expect(screen.getByText(/No backgrounds yet/)).toBeInTheDocument();
    expect(mocks.getAllBackgrounds).toHaveBeenCalledTimes(1);
  });

  it('SlideshowManager calls getAllPhotosAdmin exactly once on mount', async () => {
    render(<SlideshowManager />);
    await flushRenders();

    expect(screen.getByText('No photos uploaded yet')).toBeInTheDocument();
    expect(mocks.getAllPhotosAdmin).toHaveBeenCalledTimes(1);
  });
});
