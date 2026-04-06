import { notify } from "@/components/ui/sonner";

export const notifyValidation = {
  custom(title: string, description: string) {
    notify.warning(title, description);
  },
  fieldRequired(description: string) {
    notify.warning("Campo obrigatório", description);
  },
  fieldsRequired(description: string) {
    notify.warning("Campos obrigatórios", description);
  },
  invalidEmail(description = "Informe um email válido.") {
    notify.warning("Email inválido", description);
  },
  invalidPassword(description: string) {
    notify.warning("Senha inválida", description);
  },
  invalidConfirmation(description: string) {
    notify.warning("Confirmação inválida", description);
  },
};
