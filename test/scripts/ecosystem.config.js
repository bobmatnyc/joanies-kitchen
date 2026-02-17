module.exports = {
  apps: [{
    name: 'recipe-manager-3003',
    script: './start-dev.sh',
    cwd: '/Users/masa/Projects/recipe-manager',
    interpreter: 'bash',
    env: {
      NODE_ENV: 'development',
      PORT: '3003'
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
