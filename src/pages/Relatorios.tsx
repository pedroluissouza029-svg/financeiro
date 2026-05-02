import { useFinancialSummary } from "@/hooks/useFinanceData";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { formatCurrency, isInCurrentMonth, formatDate, parseDate } from "@/lib/finance-utils";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, Calendar, CreditCard, Receipt, AlertCircle, CheckCircle2, Clock, FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = ["hsl(152 72% 38%)", "hsl(160 65% 48%)", "hsl(38 95% 52%)", "hsl(0 78% 55%)", "hsl(220 9% 46%)", "hsl(200 80% 50%)", "hsl(280 60% 55%)", "hsl(20 80% 55%)", "hsl(340 75% 55%)", "hsl(60 70% 45%)"];

const Relatorios = () => {
  const { totalIncome: monthIncome, paidExpenses: monthPaid, pendingExpenses: monthPending, expenses, debts, incomes } = useFinancialSummary();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterType, setFilterType] = useState<string>("todos");
  
  // Date range state - default to current month
  const now = new Date();
  const [startDate, setStartDate] = useState<string>(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);

  // Combined data for the detailed list with date filtering
  const allItems = [
    ...expenses.map(e => {
      const isCard = e.category === "Cartão de Crédito" || e.category === "Cartão";
      return { ...e, type: isCard ? 'cartao' : 'despesa', date: e.due_date };
    }),
    ...debts.map(d => ({ 
      ...d, 
      type: 'divida', 
      date: d.due_date, 
      amount: d.installment_amount, 
      status: d.status === 'atrasada' ? 'atrasado' : d.status === 'quitada' ? 'pago' : 'pendente' 
    })),
    ...incomes.map(i => {
      const days = daysUntil(i.received_date);
      return { 
        ...i, 
        type: 'receita', 
        date: i.received_date, 
        status: days <= 0 ? 'pago' : 'pendente' 
      };
    })
  ];

  const filteredByDate = allItems.filter(item => {
    const itemDate = parseDate(item.date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return itemDate >= start && itemDate <= end;
  });

  const filteredItems = filteredByDate.filter(item => {
    const matchesSearch = (item.name || "").toLowerCase().includes((searchTerm || "").toLowerCase());
    const matchesStatus = filterStatus === "todos" || item.status === filterStatus;
    const matchesType = filterType === "todos" || item.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate stats based on filteredByDate
  const totalIn = filteredByDate.filter(i => i.type === 'receita').reduce((s, i) => s + Number(i.amount), 0);
  const totalOut = filteredByDate.filter(i => i.type !== 'receita').reduce((s, i) => s + Number(i.amount), 0);
  const totalPaidOut = filteredByDate.filter(i => i.type !== 'receita' && i.status === 'pago').reduce((s, i) => s + Number(i.amount), 0);
  const totalPendingOut = filteredByDate.filter(i => i.type !== 'receita' && i.status === 'pendente').reduce((s, i) => s + Number(i.amount), 0);
  const totalOverdueOut = filteredByDate.filter(i => i.type !== 'receita' && i.status === 'atrasado').reduce((s, i) => s + Number(i.amount), 0);

  const byCategory = filteredByDate.filter(i => i.type !== 'receita').reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {});
  const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

  const compareData = [
    { name: "Receitas", valor: totalIn },
    { name: "Despesas", valor: totalOut },
  ];

  const exportPDF = () => {
    const doc = new jsPDF();
    const title = `Relatorio_Financeiro_${startDate}_a_${endDate}`;
    
    doc.setFontSize(18);
    doc.text("Relatório Financeiro Detalhado", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Período: ${formatDate(startDate)} até ${formatDate(endDate)}`, 14, 30);
    
    doc.setFontSize(12);
    doc.text(`Resumo: Receitas ${formatCurrency(totalIn)} | Despesas ${formatCurrency(totalOut)} | Saldo ${formatCurrency(totalIn - totalOut)}`, 14, 40);

    const tableData = filteredItems.map(item => [
      formatDate(item.date),
      item.name,
      item.type === 'cartao' ? 'Cartão' : item.type === 'divida' ? 'Dívida' : item.type === 'receita' ? 'Receita' : 'Despesa',
      item.status === 'pago' ? 'Pago' : item.status === 'atrasado' ? 'Atrasado' : 'Pendente',
      formatCurrency(Number(item.amount || 0))
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Data', 'Nome', 'Tipo', 'Status', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`${title}.pdf`);
  };

  // Projeção: média dos últimos 3 meses (simplificada — usa atuais)
  const projection = totalOut;
  const projIncome = totalIn;

  return (
    <PageHeader title="Relatórios" description="Veja para onde seu dinheiro vai">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Início</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Fim</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-40" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportPDF} variant="default" className="gap-2 shadow-soft">
            <FileDown className="w-4 h-4" /> Exportar PDF
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

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
        <StatCard label="Contas pagas" value={totalPaidOut} accent="success" />
        <StatCard label="Contas pendentes" value={totalPendingOut} accent="warning" />
        <StatCard label="Contas atrasadas" value={totalOverdueOut} accent="destructive" />
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

      {/* Detalhamento Module */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold">Detalhamento de Contas</h2>
            <p className="text-sm text-muted-foreground">Filtre e visualize cada movimentação em detalhes</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge 
              variant={filterStatus === "todos" ? "default" : "outline"} 
              className="cursor-pointer" 
              onClick={() => setFilterStatus("todos")}
            >Todos</Badge>
            <Badge 
              variant={filterStatus === "atrasado" ? "destructive" : "outline"} 
              className="cursor-pointer" 
              onClick={() => setFilterStatus("atrasado")}
            >Atrasadas</Badge>
            <Badge 
              variant={filterStatus === "pago" ? "default" : "outline"} 
              className="cursor-pointer bg-success hover:bg-success/90" 
              onClick={() => setFilterStatus("pago")}
            >Pagas</Badge>
            <Badge 
              variant={filterStatus === "pendente" ? "default" : "outline"} 
              className="cursor-pointer bg-warning hover:bg-warning/90" 
              onClick={() => setFilterStatus("pendente")}
            >A vencer</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative col-span-1 md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome..." 
              className="pl-10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 col-span-1 md:col-span-2">
            {['todos', 'despesa', 'cartao', 'divida'].map((type) => (
              <Badge 
                key={type}
                variant={filterType === type ? "secondary" : "outline"}
                className="cursor-pointer capitalize flex-1 justify-center"
                onClick={() => setFilterType(type)}
              >
                {type === 'todos' ? 'Tipos' : type === 'cartao' ? 'Cartão' : type === 'divida' ? 'Dívida' : 'Despesa'}
              </Badge>
            ))}
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhum registro encontrado com esses filtros.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item, i) => (
                  <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-xs font-medium">{formatDate(item.date)}</TableCell>
                    <TableCell>
                      <span className="font-semibold">{item.name}</span>
                      <p className="text-[10px] text-muted-foreground">{item.category}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {item.type === 'cartao' ? <CreditCard className="w-3 h-3" /> : 
                         item.type === 'divida' ? <Receipt className="w-3 h-3" /> : 
                         item.type === 'receita' ? <CheckCircle2 className="w-3 h-3 text-success" /> :
                         <Clock className="w-3 h-3" />}
                        <span className="capitalize">{item.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] font-bold ${
                          item.status === 'pago' ? 'border-success/50 text-success bg-success/5' :
                          item.status === 'atrasado' ? 'border-destructive/50 text-destructive bg-destructive/5' :
                          'border-warning/50 text-warning bg-warning/5'
                        }`}
                      >
                        {item.type === 'receita' 
                          ? (item.status === 'pago' ? 'Recebida' : 'Pendente')
                          : (item.status === 'pago' ? 'Paga' : item.status === 'atrasado' ? 'Atrasada' : 'Pendente')
                        }
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${item.type === 'receita' ? 'text-success' : ''}`}>
                      {item.type === 'receita' ? '+' : '-'} {formatCurrency(Number(item.amount))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
