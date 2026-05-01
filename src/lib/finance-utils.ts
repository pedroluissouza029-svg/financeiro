export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const parseDate = (date: string | Date) => {
  if (typeof date === "string" && date.includes("-")) {
    const parts = date.split("T");
    if (parts.length === 1) return new Date(`${date}T12:00:00`);
  }
  return new Date(date);
};

export const formatDate = (date: string | Date) =>
  new Intl.DateTimeFormat("pt-BR").format(parseDate(date));

export const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1);

export const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

export const isInCurrentMonth = (date: string | Date) => {
  const d = parseDate(date);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

export const daysUntil = (date: string | Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseDate(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export type FinancialStatus = "saudavel" | "atencao" | "critico";

export const getFinancialStatus = (balance: number): FinancialStatus => {
  if (balance > 0) return "saudavel";
  if (balance === 0) return "atencao";
  return "critico";
};

export const expenseCategories = [
  "Moradia", "Alimentação", "Transporte", "Saúde", "Educação",
  "Lazer", "Compras", "Assinaturas", "Cartão", "Outros",
];

export const paymentMethods = [
  "Pix", "Dinheiro", "Débito", "Crédito", "Boleto", "Transferência",
];
