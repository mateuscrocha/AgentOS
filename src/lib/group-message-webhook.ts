const SEND_GROUP_MESSAGE_WEBHOOK_URL = (import.meta.env.VITE_N8N_SEND_GROUP_MESSAGE_URL ?? "").trim();

export type SendGroupMessagePayload = {
  groupId: string;
  groupName: string;
  message: string;
};

export async function sendGroupMessageWebhook(payload: SendGroupMessagePayload) {
  const message = payload.message.trim();
  const groupName = payload.groupName.trim();
  const groupId = payload.groupId.trim();

  if (!SEND_GROUP_MESSAGE_WEBHOOK_URL) {
    throw new Error("VITE_N8N_SEND_GROUP_MESSAGE_URL não configurada.");
  }

  if (!groupId) {
    throw new Error("Grupo inválido para envio.");
  }

  if (!groupName) {
    throw new Error("Nome do grupo ausente para envio.");
  }

  if (!message) {
    throw new Error("Digite a mensagem antes de enviar.");
  }

  const response = await fetch(SEND_GROUP_MESSAGE_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      groupId,
      groupName,
      name: groupName,
      message,
    }),
  });

  const responseText = await response.text().catch(() => "");
  let responseJson: any = null;

  try {
    responseJson = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseJson = null;
  }

  if (response.ok && responseJson?.messageSent === true) return;

  const webhookMessage =
    typeof responseJson?.message === "string" && responseJson.message.trim()
      ? responseJson.message.trim()
      : "";

  throw new Error(
    webhookMessage ||
      responseText.trim() ||
      `Webhook retornou HTTP ${response.status} sem {"messageSent": true}.`,
  );
}
