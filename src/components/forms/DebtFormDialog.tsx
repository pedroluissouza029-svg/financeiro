import { useState } from "react";
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

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export const DebtFormDialog = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", total_amount: "", installment_amount: "",
    total_installments: "", paid_installments: "0",
    due_date: new Date().toISOString().slice(0, 10),
    status: "em_dia" as const,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        ...form,
        total_amount: Number(form.total_amount),
        installment_amount: Number(form.installment_amount),
        total_installments: Number(form.total_installments),
        paid_installments: Number(form.paid_installments),
      });
      const { error } = await supabase.from("debts").insert([{
        user_id: user!.id,
        name: parsed.name,
        total_amount: parsed.total_amount,
        installment_amount: parsed.installment_amount,
        total_installments: parsed.total_installments,
        paid_installments: parsed.paid_installments,
        due_date: parsed.due_date,
        status: parsed.status,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dívida adicionada");
      qc.invalidateQueries({ queryKey: ["debts"] });
      onOpenChange(false);
      setForm({ name: "", total_amount: "", installment_amount: "", total_installments: "", paid_installments: "0", due_date: new Date().toISOString().slice(0, 10), status: "em_dia" });
    },
    onError: (e: any) => toast.error(e.errors?.[0]?.message || e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova Dívida</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Financiamento" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor total (R$)</Label>
              <Input type="number" step="0.01" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Valor da parcela (R$)</Label>
              <Input type="number" step="0.01" value={form.installment_amount} onChange={(e) => setForm({ ...form, installment_amount: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Total de parcelas</Label>
              <Input type="number" value={form.total_installments} onChange={(e) => setForm({ ...form, total_installments: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Parcelas pagas</Label>
              <Input type="number" value={form.paid_installments} onChange={(e) => setForm({ ...form, paid_installments: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Próximo vencimento</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_dia">Em dia</SelectItem>
                  <SelectItem value="atrasada">Atrasada</SelectItem>
                  <SelectItem value="quitada">Quitada</SelectItem>
                </SelectContent>
              </Select>
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
