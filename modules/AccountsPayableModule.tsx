import React, { useState } from 'react';
import { useGonzacarsStore } from '../store';
import { AccountPayable, PayablePayment, PaymentMethod } from '../types';
import { Search, Filter, Plus, X, Calendar, DollarSign, CheckCircle, Truck } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils/finance';
import { useToast } from '../App';

const AccountsPayableModule: React.FC = () => {
  const store = useGonzacarsStore();
  const toast = useToast();
  const accounts = store.accountsPayable || [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pendiente' | 'Parcial' | 'Pagado' | 'Vencido'>('Todos');
  
  const [selectedAccount, setSelectedAccount] = useState<AccountPayable | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo $');
  const [paymentRef, setPaymentRef] = useState('');

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || acc.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPayables = accounts.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalPaid = accounts.reduce((acc, curr) => acc + curr.paidAmount, 0);
  const totalPending = totalPayables - totalPaid;

  const handleOpenPayment = (acc: AccountPayable) => {
    setSelectedAccount(acc);
    setShowPaymentModal(true);
    setPaymentAmount((acc.totalAmount - acc.paidAmount).toString());
    setPaymentMethod('Efectivo $');
    setPaymentRef('');
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Monto inválido', 'Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    const pendingAmount = selectedAccount.totalAmount - selectedAccount.paidAmount;
    if (amount > pendingAmount) {
      toast.error('Monto excedido', 'El monto no puede ser mayor a la deuda pendiente.');
      return;
    }

    const newPayment: PayablePayment = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      amount,
      method: paymentMethod,
      reference: paymentRef
    };

    const newPaidAmount = selectedAccount.paidAmount + amount;
    let newStatus = selectedAccount.status;
    if (newPaidAmount >= selectedAccount.totalAmount) {
      newStatus = 'Pagado';
    } else {
      newStatus = 'Parcial';
    }

    const updatedAccount: AccountPayable = {
      ...selectedAccount,
      paidAmount: newPaidAmount,
      status: newStatus,
      payments: [...(selectedAccount.payments || []), newPayment]
    };

    try {
      await store.saveToFirebase('AccountsPayable', updatedAccount);
      store.setAccountsPayable((prev: AccountPayable[]) => 
        prev.map(a => a.id === updatedAccount.id ? updatedAccount : a)
      );
      toast.success('Pago registrado', 'El pago se ha registrado correctamente.');
      setShowPaymentModal(false);
      setSelectedAccount(null);
    } catch (error: any) {
      toast.error('Error', 'Hubo un error al guardar el pago.');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-chrome-100 flex items-center gap-3">
            <Truck className="text-amber-500" size={32} />
            Cuentas por Pagar (CXP)
          </h1>
          <p className="text-chrome-400 mt-1">Gestión de obligaciones con proveedores.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-metal-800 p-4 rounded-xl border border-metal-700/50 min-w-[150px]">
            <p className="text-chrome-500 text-xs font-semibold uppercase tracking-wider mb-1">Por Pagar</p>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(totalPending)}</p>
          </div>
          <div className="bg-metal-800 p-4 rounded-xl border border-metal-700/50 min-w-[150px]">
            <p className="text-chrome-500 text-xs font-semibold uppercase tracking-wider mb-1">Pagado</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalPaid)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-metal-900 border border-metal-800 rounded-xl pl-10 pr-4 py-3 text-chrome-100 placeholder-chrome-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-400" size={20} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full bg-metal-900 border border-metal-800 rounded-xl pl-10 pr-4 py-3 text-chrome-100 focus:outline-none focus:border-amber-500 appearance-none"
          >
            <option value="Todos">Todos los Estados</option>
            <option value="Pendiente">Pendientes</option>
            <option value="Parcial">Parciales</option>
            <option value="Pagado">Pagados</option>
            <option value="Vencido">Vencidos</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAccounts.map(acc => (
          <div key={acc.id} className="bg-metal-800/50 border border-metal-700/50 rounded-2xl p-5 hover:border-metal-600 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-chrome-100 text-lg">{acc.provider}</h3>
                <p className="text-chrome-400 text-sm flex items-center gap-1 mt-1">
                  <Calendar size={14} /> Vence: {formatDate(acc.dueDate)}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                ${acc.status === 'Pagado' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : ''}
                ${acc.status === 'Pendiente' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : ''}
                ${acc.status === 'Parcial' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : ''}
                ${acc.status === 'Vencido' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : ''}
              `}>
                {acc.status}
              </span>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-chrome-400">Total Obligación:</span>
                <span className="font-semibold text-chrome-200">{formatCurrency(acc.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-chrome-400">Pagado:</span>
                <span className="font-semibold text-emerald-400">{formatCurrency(acc.paidAmount)}</span>
              </div>
              <div className="w-full h-1.5 bg-metal-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full" 
                  style={{ width: `${Math.min((acc.paidAmount / acc.totalAmount) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-sm pt-1 border-t border-metal-700/50 mt-2">
                <span className="font-semibold text-chrome-300">Restante:</span>
                <span className="font-bold text-red-400">{formatCurrency(acc.totalAmount - acc.paidAmount)}</span>
              </div>
            </div>

            {acc.status !== 'Pagado' && (
              <button
                onClick={() => handleOpenPayment(acc)}
                className="w-full py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 font-semibold rounded-xl border border-amber-500/30 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Registrar Pago
              </button>
            )}
            
            {acc.status === 'Pagado' && (
              <div className="w-full py-2.5 bg-emerald-500/10 text-emerald-400 font-semibold rounded-xl border border-emerald-500/20 flex items-center justify-center gap-2">
                <CheckCircle size={18} /> Cuenta Saldada
              </div>
            )}
          </div>
        ))}
        {filteredAccounts.length === 0 && (
          <div className="col-span-full py-12 text-center bg-metal-800/30 rounded-2xl border border-metal-700/50 border-dashed">
            <Truck size={48} className="mx-auto text-chrome-600 mb-4" />
            <p className="text-chrome-400 text-lg">No hay cuentas por pagar que coincidan con la búsqueda.</p>
          </div>
        )}
      </div>

      {showPaymentModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-metal-900 border border-metal-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-metal-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-chrome-100 flex items-center gap-2">
                <DollarSign className="text-emerald-400" />
                Registrar Pago
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-chrome-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleRegisterPayment} className="p-6 space-y-4">
              <div className="bg-metal-800/50 p-4 rounded-xl border border-metal-700/50 mb-4 text-center">
                <p className="text-chrome-400 text-sm">Obligación Restante a {selectedAccount.provider}</p>
                <p className="text-3xl font-black text-amber-400 mt-1">
                  {formatCurrency(selectedAccount.totalAmount - selectedAccount.paidAmount)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-chrome-400 mb-1">Monto a Pagar ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-chrome-400 mb-1">Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="Efectivo $">Efectivo $</option>
                  <option value="Efectivo Bs">Efectivo Bs</option>
                  <option value="Pago Móvil">Pago Móvil</option>
                  <option value="Zelle">Zelle</option>
                  <option value="Binance">Binance</option>
                  <option value="TDD">Punto (TDD)</option>
                  <option value="TDC">Punto (TDC)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-chrome-400 mb-1">Referencia (Opcional)</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="Nro de transferencia, etc."
                  className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-metal-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-6 py-2.5 rounded-xl border border-metal-700 text-chrome-300 hover:bg-metal-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-amber-900/20"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPayableModule;
