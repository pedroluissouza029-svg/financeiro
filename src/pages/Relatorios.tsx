import { useFinancialSummary } from "@/hooks/useFinanceData";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate, parseDate } from "@/lib/finance-utils";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CreditCard, Receipt, CheckCircle2, Clock, FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = ["hsl(152 72% 38%)", "hsl(160 65% 48%)", "hsl(38 95% 52%)", "hsl(0 78% 55%)", "hsl(220 9% 46%)", "hsl(200 80% 50%)", "hsl(280 60% 55%)", "hsl(20 80% 55%)", "hsl(340 75% 55%)", "hsl(60 70% 45%)"];

const Relatorios = () => {
  const { expenses = [], debts = [], incomes = [] } = useFinancialSummary();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterType, setFilterType] = useState<string>("todos");
  
  const now = new Date();
  const [startDate, setStartDate] = useState<string>(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);

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
    ...incomes.map(i => ({ ...i, type: 'receita', date: i.received_date, status: 'pago' }))
  ].filter(item => item && item.date);

  const filteredByDate = allItems.filter(item => {
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
  });

  const filteredItems = filteredByDate.filter(item => {
    const name = String(item.name || "").toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = name.includes(search);
    const matchesStatus = filterStatus === "todos" || item.status === filterStatus;
    const matchesType = filterType === "todos" || item.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalIn = filteredByDate.filter(i => i.type === 'receita').reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalOut = filteredByDate.filter(i => i.type !== 'receita').reduce((s, i) => s + Number(i.amount || 0), 0);
  
  const byCategory = filteredByDate.filter(i => i.type !== 'receita').reduce<Record<string, number>>((acc, e) => {
    const cat = e.category || "Outros";
    acc[cat] = (acc[cat] || 0) + Number(e.amount || 0);
    return acc;
  }, {});
  
  const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

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

      autoTable(doc, {
        startY: 40,
        head: [['Data', 'Nome', 'Tipo', 'Status', 'Valor']],
        body: tableData,
      });

      doc.save(`Relatorio_${startDate}_${endDate}.pdf`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <PageHeader title="Relatórios" description="Análise detalhada das suas finanças">
      <div className="grid gap-6">
        <div className="flex flex-col md:flex-row gap-4 p-4 bg-card rounded-xl border items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium ml-1">Início</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium ml-1">Fim</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-44" />
          </div>
          <div className="flex gap-2 ml-auto">
            <Button onClick={exportPDF} variant="outline" className="gap-2">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
            <Button onClick={() => window.print()} variant="outline" className="gap-2">
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-bold mb-4">Despesas por Categoria</h3>
            <div className="h-[300px]">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={categoryData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      outerRadius={80} 
                      label={({ name }) => name}
                    >
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados</div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-4">Resumo do Período</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-end border-b pb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Entradas</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency(totalIn)}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-success/20" />
              </div>
              <div className="flex justify-between items-end border-b pb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Saídas</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(totalOut)}</p>
                </div>
                <Receipt className="w-8 h-8 text-destructive/20" />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Líquido</p>
                  <p className={`text-2xl font-bold ${totalIn - totalOut >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(totalIn - totalOut)}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">R$</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
            <h3 className="font-bold">Listagem Detalhada</h3>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar..." 
                  className="pl-9 h-9 w-48" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              <select 
                className="h-9 px-3 rounded-md border bg-background text-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="todos">Todos os Tipos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
                <option value="cartao">Cartão</option>
                <option value="divida">Dívida</option>
              </select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{formatDate(item.date)}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.category}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${item.type === 'receita' ? 'text-success' : ''}`}>
                      {item.type === 'receita' ? '+' : '-'}{formatCurrency(Number(item.amount || 0))}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
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
