import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type JsonRecord = Record<string, unknown>;
type DismissedMap = Record<string, string>;

type OnboardingState = {
  org_activation_dismissed?: DismissedMap;
  group_welcome_dismissed?: DismissedMap;
};

const PROFILE_ONBOARDING_QUERY_KEY = "profile-onboarding";

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeDismissedMap(value: unknown): DismissedMap {
  if (!isJsonRecord(value)) return {};

  const entries = Object.entries(value).filter(([, dismissedAt]) => typeof dismissedAt === "string");
  return Object.fromEntries(entries);
}

function normalizeOnboardingState(metadata: unknown): OnboardingState {
  if (!isJsonRecord(metadata)) return {};

  const raw = isJsonRecord(metadata.boris_onboarding) ? metadata.boris_onboarding : {};
  return {
    org_activation_dismissed: normalizeDismissedMap(raw.org_activation_dismissed),
    group_welcome_dismissed: normalizeDismissedMap(raw.group_welcome_dismissed),
  };
}

export function useUserOnboarding(userId?: string) {
  const queryClient = useQueryClient();

  const onboardingQuery = useQuery({
    queryKey: [PROFILE_ONBOARDING_QUERY_KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, metadata")
        .eq("id", userId!)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return normalizeOnboardingState(data?.metadata);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (
      updater: (current: OnboardingState) => OnboardingState,
    ) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, metadata")
        .eq("id", userId!)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      const currentMetadata = isJsonRecord(data?.metadata) ? data.metadata : {};
      const currentOnboarding = normalizeOnboardingState(currentMetadata);
      const nextOnboarding = updater(currentOnboarding);
      const nextMetadata = {
        ...currentMetadata,
        boris_onboarding: nextOnboarding,
      };

      if (data?.id) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ metadata: nextMetadata })
          .eq("id", userId!);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({ id: userId!, metadata: nextMetadata });

        if (insertError) throw insertError;
      }

      return nextOnboarding;
    },
    onSuccess: (nextOnboarding) => {
      queryClient.setQueryData([PROFILE_ONBOARDING_QUERY_KEY, userId], nextOnboarding);
    },
  });

  const state = onboardingQuery.data ?? {};

  return useMemo(
    () => ({
      onboarding: state,
      isLoading: onboardingQuery.isLoading,
      isSaving: saveMutation.isPending,
      isOrgActivationDismissed: (orgId?: string | null) =>
        Boolean(orgId && state.org_activation_dismissed?.[orgId]),
      isGroupWelcomeDismissed: (groupId?: string | null) =>
        Boolean(groupId && state.group_welcome_dismissed?.[groupId]),
      dismissOrgActivation: async (orgId: string) => {
        await saveMutation.mutateAsync((current) => ({
          ...current,
          org_activation_dismissed: {
            ...(current.org_activation_dismissed ?? {}),
            [orgId]: new Date().toISOString(),
          },
        }));
      },
      reopenOrgActivation: async (orgId: string) => {
        await saveMutation.mutateAsync((current) => {
          const nextMap = { ...(current.org_activation_dismissed ?? {}) };
          delete nextMap[orgId];
          return {
            ...current,
            org_activation_dismissed: nextMap,
          };
        });
      },
      dismissGroupWelcome: async (groupId: string) => {
        await saveMutation.mutateAsync((current) => ({
          ...current,
          group_welcome_dismissed: {
            ...(current.group_welcome_dismissed ?? {}),
            [groupId]: new Date().toISOString(),
          },
        }));
      },
    }),
    [onboardingQuery.isLoading, saveMutation, state],
  );
}
