/**
 * SafarX Application Configuration
 * Centralizes environment variables, API endpoints, and WebSocket URL derivation.
 */

// Base HTTP URL for Spring Boot backend
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Derives native WebSocket broker URL from API_BASE_URL
 * http://localhost:8080  -> ws://localhost:8080/ws-ride/websocket
 * https://api.safarx.in -> wss://api.safarx.in/ws-ride/websocket
 */
const deriveWsUrl = (baseUrl) => {
  try {
    const url = new URL(baseUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws-ride/websocket`;
  } catch {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
    return `${protocol}//${host}/ws-ride/websocket`;
  }
};

export const WS_URL = deriveWsUrl(API_BASE_URL);

// Razorpay Key ID from environment
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

// Demo mode flag for local simulation (e.g. Hyderabad hub GPS fallback)
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
