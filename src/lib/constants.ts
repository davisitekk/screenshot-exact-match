import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type StockMovementType = Database["public"]["Enums"]["stock_movement_type"];
export type AccountType = Database["public"]["Enums"]["account_type"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type BadgeTone = "success" | "warning" | "info" | "danger" | "neutral" | "default";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  aguardando_pagamento: { label: "Aguardando pagamento", tone: "warning" },
  pagamento_aprovado: { label: "Pagamento aprovado", tone: "info" },
  em_separacao: { label: "Em separação", tone: "info" },
  em_preparacao: { label: "Em preparação", tone: "info" },
  enviado: { label: "Enviado", tone: "default" },
  entregue: { label: "Entregue", tone: "success" },
  cancelado: { label: "Cancelado", tone: "danger" },
  devolvido: { label: "Devolvido", tone: "neutral" },
};
export const ORDER_STATUS_LIST = Object.keys(ORDER_STATUS) as OrderStatus[];

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  pendente: { label: "Pendente", tone: "warning" },
  pago: { label: "Pago", tone: "success" },
  estornado: { label: "Estornado", tone: "neutral" },
};

export const STOCK_TYPES: Record<StockMovementType, { label: string; sign: 1 | -1 | 0; manual: boolean }> = {
  entrada: { label: "Entrada de mercadoria", sign: 1, manual: true },
  saida: { label: "Saída manual", sign: -1, manual: true },
  devolucao: { label: "Devolução", sign: 1, manual: true },
  perda: { label: "Perda / avaria", sign: -1, manual: true },
  ajuste: { label: "Ajuste de inventário", sign: 0, manual: true },
  venda: { label: "Venda", sign: -1, manual: false },
  cancelamento: { label: "Cancelamento de venda", sign: 1, manual: false },
};

export const ACCOUNT_TYPES: Record<AccountType, string> = {
  banco: "Conta bancária",
  caixa: "Dinheiro em caixa",
  pix: "PIX",
  carteira_digital: "Carteira digital",
  mercado_pago: "Mercado Pago",
  outro: "Outra plataforma",
};

export const ROLES: Record<AppRole, { label: string; description: string }> = {
  admin: { label: "Administrador", description: "Acesso completo, inclusive usuários e configurações" },
  financeiro: { label: "Financeiro", description: "Contas, fluxo de caixa e indicadores financeiros" },
  vendas: { label: "Vendas", description: "Pedidos, clientes, produtos e estoque" },
};

export const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
