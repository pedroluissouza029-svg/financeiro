import { useExpenses, useDebts } from "@/hooks/useFinanceData";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, daysUntil } from "@/lib/finance-utils";
import { Calendar as CalendarIcon, CreditCard, TrendingDown } from "lucide-react";

const Calendario = () => {
  const { data: expenses = [] } = useExpenses();
  const { data: debts = [] } = useDebts();

  type Item = { id: string; name: string; date: string; amount: number; kind: "expense" | "debt"; status?: string };
  const items: Item[] = [
    ...expenses.filter(e => e.status !== "pago").map(e => ({
      id: e.id, name: e.name, date: e.due_date, amount: Number(e.amount), kind: "expense" as const, status: e.status,
    })),
    ...debts.filter(d => d.status !== "quitada").map(d => ({
      id: d.id, name: d.name, date: d.due_date, amount: Number(d.installment_amount), kind: "debt" as const, status: d.status,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <PageHeader title="Calendário de contas" description="Próximos vencimentos">
      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarIcon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhuma conta em aberto 🎉</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const days = daysUntil(item.date);
            const overdue = days < 0;
            const soon = days >= 0 && days <= 3;
            return (
              <Card key={item.kind + item.id} className="p-4 flex items-center gap-4 hover:shadow-soft transition-smooth">
                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                  overdue ? "bg-destructive/10 text-destructive" :
                  soon ? "bg-warning/10 text-warning" :
                  "bg-accent text-accent-foreground"
                }`}>
                  <span className="text-xs font-medium">{new Date(item.date).toLocaleString("pt-BR", { month: "short" }).replace(".", "")}</span>
                  <span className="text-lg font-bold leading-none">{new Date(item.date).getDate()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{item.name}</p>
                    <Badge variant="outline" className="text-xs gap-1">
                      {item.kind === "debt" ? <CreditCard className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {item.kind === "debt" ? "Dívida" : "Despesa"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(item.date)} • {overdue ? `${Math.abs(days)}d atrasada` : days === 0 ? "Vence hoje" : `Em ${days} dia(s)`}
                  </p>
                </div>
                <p className="font-bold shrink-0">{formatCurrency(item.amount)}</p>
              </Card>
            );
          })}
        </div>
      )}
    </PageHeader>
  );
};
export default Calendario;
