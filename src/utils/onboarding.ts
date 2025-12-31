export function getProvisioningErrorMessage(code?: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "GROUP_ALREADY_PROVISIONED":
      return "Esse grupo já foi cadastrado. Faça login para continuar.";
    default:
      return null;
  }
}

export type GroupValidationLite = {
  is_valid: boolean;
  is_boris_in_group: boolean;
  data_incomplete?: boolean;
};

export function isGroupValidationSuccessful(v?: GroupValidationLite | null): boolean {
  return !!v && v.is_valid === true && v.is_boris_in_group === true && v.data_incomplete !== true;
}
