import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, getProjectRoot } from "./shared.mjs";

export const PACK_TEMPLATES = {
  vsl: [
    {
      slug: "vsl-gancho",
      text: "Se voce oferece {offer} para {audience}, mas sente que a mensagem nao converte como deveria, presta atencao nisso."
    },
    {
      slug: "vsl-problema",
      text: "Na maioria das vezes, o problema nao esta na qualidade da oferta. Esta na forma como o valor chega ate a pessoa certa."
    },
    {
      slug: "vsl-oportunidade",
      text: "Quando a comunicacao fica clara, a decisao acontece com menos resistencia e com muito mais confianca."
    },
    {
      slug: "vsl-cta",
      text: "Se voce quer transformar {offer} em {outcome}, me chama e vamos estruturar isso do jeito certo."
    }
  ],
  criativos: [
    {
      slug: "criativo-dor",
      text: "Tem muita empresa boa perdendo venda porque a mensagem nao deixa obvio por que alguem deveria agir agora."
    },
    {
      slug: "criativo-erro",
      text: "O erro mais caro do marketing nao e falta de esforco. E comunicar valor de um jeito que nao gera resposta."
    },
    {
      slug: "criativo-ajuste",
      text: "Com o ajuste certo de oferta, narrativa e chamada, {offer} pode gerar muito mais retorno."
    }
  ],
  ctas: [
    {
      slug: "cta-direto",
      text: "Se fizer sentido para voce, me chama agora e eu te mostro o proximo passo."
    },
    {
      slug: "cta-diagnostico",
      text: "Se voce quer clareza para vender melhor, fala comigo e vamos diagnosticar isso juntos."
    },
    {
      slug: "cta-oportunidade",
      text: "Talvez o que falta entre sua oferta e {outcome} seja uma comunicacao mais precisa. Vamos ajustar isso."
    },
    {
      slug: "cta-whatsapp",
      text: "Me chama no WhatsApp e eu te explico, na pratica, como destravar essa oportunidade."
    }
  ]
};

export function createContentPack({
  packType,
  campaignName,
  offer = "sua oferta",
  audience = "seu publico",
  outcome = "mais resultado"
}) {
  const items = PACK_TEMPLATES[packType];
  if (!items) {
    throw new Error(
      `Unknown pack type "${packType}". Available pack types: ${Object.keys(PACK_TEMPLATES).join(", ")}`
    );
  }

  const compiledItems = items.map((item) => ({
    slug: item.slug,
    text: item.text
      .replaceAll("{offer}", offer)
      .replaceAll("{audience}", audience)
      .replaceAll("{outcome}", outcome)
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
        type: packType,
        offer,
        audience,
        outcome,
        items: compiledItems
      },
      null,
      2
    )
  );

  return outputPath;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const packType = process.argv[2];
  const campaignName = process.argv[3];
  const offer = process.argv[4] || "sua oferta";
  const audience = process.argv[5] || "seu publico";
  const outcome = process.argv[6] || "mais resultado";

  if (!packType || !campaignName) {
    console.error(
      "Usage: npm run eleven:pack:create -- tipo nome-da-campanha [oferta] [publico] [resultado]"
    );
    process.exit(1);
  }

  const outputPath = createContentPack({ packType, campaignName, offer, audience, outcome });
  console.log(`Content pack saved to ${outputPath}`);
}
