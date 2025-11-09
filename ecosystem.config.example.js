module.exports = {
  apps: [{
    // Application name
    name: 'raf-bot',
    
    // Application entry point
    script: './index.js',
    
    // Number of instances to be started
    instances: 1,
    
    // Execution mode
    exec_mode: 'fork',
    
    // Enable/disable file watching
    watch: false,
    
    // Ignore watch for these patterns
    ignore_watch: [
      'node_modules',
      'logs',
      'session',
      '.git',
      'uploads',
      'temp',
      'backups',
      '*.sqlite'
    ],
    
    // Memory limit for restart
    max_memory_restart: '2G',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3100
    },
    
    // Environment variables for development
    env_development: {
      NODE_ENV: 'development',
      PORT: 3100,
      DEBUG: 'app:*'
    },
    
    // Log files configuration
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    
    // Add timestamp to logs
    time: true,
    
    // Merge logs from all instances
    merge_logs: true,
    
    // Log date format
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto restart configuration
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Delay between restarts
    restart_delay: 4000,
    
    // Kill timeout
    kill_timeout: 5000,
    
    // Wait for ready signal
    wait_ready: true,
    listen_timeout: 10000,
    
    // Cron restart pattern (optional)
    // cron_restart: '0 2 * * *',
    
    // Node.js arguments
    node_args: '--max-old-space-size=2048',
    
    // Interpreter arguments
    interpreter_args: '',
    
    // Source map support
    source_map_support: true,
    
    // Instance variables
    instance_var: 'INSTANCE_ID',
    
    // Minimum uptime before auto-restart
    min_uptime: 10000,
    
    // Process events
    events: {
      restart: 'echo "App restarted"',
      // reload: 'echo "App reloaded"',
      // stop: 'echo "App stopped"',
      // exit: 'echo "App exited"',
      // kill: 'echo "App killed"'
    },
    
    // Error handling
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    combine_logs: true,
    
    // Post-deploy actions
    post_deploy: 'npm install --production && pm2 reload ecosystem.config.js --env production',
    
    // Pre-stop hook
    // pre_stop: 'echo "Stopping application"'
  }],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'www-data',
      host: 'YOUR_SERVER_IP',
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/raf-bot-v2.git',
      path: '/var/www/raf-bot',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'echo "Setting up production environment"',
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'www-data',
      host: 'YOUR_STAGING_SERVER_IP',
      ref: 'origin/develop',
      repo: 'https://github.com/yourusername/raf-bot-v2.git',
      path: '/var/www/raf-bot-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development',
      env: {
        NODE_ENV: 'development'
      }
    }
  }
};
