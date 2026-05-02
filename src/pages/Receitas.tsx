import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIncomes } from "@/hooks/useFinanceData";
import { PageHeader } from "@/components/PageHeader";
import { IncomeFormDialog } from "@/components/forms/IncomeFormDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, daysUntil } from "@/lib/finance-utils";
import { Trash2, TrendingUp, Repeat, Edit2 } from "lucide-react";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  salario: "Salário", freelance: "Freelance", investimento: "Investimento", outro: "Outro",
};

const Receitas = () => {
  const [open, setOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<any>(null);
  const { data: incomes = [], isLoading } = useIncomes();
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("incomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["incomes"] }); },
  });

  return (
    <PageHeader title="Receitas" description="Tudo que entra na sua conta" action={{ label: "Nova receita", onClick: () => setOpen(true) }}>
      {isLoading ? <p className="text-muted-foreground">Carregando…</p> :
        incomes.length === 0 ? (
          <Card className="p-12 text-center">
            <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma receita cadastrada ainda</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {incomes.map((i) => (
              <Card key={i.id} className="p-4 hover:shadow-soft transition-smooth flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{i.name}</p>
                    <Badge variant="secondary" className="text-xs">{typeLabels[i.income_type]}</Badge>
                    {i.status === "recebido" 
                      ? <Badge className="bg-success/10 text-success border-success/20">Recebida</Badge>
                      : <Badge className="bg-warning/10 text-warning border-warning/20">Pendente</Badge>
                    }
                    {i.is_recurring && <Badge variant="outline" className="text-xs gap-1"><Repeat className="w-3 h-3" />Recorrente</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Previsão: {formatDate(i.received_date)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-success leading-none">{formatCurrency(Number(i.amount))}</p>
                    {Math.abs(Number(i.expected_amount || i.amount) - Number(i.amount)) > 0.01 && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Esperado: {formatCurrency(Number(i.expected_amount))}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={i.status === "recebido" ? "outline" : "default"}
                    className="h-8 text-xs hidden sm:flex"
                    onClick={async () => {
                      const newStatus = i.status === "recebido" ? "pendente" : "recebido";
                      const { error } = await supabase.from("incomes").update({ status: newStatus }).eq("id", i.id);
                      if (error) toast.error("Erro ao atualizar");
                      else {
                        toast.success(newStatus === "recebido" ? "Recebida!" : "Marcada como pendente");
                        qc.invalidateQueries({ queryKey: ["incomes"] });
                      }
                    }}
                  >
                    {i.status === "recebido" ? "Estornar" : "Receber"}
                  </Button>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingIncome(i); setOpen(true); }}>
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(i.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      }
      <IncomeFormDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingIncome(null); }} income={editingIncome} />
    </PageHeader>
  );
};
export default Receitas;
