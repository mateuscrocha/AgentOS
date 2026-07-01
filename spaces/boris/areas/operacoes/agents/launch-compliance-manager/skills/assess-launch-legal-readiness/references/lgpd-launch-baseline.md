# Baseline de Lançamento Jurídico do Bóris

## Objetivo

Este material serve como referência curta para o agente transformar LGPD, transparência e governança em um plano de lançamento prático.

Ele não substitui advogado. Ele organiza o mínimo sério para o Bóris não entrar no ar no escuro.

## Fontes oficiais a usar

- Lei nº 13.709/2018 (LGPD), via publicação da ANPD:
  - `https://www.gov.br/anpd/pt-br/centrais-de-conteudo/outros-documentos-e-publicacoes-institucionais/lgpd-en-lei-no-13-709-capa.pdf`
- ANPD — Titular de Dados:
  - `https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1`
- ANPD — Comunicação de Incidente de Segurança:
  - `https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis`
- ANPD — Sanções Administrativas:
  - `https://www.gov.br/anpd/pt-br/acesso-a-informacao/sancoes-administrativas`
- ANPD — Aviso de Privacidade:
  - `https://www.gov.br/anpd/pt-br/acesso-a-informacao/aviso-de-privacidade`

## Pontos legais que precisam aparecer no raciocínio

### 1. Escopo da LGPD

A LGPD se aplica ao tratamento de dados pessoais por pessoa natural ou jurídica, inclusive em ambiente digital, quando o tratamento ocorre no Brasil, quando os dados são coletados no Brasil ou quando o serviço é ofertado a pessoas localizadas no Brasil.

Para o Bóris, isso tende a ser a regra, não a exceção.

### 2. Princípios que precisam virar decisão prática

Os princípios que mais afetam lançamento são:

- finalidade
- adequação
- necessidade
- transparência
- segurança
- prevenção
- responsabilização e prestação de contas

Tradução prática:

- coletar menos
- explicar melhor
- guardar com mais cuidado
- provar que houve critério

### 3. Base legal não é detalhe

Cada tratamento precisa ter fundamento compatível.

Para o contexto inicial do Bóris, as hipóteses mais prováveis costumam ser:

- execução de contrato ou procedimentos preliminares a pedido do titular
- cumprimento de obrigação legal
- legítimo interesse, quando couber e com cautela
- consentimento, quando realmente necessário

Regra operacional:

- não usar consentimento como muleta para tudo
- quando o tratamento é necessário para entregar o serviço principal, testar primeiro contrato, obrigação legal ou legítimo interesse compatível

### 4. Direitos do titular exigem operação, não só texto

O titular precisa ter um caminho real para pedir, conforme o caso:

- confirmação de tratamento
- acesso
- correção
- eliminação
- informação sobre compartilhamento
- revogação de consentimento
- oposição

Para o Bóris, isso pede no mínimo:

- canal visível de contato
- responsável interno
- prazo e rotina de triagem
- registro do pedido e da resposta

### 5. Política de privacidade

Antes do go-live, a política deve refletir a operação real e cobrir pelo menos:

- quem trata os dados
- quais dados são coletados
- para quais finalidades
- com quem podem ser compartilhados
- base operacional ou contexto do tratamento
- retenção e critérios de eliminação
- direitos do titular e canal de contato
- uso de cookies e tecnologias similares, se houver
- transferências internacionais relevantes, se houver
- data de vigência e atualização

### 6. Termos de uso

Os termos de uso devem cobrir o lado contratual e de risco do produto, incluindo conforme o caso:

- objeto do serviço
- conta e acesso
- regras de uso aceitável
- responsabilidades do usuário
- limites de responsabilidade
- propriedade intelectual
- suspensão ou encerramento
- foro e lei aplicável, com revisão jurídica

Se o Bóris processar dados de clientes empresariais dentro do produto, pode haver camada adicional contratual B2B fora dos termos públicos.

### 7. Cookies, analytics e rastreamento

Se houver apenas cookie estritamente necessário, a exigência operacional é diferente de um cenário com analytics, remarketing, gravação de sessão ou personalização comportamental.

Tratar com atenção:

- analytics de terceiros
- pixels de mídia
- ferramentas de heatmap ou gravação
- embeds externos

Nesses casos, avaliar:

- banner ou central de preferências
- transparência na política
- bloqueio por categoria quando aplicável

### 8. Segurança e incidente

O Bóris precisa entrar no ar com medidas técnicas e administrativas mínimas.

Checklist mínimo:

- controle de acesso por necessidade
- MFA nas contas críticas
- política básica de credenciais
- revisão de quem acessa produção
- backup e restauração minimamente pensados
- inventário de terceiros críticos
- fluxo de incidente com dono, contenção e comunicação

Ponto oficial relevante:

- a página da ANPD sobre incidente foi modificada em 02/06/2026 e reforça que a comunicação à ANPD não substitui a comunicação aos titulares quando houver risco ou dano relevante

### 9. Sanções existem e contam com governança como fator atenuante

A LGPD prevê advertência, multa, bloqueio, eliminação de dados e até suspensão de atividades de tratamento.

Na prática, para lançamento, importa especialmente:

- reduzir chance de infração
- demonstrar boa-fé
- ter medidas internas documentadas
- agir rápido em correções

### 10. Terceiros e operadores

Mapear quem trata dados em nome do Bóris:

- hospedagem
- autenticação
- analytics
- CRM
- e-mail
- suporte
- pagamentos
- automações
- mensageria

Para cada terceiro, verificar pelo menos:

- que dado recebe
- para quê
- onde processa
- que obrigação contratual ou política cobre esse tratamento

## Checklist mínimo para o Bóris entrar no ar

### Bloqueadores prováveis

- ausência de política de privacidade compatível com a operação real
- inexistência de canal para titular
- inexistência de clareza sobre quais dados são coletados e por quê
- uso de terceiros críticos sem mapeamento mínimo
- inexistência de fluxo de incidente
- retenção indefinida sem critério para dados claramente descartáveis

### Antes do go-live

- mapear fluxos de dados e terceiros
- publicar política de privacidade
- publicar termos de uso
- decidir tratamento de cookies e analytics
- definir e-mail ou canal do titular
- definir responsável interno
- criar rotina curta de incidente
- revisar acessos internos e credenciais críticas

### D+30

- organizar registro interno de operações de tratamento
- formalizar matriz de retenção e descarte
- revisar contratos prioritários com operadores
- testar atendimento a pedido de acesso, correção e exclusão

### D+60 ou contínuo

- aprofundar governança
- revisar DPIA quando houver tratamento de maior risco
- endurecer controles técnicos
- revisar textos jurídicos com advogado especializado

## Regra final de priorização

Se o Bóris tiver que escolher entre documento bonito e operação real, priorizar:

1. saber quais dados coleta
2. saber por que coleta
3. dar canal ao titular
4. ter resposta a incidente
5. só depois sofisticar redação e acabamento jurídico
