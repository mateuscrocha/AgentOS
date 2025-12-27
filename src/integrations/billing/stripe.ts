import { supabase } from "@/integrations/supabase/client";

export async function startCheckoutForOrganization(organizationId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("billing-checkout", {
    body: { organizationId },
  });
  if (error) throw error;
  return (data as { url: string }).url;
}

export async function openCustomerPortal(organizationId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("billing-portal", {
    body: { organizationId },
  });
  if (error) throw error;
  return (data as { url: string }).url;
}

export async function linkExistingStripeCustomer(organizationId: string, stripeCustomerId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("billing-link-stripe-customer", {
    body: { organizationId, stripeCustomerId },
  });
  if (error) throw error;
}

