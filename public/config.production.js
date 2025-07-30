/**
 * Production Configuration for BDD Market Data Client
 * 
 * Copy this file to config.js and update SERVER_URL for production deployment.
 */

window.APP_CONFIG = {
  // Production server URL - Update this to your deployed server
  SERVER_URL: 'https://your-production-server.com',
  
  // Environment
  ENVIRONMENT: 'production',
  
  // Feature flags
  FEATURES: {
    DEBUG_LOGGING: false,
    AUTO_RECONNECT: true
  }
};