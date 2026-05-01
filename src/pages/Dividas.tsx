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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [amortization, setAmortization] = useState<"parcela" | "prazo" | "atual">("parcela");
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
      const expected_total = (debt.total_installments - debt.paid_installments) * Number(debt.installment_amount);
      const partial_accumulated = expected_total - Number(debt.total_amount);
      const amount_to_pay = Number(debt.installment_amount) - partial_accumulated;

      const newPaid = Math.min(debt.paid_installments + 1, debt.total_installments);
      const newStatus = newPaid >= debt.total_installments ? "quitada" : debt.status;
      const newTotal = Math.max(0, debt.total_amount - amount_to_pay);

      const { error } = await supabase.from("debts").update({ 
        paid_installments: newPaid, 
        status: newStatus,
        total_amount: newTotal
      }).eq("id", debt.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Parcela registrada"); qc.invalidateQueries({ queryKey: ["debts"] }); },
  });

  const payPartial = useMutation({
    mutationFn: async ({ debt, amount, type }: { debt: any, amount: number, type: "parcela" | "prazo" }) => {
      const current_remaining = (debt.total_installments - debt.paid_installments) * Number(debt.installment_amount);
      const new_remaining = Math.max(0, current_remaining - amount);
      const newTotal = Math.max(0, debt.total_amount - amount);
      
      let new_total_inst = debt.total_installments;
      let new_inst_amount = Number(debt.installment_amount);
      let new_status = debt.status;
      let new_paid = debt.paid_installments;

      if (new_remaining === 0) {
        new_status = "quitada";
        new_paid = debt.total_installments;
      } else {
        if (type === "atual") {
          const expected_total = (debt.total_installments - debt.paid_installments) * Number(debt.installment_amount);
          const accumulated_partial = expected_total - Number(debt.total_amount);
          const total_partial_now = accumulated_partial + amount;
          const installments_to_add = Math.floor(total_partial_now / Number(debt.installment_amount));
          
          if (installments_to_add > 0) {
            new_paid += installments_to_add;
            if (new_paid >= debt.total_installments) {
              new_paid = debt.total_installments;
              new_status = "quitada";
            }
          }
        } else if (type === "parcela") {
          const rem_inst = debt.total_installments - debt.paid_installments;
          new_inst_amount = new_remaining / rem_inst;
        } else {
          const rem_inst = Math.ceil(new_remaining / Number(debt.installment_amount));
          new_total_inst = debt.paid_installments + rem_inst;
          new_inst_amount = new_remaining / rem_inst;
        }
      }

      const { error } = await supabase.from("debts").update({ 
        total_installments: new_total_inst,
        installment_amount: new_inst_amount,
        status: new_status,
        paid_installments: new_paid,
        total_amount: newTotal
      }).eq("id", debt.id);
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Abatimento inteligente realizado!"); 
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
              const expected_total = (d.total_installments - d.paid_installments) * Number(d.installment_amount);
              const remaining = expected_total;
              
              const diff = Math.round((expected_total - Number(d.total_amount)) * 100) / 100;
              const partial = Math.max(0, diff);
              const current_installment = Number(d.installment_amount) - partial;

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
                      <p className="text-xs text-muted-foreground">Parcela atual</p>
                      <p className="font-semibold">
                        {formatCurrency(current_installment)}
                        {partial > 0 && <span className="text-[10px] block text-success font-normal">(-{formatCurrency(partial)})</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Restante</p>
                      <p className="font-semibold">{formatCurrency(Number(d.total_amount))}</p>
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
          <DialogHeader><DialogTitle>Abatimento Inteligente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor do abatimento / pago (R$)</Label>
              <Input type="number" step="0.01" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} placeholder="Ex: 50.00" />
            </div>
            <div className="space-y-2">
              <Label>Como deseja recalcular a dívida?</Label>
              <Select value={amortization} onValueChange={(v: any) => setAmortization(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atual">Abater apenas da parcela atual</SelectItem>
                  <SelectItem value="parcela">Reduzir o valor das próximas parcelas</SelectItem>
                  <SelectItem value="prazo">Reduzir o número de parcelas (Prazo)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                O sistema irá recalcular automaticamente o restante da dívida conforme a sua escolha.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialDebt(null)}>Cancelar</Button>
            <Button onClick={() => payPartial.mutate({ debt: partialDebt, amount: Number(partialAmount), type: amortization })} disabled={!partialAmount || payPartial.isPending}>
              {payPartial.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Recalcular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageHeader>
  );
};
export default Dividas;
