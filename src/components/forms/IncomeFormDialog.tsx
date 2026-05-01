import { useState, useEffect } from "react";
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
import { getFifthBusinessDay } from "@/lib/finance-utils";

const schema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(100),
  amount: z.number().positive("Valor deve ser maior que zero"),
  received_date: z.string().min(1, "Data obrigatória"),
  income_type: z.enum(["salario", "freelance", "investimento", "outro"]),
  is_recurring: z.boolean(),
});

interface Props { open: boolean; onOpenChange: (o: boolean) => void; income?: any; }

export const IncomeFormDialog = ({ open, onOpenChange, income }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", amount: "", received_date: new Date().toISOString().slice(0, 10),
    income_type: "salario" as const, is_recurring: false,
  });

  useEffect(() => {
    if (open) {
      if (income) {
        setForm({
          name: income.name, amount: income.amount.toString(), received_date: income.received_date,
          income_type: income.income_type as any, is_recurring: income.is_recurring,
        });
      } else {
        setForm({ name: "", amount: "", received_date: new Date().toISOString().slice(0, 10), income_type: "salario", is_recurring: false });
      }
    }
  }, [open, income]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({ ...form, amount: Number(form.amount) });
      if (income) {
        const { error } = await supabase.from("incomes").update({
          name: parsed.name,
          amount: parsed.amount,
          received_date: parsed.received_date,
          income_type: parsed.income_type,
          is_recurring: parsed.is_recurring,
        }).eq("id", income.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("incomes").insert([{
          user_id: user!.id,
          name: parsed.name,
          amount: parsed.amount,
          received_date: parsed.received_date,
          income_type: parsed.income_type,
          is_recurring: parsed.is_recurring,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(income ? "Receita atualizada" : "Receita adicionada");
      qc.invalidateQueries({ queryKey: ["incomes"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.errors?.[0]?.message || e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{income ? "Editar Receita" : "Nova Receita"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Salário" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <div className="flex gap-2">
                <Input type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} />
                {form.income_type === "salario" && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, received_date: getFifthBusinessDay() })} title="Preencher com 5º dia útil">
                    5º dia útil
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.income_type} onValueChange={(v: any) => setForm({ ...form, income_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="salario">Salário</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
                <SelectItem value="investimento">Investimento</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="rec">Receita recorrente</Label>
            <Switch id="rec" checked={form.is_recurring} onCheckedChange={(c) => setForm({ ...form, is_recurring: c })} />
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
