import type { NextConfig } from "next";

// Bundle analyzer (run with ANALYZE=true pnpm build)
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async redirects() {
    return [
      {
        source: '/meal-plans',
        destination: '/meals',
        permanent: true,
      },
      {
        source: '/meal-plans/:path*',
        destination: '/meals/:path*',
        permanent: true,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Disable optimizeCss due to critters dependency issue
    // optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'react-icons', '@radix-ui/react-icons'],
  },
  skipMiddlewareUrlNormalize: true,
  skipTrailingSlashRedirect: true,
  images: {
    // Re-enable optimization for better FCP/LCP performance
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Quality levels for Next.js 16 compatibility
    qualities: [75, 85, 90, 95, 100],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // Vercel Blob Storage (our own images)
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.blob.vercel-app.com',
        port: '',
        pathname: '/**',
      },
      // Fallback: Unsplash for ingredients without custom images
      // TODO: Migrate these to Vercel Blob or generate with Stable Diffusion
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      // Temporary: Remaining external images that failed to download (19 recipes)
      // TODO: Generate replacement images with Stable Diffusion
      {
        protocol: 'https',
        hostname: 'food.fnr.sndimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'annikaeats.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.ebony.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'www.ebony.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
