export function getRelationshipTypeMeta(value?: string | null) {
  switch ((value || "").trim()) {
    case "partner":
      return { label: "Parceiro", shortLabel: "Parceiro", className: "border-violet-200/80 bg-violet-50/90 text-violet-700" };
    case "courtesy":
      return { label: "Cortesia", shortLabel: "Cortesia", className: "border-cyan-200/80 bg-cyan-50/90 text-cyan-700" };
    case "internal":
      return { label: "Interno", shortLabel: "Interno", className: "border-zinc-200/80 bg-zinc-100/90 text-zinc-700" };
    case "trial":
      return { label: "Teste", shortLabel: "Teste", className: "border-amber-200/80 bg-amber-50/90 text-amber-700" };
    case "demo":
      return { label: "Demo", shortLabel: "Demo", className: "border-sky-200/80 bg-sky-50/90 text-sky-700" };
    default:
      return { label: "Cliente pagante", shortLabel: "Pagante", className: "border-sky-200/80 bg-sky-50/90 text-sky-700" };
  }
}

export function getBillingStatusMeta(value?: string | null) {
  switch ((value || "").trim()) {
    case "active":
      return { label: "Pago", shortLabel: "Pago", className: "border-emerald-200/80 bg-emerald-50/90 text-emerald-700" };
    case "trialing":
      return { label: "Trial", shortLabel: "Trial", className: "border-amber-200/80 bg-amber-50/90 text-amber-700" };
    case "past_due":
      return { label: "Em atraso", shortLabel: "Em atraso", className: "border-orange-200/80 bg-orange-50/90 text-orange-700" };
    case "unpaid":
      return { label: "Inadimplente", shortLabel: "Inadimplente", className: "border-rose-200/80 bg-rose-50/90 text-rose-700" };
    case "canceled":
      return { label: "Cancelado", shortLabel: "Cancelado", className: "border-zinc-200/80 bg-zinc-100/90 text-zinc-700" };
    case "incomplete":
      return { label: "Incompleto", shortLabel: "Incompleto", className: "border-slate-200/80 bg-slate-100/90 text-slate-700" };
    case "incomplete_expired":
      return { label: "Expirado", shortLabel: "Expirado", className: "border-zinc-200/80 bg-zinc-100/90 text-zinc-700" };
    case "paused":
      return { label: "Pausado", shortLabel: "Pausado", className: "border-sky-200/80 bg-sky-50/90 text-sky-700" };
    case "inactive":
      return { label: "Sem cobrança", shortLabel: "Sem cobrança", className: "border-slate-200/80 bg-slate-50/90 text-slate-700" };
    default:
      return { label: "Sem cobrança", shortLabel: "Sem cobrança", className: "border-slate-200/80 bg-slate-50/90 text-slate-700" };
  }
}
