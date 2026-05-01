import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { expenseCategories, paymentMethods } from "@/lib/finance-utils";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z.number().positive(),
  category: z.string(),
  due_date: z.string(),
  status: z.enum(["pago", "pendente", "atrasado"]),
  payment_method: z.string().nullable(),
  is_recurring: z.boolean(),
});

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export const ExpenseFormDialog = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", amount: "", category: "Outros",
    due_date: new Date().toISOString().slice(0, 10),
    status: "pendente" as const, payment_method: "Pix", is_recurring: false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({ ...form, amount: Number(form.amount), payment_method: form.payment_method || null });
      const { error } = await supabase.from("expenses").insert([{
        user_id: user!.id,
        name: parsed.name,
        amount: parsed.amount,
        category: parsed.category,
        due_date: parsed.due_date,
        status: parsed.status,
        payment_method: parsed.payment_method ?? undefined,
        is_recurring: parsed.is_recurring,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa adicionada");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      onOpenChange(false);
      setForm({ name: "", amount: "", category: "Outros", due_date: new Date().toISOString().slice(0, 10), status: "pendente", payment_method: "Pix", is_recurring: false });
    },
    onError: (e: any) => toast.error(e.errors?.[0]?.message || e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Aluguel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{paymentMethods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="rec-e">Despesa recorrente</Label>
            <Switch id="rec-e" checked={form.is_recurring} onCheckedChange={(c) => setForm({ ...form, is_recurring: c })} />
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
