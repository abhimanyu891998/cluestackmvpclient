/**
 * API Configuration for BDD Market Data Client
 * 
 * This file centralizes all server URL configurations.
 * Update these URLs based on your deployment environment.
 */

// Type definition for window configuration
interface AppConfig {
  SERVER_URL?: string;
}

declare global {
  interface Window {
    APP_CONFIG?: AppConfig;
  }
}

// Get server URL from environment variables or use default
const getServerUrl = (): string => {
  // Try environment variable first (for build-time configuration)
  if (process.env.NEXT_PUBLIC_SERVER_URL) {
    return process.env.NEXT_PUBLIC_SERVER_URL;
  }
  
  // Try runtime configuration (for client-side configuration)
  if (typeof window !== 'undefined' && window.APP_CONFIG?.SERVER_URL) {
    return window.APP_CONFIG.SERVER_URL;
  }
  
  // Default to localhost for development
  return 'http://127.0.0.1:8000';
};

const getWebSocketUrl = (): string => {
  const serverUrl = getServerUrl();
  // Convert HTTP URL to WebSocket URL
  return serverUrl.replace(/^https?/, 'wss');
};

const getSSEUrl = (): string => {
  const serverUrl = getServerUrl();
  // SSE uses regular HTTP/HTTPS
  return serverUrl;
};

export const API_CONFIG = {
  // Base server URL (HTTP)
  SERVER_URL: getServerUrl(),
  
  // WebSocket URL
  WS_URL: getWebSocketUrl(),
  
  // SSE URL
  SSE_URL: getSSEUrl(),
  
  // API endpoints
  ENDPOINTS: {
    HEALTH: '/health',
    STATUS: '/status',
    METRICS: '/metrics/summary',
    START: '/start',
    STOP: '/stop',
    PROFILES: '/config/profiles',
    PROFILE_SWITCH: '/config/profile',
    PUBLISHER_STATUS: '/status/publisher',
    WEBSOCKET: '/ws',
    SSE: '/events'
  }
} as const;

// Helper functions to build full URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.SERVER_URL}${endpoint}`;
};

export const buildWebSocketUrl = (): string => {
  return `${API_CONFIG.WS_URL}${API_CONFIG.ENDPOINTS.WEBSOCKET}`;
};

export const buildSSEUrl = (): string => {
  return `${API_CONFIG.SSE_URL}${API_CONFIG.ENDPOINTS.SSE}`;
};

// Export individual URLs for convenience
export const SERVER_URL = API_CONFIG.SERVER_URL;
export const WS_URL = buildWebSocketUrl();
export const SSE_URL = buildSSEUrl();

console.log('🔧 API Configuration loaded:', {
  SERVER_URL: API_CONFIG.SERVER_URL,
  WS_URL: API_CONFIG.WS_URL,
  SSE_URL: API_CONFIG.SSE_URL
});