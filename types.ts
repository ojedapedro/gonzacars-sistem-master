
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
  quantity: number;
  cost: number;
  price: number;
  lastEntry: string;
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
  items: { productId: string; name: string; price: number; quantity: number }[];
  total: number;
  iva: boolean;
  paymentMethod: PaymentMethod;
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
}

export interface Expense {
  id: string;
  date: string;
  category: 'Limpieza' | 'Oficina' | 'Víveres' | 'Impuesto' | 'Aseo Urbano' | 'Internet';
  description: string;
  amount: number;
}

export interface Employee {
  id: string;
  name: string;
  role: 'Mecánico' | 'Vendedor' | 'Administrador';
  baseSalary: number;
  commissionRate: number;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  date: string;
  baseSalary: number;
  commission: number;
  total: number;
  status: 'Pendiente' | 'Pagado';
}
