# Rollout do Design System da Central de Controle do Boris

## Objetivo

Registrar o que ja foi aplicado do design system no produto, quais camadas estao consolidadas e quais superficies ainda devem ser ajustadas.

## Status geral

### 1. Fundacoes
- Status: aplicado
- Arquivos principais:
  - `src/index.css`
  - `src/design-system/tokens/colors.ts`
  - `src/design-system/tokens/typography.ts`
  - `src/design-system/tokens/spacing.ts`
  - `src/design-system/tokens/radius.ts`
  - `src/design-system/tokens/shadows.ts`
  - `src/design-system/tokens/charts.ts`

### 2. Componentes base
- Status: aplicado
- Arquivos principais:
  - `src/components/ui/button.tsx`
  - `src/components/ui/card.tsx`
  - `src/components/ui/badge.tsx`
  - `src/components/ui/input.tsx`
  - `src/components/ui/table.tsx`
  - `src/components/ui/pagination.tsx`
  - `src/components/ui/boris-table.tsx`
  - `src/components/group-dashboard/KpiCard.tsx`

### 3. Shell administrativo
- Status: aplicado
- Arquivos principais:
  - `src/components/layout/AdminHeader.tsx`
  - `src/components/layout/AdminSidebar.tsx`
  - `src/components/layout/AdminPageHeader.tsx`
  - `src/components/ui/filter-bar-row.tsx`
  - `src/components/ui/empty-state.tsx`
  - `src/components/ui/error-state.tsx`

### 4. Superficies principais
- Status: aplicado
- Dashboard do sistema:
  - `src/pages/Index.tsx`
  - `src/components/dashboard/StatsCard.tsx`
  - `src/components/dashboard/ExecutiveSectionHeader.tsx`
- Lista de grupos:
  - `src/pages/SystemGroups.tsx`
  - `src/components/dashboard/ListSectionHeader.tsx`
- Pagina de organizacao:
  - `src/pages/Org.tsx`
- Detalhe de grupo:
  - `src/pages/Group.tsx`
  - `src/components/group-navigation/GroupPageTop.tsx`
  - `src/components/group-navigation/GroupTabs.tsx`
  - `src/components/group-dashboard/GroupHeader.tsx`

## Decisoes de design consolidadas

- Base light-first com superfices neutras e laranja reservado para acao e destaque.
- Tipografia mais editorial para titulos e mais precisa para KPIs e tabelas.
- Cards com menos ruido visual e mais separacao entre contexto, valor e acao.
- Tabelas e listas com hierarquia melhor para operacao e leitura analitica.
- Shell administrativo com estados ativos mais claros e navegacao mais estavel.
- Estados vazios e de erro tratados como partes do sistema, nao como excecoes visuais.

## Padrao que deve ser seguido daqui para frente

- Preferir tokens semanticos em vez de valores diretos.
- Toda superficie nova deve usar radius, sombra e densidade ja adotados nas telas principais.
- Filtros devem viver em surfaces discretas, com chips ativos e acao de limpar.
- KPIs precisam seguir a ordem: label, valor, delta, contexto.
- Listas operacionais precisam ter leitura equivalente em desktop e mobile.

## Superficies que ainda merecem rollout

### Alta prioridade
- `src/pages/SystemActivity.tsx`
- `src/pages/SystemOrganizations.tsx`
- `src/pages/SystemPeople.tsx`
- `src/pages/Users.tsx`
- `src/pages/Settings.tsx`

### Media prioridade
- `src/pages/GroupMessages.tsx`
- `src/pages/GroupMembers.tsx`
- `src/pages/GroupSummaries.tsx`
- `src/pages/GroupPolls.tsx`
- `src/pages/Alerts.tsx`

## Checklist de adocao para as proximas telas

- A tela usa `AdminPageHeader` ou `GroupPageTop` corretamente?
- Os blocos principais estao dentro do mesmo ritmo de espacamento das telas novas?
- Ha no maximo uma acao primaria por area?
- Os badges e estados seguem as variantes semanticas ja existentes?
- Loading, vazio e erro foram atualizados para a nova linguagem?
- A experiencia mobile ficou coerente com a desktop?

## Observacao de manutencao

Esse rollout foi feito preservando a base atual em Tailwind + ShadCN. A proxima etapa ideal e continuar a migracao por superficie, evitando forks visuais entre telas antigas e telas novas.
