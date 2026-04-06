# Manual de Operacao Editorial do Bóris

## Objetivo

Este documento transforma a linha editorial do Bóris em um sistema de execucao.
Ele define como pedidos de conteudo devem ser interpretados, quais skills entram em cada caso e qual tipo de entrega deve sair pronta daqui para frente.

## Verdades fixas do projeto

- O Bóris nao e "conteudo sobre IA". Ele e conteudo sobre leitura, contexto e operacao em grupos de WhatsApp.
- O produto resolve uma dor concreta: grupo sem leitura vira barulho, achismo e atraso de decisao.
- O conteudo deve soar como visao de fundador construindo um produto real.
- O Bóris entra como consequencia natural da dor, nunca como pitch forçado.
- Clareza vence hype.
- Observacao real vence frase bonita.

## Fonte oficial de dores

A fonte oficial para gerar conteudo editorial passa a ser a lista `PRINCIPAIS DORES DO MERCADO` em [agente-boris-conteudo.md](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/agente-boris-conteudo.md).
O mapa expandido e reutilizavel de dores do ecossistema Bóris agora vive em [boris-pain-library.md](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/editorial/editorial/strategy/boris-pain-library.md).

Hoje, essa base tem 10 dores:

- ninguem sabe de verdade o que acontece dentro dos grupos
- informacao importante se perde no volume
- grupos parecem ativos, mas ninguem sabe se estao saudaveis
- decisoes sao tomadas com base em sensacao
- lideres e gestores nao conseguem acompanhar tudo
- sinais importantes passam batido
- comunidade sem leitura vira barulho
- grupo sem contexto vira sobrecarga
- o WhatsApp vira operacao critica sem ferramenta de leitura
- quem lidera grupo acaba refem de impressao pessoal

Regras:

- todo conteudo deve nascer de pelo menos 1 dessas dores
- no maximo 2 dores por conteudo, para nao perder foco
- a tese sempre deve ser una, mesmo quando combinar 2 dores
- novas dores so entram na rotina editorial depois de serem adicionadas a essa base oficial
- para contextos de produto, vendas, UX, CS, operacao, dashboard e onboarding, agentes podem apoiar a tese na biblioteca expandida, desde que preservem uma dor principal clara

## Linhas editoriais

### 1. Problema
- Serve para nomear dores mal articuladas.
- Tom: diagnostico, contraste, provocacao util.
- Melhor uso: quando queremos educar mercado e criar identificacao.

### 2. Demonstracao
- Serve para provar utilidade com mobile, desktop ou fluxo real.
- Tom: direto, visual, concreto.
- Melhor uso: quando queremos mostrar como o Bóris transforma conversa em leitura.

### 3. Bastidores
- Serve para mostrar aprendizagem, criterio e construcao de produto.
- Tom: reflexivo, vivido, sem pose.
- Melhor uso: quando queremos construir autoridade e repertorio.

## Formatos oficiais

### Video curto vertical
- Plataforma: Shorts, Reels, TikTok
- Proporcao: 9:16
- Duracao ideal: 20 a 35 segundos
- Funcao: impacto rapido, dor clara, prova visual simples
- Preferencia visual: mobile, takes do Bóris, texto grande, pouca poluicao

### Video longo YouTube
- Duracao ideal: 3 a 8 minutos
- Funcao: aprofundar tese, interpretar o problema e mostrar painel desktop
- Preferencia visual: leitura estrategica, explicacao com contexto, demonstracao guiada

### LinkedIn
- Funcao: transformar a mesma tese em observacao forte
- Tom: fundador, produto, mercado, comportamento
- Evitar: tom de guru, post motivacional, venda disfarçada

### Locucao / TTS
- Funcao: narracao de shorts, demos, cortes e testes de roteiro
- Regra: manter texto falavel, ritmo natural e instrucoes simples de voz

### Imagem / asset visual
- Funcao: takes do Bóris, thumb, story, frame, apoio de campanha
- Regra: consistencia visual absoluta do personagem
- Regra adicional para `cabeca quente`: o fechamento deve prever uma imagem final de CTA, preferencialmente com o Bóris apresentando o site ou o proximo passo com area limpa para texto na edicao

## Router de skills

### Skill orquestradora deste workspace
- `boris-content-orchestrator`
- Uso: receber o pedido, classificar em `post`, `campanha` ou `material`, criar a pasta-fonte certa e acionar apenas os skills especialistas necessarios.
- Regra fixa: este skill nao substitui os outros; ele coordena a execucao e organiza os arquivos.

### Skill principal de contexto
- `boris-product-context`
- Uso: alinhar qualquer saida ao produto, ao publico e ao problema real do Bóris.
- Deve entrar sempre que o pedido for sobre conteudo, tela, campanha, mensagem ou narrativa do ecossistema Bóris.

### Skill principal de voz e consistencia de marca
- `ckm:brand`
- Uso: manter tom, identidade e coerencia de linguagem.
- Deve entrar quando o pedido exigir copy, naming, tagline, variacoes de mensagem ou padrao de voz.

### Skill principal para imagem do personagem
- `boris-image-agent`
- Uso: qualquer imagem do Bóris com consistencia canonica.
- Regra fixa: usar sempre a referencia oficial do corpo.

### Skill de aceleracao para imagem recorrente
- `boris-image-kit`
- Uso: thumbnails, stories, templates reutilizaveis e fluxo mais rapido para assets padronizados.
- Deve ser usada junto com `boris-image-agent`, nunca sozinha.

### Skill de execucao de imagem
- `imagegen`
- Uso: gerar ou editar imagens finais via CLI.
- Funcao: transformar prompt estruturado em asset final.

### Skill de audio
- `speech`
- Uso: locucao, voice-over, narracao curta e batch de audios.
- Regra: nao reescrever o texto-base sem necessidade; ajustar apenas direcao de voz e ritmo.

### Skills auxiliares sob demanda
- `transcribe`: quando houver audio ou video para virar texto, legenda, cortes ou reaproveitamento editorial.
- `slides`: quando o conteudo virar apresentacao.
- `doc`: quando o conteudo virar documento entregavel.

## Mapa de decisao por pedido

### Se o usuario pedir uma ideia de conteudo
Usar:
- `boris-product-context`
- `ckm:brand`

Entregar:
- tese central
- linha editorial
- formato pedido ou desdobramento multiplataforma
- texto pronto para uso

### Se o usuario pedir o conteudo do dia
Usar:
- `boris-product-context`
- `ckm:brand`

Entregar:
- exatamente no formato definido em [agente-boris-conteudo.md](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/agente-boris-conteudo.md)

### Se o usuario pedir campanha
Usar:
- `boris-product-context`
- `ckm:brand`

Entregar:
- campanha de 7 ou 14 dias
- distribuicao equilibrada entre Problema, Demonstracao e Bastidores
- progressao narrativa clara

### Se o usuario pedir roteiro com locucao
Usar:
- `boris-product-context`
- `ckm:brand`
- `speech` se tambem quiser audio final

Entregar:
- roteiro falavel
- versao de locucao
- marcacao de ritmo se fizer sentido
- audio final se solicitado

### Se o usuario pedir imagem do Bóris
Usar:
- `boris-image-agent`
- `imagegen`
- `boris-image-kit` quando for asset recorrente ou formato padrao

Entregar:
- prompt final
- arquivo gerado
- checklist de consistencia visual

### Se o usuario pedir pacote de producao
Usar:
- `boris-product-context`
- `ckm:brand`
- `boris-image-agent` se houver asset do personagem
- `speech` se houver locucao

Entregar:
- roteiro
- prompts de imagem
- prompt e arquivo da imagem final de CTA quando houver encerramento visual
- locucao
- checklist de assets
- guia de montagem se necessario

## Padrao de entrega

Toda entrega deve buscar este nivel:

- pronta para usar
- sem texto generico
- com tese clara
- com gancho forte
- com demonstracao coerente com o produto
- com linguagem simples e gravavel
- com baixo retrabalho

## Regras de qualidade

- Nao usar hype sobre IA como ideia central.
- Nao tratar automacao como valor por si so.
- Nao confundir atividade com entendimento.
- Nao repetir a mesma tese, hook ou moral de forma disfarçada.
- Nao parecer anuncio.
- Nao escrever como social media de agencia.
- Nao inventar dores que nao parecem vividas.

## Preferencias de linguagem

- Frases curtas.
- Verbos concretos.
- Contrastes claros.
- Menos abstracao, mais observacao.
- Tom de quem viu isso acontecer.
- Sempre perguntar implicitamente: "isso daria vontade de gravar agora?"

## Estrutura operacional que vou seguir daqui para frente

### Para texto
1. Identificar formato e objetivo.
2. Escolher a linha editorial certa.
3. Fixar uma tese unica.
4. Construir hook, desenvolvimento, demonstracao e fechamento.
5. Revisar repeticao, clareza e gravabilidade.

### Para imagem
1. Confirmar se o Bóris aparece ou nao.
2. Se aparecer, aplicar `boris-image-agent`.
3. Estruturar prompt com cena, enquadramento, estilo e restricoes.
4. Gerar via `imagegen`.
5. Validar consistencia do personagem e utilidade do asset.
6. Se o formato for `cabeca quente`, prever tambem a imagem final de CTA como asset proprio do fechamento.

### Para audio
1. Fechar texto final.
2. Definir voz, tom, pacing e enfases.
3. Gerar via `speech`.
4. Validar inteligibilidade e ritmo.

## Arquivos-base deste workspace

- [agente-boris-conteudo.md](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/agente-boris-conteudo.md): regra mestra de estrategia e formato de saida.
- [skills/boris-content-orchestrator/SKILL.md](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/skills/boris-content-orchestrator/SKILL.md): skill local que organiza pedidos por pasta e roteia a execucao para outros skills.
- [producao/README.md](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/producao/README.md): convencao oficial de organizacao dos packs.
- [producao/2026-03-20-grupo-ativo-engana/README.md](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/producao/2026-03-20-grupo-ativo-engana/README.md): exemplo de pack fechado.

## Estrutura fisica de producao

Daqui para frente, os pedidos devem ser organizados assim:

- `producao/posts`: uma pasta por post, cena ou pack unitario
- `producao/campanhas`: uma pasta por campanha, com desdobramento por dia quando necessario
- `producao/materiais`: uma pasta por material de apoio
- `producao/_templates`: modelos-base para iniciar qualquer uma dessas estruturas

Regra:

- cada item deve ter uma unica pasta-fonte
- todos os arquivos do mesmo item ficam juntos
- se um pedido evoluir, atualizar a mesma pasta em vez de espalhar versoes em varios lugares

## Comando mental padrao

Quando chegar um pedido novo, assumir esta ordem:

1. Qual e a tese?
2. Qual linha editorial faz mais sentido?
3. Qual formato resolve melhor?
4. Quais skills entram?
5. O que precisa sair pronto para uso hoje?

## Resultado esperado

Daqui para frente, qualquer pedido seu deve ser interpretado como uma ordem de producao, nao como brainstorm vazio.
Meu papel passa a ser:

- entender o angulo certo
- acionar as skills certas
- executar o formato certo
- te devolver material bonito, coerente e pronto para uso
