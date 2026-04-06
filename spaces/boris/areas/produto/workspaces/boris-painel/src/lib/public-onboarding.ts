import { APP_PASSWORD_HINT, validateAppPassword } from "@/lib/password-policy";
import { supabase } from "@/integrations/supabase/client";
import {
  clearPendingOnboardingDraft,
  readPendingOnboardingDraft,
  type PendingOnboardingDraft,
} from "@/lib/public-onboarding-pending";

export type PublicOnboardingFormValues = {
  fullName: string;
  organizationName: string;
  email: string;
  whatsappPhone: string;
  password: string;
  confirmPassword: string;
  inviteLink: string;
};

export type PublicOnboardingValidationErrors = Partial<Record<keyof PublicOnboardingFormValues, string>>;

async function readFunctionErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return null;

  const maybeContext = (error as { context?: Response }).context;
  if (!(maybeContext instanceof Response)) return null;

  try {
    const cloned = maybeContext.clone();
    const payload = await cloned.json().catch(async () => {
      const text = await cloned.text();
      return text ? { message: text } : null;
    });

    if (payload && typeof payload === "object") {
      const code = "code" in payload ? String((payload as { code?: unknown }).code ?? "").trim() : "";
      const message = "message" in payload ? String((payload as { message?: unknown }).message ?? "").trim() : "";
      if (code && message) return `${message} (${code})`;
      if (message) return message;
      if (code) return code;
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizePhoneToE164(input?: string | null) {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}

export function validatePublicOnboardingForm(values: PublicOnboardingFormValues): PublicOnboardingValidationErrors {
  const errors: PublicOnboardingValidationErrors = {};

  if (!values.fullName.trim()) errors.fullName = "Nome é obrigatório";
  if (!values.organizationName.trim()) errors.organizationName = "Nome da organização é obrigatório";

  const normalizedEmail = values.email.trim();
  if (!normalizedEmail) {
    errors.email = "Email é obrigatório";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = "Email inválido";
  }

  if (!normalizePhoneToE164(values.whatsappPhone)) {
    errors.whatsappPhone = "Informe um WhatsApp válido";
  }

  if (!values.inviteLink.trim()) {
    errors.inviteLink = "Link do grupo é obrigatório";
  } else if (!/chat\.whatsapp\.com/i.test(values.inviteLink)) {
    errors.inviteLink = "Use um link de convite válido do WhatsApp";
  }

  const passwordError = validateAppPassword(values.password);
  if (passwordError) errors.password = passwordError;

  if (!values.confirmPassword.trim()) {
    errors.confirmPassword = "Confirme sua senha";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "As senhas não coincidem";
  }

  return errors;
}

export function getPasswordHint() {
  return APP_PASSWORD_HINT;
}

export async function getFriendlyOnboardingErrorMessage(error: unknown) {
  const functionMessage = await readFunctionErrorMessage(error);
  if (functionMessage) return functionMessage;

  if (error instanceof Error && error.message) return error.message;
  return "Erro inesperado";
}

export async function completePendingOnboardingDraft(expectedUserId?: string) {
  const draft = readPendingOnboardingDraft();
  if (!draft) return null;

  if (expectedUserId && draft.userId !== expectedUserId) {
    return null;
  }

  const provision = await invokeProvisionOnboarding(draft);
  clearPendingOnboardingDraft();
  return provision;
}

export async function invokeProvisionOnboarding(draft: PendingOnboardingDraft) {
  const provision = await supabase.functions.invoke<{
    success: boolean;
    code?: string;
    message?: string;
    group_id?: string | null;
  }>("provision-onboarding", {
    body: {
      lead: {
        name: draft.fullName,
        email: draft.email,
        whatsapp_phone: normalizePhoneToE164(draft.whatsappPhone),
        user_id: draft.userId,
      },
      organization: {
        name: draft.organizationName,
      },
      group: {
        provider: draft.validatedGroup.provider ?? "whatsapp",
        provider_phone: draft.validatedGroup.provider_phone ?? draft.validatedGroup.whatsapp_provider_id,
        whatsapp_provider_id: draft.validatedGroup.whatsapp_provider_id ?? draft.validatedGroup.provider_phone,
        name: draft.validatedGroup.group_name ?? draft.organizationName,
        invite_link: draft.inviteLink,
      },
      participants: draft.validatedGroup.participants ?? [],
    },
  });

  if (provision.error) {
    const message = await getFriendlyOnboardingErrorMessage(provision.error);
    throw new Error(message);
  }
  if (!provision.data?.success || !provision.data.group_id) {
    throw new Error(provision.data?.message || "Não conseguimos finalizar a criação da sua organização.");
  }

  return provision.data;
}
