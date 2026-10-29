import type { NextConfig } from "next";
import { EMBEDDING_MODEL_REPO, EMBEDDING_MODEL_ROOT } from './src/lib/ai/embedding-model';

// Bundle analyzer (run with ANALYZE=true pnpm build)
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// #96 D57: functions that embed in-process need the bge-small files and the
// linux-x64 ONNX runtime (its .so sits beside the .node binding the tracer finds).
// Applied to every route: the embedder is reached through server actions, which
// are compiled into ~30 pages including `/`, and Next matches include keys with
// `contains`, so a key for `/` alone would match every route anyway.
const EMBEDDER_FILES = [
  `./${EMBEDDING_MODEL_ROOT}/${EMBEDDING_MODEL_REPO}/**/*`,
  './node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v*/linux/x64/*',
];
// #96 D57: Vercel runs linux-x64; the other onnxruntime-node builds are ~240 MB of dead weight.
const ONNX_FOREIGN_BINARIES = [
  '**/onnxruntime-node/bin/napi-v*/darwin/**',
  '**/onnxruntime-node/bin/napi-v*/win32/**',
  '**/onnxruntime-node/bin/napi-v*/linux/arm64/**',
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // #96 D57: native ONNX runtime and its JS wrapper load from node_modules, not the webpack bundle.
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
  outputFileTracingIncludes: { '/**/*': EMBEDDER_FILES },
  outputFileTracingExcludes: { '/**/*': ONNX_FOREIGN_BINARIES },
  // Compression is enabled by default in production
  // Next.js automatically compresses responses using gzip
  compress: true, // Explicitly enable for clarity
  // Cache control headers for aggressive cache busting
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
        ],
      },
    ];
  },
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
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
