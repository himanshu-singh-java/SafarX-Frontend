

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
