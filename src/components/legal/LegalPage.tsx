import type { ReactNode } from 'react';
import { getSupportContact } from '@/lib/site-contact';

/** Shared shell for /privacy and /terms, styled like /philosophy. */
export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-green-50/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-3">{title}</h1>
          <p className="text-sm text-jk-charcoal/70 font-ui">Effective date: {effectiveDate}</p>
        </div>
        <div className="bg-white rounded-2xl p-8 border-2 border-jk-sage/20 space-y-8 text-base text-jk-charcoal/80 font-body leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

/** One titled section of a legal page. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-heading text-jk-olive">{title}</h2>
      {children}
    </section>
  );
}

/** Link to the support contact (email when configured, else GitHub issues). */
export function SupportContactLink() {
  const contact = getSupportContact();
  return (
    <a
      href={contact.href}
      className="text-jk-tomato underline hover:no-underline"
      {...(contact.isEmail ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
    >
      {contact.label}
    </a>
  );
}
