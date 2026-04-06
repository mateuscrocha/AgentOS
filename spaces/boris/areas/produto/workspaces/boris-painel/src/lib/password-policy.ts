export const APP_PASSWORD_MIN_LENGTH = 10;
export const APP_PASSWORD_MAX_LENGTH = 72;
export const APP_PASSWORD_HINT =
  "Mínimo de 10 caracteres, com letra maiúscula, minúscula, número e símbolo.";

export function validateAppPassword(password: string): string | null {
  const value = (password ?? "").trim();
  if (!value) return "Senha é obrigatória";
  if (value.length < APP_PASSWORD_MIN_LENGTH) {
    return `Senha deve ter no mínimo ${APP_PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (value.length > APP_PASSWORD_MAX_LENGTH) {
    return `Senha deve ter no máximo ${APP_PASSWORD_MAX_LENGTH} caracteres`;
  }
  if (!/[A-Z]/.test(value)) return "Senha deve incluir ao menos 1 letra maiúscula";
  if (!/[a-z]/.test(value)) return "Senha deve incluir ao menos 1 letra minúscula";
  if (!/\d/.test(value)) return "Senha deve incluir ao menos 1 número";
  if (!/[^A-Za-z0-9]/.test(value)) return "Senha deve incluir ao menos 1 símbolo";
  return null;
}

export function isValidAppPassword(password: string) {
  return validateAppPassword(password) === null;
}
