/**
 * PM2 Process Manager Configuration for Port 3005
 *
 * This configuration starts the Next.js application on port 3005
 */

module.exports = {
  apps: [
    {
      name: 'joanies-kitchen',
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
  ],
};
