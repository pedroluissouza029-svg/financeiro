import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebts } from "@/hooks/useFinanceData";
import { PageHeader } from "@/components/PageHeader";
import { DebtFormDialog } from "@/components/forms/DebtFormDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate } from "@/lib/finance-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Trash2, CreditCard, Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const statusBadge: Record<string, string> = {
  em_dia: "bg-success/10 text-success border-success/20",
  atrasada: "bg-destructive/10 text-destructive border-destructive/20",
  quitada: "bg-muted text-muted-foreground",
};
const statusLabel: Record<string, string> = { em_dia: "Em dia", atrasada: "Atrasada", quitada: "Quitada" };

const Dividas = () => {
  const [open, setOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<any>(null);
  const [partialDebt, setPartialDebt] = useState<any>(null);
  const [partialAmount, setPartialAmount] = useState("");
  const { data: debts = [], isLoading } = useDebts();
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["debts"] }); },
  });

  const payInstallment = useMutation({
    mutationFn: async (debt: any) => {
      const newPaid = Math.min(debt.paid_installments + 1, debt.total_installments);
      const newStatus = newPaid >= debt.total_installments ? "quitada" : debt.status;
      const { error } = await supabase.from("debts").update({ paid_installments: newPaid, status: newStatus }).eq("id", debt.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Parcela registrada"); qc.invalidateQueries({ queryKey: ["debts"] }); },
  });

  const payPartial = useMutation({
    mutationFn: async ({ debt, amount }: { debt: any, amount: number }) => {
      const newTotal = Math.max(0, debt.total_amount - amount);
      const { error } = await supabase.from("debts").update({ total_amount: newTotal }).eq("id", debt.id);
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Pagamento parcial abatido com sucesso!"); 
      qc.invalidateQueries({ queryKey: ["debts"] }); 
      setPartialDebt(null);
      setPartialAmount("");
    },
  });

  return (
    <PageHeader title="Dívidas" description="Acompanhe parcelas e financiamentos" action={{ label: "Nova dívida", onClick: () => setOpen(true) }}>
      {isLoading ? <p className="text-muted-foreground">Carregando…</p> :
        debts.length === 0 ? (
          <Card className="p-12 text-center">
            <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma dívida cadastrada</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {debts.map((d) => {
              const progress = (d.paid_installments / d.total_installments) * 100;
              const remaining = Math.max(0, Number(d.total_amount) - (d.paid_installments * Number(d.installment_amount)));
              return (
                <Card key={d.id} className="p-5 hover:shadow-soft transition-smooth">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{d.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Vence {formatDate(d.due_date)}</p>
                    </div>
                    <Badge variant="outline" className={statusBadge[d.status]}>{statusLabel[d.status]}</Badge>
                  </div>
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{d.paid_installments}/{d.total_installments} parcelas</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm py-3 border-y">
                    <div>
                      <p className="text-xs text-muted-foreground">Parcela</p>
                      <p className="font-semibold">{formatCurrency(Number(d.installment_amount))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Restante</p>
                      <p className="font-semibold">{formatCurrency(remaining)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1" disabled={d.status === "quitada"} onClick={() => payInstallment.mutate(d)}>
                      Pagar parcela
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" disabled={d.status === "quitada"} onClick={() => setPartialDebt(d)}>
                      Pgto Parcial
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditingDebt(d); setOpen(true); }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(d.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      }
      <DebtFormDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingDebt(null); }} debt={editingDebt} />
      
      <Dialog open={!!partialDebt} onOpenChange={(o) => !o && setPartialDebt(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagamento Parcial</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor pago (R$)</Label>
              <Input type="number" step="0.01" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} placeholder="Ex: 50.00" />
              <p className="text-xs text-muted-foreground mt-2">
                O valor informado será deduzido do montante total da dívida, mantendo o número de parcelas.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialDebt(null)}>Cancelar</Button>
            <Button onClick={() => payPartial.mutate({ debt: partialDebt, amount: Number(partialAmount) })} disabled={!partialAmount || payPartial.isPending}>
              {payPartial.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Abater Valor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageHeader>
  );
};
export default Dividas;
