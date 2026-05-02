export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const parseDate = (date: string | Date | null | undefined) => {
  if (!date) return new Date();
  if (typeof date === "string" && date.includes("-")) {
    const parts = date.split("T");
    if (parts.length === 1) return new Date(`${date}T12:00:00`);
  }
  return new Date(date);
};

export const formatDate = (date: string | Date | null | undefined) => {
  const parsed = parseDate(date);
  if (isNaN(parsed.getTime())) return "Data inválida";
  return new Intl.DateTimeFormat("pt-BR").format(parsed);
};

export const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1);

export const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

export const getFifthBusinessDay = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  let businessDays = 0;
  while (businessDays < 5) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) businessDays++;
    if (businessDays < 5) d.setDate(d.getDate() + 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isInCurrentMonth = (date: string | Date | null | undefined) => {
  const d = parseDate(date);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

export const daysUntil = (date: string | Date | null | undefined) => {
  const target = parseDate(date);
  if (isNaN(target.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export type FinancialStatus = "saudavel" | "atencao" | "critico";

export const getFinancialStatus = (balance: number): FinancialStatus => {
  if (isNaN(balance) || balance < 0) return "critico";
  if (balance === 0) return "atencao";
  return "saudavel";
};

export const expenseCategories = [
  "Moradia", "Energia", "Água", "Internet", "Gás", "Telefone",
  "Alimentação", "Supermercado", "Transporte", "Veículo",
  "Saúde", "Educação", "Lazer", "Compras", "Vestuário", "Beleza", 
  "Pet", "Seguros", "Impostos", "Assinaturas", "Cartão", "Cartão de Crédito", "Outros",
];

export const paymentMethods = [
  "Pix", "Dinheiro", "Débito", "Crédito", "Boleto", "Transferência",
];

export const creditCardBanks = [
  "Nubank", "Itaú", "Inter", "Bradesco", "Santander", "C6 Bank", "Banco do Brasil", "Caixa", "XP", "BTG", "Outro"
];
