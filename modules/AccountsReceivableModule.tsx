import React, { useState, useMemo } from 'react';
import { useGonzacarsStore } from '../store';
import { AccountReceivable, CXCEntry, PaymentMethod } from '../types';
import {
  Wallet, Search, Filter, Plus, X, Calendar, DollarSign,
  FileText, CheckCircle, TrendingUp, TrendingDown, Car,
  ChevronRight, BookOpen, ArrowDownCircle, ArrowUpCircle,
  AlertTriangle, Clock, ReceiptText, ChevronLeft, User,
  Wrench, Package
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils/finance';
import { useToast } from '../App';

// ─── Helpers ───────────────────────────────────────────────────────────────

const statusConfig = {
  Pendiente: { label: 'Pendiente',  bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/30' },
  Parcial:   { label: 'Parcial',    bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/30' },
  Pagado:    { label: 'Saldado',    bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  Vencido:   { label: 'Vencido',    bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30' },
} as const;

const PAYMENT_METHODS: PaymentMethod[] = [
  'Efectivo $', 'Efectivo Bs', 'Pago Móvil', 'Zelle', 'Binance', 'TDD', 'TDC'
];

// Calcula el saldo acumulado para mostrar en la tabla de movimientos
function buildLedgerRows(entries: CXCEntry[]) {
  let runningBalance = 0;
  return entries.map(entry => {
    if (entry.type === 'Cargo') {
      runningBalance += entry.amount;
    } else {
      runningBalance -= entry.amount;
    }
    return { ...entry, balance: runningBalance };
  });
}

// ─── Componente Principal ──────────────────────────────────────────────────

const AccountsReceivableModule: React.FC = () => {
  const store = useGonzacarsStore();
  const toast = useToast();
  const accounts = store.accountsReceivable || [];
  const isAdmin = store.currentUser?.role === 'administrador';

  // Vista: 'list' | 'detail'
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedAccount, setSelectedAccount] = useState<AccountReceivable | null>(null);

  // Filtros de lista
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pendiente' | 'Parcial' | 'Pagado' | 'Vencido'>('Todos');

  // Modal de abono
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo $');
  const [paymentRef, setPaymentRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de edición de abono
  const [editingAbono, setEditingAbono] = useState<CXCEntry | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState<PaymentMethod>('Efectivo $');
  const [editRef, setEditRef] = useState('');

  // ─── KPIs globales ───
  const totalCargado  = accounts.reduce((s, a) => s + a.totalAmount, 0);
  const totalCobrado  = accounts.reduce((s, a) => s + a.paidAmount, 0);
  const totalPendiente = totalCargado - totalCobrado;
  const countPendientes = accounts.filter(a => a.status === 'Pendiente' || a.status === 'Parcial').length;
  const countVencidos  = accounts.filter(a => a.status === 'Vencido').length;

  // ─── Listado filtrado ───
  const filteredAccounts = useMemo(() => {
    return accounts
      .filter(acc => {
        const q = searchTerm.toLowerCase();
        const matchSearch =
          acc.customerName.toLowerCase().includes(q) ||
          (acc.vehiclePlate || '').toLowerCase().includes(q) ||
          (acc.vehicleBrand || '').toLowerCase().includes(q) ||
          (acc.vehicleModel || '').toLowerCase().includes(q);
        const matchStatus = statusFilter === 'Todos' || acc.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [accounts, searchTerm, statusFilter]);

  // ─── Ledger rows del detalle ───
  const ledgerRows = useMemo(() => {
    if (!selectedAccount?.entries) return [];
    return buildLedgerRows(
      [...(selectedAccount.entries)].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    );
  }, [selectedAccount]);

  // ─── Abrir detalle ───
  const openDetail = (acc: AccountReceivable) => {
    // Refrescar desde el store (puede haber cambiado por sync)
    const fresh = accounts.find(a => a.id === acc.id) || acc;
    setSelectedAccount(fresh);
    setView('detail');
  };

  // ─── Registrar abono ───
  const handleOpenPayment = () => {
    if (!selectedAccount) return;
    const pending = selectedAccount.totalAmount - selectedAccount.paidAmount;
    setPaymentAmount(pending.toFixed(2));
    setPaymentMethod('Efectivo $');
    setPaymentRef('');
    setShowPaymentModal(true);
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Monto inválido', 'El monto debe ser mayor a 0.');
      return;
    }
    const pending = selectedAccount.totalAmount - selectedAccount.paidAmount;
    if (amount > pending + 0.01) {
      toast.error('Monto excedido', `El saldo pendiente es ${formatCurrency(pending)}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const newEntry: CXCEntry = {
        id: `abono-manual-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'Abono',
        description: `Abono - ${paymentMethod}${paymentRef ? ` (Ref: ${paymentRef})` : ''}`,
        amount,
        method: paymentMethod,
        reference: paymentRef || undefined,
      };

      const newPaid = selectedAccount.paidAmount + amount;
      let newStatus: AccountReceivable['status'] = 'Pendiente';
      if (newPaid >= selectedAccount.totalAmount) newStatus = 'Pagado';
      else if (newPaid > 0) newStatus = 'Parcial';

      const updatedAccount: AccountReceivable = {
        ...selectedAccount,
        paidAmount: newPaid,
        status: newStatus,
        entries: [...(selectedAccount.entries || []), newEntry],
        payments: [
          ...(selectedAccount.payments || []),
          { id: newEntry.id, date: newEntry.date, amount, method: paymentMethod, reference: paymentRef || undefined }
        ],
      };

      // Si tiene reparación asociada, sincronizar también en el informe de reparación
      if (selectedAccount.repairId) {
        const linkedRepair = store.repairs.find(r => r.id === selectedAccount.repairId);
        if (linkedRepair) {
          const updatedRepair = {
            ...linkedRepair,
            installments: [
              ...(linkedRepair.installments || []),
              {
                id: newEntry.id,
                date: newEntry.date,
                amount,
                method: paymentMethod
              }
            ]
          };
          await store.saveToFirebase('Repairs', updatedRepair);
          store.setRepairs((prev: any) => prev.map((r: any) => r.id === updatedRepair.id ? updatedRepair : r));
        }
      }

      await store.saveToFirebase('AccountsReceivable', updatedAccount);
      store.setAccountsReceivable((prev: AccountReceivable[]) =>
        prev.map(a => a.id === updatedAccount.id ? updatedAccount : a)
      );
      setSelectedAccount(updatedAccount);
      toast.success('Abono registrado', `Se registró un abono de ${formatCurrency(amount)}.`);
      setShowPaymentModal(false);
    } catch {
      toast.error('Error', 'No se pudo registrar el abono.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Editar abono ───
  const handleOpenEditAbono = (entry: CXCEntry) => {
    if (!isAdmin) return;
    setEditingAbono(entry);
    setEditAmount(entry.amount.toString());
    setEditMethod(entry.method || 'Efectivo $');
    setEditRef(entry.reference || '');
  };

  const handleUpdateAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !editingAbono) return;

    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Monto inválido', 'El monto debe ser mayor a 0.');
      return;
    }

    // Calcular saldo sin contar el abono actual que estamos editando
    const currentAbonosExcludingThis = (selectedAccount.entries || [])
      .filter(e => e.type === 'Abono' && e.id !== editingAbono.id)
      .reduce((s, e) => s + e.amount, 0);

    const pendingLimit = selectedAccount.totalAmount - currentAbonosExcludingThis;
    if (amount > pendingLimit + 0.01) {
      toast.error('Monto excedido', `El monto máximo permitido para este abono es ${formatCurrency(pendingLimit)}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedEntries = (selectedAccount.entries || []).map(entry => {
        if (entry.id === editingAbono.id) {
          return {
            ...entry,
            amount,
            method: editMethod,
            reference: editRef || undefined,
            description: `Abono - ${editMethod}${editRef ? ` (Ref: ${editRef})` : ''}`,
          };
        }
        return entry;
      });

      const newPaid = currentAbonosExcludingThis + amount;
      let newStatus: AccountReceivable['status'] = 'Pendiente';
      if (newPaid >= selectedAccount.totalAmount) newStatus = 'Pagado';
      else if (newPaid > 0) newStatus = 'Parcial';

      const updatedAccount: AccountReceivable = {
        ...selectedAccount,
        paidAmount: newPaid,
        status: newStatus,
        entries: updatedEntries,
        payments: (selectedAccount.payments || []).map(p => {
          if (p.id === editingAbono.id || p.id === editingAbono.installmentId) {
            return { ...p, amount, method: editMethod, reference: editRef || undefined };
          }
          return p;
        })
      };

      // Sincronizar en informe si tiene reparación asociada
      if (selectedAccount.repairId) {
        const linkedRepair = store.repairs.find(r => r.id === selectedAccount.repairId);
        if (linkedRepair) {
          const updatedRepair = {
            ...linkedRepair,
            installments: (linkedRepair.installments || []).map(inst => {
              // Puede estar guardado con el id de la entrada (newEntry.id) o installmentId
              if (inst.id === editingAbono.id || inst.id === editingAbono.installmentId) {
                return { ...inst, amount, method: editMethod };
              }
              return inst;
            })
          };
          await store.saveToFirebase('Repairs', updatedRepair);
          store.setRepairs((prev: any) => prev.map((r: any) => r.id === updatedRepair.id ? updatedRepair : r));
        }
      }

      await store.saveToFirebase('AccountsReceivable', updatedAccount);
      store.setAccountsReceivable((prev: AccountReceivable[]) =>
        prev.map(a => a.id === updatedAccount.id ? updatedAccount : a)
      );
      setSelectedAccount(updatedAccount);
      toast.success('Abono actualizado', 'Se guardaron los cambios del abono correctamente.');
      setEditingAbono(null);
    } catch {
      toast.error('Error', 'No se pudo actualizar el abono.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Eliminar abono ───
  const handleDeleteAbono = async (abonoId: string) => {
    if (!isAdmin || !selectedAccount) return;
    if (!window.confirm('¿Está seguro de que desea eliminar este abono? Esto afectará el saldo de la cuenta.')) return;

    try {
      const remainingEntries = (selectedAccount.entries || []).filter(e => e.id !== abonoId);
      const deletedEntry = (selectedAccount.entries || []).find(e => e.id === abonoId);
      if (!deletedEntry) return;

      const newPaid = Math.max(0, selectedAccount.paidAmount - deletedEntry.amount);
      let newStatus: AccountReceivable['status'] = 'Pendiente';
      if (newPaid >= selectedAccount.totalAmount) newStatus = 'Pagado';
      else if (newPaid > 0) newStatus = 'Parcial';

      const updatedAccount: AccountReceivable = {
        ...selectedAccount,
        paidAmount: newPaid,
        status: newStatus,
        entries: remainingEntries,
        payments: (selectedAccount.payments || []).filter(p => p.id !== abonoId && p.id !== deletedEntry.installmentId),
      };

      // Sincronizar en informe de reparación
      if (selectedAccount.repairId) {
        const linkedRepair = store.repairs.find(r => r.id === selectedAccount.repairId);
        if (linkedRepair) {
          const updatedRepair = {
            ...linkedRepair,
            installments: (linkedRepair.installments || []).filter(inst => inst.id !== abonoId && inst.id !== deletedEntry.installmentId)
          };
          await store.saveToFirebase('Repairs', updatedRepair);
          store.setRepairs((prev: any) => prev.map((r: any) => r.id === updatedRepair.id ? updatedRepair : r));
        }
      }

      await store.saveToFirebase('AccountsReceivable', updatedAccount);
      store.setAccountsReceivable((prev: AccountReceivable[]) =>
        prev.map(a => a.id === updatedAccount.id ? updatedAccount : a)
      );
      setSelectedAccount(updatedAccount);
      toast.success('Abono eliminado', 'El abono fue eliminado y el saldo actualizado.');
    } catch {
      toast.error('Error', 'No se pudo eliminar el abono.');
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — VISTA LISTA
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'list') {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-24">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-chrome-100 flex items-center gap-3">
              <BookOpen className="text-blue-400" size={32} />
              Libro de Cuentas por Cobrar
            </h1>
            <p className="text-chrome-400 mt-1 text-sm">
              Cada informe de vehículo genera automáticamente una cuenta contable.
            </p>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <TrendingUp size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider">Total Cargado</span>
            </div>
            <p className="text-2xl font-black text-blue-300">{formatCurrency(totalCargado)}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <ArrowDownCircle size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider">Total Cobrado</span>
            </div>
            <p className="text-2xl font-black text-emerald-300">{formatCurrency(totalCobrado)}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-900/40 to-amber-800/20 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Clock size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider">Saldo Pendiente</span>
            </div>
            <p className="text-2xl font-black text-amber-300">{formatCurrency(totalPendiente)}</p>
            <p className="text-xs text-chrome-500 mt-1">{countPendientes} cuenta(s) activa(s)</p>
          </div>
          <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 border border-red-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertTriangle size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider">Vencidas</span>
            </div>
            <p className="text-2xl font-black text-red-300">{countVencidos}</p>
            <p className="text-xs text-chrome-500 mt-1">cuenta(s) vencida(s)</p>
          </div>
        </div>

        {/* ── Filtros ── */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por cliente, placa o vehículo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-metal-900 border border-metal-800 rounded-xl pl-10 pr-4 py-3 text-chrome-100 placeholder-chrome-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
            />
          </div>
          <div className="relative min-w-[180px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-400" size={18} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full bg-metal-900 border border-metal-800 rounded-xl pl-10 pr-4 py-3 text-chrome-100 focus:outline-none focus:border-blue-500 appearance-none text-sm"
            >
              <option value="Todos">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Parcial">Parcial</option>
              <option value="Pagado">Saldados</option>
              <option value="Vencido">Vencidos</option>
            </select>
          </div>
        </div>

        {/* ── Tabla de cuentas ── */}
        {filteredAccounts.length > 0 ? (
          <div className="bg-metal-800/30 border border-metal-700/50 rounded-2xl overflow-hidden">
            {/* Header de tabla */}
            <div className="grid grid-cols-12 px-5 py-3 border-b border-metal-700/50 bg-metal-800/60">
              <div className="col-span-3 text-xs font-semibold text-chrome-500 uppercase tracking-wider">Vehículo / Cliente</div>
              <div className="col-span-2 text-xs font-semibold text-chrome-500 uppercase tracking-wider">Apertura</div>
              <div className="col-span-2 text-xs font-semibold text-chrome-500 uppercase tracking-wider text-right">Cargos</div>
              <div className="col-span-2 text-xs font-semibold text-chrome-500 uppercase tracking-wider text-right">Abonos</div>
              <div className="col-span-2 text-xs font-semibold text-chrome-500 uppercase tracking-wider text-right">Saldo</div>
              <div className="col-span-1 text-xs font-semibold text-chrome-500 uppercase tracking-wider text-center">Estado</div>
            </div>

            {filteredAccounts.map((acc, idx) => {
              const cfg = statusConfig[acc.status];
              const saldo = acc.totalAmount - acc.paidAmount;
              const progress = acc.totalAmount > 0 ? (acc.paidAmount / acc.totalAmount) * 100 : 0;
              return (
                <div
                  key={acc.id}
                  onClick={() => openDetail(acc)}
                  className={`grid grid-cols-12 px-5 py-4 items-center cursor-pointer hover:bg-metal-700/30 transition-colors group ${idx < filteredAccounts.length - 1 ? 'border-b border-metal-700/30' : ''}`}
                >
                  {/* Vehículo / Cliente */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Car size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="font-bold text-chrome-100 text-sm leading-tight">
                        {acc.vehiclePlate || '—'} {acc.vehicleBrand ? `· ${acc.vehicleBrand}` : ''}
                      </p>
                      <p className="text-chrome-400 text-xs mt-0.5 flex items-center gap-1">
                        <User size={10} /> {acc.customerName}
                      </p>
                    </div>
                  </div>

                  {/* Fecha */}
                  <div className="col-span-2">
                    <p className="text-chrome-300 text-sm">{formatDate(acc.date)}</p>
                    <p className="text-chrome-500 text-xs mt-0.5">{(acc.entries || []).length} movimientos</p>
                  </div>

                  {/* Cargos */}
                  <div className="col-span-2 text-right">
                    <p className="font-semibold text-chrome-200 text-sm">{formatCurrency(acc.totalAmount)}</p>
                  </div>

                  {/* Abonos */}
                  <div className="col-span-2 text-right">
                    <p className="font-semibold text-emerald-400 text-sm">{formatCurrency(acc.paidAmount)}</p>
                    {/* Barra de progreso */}
                    <div className="w-full h-1 bg-metal-900 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Saldo */}
                  <div className="col-span-2 text-right">
                    <p className={`font-bold text-sm ${saldo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {formatCurrency(saldo)}
                    </p>
                  </div>

                  {/* Estado */}
                  <div className="col-span-1 flex justify-center items-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center bg-metal-800/30 rounded-2xl border border-metal-700/50 border-dashed">
            <BookOpen size={48} className="mx-auto text-chrome-600 mb-4" />
            <p className="text-chrome-300 text-lg font-semibold">No hay cuentas por cobrar</p>
            <p className="text-chrome-500 text-sm mt-1">
              {searchTerm || statusFilter !== 'Todos'
                ? 'No hay resultados para la búsqueda aplicada.'
                : 'Las cuentas se crean automáticamente al agregar productos a un informe de vehículo.'}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — VISTA DETALLE (Libro de Cuenta)
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'detail' && selectedAccount) {
    const cfg = statusConfig[selectedAccount.status];
    const saldo = selectedAccount.totalAmount - selectedAccount.paidAmount;

    return (
      <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto pb-24">

        {/* ── Breadcrumb / Back ── */}
        <button
          onClick={() => { setView('list'); setSelectedAccount(null); }}
          className="flex items-center gap-2 text-chrome-400 hover:text-chrome-100 transition-colors text-sm font-medium"
        >
          <ChevronLeft size={18} />
          Volver al Libro Mayor
        </button>

        {/* ── Header de la cuenta ── */}
        <div className="bg-gradient-to-br from-metal-800/80 to-metal-900/60 border border-metal-700/50 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                <Car size={26} className="text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-black text-chrome-100">
                    {selectedAccount.vehiclePlate || 'SIN PLACA'}
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-chrome-400 text-sm mt-1">
                  {selectedAccount.vehicleBrand} {selectedAccount.vehicleModel} {selectedAccount.vehicleYear}
                </p>
                <p className="text-chrome-500 text-xs mt-0.5 flex items-center gap-1">
                  <User size={11} /> {selectedAccount.customerName}
                </p>
              </div>
            </div>

            <div className="text-right md:text-right w-full md:w-auto">
              <p className="text-xs text-chrome-500 uppercase tracking-wider">Apertura de Cuenta</p>
              <p className="text-chrome-300 font-semibold">{formatDate(selectedAccount.date)}</p>
              <p className="text-xs text-chrome-500 mt-1">Vence: {formatDate(selectedAccount.dueDate)}</p>
            </div>
          </div>

          {/* ── Sub-KPIs de la cuenta ── */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-metal-700/50">
            <div className="text-center">
              <p className="text-xs text-chrome-500 uppercase tracking-wider mb-1">Total Cargado</p>
              <p className="text-xl font-black text-chrome-100">{formatCurrency(selectedAccount.totalAmount)}</p>
            </div>
            <div className="text-center border-x border-metal-700/50">
              <p className="text-xs text-chrome-500 uppercase tracking-wider mb-1">Total Abonado</p>
              <p className="text-xl font-black text-emerald-400">{formatCurrency(selectedAccount.paidAmount)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-chrome-500 uppercase tracking-wider mb-1">Saldo Pendiente</p>
              <p className={`text-xl font-black ${saldo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {formatCurrency(saldo)}
              </p>
            </div>
          </div>

          {/* Barra de progreso */}
          {selectedAccount.totalAmount > 0 && (
            <div className="mt-4">
              <div className="w-full h-2 bg-metal-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((selectedAccount.paidAmount / selectedAccount.totalAmount) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-chrome-500 mt-1 text-right">
                {((selectedAccount.paidAmount / selectedAccount.totalAmount) * 100).toFixed(1)}% cobrado
              </p>
            </div>
          )}
        </div>

        {/* ── Libro de Movimientos ── */}
        <div className="bg-metal-800/30 border border-metal-700/50 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-metal-700/50 flex items-center justify-between">
            <h3 className="font-bold text-chrome-100 flex items-center gap-2">
              <FileText size={18} className="text-blue-400" />
              Libro de Movimientos
            </h3>
            <span className="text-xs text-chrome-500">{ledgerRows.length} movimiento(s)</span>
          </div>

          {/* Columnas */}
          <div className="grid grid-cols-12 px-5 py-2.5 bg-metal-800/60 border-b border-metal-700/30">
            <div className="col-span-2 text-xs font-semibold text-chrome-500 uppercase tracking-wider">Fecha</div>
            <div className="col-span-3 text-xs font-semibold text-chrome-500 uppercase tracking-wider">Descripción</div>
            <div className="col-span-1 text-xs font-semibold text-chrome-500 uppercase tracking-wider text-center">Tipo</div>
            <div className="col-span-2 text-xs font-semibold text-chrome-500 uppercase tracking-wider text-right">Cargo (+)</div>
            <div className="col-span-2 text-xs font-semibold text-chrome-500 uppercase tracking-wider text-right">Abono (−)</div>
            <div className="col-span-1 text-xs font-semibold text-chrome-500 uppercase tracking-wider text-right">Saldo</div>
            <div className="col-span-1 text-xs font-semibold text-chrome-500 uppercase tracking-wider text-center">Acciones</div>
          </div>

          {/* Filas de movimientos */}
          {ledgerRows.length > 0 ? (
            <>
              {ledgerRows.map((row, idx) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-12 px-5 py-3.5 items-center ${idx < ledgerRows.length - 1 ? 'border-b border-metal-700/20' : ''} ${row.type === 'Abono' ? 'bg-emerald-900/10' : ''}`}
                >
                  {/* Fecha */}
                  <div className="col-span-2">
                    <p className="text-chrome-300 text-xs font-mono">
                      {new Date(row.date).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </p>
                  </div>

                  {/* Descripción */}
                  <div className="col-span-3 flex items-center gap-2">
                    {row.type === 'Cargo' ? (
                      <ArrowUpCircle size={14} className="text-red-400 flex-shrink-0" />
                    ) : (
                      <ArrowDownCircle size={14} className="text-emerald-400 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-chrome-200 text-sm leading-tight">{row.description}</p>
                      {row.reference && (
                        <p className="text-chrome-500 text-xs">Ref: {row.reference}</p>
                      )}
                    </div>
                  </div>

                  {/* Tipo badge */}
                  <div className="col-span-1 flex justify-center">
                    {row.type === 'Cargo' ? (
                      <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded text-[10px] font-bold uppercase">
                        Cargo
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold uppercase">
                        Abono
                      </span>
                    )}
                  </div>

                  {/* Cargo */}
                  <div className="col-span-2 text-right">
                    {row.type === 'Cargo' ? (
                      <span className="font-semibold text-chrome-200 text-sm">{formatCurrency(row.amount)}</span>
                    ) : (
                      <span className="text-chrome-600 text-sm">—</span>
                    )}
                  </div>

                  {/* Abono */}
                  <div className="col-span-2 text-right">
                    {row.type === 'Abono' ? (
                      <span className="font-semibold text-emerald-400 text-sm">{formatCurrency(row.amount)}</span>
                    ) : (
                      <span className="text-chrome-600 text-sm">—</span>
                    )}
                  </div>

                  {/* Saldo corriente */}
                  <div className="col-span-1 text-right">
                    <span className={`font-bold text-sm ${(row as any).balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {formatCurrency((row as any).balance)}
                    </span>
                  </div>

                  {/* Acciones para Administradores sobre Abonos */}
                  <div className="col-span-1 flex justify-center gap-2">
                    {row.type === 'Abono' && isAdmin ? (
                      <>
                        <button
                          onClick={() => handleOpenEditAbono(row)}
                          className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                          title="Editar abono"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteAbono(row.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                          title="Eliminar abono"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <span className="text-chrome-600 text-xs">—</span>
                    )}
                  </div>
                </div>
              ))}

              {/* ── Fila de Totales ── */}
              <div className="grid grid-cols-12 px-5 py-4 border-t-2 border-metal-600/50 bg-metal-800/60">
                <div className="col-span-5 flex items-center">
                  <span className="text-xs font-bold text-chrome-400 uppercase tracking-wider">Totales</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="font-black text-chrome-100 text-sm">{formatCurrency(selectedAccount.totalAmount)}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="font-black text-emerald-400 text-sm">{formatCurrency(selectedAccount.paidAmount)}</span>
                </div>
                <div className="col-span-1 col-start-11 text-right">
                  <span className={`font-black text-sm ${saldo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {formatCurrency(saldo)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-10 text-center">
              <FileText size={32} className="mx-auto text-chrome-600 mb-3" />
              <p className="text-chrome-500 text-sm">Sin movimientos registrados.</p>
            </div>
          )}
        </div>

        {/* ── Acción: Registrar Abono ── */}
        {selectedAccount.status !== 'Pagado' && (
          <div className="flex justify-end gap-3">
            <button
              onClick={handleOpenPayment}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50"
            >
              <Plus size={20} />
              Registrar Abono
            </button>
          </div>
        )}

        {selectedAccount.status === 'Pagado' && (
          <div className="flex items-center justify-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle size={22} className="text-emerald-400" />
            <p className="text-emerald-400 font-bold">Esta cuenta está completamente saldada.</p>
          </div>
        )}

        {/* ══ MODAL DE REGISTRAR ABONO ════════════════════════════════════════ */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-metal-900 border border-metal-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">

              <div className="p-6 border-b border-metal-800 flex justify-between items-center">
                <h3 className="text-xl font-bold text-chrome-100 flex items-center gap-2">
                  <DollarSign className="text-emerald-400" size={22} />
                  Registrar Abono
                </h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-chrome-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleRegisterPayment} className="p-6 space-y-4">
                {/* Info cuenta */}
                <div className="bg-metal-800/50 p-4 rounded-xl border border-metal-700/50 text-center">
                  <p className="text-chrome-400 text-xs uppercase tracking-wider">
                    {selectedAccount.vehiclePlate} · {selectedAccount.customerName}
                  </p>
                  <p className="text-chrome-500 text-xs mt-0.5">Saldo pendiente</p>
                  <p className="text-3xl font-black text-amber-400 mt-1">
                    {formatCurrency(selectedAccount.totalAmount - selectedAccount.paidAmount)}
                  </p>
                </div>

                {/* Monto */}
                <div>
                  <label className="block text-sm font-medium text-chrome-400 mb-1.5">Monto a Abonar ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-emerald-500 text-lg font-bold"
                  />
                </div>

                {/* Método */}
                <div>
                  <label className="block text-sm font-medium text-chrome-400 mb-1.5">Método de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-emerald-500"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Referencia */}
                <div>
                  <label className="block text-sm font-medium text-chrome-400 mb-1.5">Referencia (Opcional)</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    placeholder="Nro. de transferencia, comprobante..."
                    className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-emerald-500 placeholder-chrome-600"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-metal-800">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-metal-700 text-chrome-300 hover:bg-metal-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-900/20"
                  >
                    {isSubmitting ? 'Guardando...' : 'Confirmar Abono'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══ MODAL DE EDICIÓN DE ABONO (ADMIN) ═════════════════════════════ */}
        {editingAbono && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-metal-900 border border-metal-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">

              <div className="p-6 border-b border-metal-800 flex justify-between items-center">
                <h3 className="text-xl font-bold text-chrome-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Editar Abono (Admin)
                </h3>
                <button onClick={() => setEditingAbono(null)} className="text-chrome-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateAbono} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-chrome-400 mb-1.5">Monto del Abono ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-blue-500 text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-chrome-400 mb-1.5">Método de Pago</label>
                  <select
                    value={editMethod}
                    onChange={e => setEditMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-blue-500"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-chrome-400 mb-1.5">Referencia</label>
                  <input
                    type="text"
                    value={editRef}
                    onChange={e => setEditRef(e.target.value)}
                    placeholder="Nro. de transferencia, comprobante..."
                    className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-blue-500 placeholder-chrome-600"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-metal-800">
                  <button
                    type="button"
                    onClick={() => setEditingAbono(null)}
                    className="px-5 py-2.5 rounded-xl border border-metal-700 text-chrome-300 hover:bg-metal-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold rounded-xl transition-colors shadow-lg"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default AccountsReceivableModule;
