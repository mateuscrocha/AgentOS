import Stripe from "https://esm.sh/stripe@14.24.0?target=deno";

export function getEnvOrThrow(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim() === "") {
    throw new Error(`Configuração ausente: ${name}`);
  }
  return value;
}

let cachedStripe: Stripe | null = null;
let cachedStripeKey: string | null = null;
let cachedStripeExpiresAt = 0;

export async function getStripe(): Promise<Stripe> {
  const now = Date.now();
  if (cachedStripe && cachedStripeKey && now < cachedStripeExpiresAt) return cachedStripe;

  const key = getEnvOrThrow("STRIPE_SECRET_KEY").trim();

  if (!cachedStripe || cachedStripeKey !== key) {
    cachedStripe = new Stripe(key, { apiVersion: "2024-11-20" });
    cachedStripeKey = key;
  }
  cachedStripeExpiresAt = now + 60_000;
  return cachedStripe;
}

export function getStripePublishableKey(): string {
  return getEnvOrThrow("STRIPE_PUBLISHABLE_KEY");
}

export function getStripeWebhookSecret(): string {
  return getEnvOrThrow("STRIPE_WEBHOOK_SECRET");
}

export function getStripePriceIdDefault(): string {
  return getEnvOrThrow("STRIPE_PRICE_ID_DEFAULT");
}

export function getStripeCheckoutSuccessUrl(): string {
  return getEnvOrThrow("STRIPE_CHECKOUT_SUCCESS_URL");
}

export function getStripeCheckoutCancelUrl(): string {
  return getEnvOrThrow("STRIPE_CHECKOUT_CANCEL_URL");
}

export function getStripeCustomerPortalReturnUrl(): string {
  return getEnvOrThrow("STRIPE_CUSTOMER_PORTAL_RETURN_URL");
}

export function mapStripeStatusToBilling(status: string): "inactive" | "trialing" | "active" | "past_due" | "canceled" {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return "inactive";
  }
}
