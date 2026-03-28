import type { PublicOnboardingFormValues } from "@/lib/public-onboarding";

const PENDING_ONBOARDING_STORAGE_KEY = "boris-onboarding:pending-v1";

export type PendingOnboardingValidation = {
  provider?: string;
  provider_phone?: string;
  whatsapp_provider_id?: string;
  group_name?: string;
  participants?: Array<{
    phone: string;
    name: string;
    is_admin: boolean;
    is_super_admin?: boolean;
    lid?: string;
    whatsapp_provider_id?: string;
  }>;
};

export type PendingOnboardingDraft = {
  fullName: string;
  organizationName: string;
  email: string;
  whatsappPhone: string;
  inviteLink: string;
  userId: string;
  validatedGroup: PendingOnboardingValidation;
};

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function savePendingOnboardingDraft(args: {
  values: PublicOnboardingFormValues;
  userId: string;
  validatedGroup: PendingOnboardingValidation;
}) {
  if (!hasWindow()) return;

  const draft: PendingOnboardingDraft = {
    fullName: args.values.fullName.trim(),
    organizationName: args.values.organizationName.trim(),
    email: args.values.email.trim(),
    whatsappPhone: args.values.whatsappPhone.trim(),
    inviteLink: args.values.inviteLink.trim(),
    userId: args.userId,
    validatedGroup: args.validatedGroup,
  };

  window.localStorage.setItem(PENDING_ONBOARDING_STORAGE_KEY, JSON.stringify(draft));
}

export function readPendingOnboardingDraft(): PendingOnboardingDraft | null {
  if (!hasWindow()) return null;

  const raw = window.localStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingOnboardingDraft;
    if (!parsed?.email || !parsed?.userId || !parsed?.inviteLink) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingOnboardingDraft() {
  if (!hasWindow()) return;
  window.localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);
}
