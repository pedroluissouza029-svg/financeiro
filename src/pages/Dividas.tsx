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
import { useExpenses } from "@/hooks/useFinanceData";
import { isInCurrentMonth } from "@/lib/finance-utils";
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
  const [amortization, setAmortization] = useState<"parcela" | "prazo" | "atual">("atual");
  const { data: debts = [], isLoading: loadingDebts, isError: errorDebts } = useDebts();
  const { data: expenses = [], isLoading: loadingExpenses, isError: errorExpenses } = useExpenses();
  const qc = useQueryClient();
  const isLoading = loadingDebts || loadingExpenses;
  const isError = errorDebts || errorExpenses;

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["debts"] }); },
  });

  const payInstallment = useMutation({
    mutationFn: async (debt: any) => {
      const debtPartials = expenses.filter(e => 
        e.payment_method === `debt:${debt.id}` && 
        e.category === "Amortização" &&
        isInCurrentMonth(e.due_date)
      );
      const partialPaid = debtPartials.reduce((sum, e) => sum + Number(e.amount), 0);
      const amountToPay = Math.max(0, Number(debt.installment_amount) - partialPaid);

      const newPaid = Math.min(debt.paid_installments + 1, debt.total_installments);
      const newStatus = newPaid >= debt.total_installments ? "quitada" : debt.status;
      const newTotal = Math.max(0, Number(debt.total_amount) - amountToPay);

      const { error } = await supabase.from("debts").update({ 
        paid_installments: newPaid, 
        status: newStatus,
        total_amount: newTotal
      }).eq("id", debt.id);
      if (error) throw error;

      // Register the payment of the rest of the installment as a normal expense too?
      // Optional, but for consistency let's do it.
      await supabase.from("expenses").insert([{
        user_id: (await supabase.auth.getUser()).data.user!.id,
        name: `Parcela: ${debt.name}`,
        amount: amountToPay,
        category: "Dívida",
        due_date: new Date().toISOString().slice(0, 10),
        status: "pago"
      }]);
    },
    onSuccess: () => { 
      toast.success("Parcela registrada"); 
      qc.invalidateQueries({ queryKey: ["debts"] }); 
      qc.invalidateQueries({ queryKey: ["expenses"] }); 
    },
  });

  const payPartial = useMutation({
    mutationFn: async ({ debt, amount, type }: { debt: any, amount: number, type: "parcela" | "prazo" | "atual" }) => {
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
          // No need to change paid_installments or inst_amount here.
          // We will track the deduction via a linked expense.
          const { error: expError } = await supabase.from("expenses").insert([{
            user_id: (await supabase.auth.getUser()).data.user!.id,
            name: `Abatimento: ${debt.name}`,
            amount: amount,
            category: "Amortização",
            due_date: new Date().toISOString().slice(0, 10),
            status: "pago",
            payment_method: `debt:${debt.id}`
          }]);
          if (expError) throw expError;
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
      toast.success("Abatimento registrado com sucesso!"); 
      qc.invalidateQueries({ queryKey: ["debts"] }); 
      qc.invalidateQueries({ queryKey: ["expenses"] }); 
      setPartialDebt(null);
      setPartialAmount("");
    },
  });

  return (
    <PageHeader title="Dívidas" description="Acompanhe parcelas e financiamentos" action={{ label: "Nova dívida", onClick: () => setOpen(true) }}>
      {isError ? (
        <Card className="p-6 border-destructive/50 bg-destructive/5">
          <p className="text-destructive font-medium">Erro ao carregar os dados. Por favor, recarregue a página.</p>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p>Carregando dívidas…</p>
        </div>
      ) :
        debts.length === 0 ? (
          <Card className="p-12 text-center">
            <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma dívida cadastrada</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {debts.map((d) => {
              const progress = (d.paid_installments / d.total_installments) * 100;
              const remaining = Number(d.total_amount);
              
              const debtPartials = expenses.filter(e => 
                e.payment_method === `debt:${d.id}` && 
                e.category === "Amortização" &&
                isInCurrentMonth(e.due_date)
              );
              const partialPaidThisMonth = debtPartials.reduce((sum, e) => sum + Number(e.amount), 0);
              const current_installment = Math.max(0, Number(d.installment_amount) - partialPaidThisMonth);

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
                        {partialPaidThisMonth > 0 && <span className="text-[10px] block text-success font-normal">(-{formatCurrency(partialPaidThisMonth)})</span>}
                      </p>
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
                  <SelectItem value="atual">Abater valor da parcela atual</SelectItem>
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
