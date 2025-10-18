import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Disable optimizeCss due to critters dependency issue
    // optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'react-icons', '@radix-ui/react-icons'],
  },
  // DO NOT add 'output: standalone' - it breaks public folder serving on Vercel
  // See: docs/fixes/CHEF_AVATAR_FIX_2025-10-17.md
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
      // CDNs
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.wp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'live.staticflickr.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's.yimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.zenfs.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'publish.purewow.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.purewow.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'example.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'example.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.heavenlyhomemakers.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.heavenlyhomemakers.com',
        port: '',
        pathname: '/**',
      },
      // Recipe Source Domains
      {
        protocol: 'https',
        hostname: 'www.bonappetit.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.epicurious.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.seriouseats.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.foodnetwork.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'smittenkitchen.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.halfbakedharvest.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.budgetbytes.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'minimalistbaker.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.cookieandkate.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.kingarthurbaking.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.thekitchn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pinchofyum.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'howsweeteats.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.allrecipes.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'tasty.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.mariashriversundaypaper.com',
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
        hostname: 'ljqhvy0frzhuigv1.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      // Chef Recipe Sources
      {
        protocol: 'https',
        hostname: 'www.foodandwine.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lidiasitaly.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.lidiasitaly.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
