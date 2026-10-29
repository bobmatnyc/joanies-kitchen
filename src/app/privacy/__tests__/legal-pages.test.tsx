/** /privacy and /terms render their required sections and the support contact. */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';

afterEach(() => vi.unstubAllEnvs());

describe('PrivacyPage', () => {
  it('renders the effective date, required sections and the issues-page fallback contact', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', '');
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Effective date: October 28, 2026/)).toBeInTheDocument();
    for (const name of [
      'Information from Google sign-in',
      'Content you create',
      'Cookies and browser storage',
      'Service providers',
      'Your choices: access, export and deletion',
      'Children',
      'Changes to this policy',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    const contacts = screen.getAllByRole('link', { name: 'support@1mc.io' });
    expect(contacts[0]).toHaveAttribute('href', 'mailto:support@1mc.io');
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/terms'
    );
  });

  // #104: the Retention section describes the daily purge job.
  it('describes the daily purge in Retention', () => {
    render(<PrivacyPage />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Retention' });
    const text = heading.parentElement?.textContent ?? '';
    expect(text).not.toContain('no automatic deletion schedule');
    expect(text).toContain('runs once a day');
    expect(text).toContain('30-day grace period');
  });

  it('commits to 30 days and makes no self-serve claim', () => {
    render(<PrivacyPage />);
    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'Your choices: access, export and deletion',
    });
    const text = heading.parentElement?.textContent ?? '';
    expect(text).toContain('within 30 days');
    expect(text).toContain('30-day grace period');
    expect(text).toContain('coming soon');
    expect(text).toContain('deleted user');
    expect(text).not.toMatch(/(download|delete)[^.]*(from|in) your (account )?settings/i);
    expect(text).not.toMatch(
      /(delete|export) (it |your data |your account )?(yourself|instantly)/i
    );
  });

  it('links a mailto contact when NEXT_PUBLIC_SUPPORT_EMAIL is set', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', 'help@example.test');
    render(<PrivacyPage />);
    const links = screen.getAllByRole('link', { name: 'help@example.test' });
    expect(links[0]).toHaveAttribute('href', 'mailto:help@example.test');
  });
});

describe('TermsPage', () => {
  it('renders the required sections and links the privacy policy', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', '');
    render(<TermsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
    for (const name of [
      'The service',
      'Accounts',
      'Your content',
      'Recipes from other sources',
      'Acceptable use',
      'Suspension',
      'Limitation of liability',
      'Changes to these terms',
      'Contact',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });

  it('commits to 7-day report review and lists the moderation actions', () => {
    render(<TermsPage />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Reports and moderation' });
    const text = heading.parentElement?.textContent ?? '';
    expect(text).toContain('within 7 days');
    expect(text).toMatch(/hide/);
    expect(text).toMatch(/remove/);
    expect(text).toMatch(/suspend the account/);
  });
});
