import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingDown,
  Wallet
} from "lucide-react";

import { Badge } from "./components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./components/ui/card";
import { financeData } from "./data/finance-data";

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function normalizeDescription(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isInternalTransfer(category) {
  return category === "Transferência interna";
}

function isIgnoredAutomaticMovement(transaction) {
  return normalizeDescription(transaction.description).includes("bb rende facil");
}

function isTransactionApplicable(transactionId, applicabilityOverrides) {
  return applicabilityOverrides[transactionId] !== false;
}

function isFixedCategory(category) {
  return [
    "Contas da casa",
    "Empréstimos",
    "Investimentos",
    "Seguros e benefícios",
    "Financeiro"
  ].includes(category);
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <Card className="border-white/70 bg-white/92">
      <CardHeader className="gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-secondary p-3 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function KpiCard({ label, value, hint, icon: Icon, tone = "default" }) {
  return (
    <Card className="border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(39,45,34,0.45)]">
      <CardHeader className="gap-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline">{label}</Badge>
          <div
            className={
              tone === "alert"
                ? "rounded-2xl bg-amber-100 p-3 text-amber-700"
                : "rounded-2xl bg-emerald-100 p-3 text-emerald-700"
            }
          >
            <Icon className="size-5" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-3xl">{value}</CardTitle>
          <CardDescription>{hint}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}

function SourceBadge({ source }) {
  if (!source) {
    return null;
  }

  const className =
    source === "Mateus"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-pink-200 bg-pink-50 text-pink-700";

  return (
    <Badge variant="outline" className={className}>
      {source}
    </Badge>
  );
}

function ProgressBar({ value, total, tone = "green" }) {
  const width = total > 0 ? Math.max((value / total) * 100, 8) : 0;
  const color =
    tone === "green"
      ? "bg-[linear-gradient(90deg,#365f4b,#a8c3a7)]"
      : "bg-[linear-gradient(90deg,#805442,#d1aa97)]";

  return (
    <div className="h-2 rounded-full bg-secondary">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function sumBy(items, key) {
  return items.reduce((sum, item) => sum + (item[key] || 0), 0);
}

function mergeTransactions(accounts) {
  return accounts
    .flatMap((account) =>
      (account.transactions || []).map((transaction) => ({
        ...transaction,
        source: account.label
      }))
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

function mergeCategories(accounts) {
  const totals = new Map();

  accounts.forEach((account) => {
    account.categories.forEach((category) => {
      totals.set(category.name, (totals.get(category.name) || 0) + category.amount);
    });
  });

  return Array.from(totals.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((left, right) => right.amount - left.amount);
}

function mergeUpcomingBills(accounts) {
  const parseDue = (due) => {
    if (!due) {
      return Number.POSITIVE_INFINITY;
    }

    if (String(due).includes("/")) {
      const [day, month] = String(due).split("/").map(Number);
      return month * 100 + day;
    }

    return Number(due);
  };

  return accounts
    .flatMap((account) =>
      account.upcomingBills.map((bill) => ({
        ...bill,
        source: account.label
      }))
    )
    .sort((left, right) => parseDue(left.due) - parseDue(right.due));
}

function buildCombinedAccount(accounts) {
  const upcomingBills = mergeUpcomingBills(accounts);
  const categories = mergeCategories(accounts);
  const transactions = mergeTransactions(accounts);
  const hasImportedData = accounts.some(
    (account) =>
      account.upcomingBills.length > 0 ||
      account.categories.length > 0 ||
      (account.transactions || []).length > 0
  );

  return {
    label: "Conjunta",
    balanceToday: sumBy(accounts, "balanceToday"),
    monthlyIncome: sumBy(accounts, "monthlyIncome"),
    monthlySpent: sumBy(accounts, "monthlySpent"),
    fixedSpent: sumBy(accounts, "fixedSpent"),
    variableSpent: sumBy(accounts, "variableSpent"),
    nextRequired: sumBy(accounts, "nextRequired"),
    daysCovered: sumBy(accounts, "daysCovered"),
    message: hasImportedData
      ? "Visão conjunta somada automaticamente a partir das abas de Mateus e Alice."
      : "Aguardando os dados reais das contas individuais para compor a visão conjunta.",
    upcomingBills,
    categories,
    transactions
  };
}

function buildCategoryTotals(transactions, overrides, applicabilityOverrides) {
  const totals = new Map();

  transactions
    .filter((transaction) => transaction.type === "saída")
    .forEach((transaction) => {
      if (!isTransactionApplicable(transaction.id, applicabilityOverrides)) {
        return;
      }

      if (isIgnoredAutomaticMovement(transaction)) {
        return;
      }

      const category =
        overrides[normalizeDescription(transaction.description)] ?? transaction.category;
      if (isInternalTransfer(category)) {
        return;
      }
      totals.set(category, (totals.get(category) || 0) + transaction.amount);
    });

  return Array.from(totals.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((left, right) => right.amount - left.amount);
}

function buildIncomeTotals(transactions, overrides, applicabilityOverrides) {
  const base = {
    "Salário": 0,
    "Resgate": 0,
    "Transferência": 0,
    "Receita": 0
  };

  transactions
    .filter((transaction) => transaction.type === "entrada")
    .forEach((transaction) => {
      if (!isTransactionApplicable(transaction.id, applicabilityOverrides)) {
        return;
      }

      if (isIgnoredAutomaticMovement(transaction)) {
        return;
      }

      const category =
        overrides[normalizeDescription(transaction.description)] ?? transaction.category;
      base[category] = (base[category] || 0) + transaction.amount;
    });

  return Object.entries(base).map(([name, amount]) => ({ name, amount }));
}

function getCategoryOptions(transaction) {
  if (transaction.type === "entrada") {
    return ["Salário", "Resgate", "Transferência", "Transferência interna", "Receita"];
  }

  return [
    "Empréstimos",
    "Trabalho e negócio",
    "Transferência interna",
    "Transferências e outros",
    "Mercado e conveniência",
    "Alimentação fora",
    "Contas da casa",
    "Financeiro",
    "Transporte",
    "Saúde",
    "Lazer",
    "Investimentos",
    "Extras",
    "Seguros e benefícios"
  ];
}

function App() {
  const [activeMonth, setActiveMonth] = useState("mai");
  const [activeAccount, setActiveAccount] = useState("conjunta");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("todos");
  const [categoryRules, setCategoryRules] = useState({});
  const [applicabilityOverrides, setApplicabilityOverrides] = useState({});
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const selectedMonth = financeData.months.find((month) => month.key === activeMonth) ?? financeData.months[0];
  const monthData = financeData.monthlyData[activeMonth];
  const derivedAccountViews = useMemo(() => {
    const individualAccounts = [monthData.accountViews.mateus, monthData.accountViews.alice];

    return {
      ...monthData.accountViews,
      conjunta: buildCombinedAccount(individualAccounts)
    };
  }, [monthData]);
  const currentAccount = derivedAccountViews[activeAccount];
  const transactions = currentAccount.transactions || [];
  const resolvedTransactions = useMemo(
    () =>
      transactions.map((transaction) => ({
        ...transaction,
        resolvedCategory:
          categoryRules[normalizeDescription(transaction.description)] ?? transaction.category
      })),
    [transactions, categoryRules]
  );
  const filteredTransactions = useMemo(() => {
    const visibleTransactions = resolvedTransactions.filter(
      (transaction) => !isIgnoredAutomaticMovement(transaction)
    );

    if (transactionTypeFilter === "todos") {
      return visibleTransactions;
    }

    return visibleTransactions.filter((transaction) => transaction.type === transactionTypeFilter);
  }, [resolvedTransactions, transactionTypeFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadRules() {
      try {
        const response = await fetch("/api/category-rules");
        const data = await response.json();

        if (!cancelled) {
          setCategoryRules(data.categoryRules || {});
          setApplicabilityOverrides(data.applicabilityOverrides || {});
        }
      } catch {
        if (!cancelled) {
          setCategoryRules({});
          setApplicabilityOverrides({});
        }
      } finally {
        if (!cancelled) {
          setRulesLoaded(true);
        }
      }
    }

    loadRules();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!rulesLoaded) {
      return;
    }

    fetch("/api/category-rules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        categoryRules,
        applicabilityOverrides
      })
    }).catch(() => {});
  }, [categoryRules, applicabilityOverrides, rulesLoaded]);

  const visibleCategories = useMemo(() => {
    if (resolvedTransactions.length === 0) {
      return currentAccount.categories;
    }

    return buildCategoryTotals(resolvedTransactions, {}, applicabilityOverrides);
  }, [resolvedTransactions, currentAccount.categories, applicabilityOverrides]);
  const incomeBreakdown = useMemo(
    () => buildIncomeTotals(resolvedTransactions, {}, applicabilityOverrides),
    [resolvedTransactions, applicabilityOverrides]
  );
  const nonApplicableNetImpact = useMemo(
    () =>
      resolvedTransactions.reduce((sum, transaction) => {
        if (isTransactionApplicable(transaction.id, applicabilityOverrides)) {
          return sum;
        }

        return transaction.type === "entrada"
          ? sum - transaction.amount
          : sum + transaction.amount;
      }, 0),
    [resolvedTransactions, applicabilityOverrides]
  );
  const displayedBalanceToday = useMemo(
    () => currentAccount.balanceToday + nonApplicableNetImpact,
    [currentAccount.balanceToday, nonApplicableNetImpact]
  );
  const displayedMonthlyIncome = useMemo(
    () =>
      resolvedTransactions
        .filter(
          (transaction) =>
            transaction.type === "entrada" &&
            !isInternalTransfer(transaction.resolvedCategory) &&
            isTransactionApplicable(transaction.id, applicabilityOverrides) &&
            !isIgnoredAutomaticMovement(transaction)
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [resolvedTransactions, applicabilityOverrides]
  );
  const displayedMonthlySpent = useMemo(
    () =>
      resolvedTransactions
        .filter(
          (transaction) =>
            transaction.type === "saída" &&
            !isInternalTransfer(transaction.resolvedCategory) &&
            isTransactionApplicable(transaction.id, applicabilityOverrides) &&
            !isIgnoredAutomaticMovement(transaction)
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [resolvedTransactions, applicabilityOverrides]
  );
  const displayedFixedSpent = useMemo(
    () =>
      resolvedTransactions
        .filter(
          (transaction) =>
            transaction.type === "saída" &&
            isTransactionApplicable(transaction.id, applicabilityOverrides) &&
            !isIgnoredAutomaticMovement(transaction) &&
            !isInternalTransfer(transaction.resolvedCategory) &&
            isFixedCategory(transaction.resolvedCategory)
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [resolvedTransactions, applicabilityOverrides]
  );
  const displayedVariableSpent = useMemo(
    () =>
      resolvedTransactions
        .filter(
          (transaction) =>
            transaction.type === "saída" &&
            isTransactionApplicable(transaction.id, applicabilityOverrides) &&
            !isIgnoredAutomaticMovement(transaction) &&
            !isInternalTransfer(transaction.resolvedCategory) &&
            !isFixedCategory(transaction.resolvedCategory)
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [resolvedTransactions, applicabilityOverrides]
  );

  const categoryTotal = useMemo(
    () => visibleCategories.reduce((sum, category) => sum + category.amount, 0),
    [visibleCategories]
  );

  const fixedCoverage = currentAccount.nextRequired > 0
    ? (currentAccount.balanceToday / currentAccount.nextRequired) * 100
    : 0;
  const reserve6mProgress = monthData.investments.emergency6mTarget > 0
    ? (monthData.investments.totalSaved / monthData.investments.emergency6mTarget) * 100
    : 0;
  const reserve12mProgress = monthData.investments.emergency12mTarget > 0
    ? (monthData.investments.totalSaved / monthData.investments.emergency12mTarget) * 100
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-[radial-gradient(circle_at_top_left,_rgba(197,220,197,0.55),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.97),_rgba(246,244,238,0.94))] p-6 shadow-[0_30px_80px_-48px_rgba(42,52,41,0.45)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="mb-4">{selectedMonth.label} {financeData.metadata.year}</Badge>
              <h1 className="font-display text-4xl leading-tight md:text-5xl">
                Caixa corrente, investimentos e empréstimos num só lugar
              </h1>
              <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
                O painel agora segue exatamente a lógica da casa: ver cada conta separada, juntar a
                visão familiar e entender se o dinheiro de hoje é suficiente para chegar nas contas
                fixas que já sabemos que vão bater.
              </p>
            </div>
            <Card className="w-full max-w-sm border-white/80 bg-white/82">
              <CardHeader className="gap-3 pb-4">
                <Badge variant="outline" className="w-fit">
                  Objetivo principal
                </Badge>
                <CardTitle className="text-2xl">Mais previsibilidade e menos dependência de empréstimo</CardTitle>
                <CardDescription>
                  Formar reserva, reduzir parcela mensal e ganhar margem de segurança.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {financeData.months.map((month) => {
              const isActive = month.key === activeMonth;

              return (
                <button
                  key={month.key}
                  type="button"
                  onClick={() => setActiveMonth(month.key)}
                  className={
                    isActive
                      ? "rounded-full border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition"
                      : "rounded-full border border-border bg-white/85 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-white"
                  }
                >
                  {month.label}
                </button>
              );
            })}
          </div>
        </section>

        <SectionCard
          icon={Wallet}
          title="Conta corrente"
          description={`Fluxo de ${selectedMonth.label.toLowerCase()}, previsibilidade de contas fixas e visão separada de Mateus, Alice e conjunta.`}
        >
          <div className="mb-6 flex flex-wrap gap-3">
            {Object.entries(derivedAccountViews).map(([key, account]) => {
              const isActive = key === activeAccount;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveAccount(key)}
                  className={
                    isActive
                      ? "rounded-full border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition"
                      : "rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-white"
                  }
                >
                  {account.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Saldo em conta hoje"
              value={formatCurrency(resolvedTransactions.length > 0 ? displayedBalanceToday : currentAccount.balanceToday)}
              hint="Quanto existe disponível agora nessa visão."
              icon={Wallet}
            />
            <KpiCard
              label="Entradas do mês"
              value={formatCurrency(resolvedTransactions.length > 0 ? displayedMonthlyIncome : currentAccount.monthlyIncome)}
              hint="Tudo o que entrou no mês corrente."
              icon={ArrowUpCircle}
            />
            <KpiCard
              label="Gasto total no mês"
              value={formatCurrency(resolvedTransactions.length > 0 ? displayedMonthlySpent : currentAccount.monthlySpent)}
              hint="O KPI mais importante para acompanhar a saída."
              icon={ArrowDownCircle}
              tone="alert"
            />
            <KpiCard
              label="Próximas contas previstas"
              value={formatCurrency(currentAccount.nextRequired)}
              hint="Quanto ainda precisa existir para cobrir os vencimentos já conhecidos."
              icon={Landmark}
              tone="alert"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-white/70 bg-white/80">
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit">
                  Previsibilidade
                </Badge>
                <CardTitle className="text-2xl">O dinheiro de hoje aguenta até lá?</CardTitle>
                <CardDescription>{currentAccount.message}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-secondary/80 p-4">
                    <div className="text-sm text-muted-foreground">Gasto fixo</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {formatCurrency(
                        resolvedTransactions.length > 0 ? displayedFixedSpent : currentAccount.fixedSpent
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-secondary/80 p-4">
                    <div className="text-sm text-muted-foreground">Gasto variável</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {formatCurrency(
                        resolvedTransactions.length > 0 ? displayedVariableSpent : currentAccount.variableSpent
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-secondary/80 p-4">
                    <div className="text-sm text-muted-foreground">Autonomia estimada</div>
                    <div className="mt-2 text-2xl font-semibold">{currentAccount.daysCovered} dias</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">Cobertura das próximas contas fixas</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Compara o saldo atual com o que já sabemos que vai vencer.
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-foreground">{formatPercent(fixedCoverage)}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={Math.min(currentAccount.balanceToday, currentAccount.nextRequired)} total={currentAccount.nextRequired} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/80">
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit">
                  Contas a vencer
                </Badge>
                <CardTitle className="text-2xl">Agenda fixa conhecida</CardTitle>
                <CardDescription>
                  Este bloco existe para antecipar pressão de caixa, não só mostrar histórico.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {currentAccount.upcomingBills.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
                    Nenhuma conta cadastrada ainda nesta visão.
                  </div>
                ) : currentAccount.upcomingBills.map((bill) => (
                  <div key={`${bill.due}-${bill.title}`} className="rounded-2xl border border-border bg-secondary/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Dia {bill.due}</div>
                        <div className="mt-1 font-medium text-foreground">{bill.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{bill.type}</div>
                        <div className="mt-2">
                          <SourceBadge source={bill.source} />
                        </div>
                      </div>
                      <Badge variant={bill.status === "Confirmado" ? "secondary" : "outline"}>{bill.status}</Badge>
                    </div>
                    <div className="mt-3 text-lg font-semibold">{formatCurrency(bill.amount)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="border-white/70 bg-white/80">
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit">
                  Categorias
                </Badge>
                <CardTitle className="text-2xl">Quanto está saindo por tipo de despesa</CardTitle>
                <CardDescription>
                  Isso ajuda a enxergar onde reduzir variável e o que é realmente fixo.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {visibleCategories.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
                    Nenhuma categoria preenchida ainda.
                  </div>
                ) : visibleCategories.map((category) => (
                  <div key={category.name} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">{category.name}</span>
                      <span className="font-medium text-foreground">{formatCurrency(category.amount)}</span>
                    </div>
                    <ProgressBar value={category.amount} total={categoryTotal} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/80">
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit">
                  Entradas
                </Badge>
                <CardTitle className="text-2xl">Como entrou o dinheiro no mês</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {incomeBreakdown.map((entry) => (
                  <div key={entry.name} className="rounded-2xl border border-border bg-white/70 p-4">
                    <div className="text-sm text-muted-foreground">{entry.name}</div>
                    <div className="mt-2 text-xl font-semibold text-foreground">{formatCurrency(entry.amount)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4">
            <Card className="border-white/70 bg-white/80">
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit">
                  Lançamentos
                </Badge>
                <CardTitle className="text-2xl">Lançamentos do mês por dia</CardTitle>
                <CardDescription>
                  Você pode revisar a categoria sugerida de cada entrada ou saída e ajustar manualmente quando precisar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap gap-3">
                  {[
                    { key: "todos", label: "Todos" },
                    { key: "entrada", label: "Entradas" },
                    { key: "saída", label: "Saídas" }
                  ].map((option) => {
                    const isActive = option.key === transactionTypeFilter;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setTransactionTypeFilter(option.key)}
                        className={
                          isActive
                            ? "rounded-full border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition"
                            : "rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-white"
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {resolvedTransactions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
                    Nenhum lançamento detalhado cadastrado para {selectedMonth.label.toLowerCase()} nesta visão.
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
                    Nenhum lançamento encontrado para esse tipo de transação.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[1.25rem] border border-border">
                    <table className="w-full border-collapse text-left">
                      <thead className="bg-secondary/80 text-sm text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Dia</th>
                          <th className="px-4 py-3 font-medium">Tipo</th>
                          <th className="px-4 py-3 font-medium">Descrição</th>
                          <th className="px-4 py-3 font-medium">Categoria</th>
                          <th className="px-4 py-3 font-medium">Aplica</th>
                          <th className="px-4 py-3 font-medium">Origem</th>
                          <th className="px-4 py-3 text-right font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((transaction) => {
                          const descriptionKey = normalizeDescription(transaction.description);
                          const resolvedCategory = transaction.resolvedCategory;
                          const isApplicable = isTransactionApplicable(
                            transaction.id,
                            applicabilityOverrides
                          );

                          return (
                            <tr
                              key={transaction.id}
                              className={
                                isApplicable
                                  ? "border-t border-border bg-white/70"
                                  : "border-t border-border bg-stone-100/80 opacity-75"
                              }
                            >
                              <td className="px-4 py-3 text-sm text-muted-foreground">{transaction.day}</td>
                              <td className="px-4 py-3">
                                <Badge variant={transaction.type === "entrada" ? "secondary" : "outline"}>
                                  {transaction.type}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 font-medium text-foreground">{transaction.description}</td>
                              <td className="px-4 py-3">
                                <select
                                  value={resolvedCategory}
                                  onChange={(event) =>
                                    setCategoryRules((current) => ({
                                      ...current,
                                      [descriptionKey]: event.target.value
                                    }))
                                  }
                                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground outline-none"
                                >
                                  {getCategoryOptions(transaction).map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setApplicabilityOverrides((current) => ({
                                      ...current,
                                      [transaction.id]: !isApplicable
                                    }))
                                  }
                                  className={
                                    isApplicable
                                      ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
                                      : "rounded-full border border-stone-300 bg-stone-200 px-3 py-2 text-xs font-medium text-stone-700"
                                  }
                                >
                                  {isApplicable ? "Aplica" : "Não se aplica"}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <SourceBadge source={transaction.source} />
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-foreground">
                                {formatCurrency(transaction.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </SectionCard>

        <SectionCard
          icon={PiggyBank}
          title="Investimentos e reserva"
          description="Acompanhamento da reserva de emergência frente às metas de 6 e 12 meses."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total guardado"
              value={formatCurrency(monthData.investments.totalSaved)}
              hint="Soma das reservas e investimentos líquidos."
              icon={PiggyBank}
            />
            <KpiCard
              label="Aporte do mês"
              value={formatCurrency(monthData.investments.monthlyContribution)}
              hint="Quanto entrou na reserva neste mês."
              icon={ArrowUpCircle}
            />
            <KpiCard
              label="Meta de 6 meses"
              value={formatCurrency(monthData.investments.emergency6mTarget)}
              hint="Baseada no custo real da casa por seis meses."
              icon={Wallet}
            />
            <KpiCard
              label="Meta de 12 meses"
              value={formatCurrency(monthData.investments.emergency12mTarget)}
              hint="Ideal de proteção para um ano."
              icon={Landmark}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-white/70 bg-white/80">
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit">
                  Progresso
                </Badge>
                <CardTitle className="text-2xl">Reserva de emergência</CardTitle>
                <CardDescription>
                  A referência sai diretamente dos gastos reais da casa, não de um número solto.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">Meta de 6 meses</span>
                    <span className="text-sm font-medium text-foreground">{formatPercent(reserve6mProgress)}</span>
                  </div>
                  <ProgressBar value={monthData.investments.totalSaved} total={monthData.investments.emergency6mTarget} />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">Meta de 12 meses</span>
                    <span className="text-sm font-medium text-foreground">{formatPercent(reserve12mProgress)}</span>
                  </div>
                  <ProgressBar value={monthData.investments.totalSaved} total={monthData.investments.emergency12mTarget} />
                </div>
                <div className="rounded-2xl border border-border bg-white/70 p-4 text-sm leading-6 text-muted-foreground">
                  A leitura ideal aqui é simples: quanto já existe, quanto falta e qual parte disso
                  realmente está líquida para servir como reserva.
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/80">
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit">
                  Contas de investimento
                </Badge>
                <CardTitle className="text-2xl">Onde o dinheiro está guardado</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {monthData.investments.accounts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
                    Nenhum saldo de investimento cadastrado para {selectedMonth.label.toLowerCase()}.
                  </div>
                ) : monthData.investments.accounts.map((account) => (
                  <div key={account.name} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-white/70 p-4">
                    <div>
                      <div className="font-medium text-foreground">{account.name}</div>
                      <div className="text-sm text-muted-foreground">{account.institution}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{account.note}</div>
                    </div>
                    <div className="text-right font-semibold text-foreground">{formatCurrency(account.amount)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </SectionCard>

        <SectionCard
          icon={TrendingDown}
          title="Empréstimos"
          description="Cadastro completo das dívidas para enxergar saldo devedor, parcelas restantes e oportunidades de quitação antecipada."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              label="Saldo devedor total"
              value={formatCurrency(monthData.loans.totalOutstanding)}
              hint="Quanto ainda falta pagar somando tudo."
              icon={TrendingDown}
              tone="alert"
            />
            <KpiCard
              label="Parcela mensal total"
              value={formatCurrency(monthData.loans.totalMonthlyInstallment)}
              hint="Impacto recorrente das dívidas no caixa do mês."
              icon={CreditCard}
              tone="alert"
            />
            <KpiCard
              label="Objetivo"
              value="Quitar antes"
              hint="Ganhar folga mensal e reduzir dependência de novos empréstimos."
              icon={Landmark}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-white/70 bg-white/80">
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit">
                  Contratos
                </Badge>
                <CardTitle className="text-2xl">Mapa das dívidas</CardTitle>
                <CardDescription>
                  Cada empréstimo precisa mostrar parcela, parcelas restantes e saldo para quitar.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {monthData.loans.contracts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
                    Nenhum contrato detalhado cadastrado para {selectedMonth.label.toLowerCase()}.
                  </div>
                ) : monthData.loans.contracts.map((loan) => (
                  <div key={loan.title} className="rounded-2xl border border-border bg-white/70 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-medium text-foreground">{loan.title}</div>
                        <div className="text-sm text-muted-foreground">{loan.institution}</div>
                      </div>
                      <div className="grid gap-3 text-sm md:grid-cols-3 md:text-right">
                        <div>
                          <div className="text-muted-foreground">Parcela</div>
                          <div className="font-semibold text-foreground">{formatCurrency(loan.installment)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Parcelas restantes</div>
                          <div className="font-semibold text-foreground">{loan.remainingInstallments}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Saldo restante</div>
                          <div className="font-semibold text-foreground">{formatCurrency(loan.totalRemaining)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-secondary/70 p-4">
                      <div className="text-sm text-muted-foreground">Valor estimado para quitação antecipada</div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{formatCurrency(loan.payoffAmount)}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/80">
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit">
                  Estratégia
                </Badge>
                <CardTitle className="text-2xl">Como esse bloco te ajuda</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
                <div className="rounded-2xl border border-border bg-white/70 p-4">
                  Saber exatamente quanto ainda deve, sem parcelas escondidas.
                </div>
                <div className="rounded-2xl border border-border bg-white/70 p-4">
                  Enxergar quais dívidas pesam mais no mês e quais valem ser abatidas primeiro.
                </div>
                <div className="rounded-2xl border border-border bg-white/70 p-4">
                  Medir o quanto a reserva está ajudando vocês a parar de girar em cima de empréstimos.
                </div>
              </CardContent>
            </Card>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default App;
