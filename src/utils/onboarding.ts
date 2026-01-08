export function getProvisioningErrorMessage(code?: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "GROUP_ALREADY_PROVISIONED":
      return "Esse grupo já foi cadastrado. Faça login para continuar.";
    case "WEBHOOK_NOT_CONFIGURED":
      return "Configuração do assistente incompleta. Tente novamente em instantes.";
    case "WEBHOOK_AUTH_FAILED":
      return "Não foi possível autenticar no serviço do assistente. Tente novamente em instantes.";
    case "WEBHOOK_RESPONSE_INVALID":
      return "O serviço do assistente respondeu de forma inesperada. Tente novamente.";
    case "WEBHOOK_UPSTREAM_FAILED":
      return "Não foi possível criar o assistente agora. Tente novamente.";
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
