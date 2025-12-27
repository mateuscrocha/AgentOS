import Stripe from "https://esm.sh/stripe@14.24.0?target=deno";

export function getEnvOrThrow(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim() === "") {
    throw new Error(`Configuração ausente: ${name}`);
  }
  return value;
}

const STRIPE_SECRET_KEY = getEnvOrThrow("STRIPE_SECRET_KEY");

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20",
});

export const STRIPE_PUBLISHABLE_KEY = getEnvOrThrow("STRIPE_PUBLISHABLE_KEY");
export const STRIPE_WEBHOOK_SECRET = getEnvOrThrow("STRIPE_WEBHOOK_SECRET");
export const STRIPE_PRICE_ID_DEFAULT = getEnvOrThrow("STRIPE_PRICE_ID_DEFAULT");
export const STRIPE_CHECKOUT_SUCCESS_URL = getEnvOrThrow("STRIPE_CHECKOUT_SUCCESS_URL");
export const STRIPE_CHECKOUT_CANCEL_URL = getEnvOrThrow("STRIPE_CHECKOUT_CANCEL_URL");
export const STRIPE_CUSTOMER_PORTAL_RETURN_URL = getEnvOrThrow("STRIPE_CUSTOMER_PORTAL_RETURN_URL");

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
