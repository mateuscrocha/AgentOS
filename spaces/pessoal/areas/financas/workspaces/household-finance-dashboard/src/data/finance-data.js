function createEmptyAccount(label, message) {
  return {
    label,
    balanceToday: 0,
    monthlyIncome: 0,
    monthlySpent: 0,
    fixedSpent: 0,
    variableSpent: 0,
    nextRequired: 0,
    daysCovered: 0,
    message,
    upcomingBills: [],
    categories: [],
    transactions: []
  };
}

function createEmptyMonth(label) {
  return {
    label,
    accountViews: {
      mateus: createEmptyAccount("Mateus", `Aguardando os dados reais de ${label.toLowerCase()} na conta do Mateus.`),
      alice: createEmptyAccount("Alice", `Aguardando os dados reais de ${label.toLowerCase()} na conta da Alice.`)
    },
    investments: {
      totalSaved: 0,
      monthlyContribution: 0,
      emergency6mTarget: 0,
      emergency12mTarget: 0,
      accounts: []
    },
    loans: {
      totalOutstanding: 0,
      totalMonthlyInstallment: 0,
      contracts: []
    }
  };
}

const months = [
  { key: "jan", label: "Janeiro" },
  { key: "fev", label: "Fevereiro" },
  { key: "mar", label: "Março" },
  { key: "abr", label: "Abril" },
  { key: "mai", label: "Maio" },
  { key: "jun", label: "Junho" },
  { key: "jul", label: "Julho" },
  { key: "ago", label: "Agosto" },
  { key: "set", label: "Setembro" },
  { key: "out", label: "Outubro" },
  { key: "nov", label: "Novembro" },
  { key: "dez", label: "Dezembro" }
];

const monthlyData = Object.fromEntries(
  months.map((month) => [month.key, createEmptyMonth(month.label)])
);

monthlyData.mai.investments = {
  totalSaved: 7225.13,
  monthlyContribution: 578.45,
  emergency6mTarget: 0,
  emergency12mTarget: 0,
  accounts: [
    { name: "Cooperforte", institution: "Alice", amount: 5119.18, note: "Saldo atual em 24 de maio" },
    { name: "Brasil Prev", institution: "Alice", amount: 2105.95, note: "Saldo atual em 24 de maio" },
    { name: "Poupança BB Alice", institution: "Alice", amount: 0, note: "Reservado para preenchimento manual" }
  ]
};

monthlyData.mai.accountViews.mateus = {
  label: "Mateus",
  balanceToday: 28.29,
  monthlyIncome: 6025.33,
  monthlySpent: 6202.88,
  fixedSpent: 2977.26,
  variableSpent: 3225.62,
  nextRequired: 47.55,
  daysCovered: 0,
  message: "Extrato de 01 a 24 de maio importado do PDF da conta corrente do Mateus, com classificação inicial automática dos gastos.",
  upcomingBills: [
    { due: "25/05", title: "Tarifas pendentes", amount: 5, type: "Fixo", status: "Lançamento futuro do extrato" },
    { due: "28/05", title: "Pagto mensalidade seguro", amount: 42.55, type: "Fixo", status: "Lançamento futuro do extrato" },
    { due: "10/06", title: "Pix agendado", amount: 17, type: "Fixo", status: "Lançamento futuro do extrato" }
  ],
  categories: [
    { name: "Empréstimos", amount: 2706.21 },
    { name: "Trabalho e negócio", amount: 1150 },
    { name: "Transferências e outros", amount: 699.5 },
    { name: "Mercado e conveniência", amount: 514.09 },
    { name: "Alimentação fora", amount: 471.8 },
    { name: "Contas da casa", amount: 255.15 },
    { name: "Financeiro", amount: 175.36 },
    { name: "Transporte", amount: 147.73 },
    { name: "Saúde", amount: 48.37 },
    { name: "Lazer", amount: 34.67 }
  ],
  transactions: [
    { id: "mai-mateus-01", day: "04/05", type: "entrada", description: "Transferência recebida ALICE", amount: 1000, category: "Transferência interna" },
    { id: "mai-mateus-02", day: "04/05", type: "entrada", description: "Pix recebido ALICE", amount: 1000, category: "Transferência interna" },
    { id: "mai-mateus-03", day: "04/05", type: "entrada", description: "Pix recebido ALICE", amount: 1000, category: "Transferência interna" },
    { id: "mai-mateus-04", day: "04/05", type: "saída", description: "Conveniência Paraíba", amount: 45, category: "Mercado e conveniência" },
    { id: "mai-mateus-05", day: "04/05", type: "saída", description: "Antonio Denis Rocha", amount: 796.21, category: "Empréstimos" },
    { id: "mai-mateus-06", day: "04/05", type: "saída", description: "Claro", amount: 129.25, category: "Contas da casa" },
    { id: "mai-mateus-07", day: "04/05", type: "saída", description: "Serra Lanchonete", amount: 56, category: "Alimentação fora" },
    { id: "mai-mateus-08", day: "04/05", type: "saída", description: "Real Churrascaria e Lanch", amount: 22, category: "Alimentação fora" },
    { id: "mai-mateus-09", day: "04/05", type: "saída", description: "Mercadinho Pague Pouco", amount: 30, category: "Mercado e conveniência" },
    { id: "mai-mateus-10", day: "04/05", type: "saída", description: "Gelo Forte", amount: 30, category: "Mercado e conveniência" },
    { id: "mai-mateus-11", day: "05/05", type: "saída", description: "Tielly Costa de Oliveira", amount: 39, category: "Transferências e outros" },
    { id: "mai-mateus-12", day: "07/05", type: "saída", description: "Catapulta Digital", amount: 500, category: "Trabalho e negócio" },
    { id: "mai-mateus-13", day: "11/05", type: "entrada", description: "Transferência recebida Catapulta", amount: 250, category: "Receita" },
    { id: "mai-mateus-14", day: "11/05", type: "entrada", description: "Pix recebido Magda", amount: 1000, category: "Transferência" },
    { id: "mai-mateus-15", day: "11/05", type: "saída", description: "Pedro Pablo Monteiro", amount: 17, category: "Transferências e outros" },
    { id: "mai-mateus-16", day: "11/05", type: "saída", description: "Thyago Costa", amount: 12.5, category: "Transferências e outros" },
    { id: "mai-mateus-17", day: "11/05", type: "saída", description: "Ari Antonio", amount: 9, category: "Transferências e outros" },
    { id: "mai-mateus-18", day: "11/05", type: "saída", description: "iFood", amount: 119.2, category: "Alimentação fora" },
    { id: "mai-mateus-19", day: "11/05", type: "saída", description: "Marcilea Back da Silva", amount: 465, category: "Empréstimos" },
    { id: "mai-mateus-20", day: "11/05", type: "saída", description: "Tarifa pacote de serviços", amount: 15.9, category: "Financeiro" },
    { id: "mai-mateus-21", day: "12/05", type: "entrada", description: "Pix recebido Pedro Pablo", amount: 100, category: "Transferência" },
    { id: "mai-mateus-22", day: "12/05", type: "saída", description: "Alison Correia", amount: 98, category: "Transferências e outros" },
    { id: "mai-mateus-23", day: "12/05", type: "saída", description: "LU ML Comércio de Alimentos", amount: 24, category: "Mercado e conveniência" },
    { id: "mai-mateus-24", day: "12/05", type: "saída", description: "Bar Fácil do Brasil", amount: 10, category: "Alimentação fora" },
    { id: "mai-mateus-25", day: "12/05", type: "saída", description: "Bar Fácil do Brasil", amount: 12, category: "Alimentação fora" },
    { id: "mai-mateus-26", day: "12/05", type: "saída", description: "LU ML Comércio de Alimentos", amount: 60, category: "Mercado e conveniência" },
    { id: "mai-mateus-27", day: "13/05", type: "entrada", description: "Pagar.me", amount: 5.33, category: "Receita" },
    { id: "mai-mateus-28", day: "13/05", type: "saída", description: "JeAdministradora", amount: 50, category: "Financeiro" },
    { id: "mai-mateus-29", day: "13/05", type: "saída", description: "Ticketmais", amount: 44, category: "Financeiro" },
    { id: "mai-mateus-30", day: "13/05", type: "saída", description: "Porks Aguas Claras", amount: 20, category: "Alimentação fora" },
    { id: "mai-mateus-31", day: "13/05", type: "saída", description: "Mirelly Ramalh", amount: 440, category: "Transferências e outros" },
    { id: "mai-mateus-32", day: "14/05", type: "saída", description: "Claro", amount: 125.9, category: "Contas da casa" },
    { id: "mai-mateus-33", day: "14/05", type: "saída", description: "Alison Correia", amount: 8, category: "Transferências e outros" },
    { id: "mai-mateus-34", day: "14/05", type: "saída", description: "Porks Aguas Claras", amount: 40, category: "Alimentação fora" },
    { id: "mai-mateus-35", day: "14/05", type: "saída", description: "LU ML Comércio de Alimentos", amount: 30, category: "Mercado e conveniência" },
    { id: "mai-mateus-36", day: "14/05", type: "saída", description: "Porks Aguas Claras", amount: 20, category: "Alimentação fora" },
    { id: "mai-mateus-37", day: "14/05", type: "saída", description: "LU ML Comércio de Alimentos", amount: 20, category: "Mercado e conveniência" },
    { id: "mai-mateus-38", day: "14/05", type: "saída", description: "Alison Correia", amount: 34, category: "Transferências e outros" },
    { id: "mai-mateus-39", day: "14/05", type: "saída", description: "Bistrozin", amount: 100, category: "Alimentação fora" },
    { id: "mai-mateus-40", day: "18/05", type: "entrada", description: "Transferência recebida Catapulta", amount: 440, category: "Receita" },
    { id: "mai-mateus-41", day: "18/05", type: "saída", description: "Catapulta Digital", amount: 400, category: "Trabalho e negócio" },
    { id: "mai-mateus-42", day: "18/05", type: "saída", description: "Kredit Pagamentos", amount: 15.55, category: "Financeiro" },
    { id: "mai-mateus-43", day: "18/05", type: "saída", description: "Market4U", amount: 64.76, category: "Mercado e conveniência" },
    { id: "mai-mateus-44", day: "18/05", type: "saída", description: "Market4U", amount: 56.67, category: "Mercado e conveniência" },
    { id: "mai-mateus-45", day: "18/05", type: "saída", description: "Droga Park", amount: 34.9, category: "Saúde" },
    { id: "mai-mateus-46", day: "18/05", type: "saída", description: "Sympla", amount: 34.67, category: "Lazer" },
    { id: "mai-mateus-47", day: "19/05", type: "saída", description: "Marcilea Back da Silva", amount: 465, category: "Empréstimos" },
    { id: "mai-mateus-48", day: "19/05", type: "saída", description: "Big Trans C A Ltda", amount: 101.16, category: "Transporte" },
    { id: "mai-mateus-49", day: "21/05", type: "saída", description: "Kredit Pagamentos", amount: 10, category: "Financeiro" },
    { id: "mai-mateus-50", day: "21/05", type: "saída", description: "Bonapan", amount: 5.67, category: "Mercado e conveniência" },
    { id: "mai-mateus-51", day: "21/05", type: "saída", description: "Catapulta Digital", amount: 250, category: "Trabalho e negócio" },
    { id: "mai-mateus-52", day: "22/05", type: "entrada", description: "Transferência recebida Catapulta", amount: 230, category: "Receita" },
    { id: "mai-mateus-53", day: "22/05", type: "entrada", description: "Pix recebido Alice", amount: 1000, category: "Transferência interna" },
    { id: "mai-mateus-54", day: "22/05", type: "saída", description: "Antonieta V C Rocha", amount: 980, category: "Empréstimos" },
    { id: "mai-mateus-55", day: "22/05", type: "saída", description: "Kredit Pagamentos", amount: 34.91, category: "Financeiro" },
    { id: "mai-mateus-56", day: "22/05", type: "saída", description: "LU ML Comércio de Alimentos", amount: 44, category: "Mercado e conveniência" },
    { id: "mai-mateus-57", day: "22/05", type: "saída", description: "Market4U", amount: 18.38, category: "Mercado e conveniência" },
    { id: "mai-mateus-58", day: "23/05", type: "saída", description: "Drogafuji", amount: 13.47, category: "Saúde" },
    { id: "mai-mateus-59", day: "23/05", type: "saída", description: "Panificadora e Confeitaria", amount: 10, category: "Mercado e conveniência" },
    { id: "mai-mateus-60", day: "23/05", type: "saída", description: "Bonapan", amount: 17.81, category: "Mercado e conveniência" },
    { id: "mai-mateus-61", day: "23/05", type: "saída", description: "Armazém 205", amount: 33.8, category: "Mercado e conveniência" },
    { id: "mai-mateus-62", day: "23/05", type: "saída", description: "Bistrozin", amount: 72.6, category: "Alimentação fora" },
    { id: "mai-mateus-63", day: "23/05", type: "saída", description: "LU ML Comércio de Alimentos", amount: 24, category: "Mercado e conveniência" },
    { id: "mai-mateus-64", day: "23/05", type: "saída", description: "Cecilia Vieira da Cruz Ro", amount: 42, category: "Transferências e outros" },
    { id: "mai-mateus-65", day: "23/05", type: "saída", description: "Big Trans C A Ltda", amount: 46.57, category: "Transporte" },
    { id: "mai-mateus-66", day: "24/05", type: "saída", description: "Kredit Pagamentos", amount: 5, category: "Financeiro" }
  ]
};

monthlyData.mai.accountViews.alice = {
  label: "Alice",
  balanceToday: 1171.12,
  monthlyIncome: 10798.02,
  monthlySpent: 14851.19,
  fixedSpent: 3458.81,
  variableSpent: 11392.38,
  nextRequired: 291.62,
  daysCovered: 0,
  message: "Extrato de 01 a 24 de maio importado do PDF da conta corrente da Alice. Movimentos automáticos de BB Rende Fácil são desconsiderados para não duplicar saldos.",
  upcomingBills: [
    { due: "26/05", title: "Pagamento de Impostos", amount: 135.37, type: "Fixo", status: "Lançamento futuro do extrato" },
    { due: "27/05", title: "Seguro de Vida", amount: 156.25, type: "Fixo", status: "Lançamento futuro do extrato" },
    { due: "23/06", title: "Pagamento de Impostos", amount: 135.37, type: "Fixo", status: "Lançamento futuro do extrato" },
    { due: "21/07", title: "Pagamento de Impostos", amount: 135.37, type: "Fixo", status: "Lançamento futuro do extrato" }
  ],
  categories: [
    { name: "Transferências e outros", amount: 11447.76 },
    { name: "Resgates e caixa", amount: 2500 },
    { name: "Empréstimos", amount: 1876.4 },
    { name: "Investimentos", amount: 582.41 },
    { name: "Alimentação fora", amount: 512.94 },
    { name: "Transporte", amount: 407.61 },
    { name: "Saúde", amount: 402.31 },
    { name: "Extras", amount: 289.9 },
    { name: "Seguros e benefícios", amount: 51.31 },
    { name: "Financeiro", amount: 18.12 }
  ],
  transactions: [
    { id: "mai-alice-01", day: "04/05", type: "entrada", description: "LUCIA CONY", amount: 408.92, category: "Transferência" },
    { id: "mai-alice-02", day: "04/05", type: "entrada", description: "LUCIA CONY CID", amount: 200, category: "Transferência" },
    { id: "mai-alice-03", day: "04/05", type: "saída", description: "Restaurante Casarão", amount: 10, category: "Alimentação fora" },
    { id: "mai-alice-04", day: "04/05", type: "saída", description: "Mateus Vieira da Cruz Roc", amount: 1000, category: "Transferência interna" },
    { id: "mai-alice-05", day: "04/05", type: "saída", description: "Mateus Vieira da Cruz Roc", amount: 1000, category: "Transferência interna" },
    { id: "mai-alice-06", day: "04/05", type: "saída", description: "Mateus Vieira da Cruz Roc", amount: 1000, category: "Transferência interna" },
    { id: "mai-alice-07", day: "04/05", type: "saída", description: "IOF Saldo Devedor Conta", amount: 4.42, category: "Financeiro" },
    { id: "mai-alice-08", day: "04/05", type: "entrada", description: "BB Rende Fácil", amount: 2405.5, category: "Resgate" },
    { id: "mai-alice-09", day: "05/05", type: "saída", description: "Escola Brasileira de Chor", amount: 255.9, category: "Extras" },
    { id: "mai-alice-10", day: "05/05", type: "saída", description: "Amanda Giordani Pereira", amount: 164.5, category: "Transferências e outros" },
    { id: "mai-alice-11", day: "05/05", type: "saída", description: "Giovana Leivas Craveiro", amount: 74.28, category: "Transferências e outros" },
    { id: "mai-alice-12", day: "05/05", type: "entrada", description: "BB Rende Fácil", amount: 494.68, category: "Resgate" },
    { id: "mai-alice-13", day: "06/05", type: "entrada", description: "Seguro Crédito Protegido", amount: 1.44, category: "Receita" },
    { id: "mai-alice-14", day: "06/05", type: "saída", description: "Ultrabox 24 - Pau Br", amount: 45, category: "Alimentação fora" },
    { id: "mai-alice-15", day: "06/05", type: "saída", description: "Ebanx", amount: 4.9, category: "Financeiro" },
    { id: "mai-alice-16", day: "06/05", type: "entrada", description: "BB Rende Fácil", amount: 48.46, category: "Resgate" },
    { id: "mai-alice-17", day: "07/05", type: "entrada", description: "Cristiano P Na", amount: 2500, category: "Transferência" },
    { id: "mai-alice-18", day: "07/05", type: "saída", description: "Uber", amount: 29.98, category: "Transporte" },
    { id: "mai-alice-19", day: "07/05", type: "saída", description: "Saque ATM", amount: 50, category: "Resgates e caixa" },
    { id: "mai-alice-20", day: "07/05", type: "saída", description: "Saque ATM", amount: 50, category: "Resgates e caixa" },
    { id: "mai-alice-21", day: "07/05", type: "saída", description: "Saque ATM", amount: 2400, category: "Resgates e caixa" },
    { id: "mai-alice-22", day: "07/05", type: "entrada", description: "BB Rende Fácil", amount: 29.98, category: "Resgate" },
    { id: "mai-alice-23", day: "08/05", type: "saída", description: "Uber", amount: 48.98, category: "Transporte" },
    { id: "mai-alice-24", day: "08/05", type: "entrada", description: "BB Rende Fácil", amount: 48.98, category: "Resgate" },
    { id: "mai-alice-25", day: "11/05", type: "saída", description: "Castanheiras Comerci", amount: 208.55, category: "Extras" },
    { id: "mai-alice-26", day: "11/05", type: "saída", description: "Bonnacerva", amount: 7, category: "Alimentação fora" },
    { id: "mai-alice-27", day: "11/05", type: "saída", description: "Uber", amount: 74.98, category: "Transporte" },
    { id: "mai-alice-28", day: "11/05", type: "saída", description: "Lago Sul", amount: 35.9, category: "Alimentação fora" },
    { id: "mai-alice-29", day: "11/05", type: "saída", description: "American Cookies", amount: 30.9, category: "Alimentação fora" },
    { id: "mai-alice-30", day: "11/05", type: "entrada", description: "BB Rende Fácil", amount: 357.33, category: "Resgate" },
    { id: "mai-alice-31", day: "13/05", type: "entrada", description: "Compra DBT", amount: 3.3, category: "Receita" },
    { id: "mai-alice-32", day: "13/05", type: "saída", description: "LuMlComercioDe", amount: 61, category: "Alimentação fora" },
    { id: "mai-alice-33", day: "13/05", type: "entrada", description: "BB Rende Fácil", amount: 57.7, category: "Resgate" },
    { id: "mai-alice-34", day: "15/05", type: "saída", description: "Drogasil 1852", amount: 229.06, category: "Saúde" },
    { id: "mai-alice-35", day: "15/05", type: "entrada", description: "BB Rende Fácil", amount: 229.06, category: "Resgate" },
    { id: "mai-alice-36", day: "18/05", type: "saída", description: "F C Bolos do Flavio", amount: 23, category: "Alimentação fora" },
    { id: "mai-alice-37", day: "18/05", type: "saída", description: "Cascol Combustiveis", amount: 124.7, category: "Transporte" },
    { id: "mai-alice-38", day: "18/05", type: "entrada", description: "BB Rende Fácil", amount: 147.7, category: "Resgate" },
    { id: "mai-alice-39", day: "19/05", type: "saída", description: "Growth Supplements", amount: 173.25, category: "Saúde" },
    { id: "mai-alice-40", day: "19/05", type: "saída", description: "Ildeni Aparecida da Costa", amount: 15, category: "Transferências e outros" },
    { id: "mai-alice-41", day: "19/05", type: "entrada", description: "BB Rende Fácil", amount: 188.25, category: "Resgate" },
    { id: "mai-alice-42", day: "20/05", type: "entrada", description: "Recebimento de Proventos", amount: 5503.7, category: "Salário" },
    { id: "mai-alice-43", day: "20/05", type: "saída", description: "Mobile Zone", amount: 34, category: "Extras" },
    { id: "mai-alice-44", day: "20/05", type: "saída", description: "Uber", amount: 57.98, category: "Transporte" },
    { id: "mai-alice-45", day: "20/05", type: "saída", description: "Uber", amount: 70.99, category: "Transporte" },
    { id: "mai-alice-46", day: "20/05", type: "saída", description: "Je Logistica", amount: 6, category: "Financeiro" },
    { id: "mai-alice-47", day: "20/05", type: "saída", description: "Marta Gomes de", amount: 7, category: "Transferências e outros" },
    { id: "mai-alice-48", day: "20/05", type: "saída", description: "BB Crédito Renovação Funci", amount: 1453.64, category: "Empréstimos" },
    { id: "mai-alice-49", day: "20/05", type: "saída", description: "Ourocap PM", amount: 150, category: "Investimentos" },
    { id: "mai-alice-50", day: "20/05", type: "saída", description: "Seguro de Vida", amount: 27.31, category: "Seguros e benefícios" },
    { id: "mai-alice-51", day: "20/05", type: "saída", description: "Brasilprev", amount: 132.41, category: "Investimentos" },
    { id: "mai-alice-52", day: "20/05", type: "saída", description: "Cooperforte", amount: 300, category: "Investimentos" },
    { id: "mai-alice-53", day: "20/05", type: "saída", description: "Clube de beneficios 05/2026", amount: 24, category: "Seguros e benefícios" },
    { id: "mai-alice-54", day: "20/05", type: "saída", description: "Juros Saldo Devedor Conta", amount: 2.8, category: "Financeiro" },
    { id: "mai-alice-55", day: "20/05", type: "saída", description: "BB Rende Fácil", amount: 3237.57, category: "Resgates e caixa" },
    { id: "mai-alice-56", day: "21/05", type: "saída", description: "Ultrabox 24 - Pau Br", amount: 65.69, category: "Alimentação fora" },
    { id: "mai-alice-57", day: "21/05", type: "entrada", description: "BB Rende Fácil", amount: 65.69, category: "Resgate" },
    { id: "mai-alice-58", day: "22/05", type: "entrada", description: "I.Casei Pre", amount: 840, category: "Receita" },
    { id: "mai-alice-59", day: "22/05", type: "saída", description: "Quality Aguas Claras", amount: 234.45, category: "Alimentação fora" },
    { id: "mai-alice-60", day: "22/05", type: "saída", description: "Mateus Vieira da Cruz Roc", amount: 1000, category: "Transferência interna" },
    { id: "mai-alice-61", day: "22/05", type: "saída", description: "BB Crédito Renovação", amount: 422.76, category: "Empréstimos" },
    { id: "mai-alice-62", day: "22/05", type: "entrada", description: "BB Rende Fácil", amount: 817.21, category: "Resgate" },
    { id: "mai-alice-63", day: "24/05", type: "saída", description: "Alice Cony de Cidade Frei", amount: 150, category: "Transferência interna" },
    { id: "mai-alice-64", day: "24/05", type: "entrada", description: "Resgate Fundo BB", amount: 1332.41, category: "Resgate" },
    { id: "mai-alice-65", day: "24/05", type: "entrada", description: "Transferido da poupança", amount: 8.25, category: "Resgate" },
    { id: "mai-alice-66", day: "24/05", type: "saída", description: "Mateus Vieira da Cruz Roc", amount: 1200, category: "Transferência interna" },
    { id: "mai-alice-67", day: "24/05", type: "saída", description: "Mateus Vieira da Cruz Roc", amount: 800, category: "Transferência interna" },
    { id: "mai-alice-68", day: "24/05", type: "saída", description: "Mateus Vieira da Cruz Roc", amount: 500, category: "Transferência interna" },
    { id: "mai-alice-69", day: "24/05", type: "saída", description: "Ricardo Signorini Feldens", amount: 20, category: "Transferências e outros" },
    { id: "mai-alice-70", day: "24/05", type: "saída", description: "Mateus Vieira da Cruz Roc", amount: 1070.86, category: "Transferências e outros" }
  ]
};

monthlyData.mai.loans = {
  totalOutstanding: 0,
  totalMonthlyInstallment: 4582.61,
  contracts: []
};

monthlyData.jun.accountViews.mateus = {
  label: "Mateus",
  balanceToday: 0,
  monthlyIncome: 0,
  monthlySpent: 3100.36,
  fixedSpent: 3100.36,
  variableSpent: 0,
  nextRequired: 3100.36,
  daysCovered: 0,
  message: "Dados reais parciais importados da aba 2026, bloco de junho, colunas EZ (Saída) e FA (Empréstimos).",
  upcomingBills: [
    { due: "03", title: "Bacen Saúde", amount: 796.21, type: "Fixo", status: "Importado da planilha" },
    { due: "08", title: "Condomínio", amount: 1000, type: "Fixo", status: "Importado da planilha" },
    { due: "10", title: "Internet", amount: 123.98, type: "Fixo", status: "Importado da planilha" },
    { due: "20", title: "Celular", amount: 130, type: "Fixo", status: "Importado da planilha" },
    { due: "20", title: "Empréstimo Antonieta", amount: 850, type: "Empréstimo", status: "Importado da planilha" },
    { due: "21", title: "Ativos", amount: 200.17, type: "Empréstimo", status: "Importado da planilha" }
  ],
  categories: [
    { name: "Saúde", amount: 796.21 },
    { name: "Moradia", amount: 1000 },
    { name: "Contas da casa", amount: 253.98 },
    { name: "Empréstimos", amount: 1050.17 }
  ]
};

monthlyData.jun.accountViews.alice = {
  label: "Alice",
  balanceToday: 0,
  monthlyIncome: 0,
  monthlySpent: 3380.68,
  fixedSpent: 3380.68,
  variableSpent: 0,
  nextRequired: 3380.68,
  daysCovered: 0,
  message: "Dados reais parciais importados da aba 2026, bloco de junho, colunas FN (Investimentos), FO (Saída) e FP (Empréstimos).",
  upcomingBills: [
    { due: "21", title: "Cooperforte", amount: 300, type: "Investimento", status: "Importado da planilha" },
    { due: "21", title: "Ourocap", amount: 150, type: "Investimento", status: "Importado da planilha" },
    { due: "21", title: "Brasil Prev", amount: 128.45, type: "Investimento", status: "Importado da planilha" },
    { due: "03", title: "Violão", amount: 255.9, type: "Fixo", status: "Importado da planilha" },
    { due: "21", title: "Seguro de Vida, Clube Benefícios", amount: 172.82, type: "Fixo", status: "Importado da planilha" },
    { due: "22", title: "NuBank", amount: 130, type: "Fixo", status: "Importado da planilha" },
    { due: "23", title: "Energia", amount: 367.11, type: "Fixo", status: "Importado da planilha" },
    { due: "20", title: "Sem descrição na planilha", amount: 1453.64, type: "Empréstimo", status: "Importado da planilha" },
    { due: "22", title: "Sem descrição na planilha", amount: 422.76, type: "Empréstimo", status: "Importado da planilha" }
  ],
  categories: [
    { name: "Empréstimos", amount: 1876.4 },
    { name: "Investimentos", amount: 578.45 },
    { name: "Contas da casa", amount: 367.11 },
    { name: "Extras", amount: 255.9 },
    { name: "Seguros e benefícios", amount: 172.82 },
    { name: "Financeiro", amount: 130 }
  ]
};

monthlyData.jun.investments = {
  totalSaved: 0,
  monthlyContribution: 578.45,
  emergency6mTarget: 0,
  emergency12mTarget: 0,
  accounts: [
    { name: "Cooperforte", institution: "Alice", amount: 300, note: "Importado da planilha de junho" },
    { name: "Ourocap", institution: "Alice", amount: 150, note: "Importado da planilha de junho" },
    { name: "Brasil Prev", institution: "Alice", amount: 128.45, note: "Importado da planilha de junho" }
  ]
};

monthlyData.jun.loans = {
  totalOutstanding: 0,
  totalMonthlyInstallment: 2926.57,
  contracts: []
};

export const financeData = {
  metadata: {
    year: 2026,
    sourceOfTruth: "dashboard-local-data",
    referenceOnlySources: ["planilha-2026-xlsx"],
    notes: [
      "A planilha e outros arquivos externos servem apenas como referência de importação.",
      "A fonte de verdade do dashboard fica neste arquivo até definirmos outra persistência."
    ]
  },
  months,
  monthlyData
};
