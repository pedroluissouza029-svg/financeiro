import { useFinancialSummary } from "@/hooks/useFinanceData";
import { formatCurrency, getFinancialStatus, formatDate, isInCurrentMonth } from "@/lib/finance-utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, AlertCircle, CheckCircle2, AlertTriangle, CreditCard, Clock, Receipt, History } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusConfig = {
  saudavel: { label: "Saudável", icon: CheckCircle2, className: "bg-success text-success-foreground" },
  atencao: { label: "Atenção", icon: AlertTriangle, className: "bg-warning text-warning-foreground" },
  critico: { label: "Crítico", icon: AlertCircle, className: "bg-destructive text-destructive-foreground" },
};

const Dashboard = () => {
  const { 
    totalIncome, paidExpenses, pendingExpenses, openDebts, 
    overdueExpenses, overdueDebts, monthDebtInstallments, 
    balance, alerts, expenses, incomes 
  } = useFinancialSummary();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<"all" | "overdue" | "month">("all");
  
  const status = getFinancialStatus(balance);
  const StatusIcon = statusConfig[status].icon;

  useEffect(() => { document.title = "Dashboard — Finança"; }, []);

  const monthName = new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{monthName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <Badge className={`${statusConfig[status].className} px-4 py-2 text-sm font-semibold gap-2 shadow-soft`}>
          <StatusIcon className="w-4 h-4" /> {statusConfig[status].label}
        </Badge>
      </header>

      {/* Big balance card */}
      <Card className="p-6 md:p-8 gradient-card text-primary-foreground shadow-elevated border-0">
        <div className="flex items-center gap-2 text-primary-foreground/80 text-sm mb-2">
          <Wallet className="w-4 h-4" /> Saldo disponível do mês
        </div>
        <div className="text-4xl md:text-5xl font-bold tracking-tight">
          {formatCurrency(balance)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-primary-foreground/20">
          <div>
            <p className="text-xs text-primary-foreground/70">Receitas</p>
            <p className="text-lg font-semibold">{formatCurrency(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-primary-foreground/70">Despesas</p>
            <p className="text-lg font-semibold">{formatCurrency(paidExpenses + pendingExpenses)}</p>
          </div>
        </div>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={TrendingUp} label="Receita total" value={totalIncome} accent="success" onClick={() => { setReportType("all"); setReportOpen(true); }} />
        <KpiCard icon={CheckCircle2} label="Despesas pagas" value={paidExpenses} accent="success" onClick={() => { setReportType("all"); setReportOpen(true); }} />
        <KpiCard icon={AlertTriangle} label="Contas em atraso" value={overdueExpenses + overdueDebts} accent="destructive" onClick={() => { setReportType("overdue"); setReportOpen(true); }} />
        <KpiCard icon={Clock} label="Despesas pendentes" value={pendingExpenses} accent="warning" onClick={() => { setReportType("all"); setReportOpen(true); }} />
        <KpiCard icon={Receipt} label="Dívidas do mês" value={monthDebtInstallments} accent="warning" onClick={() => { setReportType("month"); setReportOpen(true); }} />
        <KpiCard icon={CreditCard} label="Saldo devedor total" value={openDebts} accent="destructive" />
      </div>

      {/* Alerts */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Alertas</h2>
          <Badge variant="secondary" className="ml-auto">{alerts.length}</Badge>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Tudo em ordem por aqui ✨</p>
        ) : (
          <ul className="space-y-2">
            {alerts.slice(0, 8).map((a, i) => (
              <li key={i} className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                a.type === "danger" ? "bg-destructive/10 text-destructive" :
                a.type === "warning" ? "bg-warning/10 text-warning" :
                "bg-accent text-accent-foreground"
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              {reportType === "overdue" ? "Relatório de Contas em Atraso" : 
               reportType === "month" ? "Dívidas e Contas deste Mês" : 
               "Histórico de Movimentações"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ...incomes.map(i => ({ ...i, type: 'receita', date: i.received_date })),
                  ...expenses.map(e => ({ ...e, type: 'despesa', date: e.due_date }))
                ]
                .filter(item => {
                  if (reportType === "overdue") return item.status === "atrasado" || item.status === "atrasada";
                  if (reportType === "month") return isInCurrentMonth(item.date);
                  return true;
                })
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{formatDate(item.date)}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-xs">{item.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] h-5 ${
                        item.status === "pago" || item.status === "recebido" ? "border-success text-success bg-success/5" :
                        item.status === "atrasado" || item.status === "atrasada" ? "border-destructive text-destructive bg-destructive/5" :
                        "border-warning text-warning bg-warning/5"
                      }`}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${item.type === 'receita' ? 'text-success' : 'text-foreground'}`}>
                      {item.type === 'receita' ? '+' : '-'}{formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const accentMap = {
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
};

const KpiCard = ({ icon: Icon, label, value, accent, onClick }: any) => (
  <Card 
    className={`p-5 transition-smooth ${onClick ? 'cursor-pointer hover:shadow-soft hover:border-primary/30 active:scale-95' : ''}`}
    onClick={onClick}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accentMap[accent as keyof typeof accentMap]}`}>
      <Icon className="w-5 h-5" />
    </div>
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className="text-xl font-bold tracking-tight">{formatCurrency(value)}</p>
  </Card>
);

export default Dashboard;
