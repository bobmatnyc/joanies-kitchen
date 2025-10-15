import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  output: 'standalone',
  images: {
    unoptimized: true, // Temporarily disable optimization to allow all image sources
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
    ],
  },
};

export default nextConfig;
