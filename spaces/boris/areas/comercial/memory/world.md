# Area World: comercial

- Área criada em 2026-04-02
- Agente inicial criado: `sales-operator`
- Foco inicial: oferta, ICP e processo comercial
- Estrutura comercial reorganizada em 2026-04-06 para separar metodologia, leads e contas do Boris

## Estado Atual

- O agente `sales-operator` segue como executor central da operação comercial
- O agente `enap-opportunity-manager` passa a ser o copiloto dedicado da frente ENAP dentro da área comercial
- A metodologia herdada da Enkrateia passa a ser mantida em guidelines e documentos operacionais do Boris
- A biblioteca comercial do space passa a concentrar processos, leads, contas e templates de migração
- O AgentOS passa a ser a casa principal da operacao comercial do Boris; os workspaces antigos ficam como legado consultavel
- O legado principal foi importado para `spaces/boris/resources/comercial/`
- A base legado consolidada registra `1994` leads, com `508` P1 e `15` follow-ups pendentes no recorte herdado
- O CRM atual do painel registra `81` contas, sendo `43` contas comerciais ativas fora de `customer/lost`
- A primeira fila oficial de execucao foi consolidada em `spaces/boris/resources/comercial/leads/fila-execucao-comercial-2026-04-06.md`
- Leitura operacional atual do CRM:
- `8` em `new_lead`
- `35` em `meeting/proposal/approval_pending`
- `32` em `customer`
- `6` em `lost`
- Existem `7` acoes vencidas no CRM e um proxy atual de `6` contas com follow-up pendente por texto de `next_step`
- Regra operacional ativa: manter CRM atual, contexto da Enkrateia e consolidacao no AgentOS sempre sincronizados
- Regra operacional ativa: para outreach e follow-up em WhatsApp, preferir a skill `evolution-whatsapp-sender`
- Regra operacional ativa: a campanha sobre a base legado e as entradas novas por WhatsApp/indicacao/site andam em paralelo e precisam ser lidas como trilhos diferentes
- Referencia operacional oficial do fundador para contato comercial: `eu@rochamateus.com.br`
- Nova frente institucional em exploracao: `ENAP / governo federal / programas de subvenção`, organizada em `spaces/boris/resources/comercial/contas/enap-governo-federal/`
- Essa frente passa a usar um dossie documental proprio para editais, transcricoes, analises e proximos passos
- Nova oportunidade em exploracao no nicho de cerimonial e casamentos, ancorada provisoriamente em `André + Thai`, com potencial de uso imediato do Bóris para geração de tarefas a partir de conversas e potencial futuro de vertical de produto
- A prospecção ativa via WhatsApp do `Mateus Rocha` agora tem projeto operacional próprio em `spaces/boris/resources/comercial/prospeccao-mateus-rocha/`
- Essa mesma frente ganhou um painel simples em `spaces/boris/areas/produto/workspaces/boris-projetos/prospeccao-mateus/` para leitura rápida de fila segura, lote atual e progresso dos disparos

## Última Alteração

- Data: 2026-05-14
- O que mudou: criado o agente `enap-opportunity-manager` para concentrar leitura estratégica, próximos passos e organização recorrente da frente ENAP a partir do dossiê já existente da conta
- Agente responsável: kernel
- Data: 2026-04-28
- O que mudou: criado projeto operacional próprio da prospecção ativa do `Mateus Rocha` e painel simples conectado à workspace `boris-projetos` para acompanhar fila segura, lote atual e andamento dos disparos
- Agente responsável: kernel
- Data: 2026-04-08
- O que mudou: consolidada nova oportunidade comercial provisoria `André + Thai` na biblioteca do Boris, com registro de reuniao, leitura de dor operacional em cerimonial/casamentos e status atual de aguardando materiais para validar fase 1 com o Bóris
- Agente responsável: kernel
