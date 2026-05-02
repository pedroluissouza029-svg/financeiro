import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/finance-utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: any;
}

export const PartialPaymentDialog = ({ open, onOpenChange, invoice }: Props) => {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const remaining = Number(invoice?.amount || 0) - Number(invoice?.paid_amount || 0);

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const paymentValue = Number(value);
      if (isNaN(paymentValue) || paymentValue <= 0) throw new Error("Valor inválido");
      if (paymentValue > remaining) throw new Error("Valor maior que o saldo restante");

      const newPaidAmount = Number(invoice.paid_amount || 0) + paymentValue;
      const isFullyPaid = Math.abs(remaining - paymentValue) < 0.01;

      const { error } = await supabase.from("expenses").update({
        paid_amount: newPaidAmount,
        status: isFullyPaid ? "pago" : "pendente"
      }).eq("id", invoice.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento parcial registrado!");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Pagamento Parcial
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted/50 p-3 rounded-lg space-y-1">
            <p className="text-xs text-muted-foreground uppercase font-bold">Resumo da Fatura</p>
            <div className="flex justify-between text-sm">
              <span>Total:</span>
              <span className="font-semibold">{formatCurrency(Number(invoice?.amount))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Já pago:</span>
              <span className="font-semibold text-success">{formatCurrency(Number(invoice?.paid_amount || 0))}</span>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t">
              <span className="font-bold">Restante:</span>
              <span className="font-bold text-primary">{formatCurrency(remaining)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-value">Quanto deseja pagar agora?</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input 
                id="pay-value"
                type="number" 
                step="0.01" 
                value={value} 
                onChange={(e) => setValue(e.target.value)} 
                className="pl-9"
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[10px] h-7"
                onClick={() => setValue((remaining / 2).toFixed(2))}
              >
                50% ({(remaining / 2).toFixed(2)})
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[10px] h-7"
                onClick={() => setValue(remaining.toFixed(2))}
              >
                Total ({remaining.toFixed(2)})
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !value}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
