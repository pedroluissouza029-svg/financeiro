import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useExpenses } from "@/hooks/useFinanceData";
import { PageHeader } from "@/components/PageHeader";
import { ExpenseFormDialog } from "@/components/forms/ExpenseFormDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, daysUntil } from "@/lib/finance-utils";
import { Trash2, TrendingDown, Repeat, CheckCircle2, Clock, AlertCircle, Edit2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const statusConfig = {
  pago: { label: "Pago", icon: CheckCircle2, className: "bg-success/10 text-success border-success/20" },
  pendente: { label: "Pendente", icon: Clock, className: "bg-warning/10 text-warning border-warning/20" },
  atrasado: { label: "Atrasado", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const Despesas = () => {
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [filter, setFilter] = useState<string>("todos");
  const { data: expenses = [], isLoading } = useExpenses();
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase.from("expenses").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const filtered = filter === "todos" ? expenses : expenses.filter((e) => e.status === filter);

  return (
    <PageHeader title="Despesas" description="O que você precisa pagar" action={{ label: "Nova despesa", onClick: () => setOpen(true) }}>
      <div className="flex gap-2 flex-wrap">
        {["todos", "pendente", "pago", "atrasado"].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize">
            {s === "todos" ? "Todas" : s}
          </Button>
        ))}
      </div>
      {isLoading ? <p className="text-muted-foreground">Carregando…</p> :
        filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <TrendingDown className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma despesa</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((e) => {
              const cfg = statusConfig[e.status];
              const StIcon = cfg.icon;
              const days = daysUntil(e.due_date);
              return (
                <Card key={e.id} className="p-4 hover:shadow-soft transition-smooth">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${cfg.className}`}>
                      <StIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{e.name}</p>
                        <Badge variant="secondary" className="text-xs">{e.category}</Badge>
                        {e.is_recurring && <Badge variant="outline" className="text-xs gap-1"><Repeat className="w-3 h-3" /></Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vence em {formatDate(e.due_date)}
                        {e.status !== "pago" && (
                          <span className={days < 0 ? "text-destructive ml-1" : days <= 3 ? "text-warning ml-1" : "ml-1"}>
                            • {days < 0 ? `${Math.abs(days)}d atrasada` : days === 0 ? "hoje" : `em ${days}d`}
                          </span>
                        )}
                        {e.payment_method && ` • ${e.payment_method}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{formatCurrency(Number(e.amount))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Select value={e.status} onValueChange={(v) => updateStatus.mutate({ id: e.id, status: v })}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="atrasado">Atrasado</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingExpense(e); setOpen(true); }}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => del.mutate(e.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      }
      <ExpenseFormDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingExpense(null); }} expense={editingExpense} />
    </PageHeader>
  );
};
export default Despesas;
