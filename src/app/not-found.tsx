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
