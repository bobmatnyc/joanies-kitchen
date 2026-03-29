/**
 * PM2 Process Manager Configuration
 *
 * This configuration provides stable deployment options for development and production.
 *
 * Usage:
 *   Development (with hot reload):
 *     pm2 start ecosystem.config.js --only recipe-dev
 *
 *   Production-like local testing (port 3002):
 *     pm2 start ecosystem.config.js --only recipe-prod
 *
 *   Production on port 3005 (replaces ecosystem-3005.config.js):
 *     pm2 start ecosystem.config.js --only joanies-kitchen-3005
 *
 *   Recipe scraper (background task):
 *     pm2 start ecosystem.config.js --only recipe-scraper
 *
 *   All processes:
 *     pm2 start ecosystem.config.js
 *
 *   Monitor:
 *     pm2 monit
 *     pm2 logs
 *
 *   Stop:
 *     pm2 stop all
 *     pm2 delete all
 */

module.exports = {
  apps: [
    {
      name: 'recipe-dev',
      script: 'pnpm',
      args: 'dev',
      cwd: '/Users/masa/Projects/joanies-kitchen',
      watch: false, // Next.js handles file watching
      env: {
        NODE_ENV: 'development',
        PORT: '3002',
      },
      max_memory_restart: '2G',
      error_file: './tmp/logs/pm2-dev-error.log',
      out_file: './tmp/logs/pm2-dev-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      kill_timeout: 5000,
      listen_timeout: 10000,
      instance_var: 'INSTANCE_ID',
    },
    {
      name: 'recipe-prod',
      script: 'pnpm',
      args: 'start',
      cwd: '/Users/masa/Projects/joanies-kitchen',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
      },
      max_memory_restart: '1G',
      error_file: './tmp/logs/pm2-prod-error.log',
      out_file: './tmp/logs/pm2-prod-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '5s',
      restart_delay: 2000,
      kill_timeout: 3000,
      listen_timeout: 8000,
    },
    {
      // Port 3005 variant — consolidates ecosystem-3005.config.js
      name: 'joanies-kitchen-3005',
      script: 'pnpm',
      args: 'start',
      cwd: '/Users/masa/Projects/joanies-kitchen',
      watch: false,
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: '3005',
      },
      max_memory_restart: '1G',
      error_file: './tmp/logs/pm2-3005-error.log',
      out_file: './tmp/logs/pm2-3005-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 2000,
      kill_timeout: 3000,
      listen_timeout: 8000,
    },
    {
      name: 'recipe-daily-scraper',
      script: 'tsx',
      args: 'test/scripts/autonomous-recipe-scraper.ts',
      cwd: '/Users/masa/Projects/joanies-kitchen',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      error_file: './tmp/logs/pm2-daily-scraper-error.log',
      out_file: './tmp/logs/pm2-daily-scraper-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: false, // Don't auto-restart after normal completion
      cron_restart: '0 6 * * *', // Run at 6am daily
    },
    {
      name: 'recipe-scraper',
      script: 'tsx',
      args: 'scripts/standalone-scraper.ts',
      cwd: '/Users/masa/Projects/joanies-kitchen',
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
      max_memory_restart: '1G',
      error_file: './tmp/logs/pm2-scraper-error.log',
      out_file: './tmp/logs/pm2-scraper-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      cron_restart: '0 */6 * * *', // Restart every 6 hours
      max_restarts: 20,
      min_uptime: '30s',
      restart_delay: 10000,
    },
  ],
};
