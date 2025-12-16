import { CheckCircle, Shield, Database, Users, MessageSquare, Lock } from "lucide-react";

interface Rule {
  icon: React.ElementType;
  text: string;
  active: boolean;
}

const rules: Rule[] = [
  { icon: Database, text: "DB e Auth exclusivamente Supabase externo", active: true },
  { icon: Shield, text: "Sem Lovable Cloud DB", active: true },
  { icon: Lock, text: "Sem schemas/tabelas fora do Supabase", active: true },
  { icon: Users, text: "Admin apenas visualiza dados existentes", active: true },
  { icon: MessageSquare, text: "Members e Messages dentro de Group", active: true },
  { icon: CheckCircle, text: "Permissões via RLS no Supabase", active: true },
];

export function RulesCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-card-foreground">Regras do Contexto Oficial</h3>
      </div>
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg bg-secondary/30 px-3 py-2.5"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-success/10">
              <CheckCircle className="h-4 w-4 text-success" />
            </div>
            <span className="text-sm text-muted-foreground">{rule.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
