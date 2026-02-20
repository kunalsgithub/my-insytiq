/// <reference types="vite/client" />

interface PaddleCheckoutOptions {
  items?: Array<{ priceId: string; quantity: number }>;
  customData?: Record<string, unknown>;
  customer?: { email?: string; address?: unknown };
  settings?: { displayMode?: string; theme?: string; locale?: string };
  successUrl?: string;
}

interface PaddleStatic {
  Initialize: (opts: { token: string }) => void;
  Checkout: { open: (opts: PaddleCheckoutOptions) => void };
  Environment: { set: (env: 'sandbox' | 'production') => void };
}

declare global {
  interface Window {
    Paddle?: PaddleStatic;
  }
}

