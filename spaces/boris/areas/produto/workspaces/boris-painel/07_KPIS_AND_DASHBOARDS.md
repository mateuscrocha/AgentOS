# KPIs e Dashboards do Admin do Bóris

## Contexto

Este documento define, de forma objetiva e operacional, os KPIs usados nos dashboards do Admin do Bóris para ambientes de WhatsApp + Comunidades. O foco é medir atividade e participação real, evitar métricas de vaidade e orientar interpretações consistentes.

## O que este documento define

- Quais KPIs existem e em qual nível aparecem (System, Organization, Group)
- O que cada KPI mede e como é calculado (fórmula conceitual)
- Como comparar com o período anterior e interpretar corretamente
- Observações para evitar leituras erradas e vaidade

## Regras que não podem ser quebradas

- Não criar UI e não sugerir gráficos aleatórios
- Não repetir conceitos e não questionar escopo
- Não misturar KPI com métricas técnicas, marketing, financeiras ou IA
- Usar apenas dados que fazem sentido para WhatsApp + Comunidades
- Todo KPI é baseado em: mensagens, membros e tempo
- Sempre considerar: período atual e período anterior
- Comparações devem ser percentuais quando fizer sentido
- Tendência é mais importante que número absoluto

## Premissas fixas

- Período padrão de análise: últimos 7 dias (7d)
- Período anterior: 7 dias imediatamente anteriores ao período atual
- "Mensagem" é qualquer conteúdo válido enviado no grupo (exclui registros deletados)
- "Membro ativo" é quem enviou pelo menos 1 mensagem no período
- Taxas e distribuições são calculadas em relação ao universo relevante (sistema, organização ou grupo)

## KPIs por nível

### Nível System (Admin do Sistema)

1. **Volume total de mensagens (Sistema)**
   - Nome do KPI: Volume total de mensagens (Sistema)
   - Nível (System | Organization | Group): System
   - O que ele mede: Intensidade global das conversas em todas as organizações e grupos.
   - Como é calculado (fórmula conceitual): `count(messages onde deleted_at = null, no período)`.
   - Comparação com período anterior: Variação percentual `Δ% = (atual - anterior) / max(anterior, 1) * 100`.
   - Interpretação correta: Indica ritmo geral de conversas no sistema. Crescimento consistente é positivo quando acompanhado de aumento de membros ativos.
   - Interpretações erradas comuns (anti-padrões): Tratar picos pontuais como crescimento sustentado; usar isolado como proxy de satisfação.
   - Observações importantes: Sempre ler junto com "Membros ativos globais" para separar volume de concentração.

2. **Membros ativos globais**
   - Nome do KPI: Membros ativos globais
   - Nível (System | Organization | Group): System
   - O que ele mede: Alcance da participação (quantos membros distintos engajaram no período).
   - Como é calculado (fórmula conceitual): `count(distinct member_id em messages onde deleted_at = null, no período)` em todos os grupos.
   - Comparação com período anterior: Variação percentual `Δ%`.
   - Interpretação correta: Mede a largura da participação real no sistema.
   - Interpretações erradas comuns (anti-padrões): Confundir com total de membros cadastrados; ignorar que o mesmo membro pode participar de múltiplos grupos.
   - Observações importantes: Considerar deduplicação consistente de `member_id` e tratamento de contas técnicas/bots.

3. **Taxa de engajamento global**
   - Nome do KPI: Taxa de engajamento global
   - Nível (System | Organization | Group): System
   - O que ele mede: Proporção de membros que engajaram versus o total cadastrado.
   - Como é calculado (fórmula conceitual): `(membros_ativos_globais / membros_totais_globais) * 100`.
   - Comparação com período anterior: Diferença em pontos percentuais `pp = engajamento_atual - engajamento_anterior`.
   - Interpretação correta: Indica qualidade da ativação do ecossistema; mais robusta que apenas volume de mensagens.
   - Interpretações erradas comuns (anti-padrões): Comparar como número absoluto; interpretar sem considerar variação de base (crescimento de membros totais).
   - Observações importantes: Usar `pp` (pontos percentuais) na comparação; alinhar com políticas de inclusão/exclusão de contas técnicas.

4. **Grupos ativos no período (Sistema)**
   - Nome do KPI: Grupos ativos no período (Sistema)
   - Nível (System | Organization | Group): System
   - O que ele mede: Adoção efetiva por grupos.
   - Como é calculado (fórmula conceitual): `(count(grupos com ≥ 1 mensagem no período) / count(grupos_totais)) * 100`.
   - Comparação com período anterior: Diferença em pontos percentuais.
   - Interpretação correta: Indica quão distribuída está a atividade entre os grupos.
   - Interpretações erradas comuns (anti-padrões): Usar isoladamente como indicador de saúde; ignorar distribuição de volume por grupo.
   - Observações importantes: Opcionalmente, aplicar limiar de atividade (ex.: ≥ 5 mensagens) para evitar falsos positivos.

5. **Novos membros no período (Sistema)**
   - Nome do KPI: Novos membros no período (Sistema)
   - Nível (System | Organization | Group): System
   - O que ele mede: Crescimento de base ativa potencial.
   - Como é calculado (fórmula conceitual): `count(members com joined_at dentro do período, em todas as organizações/grupos)`.
   - Comparação com período anterior: Diferença absoluta e variação percentual quando fizer sentido.
   - Interpretação correta: Acompanha aquisição; deve ser lido com engajamento para evitar crescimento vazio.
   - Interpretações erradas comuns (anti-padrões): Assumir que novos membros são automaticamente ativos.
   - Observações importantes: Se houver dados de saída, considerar KPI separado de churn; aqui medimos apenas entradas.

---

### Nível Organization

1. **Volume de mensagens da organização**
   - Nome do KPI: Volume de mensagens da organização
   - Nível (System | Organization | Group): Organization
   - O que ele mede: Intensidade de conversas nos grupos da organização.
   - Como é calculado (fórmula conceitual): `count(messages onde group.organization_id = org_id e deleted_at = null, no período)`.
   - Comparação com período anterior: Variação percentual `Δ%`.
   - Interpretação correta: Sinal de atividade; deve ser lido com membros ativos e grupos ativos.
   - Interpretações erradas comuns (anti-padrões): Tratar campanhas pontuais como melhoria estrutural.
   - Observações importantes: Avaliar sazonalidade e eventos; comparar entre organizações de natureza similar.

2. **Membros ativos da organização**
   - Nome do KPI: Membros ativos da organização
   - Nível (System | Organization | Group): Organization
   - O que ele mede: Quantidade de participantes distintos que engajaram em qualquer grupo da organização.
   - Como é calculado (fórmula conceitual): `count(distinct member_id em messages dos grupos da organização, no período)`.
   - Comparação com período anterior: Variação percentual `Δ%`.
   - Interpretação correta: Largura da participação real dentro da organização.
   - Interpretações erradas comuns (anti-padrões): Comparar com membros cadastrados sem considerar crescimento de base.
   - Observações importantes: Membros que participam de múltiplos grupos contam uma única vez.

3. **Taxa de engajamento da organização**
   - Nome do KPI: Taxa de engajamento da organização
   - Nível (System | Organization | Group): Organization
   - O que ele mede: Proporção de membros ativos em relação ao total da organização.
   - Como é calculado (fórmula conceitual): `(membros_ativos_org / membros_totais_org) * 100`.
   - Comparação com período anterior: Diferença em pontos percentuais.
   - Interpretação correta: Indica qualidade da ativação em escala organizacional.
   - Interpretações erradas comuns (anti-padrões): Confundir crescimento de base com melhora de engajamento.
   - Observações importantes: Usar `pp` na comparação e considerar mudanças estruturais (criação/arquivamento de grupos).

4. **Grupos ativos na organização**
   - Nome do KPI: Grupos ativos na organização
   - Nível (System | Organization | Group): Organization
   - O que ele mede: Distribuição de atividade entre os grupos da organização.
   - Como é calculado (fórmula conceitual): `(count(grupos da org com ≥ 1 mensagem no período) / count(grupos_totais da org)) * 100`.
   - Comparação com período anterior: Diferença em pontos percentuais.
   - Interpretação correta: Mostra adoção efetiva; útil para detectar grupos estagnados.
   - Interpretações erradas comuns (anti-padrões): Achar que 100% ativo significa saúde perfeita; ignorar intensidade por grupo.
   - Observações importantes: Aplicar limiar mínimo de mensagens quando houver spam ou ruído.

5. **Novos membros na organização**
   - Nome do KPI: Novos membros na organização
   - Nível (System | Organization | Group): Organization
   - O que ele mede: Crescimento de membros nos grupos da organização.
   - Como é calculado (fórmula conceitual): `count(members com joined_at dentro do período e group.organization_id = org_id)`.
   - Comparação com período anterior: Diferença absoluta e `Δ%` quando fizer sentido.
   - Interpretação correta: Medida de aquisição interna; deve ser acompanhada da taxa de engajamento.
   - Interpretações erradas comuns (anti-padrões): Usar isolado como proxy de saúde.
   - Observações importantes: Se houver churn, separar em KPI próprio.

6. **Desvio de engajamento entre grupos (Organização)**
   - Nome do KPI: Desvio de engajamento entre grupos (Organização)
   - Nível (System | Organization | Group): Organization
   - O que ele mede: Homogeneidade/heterogeneidade do engajamento entre grupos.
   - Como é calculado (fórmula conceitual): Calcular `taxa_de_engajamento` por grupo; medir dispersão (ex.: desvio padrão ou IQR) sobre as taxas. Exposição: `σ_engajamento`.
   - Comparação com período anterior: Variação do desvio/IQR; observar tendência de concentração ou nivelamento.
   - Interpretação correta: Ajuda a identificar grupos fora do padrão (outliers) para ação tática.
   - Interpretações erradas comuns (anti-padrões): Confundir alta dispersão com sucesso; ignorar tamanho do grupo.
   - Observações importantes: Considerar ponderação por tamanho de grupo para evitar viés de grupos pequenos.

---

### Nível Group

1. **Volume de mensagens do grupo**
   - Nome do KPI: Volume de mensagens do grupo
   - Nível (System | Organization | Group): Group
   - O que ele mede: Intensidade de conversas no grupo.
   - Como é calculado (fórmula conceitual): `count(messages onde group_id = X e deleted_at = null, no período)`.
   - Comparação com período anterior: Variação percentual `Δ%`.
   - Interpretação correta: Ritmo de conversas; ler junto com membros ativos para diferenciar explosões pontuais de engajamento real.
   - Interpretações erradas comuns (anti-padrões): Usar isolado como proxy de qualidade.
   - Observações importantes: Verificar sazonalidade e eventos.

2. **Membros ativos do grupo**
   - Nome do KPI: Membros ativos do grupo
   - Nível (System | Organization | Group): Group
   - O que ele mede: Quantos membros distintos engajaram no período.
   - Como é calculado (fórmula conceitual): `count(distinct member_id em messages do group_id = X, no período)`.
   - Comparação com período anterior: Variação percentual `Δ%`.
   - Interpretação correta: Largura da participação real.
   - Interpretações erradas comuns (anti-padrões): Confundir com total de membros; ignorar mudanças na base.
   - Observações importantes: Alinhar definição de "membro" e exclusões técnicas.

3. **Taxa de engajamento do grupo**
   - Nome do KPI: Taxa de engajamento do grupo
   - Nível (System | Organization | Group): Group
   - O que ele mede: Proporção de membros que engajaram.
   - Como é calculado (fórmula conceitual): `(membros_ativos_grupo / membros_totais_grupo) * 100`.
   - Comparação com período anterior: Diferença em pontos percentuais.
   - Interpretação correta: Mais informativa que volume puro; indica saúde do grupo.
   - Interpretações erradas comuns (anti-padrões): Tratar como número absoluto; ignorar entrada/saída de membros.
   - Observações importantes: Usar `pp` na comparação.

4. **Distribuição de engajamento (recorrentes | esporádicos | inativos)**
   - Nome do KPI: Distribuição de engajamento por faixas
   - Nível (System | Organization | Group): Group
   - O que ele mede: Perfil de participação dos membros.
   - Como é calculado (fórmula conceitual): Para cada membro: contar mensagens no período e classificar em `recorrentes (≥ 5)`, `esporádicos (1–4)` ou `inativos (0)`. Retornar percentuais por faixa.
   - Comparação com período anterior: Comparar percentuais por faixa (diferença em `pp`).
   - Interpretação correta: Detecta concentração de atividade e risco de inatividade.
   - Interpretações erradas comuns (anti-padrões): Usar apenas recorrentes como sucesso; ignorar que esporádicos podem estar em ativação.
   - Observações importantes: Limiares podem ser ajustados, mantendo consistência histórica.

5. **Hora de pico de conversas**
   - Nome do KPI: Hora de pico de conversas
   - Nível (System | Organization | Group): Group
   - O que ele mede: Janela horária com maior volume de mensagens.
   - Como é calculado (fórmula conceitual): Contar mensagens por hora (0–23) e identificar a hora com maior `count`.
   - Comparação com período anterior: Verificar mudança de hora de pico e variação do volume no pico.
   - Interpretação correta: Otimiza ações (comunicações, moderação) para horários de maior tráfego.
   - Interpretações erradas comuns (anti-padrões): Assumir que fora do pico não há valor; ignorar distribuição diária.
   - Observações importantes: Considerar fuso horário e sazonalidade.

6. **Novos membros no grupo (período)**
   - Nome do KPI: Novos membros no grupo
   - Nível (System | Organization | Group): Group
   - O que ele mede: Aquisição de membros do grupo.
   - Como é calculado (fórmula conceitual): `count(members do group_id = X com joined_at dentro do período)`.
   - Comparação com período anterior: Diferença absoluta e `Δ%` quando fizer sentido.
   - Interpretação correta: Acompanha crescimento; deve ser lido junto com engajamento para evitar base passiva.
   - Interpretações erradas comuns (anti-padrões): Confundir aquisição com engajamento.
   - Observações importantes: Separar churn se houver dados de saída.

7. **Participação de administradores (grupo)**
   - Nome do KPI: Participação de administradores
   - Nível (System | Organization | Group): Group
   - O que ele mede: Atividade dos administradores na conversa.
   - Como é calculado (fórmula conceitual): `(count(messages de admin no período) / count(messages totais no período)) * 100` e `count(admins ativos)`.
   - Comparação com período anterior: Diferença em `pp` na participação e variação de `admins ativos`.
   - Interpretação correta: Ajuda a balancear moderação e protagonismo; excesso pode desincentivar membros.
   - Interpretações erradas comuns (anti-padrões): Concluir que mais mensagens de admin sempre é melhor.
   - Observações importantes: Considerar natureza do grupo (suporte, anúncio, comunidade) ao interpretar.

8. **Membros em risco de inatividade**
   - Nome do KPI: Membros em risco de inatividade
   - Nível (System | Organization | Group): Group
   - O que ele mede: Membros sem engajamento há ≥ 7 dias.
   - Como é calculado (fórmula conceitual): Para cada membro, `dias desde última mensagem`; marcar como risco se `≥ 7`; retornar `count` e lista.
   - Comparação com período anterior: Variação do `count` e tendência.
   - Interpretação correta: Prioriza reativação; bom sinal quando reduz de forma consistente.
   - Interpretações erradas comuns (anti-padrões): Ignorar efeito de sazonalidade; tratar redução pontual como vitória estrutural.
   - Observações importantes: Ajustar limiar conforme contexto do grupo.

9. **Concentração de mensagens (80/20 do grupo)**
   - Nome do KPI: Concentração de mensagens
   - Nível (System | Organization | Group): Group
   - O que ele mede: Quanto do volume é produzido por poucos membros.
   - Como é calculado (fórmula conceitual): Ordenar membros por mensagens no período; calcular `% de mensagens` geradas pelo `top 20%` de membros; expor também o índice de Gini opcional.
   - Comparação com período anterior: Variação do `%` de concentração.
   - Interpretação correta: Alta concentração indica dependência de poucos; útil para planos de ativação.
   - Interpretações erradas comuns (anti-padrões): Tratar concentração alta como sucesso garantido.
   - Observações importantes: Ler junto com distribuição de engajamento.

---

## O que não é responsabilidade deste escopo

- Métricas técnicas (latência, falhas, webhooks) e operacionais de infraestrutura
- Métricas de marketing (funil de campanha, CAC, CTR etc.)
- Métricas financeiras (receita, margem, custo)
- Métricas de IA (tokens, custo de inferência)
- Definição de UI, gráficos, cores ou layout dos dashboards

## Referências conceituais

- Tendência > número absoluto: comparar períodos e observar direção é prioritário
- Pontos percentuais (pp) para taxas: usar `pp` em vez de `Δ%` quando comparar proporções
- Regra de Pareto (80/20): concentração de atividade costuma seguir distribuição desigual
- Sazonalidade e eventos: sempre considerar calendário e contexto antes de concluir

---

Este documento é a fonte de verdade para interpretação e evolução dos dashboards do Admin do Bóris. A adoção de KPIs aqui descritos deve permanecer consistente ao longo do tempo, priorizando comparações limpas entre períodos e leituras centradas em mensagens, membros e tempo.
