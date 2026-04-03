import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, getProjectRoot } from "./shared.mjs";

export const OBJECTIVE_TEMPLATES = {
  captacao: [
    "Se voce quer atrair mais {audience} com clareza, talvez o problema nao esteja no alcance. Pode estar na mensagem.",
    "A maioria das ofertas boas perde atencao porque nao deixa obvio o valor que entrega.",
    "Se fizer sentido, me chama e eu te ajudo a transformar {offer} em uma comunicacao que gera resposta."
  ],
  remarketing: [
    "Se voce ja viu {offer}, agora vale olhar com mais atencao para o que isso pode destravar no seu negocio.",
    "Muita gente adia decisoes importantes nao por falta de interesse, mas por falta de clareza.",
    "Se ainda estiver avaliando, eu posso te mostrar de forma simples como essa solucao se encaixa no seu momento."
  ],
  "follow-up": [
    "Passei aqui para retomar nossa conversa sobre {offer}.",
    "Quando a oportunidade e boa, o follow-up certo ajuda a decidir com mais seguranca e menos ruido.",
    "Se quiser, eu organizo os proximos passos com voce para ficar facil avancar."
  ],
  fechamento: [
    "Se voce sente que agora e a hora de tirar esse plano do papel, eu posso te ajudar a dar o proximo passo.",
    "O melhor momento para ajustar sua comunicacao e transformar intencao em venda costuma ser antes de perder mais oportunidades.",
    "Me chama e vamos fechar isso com clareza, direcao e execucao."
  ]
};

export function createObjectiveCampaign({ objective, campaignName, offer = "sua oferta", audience = "seu cliente ideal" }) {
  const lines = OBJECTIVE_TEMPLATES[objective];
  if (!lines) {
    throw new Error(
      `Unknown objective "${objective}". Available objectives: ${Object.keys(OBJECTIVE_TEMPLATES).join(", ")}`
    );
  }

  const items = lines.map((line, index) => ({
    slug: `${objective}-${index + 1}`,
    text: line.replaceAll("{offer}", offer).replaceAll("{audience}", audience)
  }));

  const projectRoot = getProjectRoot();
  const campaignsDir = path.join(projectRoot, "campanhas");
  ensureDir(campaignsDir);
  const outputPath = path.join(campaignsDir, `${campaignName}.json`);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        name: campaignName,
        objective,
        offer,
        audience,
        items
      },
      null,
      2
    )
  );

  return outputPath;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const objective = process.argv[2];
  const campaignName = process.argv[3];
  const offer = process.argv[4] || "sua oferta";
  const audience = process.argv[5] || "seu cliente ideal";

  if (!objective || !campaignName) {
    console.error(
      "Usage: npm run eleven:campaign:create -- objetivo nome-da-campanha [oferta] [publico]"
    );
    process.exit(1);
  }

  const outputPath = createObjectiveCampaign({ objective, campaignName, offer, audience });
  console.log(`Campaign template saved to ${outputPath}`);
}
