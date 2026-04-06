const STRIPE_PUBLISHABLE_KEY = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "").trim();

function maskStripeKey(value: string) {
  if (!value) return null;
  if (value.length <= 12) return value;
  return `${value.slice(0, 7)}...${value.slice(-6)}`;
}

export function getStripeFrontendConfig() {
  const key = STRIPE_PUBLISHABLE_KEY;
  const mode =
    key.startsWith("pk_live_") ? "live" : key.startsWith("pk_test_") ? "test" : "unknown";

  return {
    publishableKey: key || null,
    isConfigured: Boolean(key),
    mode,
    maskedKey: maskStripeKey(key),
  };
}

