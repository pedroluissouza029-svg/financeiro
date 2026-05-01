import { useFinancialSummary } from "@/hooks/useFinanceData";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { formatCurrency, isInCurrentMonth } from "@/lib/finance-utils";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

const COLORS = ["hsl(152 72% 38%)", "hsl(160 65% 48%)", "hsl(38 95% 52%)", "hsl(0 78% 55%)", "hsl(220 9% 46%)", "hsl(200 80% 50%)", "hsl(280 60% 55%)", "hsl(20 80% 55%)", "hsl(340 75% 55%)", "hsl(60 70% 45%)"];

const Relatorios = () => {
  const { monthExpenses, totalIncome, paidExpenses, pendingExpenses, expenses } = useFinancialSummary();

  const byCategory = monthExpenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {});
  const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

  const overdue = expenses.filter(e => e.status === "atrasado").reduce((s, e) => s + Number(e.amount), 0);
  const compareData = [
    { name: "Receitas", valor: totalIncome },
    { name: "Despesas", valor: paidExpenses + pendingExpenses },
  ];

  // Projeção: média dos últimos 3 meses (simplificada — usa atuais)
  const projection = (paidExpenses + pendingExpenses) * 1;
  const projIncome = totalIncome;

  return (
    <PageHeader title="Relatórios" description="Veja para onde seu dinheiro vai">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Gastos por categoria</h3>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no mês</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">Receita × Despesa (mês)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={compareData}>
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                {compareData.map((_, i) => <Cell key={i} fill={i === 0 ? "hsl(152 72% 38%)" : "hsl(0 78% 55%)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Contas pagas (mês)" value={paidExpenses} accent="success" />
        <StatCard label="Contas pendentes" value={pendingExpenses} accent="warning" />
        <StatCard label="Contas atrasadas" value={overdue} accent="destructive" />
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-1">Projeção do próximo mês</h3>
        <p className="text-xs text-muted-foreground mb-4">Baseado nas suas despesas e receitas atuais</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Receita estimada</p>
            <p className="text-lg font-bold text-success">{formatCurrency(projIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Despesa estimada</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(projection)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo previsto</p>
            <p className={`text-lg font-bold ${projIncome - projection >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(projIncome - projection)}
            </p>
          </div>
        </div>
      </Card>
    </PageHeader>
  );
};

const accentClass = {
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
};
const StatCard = ({ label, value, accent }: any) => (
  <Card className="p-5">
    <div className={`inline-flex px-2 py-1 rounded-md text-xs font-medium mb-2 ${accentClass[accent as keyof typeof accentClass]}`}>{label}</div>
    <p className="text-2xl font-bold">{formatCurrency(value)}</p>
  </Card>
);

export default Relatorios;
