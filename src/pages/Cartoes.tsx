import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useExpenses } from "@/hooks/useFinanceData";
import { PageHeader } from "@/components/PageHeader";
import { CreditCardFormDialog } from "@/components/forms/CreditCardFormDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, daysUntil } from "@/lib/finance-utils";
import { Trash2, CreditCard, Repeat, CheckCircle2, Clock, AlertCircle, Edit2 } from "lucide-react";
import { toast } from "sonner";

const statusConfig = {
  pago: { label: "Paga", icon: CheckCircle2, className: "bg-success/10 text-success border-success/20" },
  pendente: { label: "Aberta", icon: Clock, className: "bg-warning/10 text-warning border-warning/20" },
  atrasado: { label: "Atrasada", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const Cartoes = () => {
  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [filter, setFilter] = useState<string>("todos");
  const { data: expenses = [], isLoading } = useExpenses();
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fatura removida"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase.from("expenses").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const cartoes = expenses.filter(e => e.category === "Cartão de Crédito" || e.category === "Cartão");
  const filtered = filter === "todos" ? cartoes : cartoes.filter((e) => e.status === filter);

  const groupedCards = filtered.reduce((acc, e) => {
    if (!acc[e.name]) acc[e.name] = [];
    acc[e.name].push(e);
    return acc;
  }, {} as Record<string, typeof filtered>);

  return (
    <PageHeader title="Cartões de Crédito" description="Acompanhe suas faturas" action={{ label: "Nova fatura", onClick: () => setOpen(true) }}>
      <div className="flex gap-2 flex-wrap">
        {["todos", "pendente", "pago", "atrasado"].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize">
            {s === "todos" ? "Todas" : s === "pendente" ? "Abertas" : s === "pago" ? "Pagas" : "Atrasadas"}
          </Button>
        ))}
      </div>
      {isLoading ? <p className="text-muted-foreground">Carregando…</p> :
        filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedCards).map(([cardName, invoices]) => (
              <div key={cardName} className="space-y-3">
                <h3 className="text-lg font-bold flex items-center gap-2 px-1">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Cartão {cardName}
                </h3>
                <div className="grid gap-3">
                  {invoices.map((e) => {
                    const cfg = statusConfig[e.status as keyof typeof statusConfig] || statusConfig.pendente;
                    const days = daysUntil(e.due_date);
                    return (
                      <Card key={e.id} className="p-4 hover:shadow-soft transition-smooth">
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${cfg.className}`}>
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold truncate">Fatura {formatDate(e.due_date).substring(3)}</p>
                              {e.is_recurring && <Badge variant="outline" className="text-xs gap-1"><Repeat className="w-3 h-3" /></Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Vencimento {formatDate(e.due_date)}
                              {e.status !== "pago" && (
                                <span className={days < 0 ? "text-destructive ml-1" : days <= 3 ? "text-warning ml-1" : "ml-1"}>
                                  • {days < 0 ? `${Math.abs(days)}d atrasada` : days === 0 ? "hoje" : `em ${days}d`}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold">{formatCurrency(Number(e.amount))}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Button 
                            variant={e.status === "pago" ? "secondary" : "default"} 
                            size="sm" 
                            onClick={() => updateStatus.mutate({ id: e.id, status: e.status === "pago" ? "pendente" : "pago" })}
                            className="h-8 text-xs"
                          >
                            {e.status === "pago" ? "Reverter Pagamento" : "Marcar como Pago"}
                          </Button>
                          <div className="ml-auto flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingInvoice(e); setOpen(true); }}>
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
              </div>
            ))}
          </div>
        )
      }
      <CreditCardFormDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingInvoice(null); }} invoice={editingInvoice} />
    </PageHeader>
  );
};
export default Cartoes;
