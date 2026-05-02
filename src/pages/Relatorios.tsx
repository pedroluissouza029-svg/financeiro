import { useFinancialSummary } from "@/hooks/useFinanceData";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate, parseDate } from "@/lib/finance-utils";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  LineChart, Line, CartesianGrid, AreaChart, Area 
} from "recharts";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CreditCard, Receipt, CheckCircle2, Clock, FileDown, Printer, TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#6366f1"];

const Relatorios = () => {
  const { expenses = [], debts = [], incomes = [] } = useFinancialSummary();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterType, setFilterType] = useState<string>("todos");
  
  const now = new Date();
  const [startDate, setStartDate] = useState<string>(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);

  const allItems = useMemo(() => [
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
    ...incomes.map(i => ({ 
      ...i, 
      type: 'receita', 
      date: i.received_date, 
      status: i.status === 'recebido' ? 'pago' : 'pendente' 
    }))
  ].filter(item => item && item.date), [expenses, debts, incomes]);

  const filteredByDate = useMemo(() => allItems.filter(item => {
    try {
      const itemDate = parseDate(item.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return true;
      end.setHours(23, 59, 59, 999);
      return itemDate >= start && itemDate <= end;
    } catch {
      return true;
    }
  }), [allItems, startDate, endDate]);

  const filteredItems = useMemo(() => filteredByDate.filter(item => {
    const name = String(item.name || "").toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = name.includes(search);
    const matchesStatus = filterStatus === "todos" || item.status === filterStatus;
    const matchesType = filterType === "todos" || item.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  }), [filteredByDate, searchTerm, filterStatus, filterType]);

  // Scenarios & Stats
  const stats = useMemo(() => {
    const totalIn = filteredByDate.filter(i => i.type === 'receita').reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalOut = filteredByDate.filter(i => i.type !== 'receita').reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalPaid = filteredByDate.filter(i => i.type !== 'receita').reduce((s, i) => s + Number(i.paid_amount || (i.status === 'pago' ? i.amount : 0)), 0);
    const totalPending = filteredByDate.filter(i => i.type !== 'receita').reduce((s, i) => s + (i.status !== 'pago' ? Number(i.amount || 0) - Number(i.paid_amount || 0) : 0), 0);
    const totalOverdue = filteredByDate.filter(i => i.type !== 'receita' && i.status === 'atrasado').reduce((s, i) => s + Number(i.amount || 0), 0);

    // Distribution by Category
    const byCategory = filteredByDate.filter(i => i.type !== 'receita').reduce<Record<string, number>>((acc, e) => {
      const cat = e.category || "Outros";
      acc[cat] = (acc[cat] || 0) + Number(e.amount || 0);
      return acc;
    }, {});
    const categoryData = Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Evolution (Daily)
    const byDay: Record<string, { date: string, income: number, expense: number }> = {};
    filteredByDate.forEach(item => {
      const day = item.date;
      if (!byDay[day]) byDay[day] = { date: day, income: 0, expense: 0 };
      if (item.type === 'receita') byDay[day].income += Number(item.amount || 0);
      else byDay[day].expense += Number(item.amount || 0);
    });
    
    let accBalance = 0;
    const evolutionData = Object.values(byDay)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(d => {
        accBalance += (d.income - d.expense);
        return { 
          ...d, 
          accumulated: accBalance,
          date: formatDate(d.date).split('/')[0] + '/' + formatDate(d.date).split('/')[1] 
        };
      });

    // Type Distribution
    const byType = filteredByDate.reduce<Record<string, number>>((acc, item) => {
      const t = item.type === 'cartao' ? 'Cartão' : item.type === 'divida' ? 'Dívida' : item.type === 'receita' ? 'Receita' : 'Despesa';
      acc[t] = (acc[t] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
    const typeData = Object.entries(byType).map(([name, value]) => ({ name, value }));

    return { totalIn, totalOut, totalPaid, totalPending, totalOverdue, categoryData, evolutionData, typeData };
  }, [filteredByDate]);

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Relatório Financeiro", 14, 20);
      doc.setFontSize(10);
      doc.text(`Período: ${formatDate(startDate)} até ${formatDate(endDate)}`, 14, 30);
      const tableData = filteredItems.map(item => [
        formatDate(item.date),
        String(item.name || ""),
        item.type,
        item.status,
        formatCurrency(Number(item.amount || 0))
      ]);
      autoTable(doc, { startY: 40, head: [['Data', 'Nome', 'Tipo', 'Status', 'Valor']], body: tableData });
      doc.save(`Relatorio_${startDate}_${endDate}.pdf`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <PageHeader title="Relatórios" description="Análise detalhada e cenários financeiros">
      <div className="grid gap-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 p-4 bg-card rounded-xl border items-end shadow-sm">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Início</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full md:w-44 h-9" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Fim</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full md:w-44 h-9" />
          </div>
          <div className="flex gap-2 w-full md:w-auto md:ml-auto">
            <Button onClick={exportPDF} variant="outline" size="sm" className="gap-2 flex-1 md:flex-none h-9">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
            <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2 flex-1 md:flex-none h-9">
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-4 border-l-4 border-l-success shadow-soft">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Entradas</p>
              <p className="text-xl font-bold">{formatCurrency(stats.totalIn)}</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4 border-l-4 border-l-destructive shadow-soft">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Saídas</p>
              <p className="text-xl font-bold">{formatCurrency(stats.totalOut)}</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4 border-l-4 border-l-primary shadow-soft">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Saldo Líquido</p>
              <p className={`text-xl font-bold ${stats.totalIn - stats.totalOut >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(stats.totalIn - stats.totalOut)}
              </p>
            </div>
          </Card>
        </div>

        {/* Primary Evolution Chart */}
        <Card className="p-6 shadow-soft overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-lg tracking-tight">Fluxo de Caixa</h3>
              <p className="text-xs text-muted-foreground">Entradas vs Saídas diárias no período</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.evolutionData}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(v: any) => formatCurrency(v)} 
                />
                <Area type="monotone" dataKey="income" name="Entrada" stroke="#10b981" fillOpacity={1} fill="url(#colorIn)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="Saída" stroke="#ef4444" fillOpacity={1} fill="url(#colorOut)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Accumulated Balance Chart */}
        <Card className="p-6 shadow-soft overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-lg tracking-tight">Progresso do Patrimônio</h3>
              <p className="text-xs text-muted-foreground">Saldo acumulado ao longo do período</p>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.evolutionData}>
                <defs>
                  <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(v: any) => formatCurrency(v)} 
                />
                <Area type="monotone" dataKey="accumulated" name="Saldo Acumulado" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAcc)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Secondary Charts & Category Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 shadow-soft lg:col-span-2">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-full md:w-1/2">
                <h3 className="font-bold mb-1 tracking-tight text-lg">Gastos por Categoria</h3>
                <p className="text-xs text-muted-foreground mb-6">Distribuição percentual das suas saídas</p>
                <div className="h-[280px] flex items-center justify-center">
                  {stats.categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={stats.categoryData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" cy="50%" 
                          innerRadius={70} 
                          outerRadius={95} 
                          paddingAngle={4}
                          stroke="none"
                        >
                          {stats.categoryData.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                          formatter={(v: any) => formatCurrency(v)} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-sm">Sem dados</p>
                  )}
                </div>
              </div>

              <div className="w-full md:w-1/2 space-y-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                <h4 className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-4">Ranking de Categorias</h4>
                {stats.categoryData.map((cat, i) => {
                  const percent = (cat.value / stats.totalOut) * 100;
                  return (
                    <div key={i} className="group cursor-default">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-sm font-semibold text-foreground/80 group-hover:text-primary transition-colors">{cat.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold block">{formatCurrency(cat.value)}</span>
                          <span className="text-[10px] text-muted-foreground">{percent.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out" 
                          style={{ 
                            width: `${percent}%`, 
                            backgroundColor: COLORS[i % COLORS.length],
                            opacity: 0.8
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-soft">
            <h3 className="font-bold mb-1 tracking-tight text-lg">Resumo por Tipo</h3>
            <p className="text-xs text-muted-foreground mb-6">Comparativo de fluxo</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.typeData} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600 }} width={80} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(v: any) => formatCurrency(v)} 
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {stats.typeData.map((entry, index) => (
                      <Cell key={index} fill={entry.name === 'Receita' ? '#10b981' : entry.name === 'Dívida' ? '#ef4444' : entry.name === 'Cartão' ? '#3b82f6' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2 border-t pt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Saúde Financeira</span>
                <span className={`font-bold ${stats.totalIn > stats.totalOut ? 'text-success' : 'text-destructive'}`}>
                  {((stats.totalIn / stats.totalOut || 0) * 100).toFixed(0)}% cobertura
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${stats.totalIn > stats.totalOut ? 'bg-success' : 'bg-destructive'}`} 
                  style={{ width: `${Math.min(100, (stats.totalIn / stats.totalOut || 0) * 100)}%` }} 
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card className="p-6 shadow-soft">
          <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
            <div>
              <h3 className="font-bold tracking-tight">Listagem Detalhada</h3>
              <p className="text-xs text-muted-foreground">Movimentações do período</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-9 h-9 w-full md:w-48 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <select className="h-9 px-3 rounded-md border bg-background text-sm outline-none focus:ring-1 focus:ring-primary" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="todos">Todos Tipos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
                <option value="cartao">Cartão</option>
                <option value="divida">Dívida</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-bold">Data</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Nome</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Tipo</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, i) => (
                  <TableRow key={i} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="text-xs font-medium">{formatDate(item.date)}</TableCell>
                    <TableCell>
                      <p className="font-semibold text-sm">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.category || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-bold ${item.type === 'receita' ? 'border-success/30 text-success' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                        {item.type === 'receita' ? 'RECEITA' : item.type === 'cartao' ? 'CARTÃO' : item.type === 'divida' ? 'DÍVIDA' : 'DESPESA'}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${item.type === 'receita' ? 'text-success' : ''}`}>
                      {item.type === 'receita' ? '+' : '-'} {formatCurrency(Number(item.amount || 0))}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Sem registros para exibir</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </PageHeader>
  );
};

export default Relatorios;
