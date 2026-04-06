import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { createWebhookZapiMessagesHandler } from "../webhook-zapi-messages/index.ts";

const handler = createWebhookZapiMessagesHandler();

if (import.meta.main) {
  serve(handler);
}

export { handler as createIncomingProviderEventHandler };
