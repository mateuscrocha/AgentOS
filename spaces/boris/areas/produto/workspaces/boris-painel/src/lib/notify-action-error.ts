import { notify } from "@/components/ui/sonner";

export function notifyActionError(title: string, error: unknown, fallbackDescription: string) {
  const message =
    typeof (error as any)?.message === "string" ? (error as any).message.trim() : "";

  notify.error(title, message || fallbackDescription);
}
