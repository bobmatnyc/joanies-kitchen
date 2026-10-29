import type { Metadata } from 'next';

// Force dynamic rendering for error pages to avoid static generation issues
export const dynamic = 'force-dynamic';

// #134: the root layout sets robots index/follow; a 404 must not inherit it.
export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="container mx-auto py-16 px-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
      <p className="text-muted-foreground mb-4">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <a
        href="/"
        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 inline-block"
      >
        Go Home
      </a>
    </div>
  );
}
