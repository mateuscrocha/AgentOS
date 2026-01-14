/// <reference types="vite/client" />

declare module "jsr:@supabase/functions-js/edge-runtime.d.ts" {
  export {};
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export type ServeHandler = (req: Request) => Response | Promise<Response>;
  export function serve(handler: ServeHandler, options?: unknown): unknown;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
  export { createClient } from "@supabase/supabase-js";
}

declare module "https://esm.sh/@supabase/supabase-js@2.45.4" {
  export * from "@supabase/supabase-js";
  export { createClient } from "@supabase/supabase-js";
}

declare module "https://deno.land/std@0.224.0/testing/asserts.ts" {
  export function assert(condition: unknown, msg?: string): asserts condition;
  export function assertEquals<T>(actual: T, expected: T, msg?: string): void;
}

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (...args: any[]) => any;
};

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string;
}
