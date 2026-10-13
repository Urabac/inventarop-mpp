export type Frequency = "Diario" | "Semanal" | "Quincenal" | "Mensual";

export type Product = {
  code: string;
  name: string;
  category: string;
  brand: string;
  capacity: string;
  price: number;
  stock: number;
};

export type Client = {
  id: string;
  clientCode: string;
  address: string;
  name: string;
  phone: string;
  document: string;
};

export type Installment = {
  number: number;
  amount: number;
  due: string;
  paid: boolean;
  paidAmount?: number;
};

export type SaleLineItem = {
  productCode: string;
  productName: string;
  brand: string;
  capacity: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type Sale = {
  id: string;
  invoice: string;
  clientId: string;
  productCode: string;
  productName: string;
  brand: string;
  capacity: string;
  total: number;
  downPayment: number;
  financed: number;
  date: string;
  frequency: Exclude<Frequency, "Diario">;
  installments: Installment[];
  items?: SaleLineItem[];
};

export type Loan = {
  id: string;
  reference: string;
  clientId: string;
  principal: number;
  interestRate: number;
  total: number;
  date: string;
  frequency: Frequency;
  skipSaturday: boolean;
  skipSunday: boolean;
  installments: Installment[];
};

export type Ficha = {
  id: string;
  kind: "sale" | "loan";
  sourceId: string;
  recordId: string;
  clientId: string;
  clientName: string;
  date: string;
  item: Sale | Loan;
};

export type PurchaseItem = {
  productCode: string;
  productName: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
};

export type Purchase = {
  id: string;
  invoice: string;
  date: string;
  supplier: string;
  items: PurchaseItem[];
  total: number;
};
export type Printable = { kind: "sale"; item: Sale } | { kind: "loan"; item: Loan } | null;
