module.exports = {
  apps: [
    {
      name: 'crm',
      script: 'crm.js',
      watch: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'bot-crm',
      script: './bot-crm/bot.js',
      watch: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
