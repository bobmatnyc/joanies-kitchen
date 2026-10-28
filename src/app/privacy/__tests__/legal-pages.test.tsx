/** /privacy and /terms render their required sections and the support contact. */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import { SUPPORT_ISSUES_URL } from '@/lib/site-contact';

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
    const contacts = screen.getAllByRole('link', { name: 'our GitHub issues page' });
    expect(contacts[0]).toHaveAttribute('href', SUPPORT_ISSUES_URL);
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/terms'
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
});
