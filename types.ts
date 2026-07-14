
export type ServiceStatus = 'Ingresado' | 'En Diagnóstico' | 'En Reparación' | 'Esperando Repuestos' | 'Finalizado' | 'Entregado';

export type PaymentMethod = 'Efectivo Bs' | 'Efectivo $' | 'Pago Móvil' | 'TDD' | 'TDC' | 'Zelle';

export type UserRole = 'administrador' | 'vendedor' | 'cajero';

export interface User {
  id: string;
  username: string;
  password?: string;
  email?: string;
  name: string;
  role: UserRole;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  brand?: string;
  quantity: number;
  cost: number;
  profitMargin?: number;
  price: number;
  lastEntry: string;
  warehouseStock?: Record<string, number>;
  isConsignment?: boolean;
  consignmentProvider?: string;
}

export interface RepairItem {
  id: string;
  productId?: string;
  type: 'Repuesto' | 'Consumible' | 'Servicio';
  description: string;
  quantity: number;
  price: number;
}

export interface Installment {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
}

export interface VehicleRepair {
  id: string;
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  ownerName: string;
  responsible: string;
  status: ServiceStatus;
  diagnosis: string;
  serviceType: string;
  mechanicId: string;
  evidencePhotos?: string[];
  mileage?: number;
  items: RepairItem[];
  installments?: Installment[];
  createdAt: string;
  finishedAt?: string;
  paymentMethod?: PaymentMethod;
}

export interface Sale {
  id: string;
  customerId?: string;
  date: string;
  customerName: string;
  items: { productId: string; name: string; price: number; quantity: number; cost?: number }[];
  total: number;
  iva: boolean;
  paymentMethod: PaymentMethod;
  // Profitability fields — injected automatically at time of sale
  totalCost?: number;       // Sum of (cost * qty) for all items
  profit?: number;          // total - totalCost
  profitMargin?: number;    // (profit / totalCost) * 100
  hasConsignment?: boolean; // True if any item came from consignment inventory
}

export interface Purchase {
  id: string;
  invoiceId: string; // ID único para agrupar ítems de una misma factura
  date: string;
  provider: string;
  invoiceNumber: string;
  productId: string;
  productName: string;
  category: string;
  price: number;
  quantity: number;
  total: number;
  type: 'Contado' | 'Crédito';
  status: 'Pendiente' | 'Cerrada' | 'Pagada';
  warehouseId?: string;
}

export type ExpenseType = 'Gasto Fijo' | 'Gasto Variable';
export type FixedExpenseCategory = 'Alquiler' | 'Luz' | 'Agua' | 'Internet' | 'Impuestos' | 'Nómina Administrativa' | 'Servicios de Aseo' | 'Oficina';
export type VariableExpenseCategory = 'Repuestos Adicionales' | 'Herramientas' | 'Mantenimiento' | 'Viáticos' | 'Imprevistos' | 'Limpieza' | 'Víveres';
export type ExpenseCategory = FixedExpenseCategory | VariableExpenseCategory | string; // string for backwards compatibility until migrated

export interface Expense {
  id: string;
  date: string;
  expenseType?: ExpenseType;
  category: ExpenseCategory;
  description: string;
  amount: number;
}

export interface Employee {
  id: string;
  name: string;
  role: 'Mecánico' | 'Vendedor' | 'Administrador' | 'Gerente' | 'Ayudante de Mecánica' | 'Administradora' | 'Contadora';
  baseSalary: number;
  commissionRate: number;
}

export type PayrollPeriod = 'Semanal' | 'Quincenal' | 'Mensual';

export interface PayrollRecord {
  id: string;
  employeeId: string;
  date: string;
  baseSalary: number;
  commission: number;
  total: number;
  period?: PayrollPeriod;
  status: 'Pendiente' | 'Pagado';
}
