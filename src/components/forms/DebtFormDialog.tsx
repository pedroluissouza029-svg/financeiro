import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  total_amount: z.number().positive(),
  installment_amount: z.number().positive(),
  total_installments: z.number().int().positive(),
  paid_installments: z.number().int().min(0),
  due_date: z.string(),
  status: z.enum(["em_dia", "atrasada", "quitada"]),
});

interface Props { open: boolean; onOpenChange: (o: boolean) => void; debt?: any; }

export const DebtFormDialog = ({ open, onOpenChange, debt }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", total_amount: "", installment_amount: "",
    total_installments: "", paid_installments: "0",
    due_date: new Date().toISOString().slice(0, 10),
    status: "em_dia" as const,
  });

  useEffect(() => {
    if (open) {
      if (debt) {
        const originalTotal = debt.total_amount + (debt.paid_installments * debt.installment_amount);
        setForm({
          name: debt.name, total_amount: originalTotal.toString(), installment_amount: debt.installment_amount.toString(),
          total_installments: debt.total_installments.toString(), paid_installments: debt.paid_installments.toString(),
          due_date: debt.due_date, status: debt.status as any,
        });
      } else {
        setForm({ name: "", total_amount: "", installment_amount: "", total_installments: "", paid_installments: "0", due_date: new Date().toISOString().slice(0, 10), status: "em_dia" });
      }
    }
  }, [open, debt]);

  const handleFieldChange = (field: "total_amount" | "installment_amount" | "total_installments" | "paid_installments", value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      const totalAmt = parseFloat(field === "total_amount" ? value : prev.total_amount) || 0;
      const totalInst = parseInt(field === "total_installments" ? value : prev.total_installments) || 0;

      if (field === "total_amount" || field === "total_installments") {
        if (totalInst > 0 && totalAmt > 0) {
          next.installment_amount = (totalAmt / totalInst).toFixed(2);
        }
      } 
      else if (field === "installment_amount") {
        const instAmt = parseFloat(value) || 0;
        if (totalAmt > 0 && instAmt > 0) {
          next.total_installments = Math.ceil(totalAmt / instAmt).toString();
        }
      }
      return next;
    });
  };

  const currentRemaining = Math.max(0, (parseFloat(form.total_amount) || 0) - ((parseInt(form.paid_installments) || 0) * (parseFloat(form.installment_amount) || 0)));

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        ...form,
        total_amount: currentRemaining,
        installment_amount: Number(form.installment_amount),
        total_installments: Number(form.total_installments),
        paid_installments: Number(form.paid_installments),
      });
      if (debt) {
        const { error } = await supabase.from("debts").update({
          name: parsed.name, total_amount: parsed.total_amount, installment_amount: parsed.installment_amount,
          total_installments: parsed.total_installments, paid_installments: parsed.paid_installments,
          due_date: parsed.due_date, status: parsed.status,
        }).eq("id", debt.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("debts").insert([{
          user_id: user!.id, name: parsed.name, total_amount: parsed.total_amount, installment_amount: parsed.installment_amount,
          total_installments: parsed.total_installments, paid_installments: parsed.paid_installments,
          due_date: parsed.due_date, status: parsed.status,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(debt ? "Dívida atualizada" : "Dívida adicionada");
      qc.invalidateQueries({ queryKey: ["debts"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.errors?.[0]?.message || e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{debt ? "Editar Dívida" : "Nova Dívida"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Financiamento" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor Total da Dívida (Original)</Label>
              <Input type="number" step="0.01" value={form.total_amount} onChange={(e) => handleFieldChange("total_amount", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor da parcela (R$)</Label>
              <Input type="number" step="0.01" value={form.installment_amount} onChange={(e) => handleFieldChange("installment_amount", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Total de parcelas</Label>
              <Input type="number" value={form.total_installments} onChange={(e) => handleFieldChange("total_installments", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Parcelas pagas</Label>
              <Input type="number" value={form.paid_installments} onChange={(e) => handleFieldChange("paid_installments", e.target.value)} />
            </div>
          </div>
          <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 space-y-1">
            <Label className="text-primary text-xs uppercase font-bold tracking-wider">Saldo Devedor Restante</Label>
            <p className="text-2xl font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentRemaining)}</p>
            <p className="text-[10px] text-muted-foreground italic">Calculado automaticamente com base nas parcelas pagas.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Próximo vencimento</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>

          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
