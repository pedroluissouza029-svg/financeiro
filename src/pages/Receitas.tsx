import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIncomes } from "@/hooks/useFinanceData";
import { PageHeader } from "@/components/PageHeader";
import { IncomeFormDialog } from "@/components/forms/IncomeFormDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/finance-utils";
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
                    {i.is_recurring && <Badge variant="outline" className="text-xs gap-1"><Repeat className="w-3 h-3" />Recorrente</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Recebido em {formatDate(i.received_date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-success">{formatCurrency(Number(i.amount))}</p>
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
