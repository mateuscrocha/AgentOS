# Central de Controle do Boris Design System

## 1. Filosofia de design do Boris

### Boris Context Fit
O Boris e uma central operacional para leitura rapida, acompanhamento de comunidades e tomada de decisao. A interface deve priorizar sinais de negocio, estado do sistema e proximos passos acionaveis.

### Principios
- Clareza antes de complexidade.
- Dados antes de decoracao.
- Velocidade antes de animacao.
- Leveza visual com contraste alto.
- Escalabilidade por composicao, nao por excecao.
- Cor de marca reservada para acao, foco e destaque.

### Regras de hierarquia
- Primeira dobra: status da pagina, KPIs principais e alertas ativos.
- Segunda camada: comparativos, tendencias e listas priorizadas.
- Terceira camada: detalhe operacional, configuracoes e auditoria.

## 2. Design tokens

### Cores
- Marca: `brand.primary`, `brand.primaryHover`, `brand.soft`
- Base: `surface.canvas`, `surface.panel`, `surface.subtle`
- Texto: `text.strong`, `text.default`, `text.muted`, `text.disabled`
- Borda: `border.subtle`, `border.default`, `border.strong`, `border.focus`
- Feedback: `feedback.success`, `feedback.warning`, `feedback.danger`, `feedback.info`
- Graficos: `chart.primary`, `chart.blue`, `chart.green`, `chart.amber`, `chart.violet`

### Tipografia
- Interface: `Inter`
- Dados tecnicos e metricas auxiliares: `Inter`
- Titulos de pagina: `display-md` ou `heading-xl`
- Titulo de card: `heading-sm`
- Corpo: `body-md`
- Labels de formulario e filtros: `label-md`
- KPIs: `metric-xl`, `metric-lg`, `metric-sm`

### Espacamento
- Componentes pequenos: `2`, `3`, `4`
- Cards, filtros e blocos: `4`, `5`, `6`
- Secoes de pagina: `6`, `8`, `10`

### Radius e sombra
- Inputs, badges e pequenos controles: `radius.sm`
- Cards, dropdowns e tabelas: `radius.lg`
- Dialogs e drawers: `radius.xl`
- `shadow.xs` para superfices comuns
- `shadow.md` apenas para overlays ou destaque temporal

## 3. Componentes base

### Botoes
- `primary`: CTA principal da tela
- `secondary`: acao secundaria com borda
- `ghost`: acoes contextuais em toolbars e tabelas
- `destructive`: confirmacoes irreversiveis

### Inputs e filtros
- Altura padrao `40px`
- Label sempre visivel
- Helper text curto abaixo do campo
- Erro inline objetivo, sem tom tecnico excessivo

### Cards
- Header curto
- Conteudo denso, mas com respiro
- Nunca competir com o valor principal por meio de cor ou grafismo

### Badges e status
- Status operacionais usam cor semantica
- Status de permissao ou escopo usam neutro ou brand soft
- Evitar mais de um badge colorido por linha de tabela

## 4. Componentes avancados

### Data table
- Ferramentas acima da tabela: busca, filtros, exportacao
- Densidade default para listas gerais
- Densidade comfortable para superficies analiticas com mais contexto por linha
- Cabecalho fixo apenas em tabelas longas

### KPI cards
- Estrutura: label, valor, delta, contexto
- Delta com apoio textual como `vs. 7 dias`
- Icone so quando ajuda a categorizar

### Graficos
- Linha para tendencia
- Barra para ranking e comparacao
- Area para volume historico
- Donut apenas para composicao simples
- Evitar 3D, gradientes pesados e excesso de anotacoes

### Timeline e activity feed
- Mostrar ator, evento, alvo e horario
- Agrupar por data quando houver alta densidade
- Incluir CTA rapido quando a acao for recuperavel

## 5. Layout da aplicacao

### App shell
- Sidebar persistente por dominio
- Top bar com contexto e acoes
- Conteudo principal com `max-width` amplo e `padding` de `24px`

### Header de pagina
- Titulo
- Subtitulo opcional com contexto operacional
- Acoes alinhadas a direita
- Breadcrumb apenas em paginas profundas

### Padroes por pagina
- Dashboard: KPIs, tendencias, alertas, lista acionavel
- Lista: toolbar de filtros, tabela, paginacao
- Detalhe: header contextual, resumo executivo, tabs, historico
- Configuracoes: navegacao lateral secundaria, formularios seccionados

## 6. Padroes de UX

### Loading
- Skeletons representando a estrutura final
- Spinners isolados apenas em acoes pontuais

### Empty state
- Explicar ausencia de dados
- Sugerir o proximo passo
- Manter o tom util, nao promocional

### Error state
- Mensagem clara
- Acao de retry
- Detalhe tecnico apenas se ajudar suporte ou operador

### Feedback e confirmacao
- Toasts curtos para sucesso
- Dialog para exclusao, desconexao ou mudanca irreversivel
- Alertas inline para risco persistente

## 7. Estrutura tecnica do design system

```txt
src/design-system/
  index.ts
  tokens/
    colors.ts
    typography.ts
    spacing.ts
    radius.ts
    shadows.ts
    charts.ts
    index.ts
  docs/
    central-controle-boris-design-system.md
```

### Convencoes
- Tokens em TypeScript para consumo semantico em React
- Variaveis CSS em `src/index.css` para compatibilidade imediata com Tailwind e ShadCN
- Componentes novos devem receber variantes com `class-variance-authority`
- Componentes compostos devem viver em `src/components/ui` ou em um dominio especifico se forem muito contextuais

### Checklist para novos componentes
- Usa token semantico em vez de hex fixo?
- Tem estados de hover, focus, disabled e erro?
- Funciona em densidade de dashboard?
- Suporta titulo, descricao curta e acao contextual quando necessario?
- Respeita a hierarquia visual do shell administrativo?
