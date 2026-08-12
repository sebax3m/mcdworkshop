import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export type McdTechSettings = {
  ai_enabled: boolean;
  external_ai_enabled: boolean;
  allow_technician_access: boolean;
  allow_customer_reports: boolean;
  allow_library_proposals: boolean;
};

export const DEFAULT_SETTINGS: McdTechSettings = {
  ai_enabled: true,
  external_ai_enabled: true,
  allow_technician_access: true,
  allow_customer_reports: true,
  allow_library_proposals: true,
};

export async function fetchMcdTechSettings(): Promise<McdTechSettings> {
  const { data } = await supabase
    .from("mcd_tech_settings")
    .select("ai_enabled, external_ai_enabled, allow_technician_access, allow_customer_reports, allow_library_proposals")
    .maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
}

export function useMcdTechSettings() {
  return useQuery({
    queryKey: ["mcd-tech-settings"],
    queryFn: fetchMcdTechSettings,
    staleTime: 60_000,
  });
}

/** Resolved permissions for the signed-in user. */
export function useMcdTechAccess() {
  const { isAdmin, isTechnician } = useCurrentUser();
  const { data: settings = DEFAULT_SETTINGS, isLoading } = useMcdTechSettings();
  const staff = isAdmin || isTechnician;
  const canUse = settings.ai_enabled && staff && (isAdmin || settings.allow_technician_access);
  return {
    settings,
    loading: isLoading,
    isAdmin,
    canUse,
    canUseExternalAi: canUse && settings.external_ai_enabled,
    canGenerateCustomerText: canUse && settings.allow_customer_reports,
    canProposeToLibrary: canUse && settings.allow_library_proposals,
  };
}
