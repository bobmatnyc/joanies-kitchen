module.exports = {
  apps: [
    {
      name: 'recipe-manager-3001',
      script: 'npm',
      args: 'run dev -- --port 3001',
      cwd: '/Users/masa/Projects/recipe-manager',
      env: {
        NODE_ENV: 'development',
        // Explicitly unset Clerk variables to force reading from .env.local
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined,
        CLERK_SECRET_KEY: undefined,
        USE_PRODUCTION_CLERK: undefined,
        FORCE_PRODUCTION_KEYS: undefined,
        CLERK_DOMAIN: undefined,
        CLERK_IS_SATELLITE: undefined,
        CLERK_PRIMARY_URL: undefined,
        SKIP_CLERK_DOMAIN_VALIDATION: undefined,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV: undefined,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD: undefined,
        CLERK_SECRET_KEY_DEV: undefined,
        CLERK_SECRET_KEY_PROD: undefined,
      }
    },
    {
      name: 'recipe-scraper',
      script: './scripts/standalone-scraper.ts',
      interpreter: './node_modules/.bin/tsx',
      cwd: '/Users/masa/Projects/recipe-manager',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        SCRAPER_WEEKS: '0,1,2,3,4',       // Current week through 4 weeks ago
        SCRAPER_MAX_RECIPES: '5',         // 5 recipes per week
        SCRAPER_INTERVAL_MIN: '60',       // Every hour
        SCRAPER_AUTO_APPROVE: 'true',     // Auto-approve quality recipes
        SCRAPER_API_URL: 'http://localhost:3001',
      },
      error_file: './logs/scraper-error.log',
      out_file: './logs/scraper-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
