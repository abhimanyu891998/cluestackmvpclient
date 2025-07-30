/**
 * Runtime Configuration for BDD Market Data Client
 * 
 * This file can be modified after deployment without rebuilding the application.
 * Update SERVER_URL to point to your deployed server.
 */

window.APP_CONFIG = {
  // Server URL - Update this based on your deployment
  SERVER_URL: 'http://127.0.0.1:8000',
  
  // Other runtime configurations can be added here
  ENVIRONMENT: 'development',
  
  // Feature flags
  FEATURES: {
    DEBUG_LOGGING: true,
    AUTO_RECONNECT: true
  }
};