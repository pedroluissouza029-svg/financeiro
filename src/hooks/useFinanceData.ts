import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isInCurrentMonth, daysUntil } from "@/lib/finance-utils";

export const useIncomes = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["incomes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("incomes").select("*").order("received_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useExpenses = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["expenses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return data.map((e: any) => {
        if (e.status !== "pago") {
          const days = daysUntil(e.due_date);
          if (days < 0) e.status = "atrasado";
          else e.status = "pendente";
        }
        return e;
      });
    },
  });
};

export const useDebts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["debts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return data.map((d: any) => {
        if (d.status !== "quitada") {
          const days = daysUntil(d.due_date);
          if (days < 0) d.status = "atrasada";
          else d.status = "em_dia";
        }
        return d;
      });
    },
  });
};

export const useFinancialSummary = () => {
  const { data: incomes = [] } = useIncomes();
  const { data: expenses = [] } = useExpenses();
  const { data: debts = [] } = useDebts();

  const monthIncomes = incomes.filter((i) => isInCurrentMonth(i.received_date));
  const monthExpenses = expenses.filter((e) => isInCurrentMonth(e.due_date));

  const totalIncome = monthIncomes.reduce((s, i) => s + Number(i.amount), 0);
  const paidExpenses = monthExpenses.filter((e) => e.status === "pago").reduce((s, e) => s + Number(e.amount), 0);
  const pendingExpenses = monthExpenses.filter((e) => e.status !== "pago").reduce((s, e) => s + Number(e.amount), 0);
  const totalExpenses = paidExpenses + pendingExpenses;
  const openDebts = debts.filter((d) => d.status !== "quitada").reduce((s, d) => s + (Number(d.installment_amount) * (d.total_installments - d.paid_installments)), 0);
  const balance = totalIncome - totalExpenses;

  // Alerts
  const alerts: { type: "warning" | "danger" | "info"; message: string }[] = [];
  expenses.forEach((e) => {
    if (e.status === "pago") return;
    const days = daysUntil(e.due_date);
    if (days < 0) alerts.push({ type: "danger", message: `${e.name} está vencida há ${Math.abs(days)} dia(s)` });
    else if (days <= 3) alerts.push({ type: "warning", message: `${e.name} vence em ${days} dia(s)` });
  });
  debts.forEach((d) => {
    if (d.status === "atrasada") alerts.push({ type: "danger", message: `Dívida atrasada: ${d.name}` });
  });
  if (totalExpenses > totalIncome && totalIncome > 0) alerts.push({ type: "warning", message: "Despesas maiores que receitas no mês" });
  if (balance < 0) alerts.push({ type: "danger", message: "Saldo do mês está negativo" });

  return {
    totalIncome, paidExpenses, pendingExpenses, totalExpenses,
    openDebts, balance, alerts,
    monthIncomes, monthExpenses, debts, expenses, incomes,
  };
};
