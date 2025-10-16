module.exports = {
    apps: [{
      name: 'api-puerta-backend',
      script: 'server.js',
      cwd: '/home/taqrocom/public_html/subdominios/api-puerta',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/home/taqrocom/.pm2/logs/api-puerta-backend-error.log',
      out_file: '/home/taqrocom/.pm2/logs/api-puerta-backend-out.log',
      log_file: '/home/taqrocom/.pm2/logs/api-puerta-backend-combined.log',
      time: true
    }]
  };