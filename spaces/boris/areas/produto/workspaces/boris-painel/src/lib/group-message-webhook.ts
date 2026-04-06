import { supabase } from "@/integrations/supabase/client";

export type SendGroupMessagePayload = {
  groupId: string;
  groupName: string;
  message: string;
};

export async function sendGroupMessageWebhook(payload: SendGroupMessagePayload) {
  const message = payload.message.trim();
  const groupName = payload.groupName.trim();
  const groupId = payload.groupId.trim();

  if (!groupId) {
    throw new Error("Grupo inválido para envio.");
  }

  if (!groupName) {
    throw new Error("Nome do grupo ausente para envio.");
  }

  if (!message) {
    throw new Error("Digite a mensagem antes de enviar.");
  }

  const { data, error } = await supabase.functions.invoke("send-group-message", {
    body: {
      groupId,
      groupName,
      name: groupName,
      message,
    },
  });

  if (error) {
    throw new Error(error.message || "Não foi possível enviar a mensagem.");
  }

  if (data?.messageSent === true) return;

  const messageFromResponse =
    typeof data?.message === "string" && data.message.trim()
      ? data.message.trim()
      : "";

  throw new Error(messageFromResponse || "Não foi possível enviar a mensagem.");
}
