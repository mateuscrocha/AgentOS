import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, getProjectRoot } from "./shared.mjs";

export const NICHE_TEMPLATES = {
  clinica: {
    audience: "clinicas, especialistas e profissionais da saude",
    outcome: "mais agendas qualificadas",
    items: [
      {
        slug: "clinica-gancho",
        text: "Muita clinica boa nao cresce como poderia porque a comunicacao nao transmite confianca, clareza e diferenca."
      },
      {
        slug: "clinica-dor",
        text: "Quando o paciente nao entende rapido o valor de {offer}, ele compara preco antes de perceber qualidade."
      },
      {
        slug: "clinica-solucao",
        text: "Com a mensagem certa, sua clinica atrai pessoas mais alinhadas, melhora a percepcao de valor e ganha previsibilidade."
      },
      {
        slug: "clinica-cta",
        text: "Se voce quer transformar {offer} em {outcome}, me chama e vamos ajustar isso juntos."
      }
    ]
  },
  imobiliaria: {
    audience: "imobiliarias, corretores e equipes comerciais",
    outcome: "mais atendimentos qualificados",
    items: [
      {
        slug: "imobiliaria-gancho",
        text: "No mercado imobiliario, nao basta ter imovel bom. A narrativa certa faz a oportunidade ganhar valor antes da visita."
      },
      {
        slug: "imobiliaria-dor",
        text: "Quando a comunicacao e generica, o lead some, compara tudo por preco e o time comercial perde forca."
      },
      {
        slug: "imobiliaria-solucao",
        text: "Com posicionamento, clareza e argumento comercial, {offer} pode gerar mais interesse e mais conversa boa."
      },
      {
        slug: "imobiliaria-cta",
        text: "Se voce quer mais ritmo comercial e {outcome}, fala comigo."
      }
    ]
  },
  advogado: {
    audience: "escritorios, advogados e consultores juridicos",
    outcome: "mais reunioes com clientes certos",
    items: [
      {
        slug: "advogado-gancho",
        text: "Advocacia nao se vende com barulho. Se posiciona com clareza, autoridade e confianca."
      },
      {
        slug: "advogado-dor",
        text: "Muitos escritorios competentes nao conseguem converter interesse em reuniao porque a mensagem nao traduz seguranca."
      },
      {
        slug: "advogado-solucao",
        text: "Quando {offer} e comunicado do jeito certo, o cliente percebe valor antes mesmo da primeira conversa."
      },
      {
        slug: "advogado-cta",
        text: "Se voce quer construir uma presenca comercial mais forte e gerar {outcome}, me chama."
      }
    ]
  },
  infoproduto: {
    audience: "especialistas, infoprodutores e times de lancamento",
    outcome: "mais vendas com menos friccao",
    items: [
      {
        slug: "infoproduto-gancho",
        text: "Ter conhecimento bom nao garante venda. O mercado responde melhor quando a promessa fica clara e desejavel."
      },
      {
        slug: "infoproduto-dor",
        text: "Se a copy nao sustenta a oferta, o trafego fica caro e o publico nao entende por que deveria agir."
      },
      {
        slug: "infoproduto-solucao",
        text: "Com a estrutura certa, {offer} pode ganhar mais percepcao de valor, mais resposta e mais conversao."
      },
      {
        slug: "infoproduto-cta",
        text: "Se voce quer destravar {outcome}, eu posso te ajudar a organizar essa comunicacao."
      }
    ]
  }
};

export function createNicheCampaign({ niche, campaignName, offer = "sua oferta" }) {
  const selected = NICHE_TEMPLATES[niche];
  if (!selected) {
    throw new Error(
      `Unknown niche "${niche}". Available niches: ${Object.keys(NICHE_TEMPLATES).join(", ")}`
    );
  }

  const items = selected.items.map((item) => ({
    slug: item.slug,
    text: item.text
      .replaceAll("{offer}", offer)
      .replaceAll("{audience}", selected.audience)
      .replaceAll("{outcome}", selected.outcome)
  }));

  const payload = {
    name: campaignName,
    niche,
    offer,
    audience: selected.audience,
    outcome: selected.outcome,
    items
  };

  const projectRoot = getProjectRoot();
  const campaignsDir = path.join(projectRoot, "campanhas");
  ensureDir(campaignsDir);
  const outputPath = path.join(campaignsDir, `${campaignName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  return outputPath;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const niche = process.argv[2];
  const campaignName = process.argv[3];
  const offer = process.argv[4] || "sua oferta";

  if (!niche || !campaignName) {
    console.error("Usage: npm run eleven:niche:create -- nicho nome-da-campanha [oferta]");
    process.exit(1);
  }

  const outputPath = createNicheCampaign({ niche, campaignName, offer });
  console.log(`Niche campaign saved to ${outputPath}`);
}
