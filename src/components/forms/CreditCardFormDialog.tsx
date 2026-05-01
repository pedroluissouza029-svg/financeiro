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
import { creditCardBanks } from "@/lib/finance-utils";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z.number().positive(),
  category: z.string(),
  due_date: z.string(),
  status: z.enum(["pago", "pendente", "atrasado"]),
  payment_method: z.string().nullable(),
  is_recurring: z.boolean(),
});

interface Props { open: boolean; onOpenChange: (o: boolean) => void; invoice?: any; }

export const CreditCardFormDialog = ({ open, onOpenChange, invoice }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "Nubank", amount: "", category: "Cartão de Crédito",
    due_date: new Date().toISOString().slice(0, 10),
    status: "pendente" as const, payment_method: "Boleto", is_recurring: false,
  });
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    if (open) {
      if (invoice) {
        const isKnown = creditCardBanks.includes(invoice.name);
        setIsCustom(!isKnown);
        setForm({
          name: invoice.name, amount: invoice.amount.toString(), category: "Cartão de Crédito",
          due_date: invoice.due_date, status: invoice.status as any, payment_method: invoice.payment_method || "Boleto",
          is_recurring: invoice.is_recurring,
        });
      } else {
        setIsCustom(false);
        setForm({ name: "Nubank", amount: "", category: "Cartão de Crédito", due_date: new Date().toISOString().slice(0, 10), status: "pendente", payment_method: "Boleto", is_recurring: false });
      }
    }
  }, [open, invoice]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({ ...form, amount: Number(form.amount), payment_method: form.payment_method || null });
      if (invoice) {
        const { error } = await supabase.from("expenses").update({
          name: parsed.name, amount: parsed.amount, category: parsed.category,
          due_date: parsed.due_date, status: parsed.status, payment_method: parsed.payment_method ?? undefined,
          is_recurring: parsed.is_recurring,
        }).eq("id", invoice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert([{
          user_id: user!.id, name: parsed.name, amount: parsed.amount, category: parsed.category,
          due_date: parsed.due_date, status: parsed.status, payment_method: parsed.payment_method ?? undefined,
          is_recurring: parsed.is_recurring,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(invoice ? "Fatura atualizada" : "Fatura adicionada");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.errors?.[0]?.message || e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{invoice ? "Editar Fatura" : "Nova Fatura de Cartão"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Banco / Operadora</Label>
              {isCustom ? (
                <div className="flex gap-2">
                  <Input 
                    value={form.name} 
                    onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    placeholder="Digite o banco..."
                    autoFocus
                  />
                  <Button type="button" variant="outline" onClick={() => { setIsCustom(false); setForm({ ...form, name: "Nubank" }); }}>
                    Lista
                  </Button>
                </div>
              ) : (
                <Select value={form.name} onValueChange={(v) => {
                  if (v === "Outro") {
                    setIsCustom(true);
                    setForm({ ...form, name: "" });
                  } else {
                    setForm({ ...form, name: v });
                  }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {creditCardBanks.map(b => b !== "Outro" && <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    <SelectItem value="Outro">Outro (Digitar manual)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Valor da Fatura (R$)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Vencimento</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>

          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="rec-c">Fatura recorrente (todo mês)</Label>
            <Switch id="rec-c" checked={form.is_recurring} onCheckedChange={(c) => setForm({ ...form, is_recurring: c })} />
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
