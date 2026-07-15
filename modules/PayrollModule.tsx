
import React, { useState, useMemo } from 'react';
import { 
  Users, UserPlus, DollarSign, TrendingUp, Wrench, Search,
  CheckCircle2, ShoppingBag, Info, Edit3, Trash2, X, Check,
  Calendar, CalendarClock, Banknote, LayoutList, ChevronDown
} from 'lucide-react';
import { Employee, VehicleRepair, RepairItem, PayrollRecord, Sale, PayrollPeriod, Expense } from '../types';
import CurrencyInput from '../components/CurrencyInput';

const ALL_ROLES: Employee['role'][] = [
  'MecÃ¡nico', 'Ayudante de MecÃ¡nica', 'Vendedor',
  'Gerente', 'Administrador', 'Administradora', 'Contadora'
];

const ROLE_COLORS: Record<string, string> = {
  'MecÃ¡nico':            'bg-blue-600',
  'Ayudante de MecÃ¡nica':'bg-sky-500',
  'Vendedor':            'bg-emerald-600',
  'Gerente':             'bg-purple-700',
  'Administrador':       'bg-slate-700',
  'Administradora':      'bg-pink-600',
  'Contadora':           'bg-amber-600',
};

const PERIOD_FACTOR: Record<PayrollPeriod, number> = {
  'Semanal':    1 / 4,
  'Quincenal':  1 / 2,
  'Mensual':    1,
};

const PayrollModule: React.FC<{ store: any }> = ({ store }) => {
  const [showAddModal, setShowAddModal]   = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [period, setPeriod]               = useState<PayrollPeriod>('Mensual');
  const [activeTab, setActiveTab]         = useState<'nomina' | 'consolidado'>('nomina');
  const [formData, setFormData]           = useState<Partial<Employee>>({
    role: 'MecÃ¡nico', baseSalary: 0, commissionRate: 0.50,
  });

  const isAdm = store.currentUser?.role === 'administrador';

  const filteredEmployees = useMemo(() =>
    (store.employees || []).filter((e: Employee) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [store.employees, searchQuery]);

  // Commission pool for sellers
  const sharedSalesCommission = useMemo(() => {
    const totalSales = (store.sales || []).reduce((acc: number, s: Sale) => acc + Number(s.total || 0), 0);
    const commissionPool = totalSales * 0.025;
    const sellerCount = (store.employees || []).filter((e: Employee) => e.role === 'Vendedor').length;
    return { totalPool: commissionPool, perSeller: sellerCount > 0 ? commissionPool / sellerCount : 0, totalSales };
  }, [store.sales, store.employees]);

  const getEmployeeEarnings = (emp: Employee, factor = 1) => {
    // Compute labor commission for ALL roles that have commissionRate > 0
    const completedRepairs = (store.repairs || []).filter((r: VehicleRepair) =>
      r.mechanicId === emp.id && r.status === 'Entregado'
    );
    const laborCommission = completedRepairs.reduce((total: number, repair: VehicleRepair) => {
      const laborTotal = repair.items
        .filter((item: RepairItem) => item.type === 'Servicio')
        .reduce((sum: number, item: RepairItem) => sum + item.price * item.quantity, 0);
      return total + laborTotal * (emp.commissionRate || 0);
    }, 0);

    if (emp.role === 'Vendedor') {
      const totalCommission = sharedSalesCommission.perSeller + laborCommission;
      return {
        base: emp.baseSalary * factor,
        commission: totalCommission * factor,
        total: (emp.baseSalary + totalCommission) * factor,
        repairCount: completedRepairs.length,
        commissionType: emp.commissionRate > 0 ? 'Ventas + Mano de Obra' : 'Compartida (2.5% Ventas)',
      };
    }

    // All other roles (Mecánico, Ayudante, Gerente, Administrador, Administradora, Contadora)
    const commissionType =
      emp.commissionRate > 0 ? `Comisión M.O. ${(emp.commissionRate * 100).toFixed(0)}%` : 'Sueldo Fijo';
    return {
      base: emp.baseSalary * factor,
      commission: laborCommission * factor,
      total: (emp.baseSalary + laborCommission) * factor,
      repairCount: completedRepairs.length,
      commissionType,
    };
  };

  const factor = PERIOD_FACTOR[period];

  const totals = useMemo(() =>
    (store.employees || []).reduce((acc: any, emp: Employee) => {
      const e = getEmployeeEarnings(emp, factor);
      acc.total += e.total; acc.commissions += e.commission; acc.base += e.base;
      return acc;
    }, { total: 0, commissions: 0, base: 0 }),
    [store.employees, store.repairs, store.sales, sharedSalesCommission, factor]);

  // ——————————————————————————————————————————————————————————————————————
  const handleLiquidate = (emp: Employee) => {
    const earnings = getEmployeeEarnings(emp, factor);
    if (earnings.total <= 0) { alert('No hay montos pendientes para liquidar.'); return; }
    if (!confirm(`¿Liquidar $${earnings.total.toFixed(2)} para ${emp.name} (${period})?`)) return;

    const record: PayrollRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: emp.id, date: new Date().toISOString(),
      baseSalary: earnings.base, commission: earnings.commission,
      total: earnings.total, period, status: 'Pagado',
    };
    store.addPayrollRecord?.(record);

    // Descuento automático de caja
    const expense: Expense = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      expenseType: 'Gasto Fijo',
      category: 'Nómina Administrativa',
      description: `Pago de nómina ${period} — ${emp.name} (${emp.role})`,
      amount: earnings.total,
    };
    store.addExpense?.(expense);
    alert(`✅ Nómina ${period} de ${emp.name} liquidada y registrada en caja.`);
  };

  // ——————————————————————————————————————————————————————————————————————————————
  const handleLiquidateAll = () => {
    const employees: Employee[] = store.employees || [];
    if (employees.length === 0) { alert('No hay empleados registrados.'); return; }
    const totalAmount = employees.reduce((acc: number, emp: Employee) => acc + getEmployeeEarnings(emp, factor).total, 0);
    if (!confirm(`¿Liquidar nómina COMPLETA (${period}) por un total de $${totalAmount.toFixed(2)} para ${employees.length} empleados? Se registrará en caja.`)) return;

    employees.forEach((emp: Employee) => {
      const earnings = getEmployeeEarnings(emp, factor);
      if (earnings.total <= 0) return;
      store.addPayrollRecord?.({
        id: Math.random().toString(36).substr(2, 9),
        employeeId: emp.id, date: new Date().toISOString(),
        baseSalary: earnings.base, commission: earnings.commission,
        total: earnings.total, period, status: 'Pagado',
      } as PayrollRecord);
      store.addExpense?.({
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split('T')[0],
        expenseType: 'Gasto Fijo',
        category: 'Nómina Administrativa',
        description: `Pago de nómina ${period} — ${emp.name} (${emp.role})`,
        amount: earnings.total,
      } as Expense);
    });
    alert(`✅ Nómina ${period} completa liquidada ($${totalAmount.toFixed(2)}) y registrada en caja.`);
  };

  const handleOpenAdd = () => { setEditingEmployee(null); setFormData({ role: 'Mecánico', baseSalary: 0, commissionRate: 0.50 }); setShowAddModal(true); };
  const handleOpenEdit = (emp: Employee) => { setEditingEmployee(emp); setFormData({ ...emp }); setShowAddModal(true); };
  const handleDelete = (id: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name} de la nómina?`)) return;
    store.deleteEmployee(id);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      store.updateEmployee({ ...editingEmployee, ...formData } as Employee);
      alert('Colaborador actualizado');
    } else {
      store.addEmployee({ ...formData as Employee, id: Math.random().toString(36).substr(2, 9) });
      alert('Colaborador registrado');
    }
    setShowAddModal(false);
  };

  // PayrollRecord history for consolidado tab
  const payrollHistory: PayrollRecord[] = useMemo(() =>
    [...(store.payroll || [])].reverse(), [store.payroll]);

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div>
          <h3 className="text-3xl font-black text-chrome-100 tracking-tighter uppercase leading-none">Nómina y Participaciones</h3>
          <p className="text-chrome-400 font-medium mt-2">Gestión de sueldos, comisiones y consolidado periódico</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18}/>
            <input type="text" placeholder="Buscar personal..." className="pl-12 pr-6 py-3 bg-metal-mid border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold text-sm transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
          </div>
          {isAdm && (
            <>
              <button onClick={handleOpenAdd} className="btn-chrome px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 active:scale-95 shadow-xl">
                <UserPlus size={16}/> Alta Personal
              </button>
              <button onClick={handleLiquidateAll} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-emerald-700 active:scale-95 shadow-xl shadow-emerald-100 transition-all">
                <Banknote size={16}/> Liquidar Todo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-4 mb-8">
        <span className="text-[10px] font-black text-chrome-500 uppercase tracking-widest flex items-center gap-2">
          <CalendarClock size={14}/> Período de Cálculo:
        </span>
        <div className="flex bg-metal-dark rounded-2xl p-1 border border-metal-border">
          {(['Semanal', 'Quincenal', 'Mensual'] as PayrollPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${period === p ? 'bg-blue-600 text-white shadow-lg' : 'text-chrome-500 hover:text-chrome-300'}`}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-metal-mid p-7 rounded-2xl border border-metal-border shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 text-slate-50 opacity-10 group-hover:scale-110 transition-transform"><DollarSign size={100}/></div>
          <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-2">Total Nómina ({period})</p>
          <h4 className="text-4xl font-black text-chrome-100 tracking-tighter">${totals.total.toFixed(2)}</h4>
          <div className="mt-4 flex items-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 px-3 py-1 rounded-full w-fit">
            <TrendingUp size={14}/> {totals.total > 0 ? ((totals.commissions / totals.total) * 100).toFixed(1) : 0}% es variable
          </div>
        </div>
        <div className="bg-slate-900 p-7 rounded-2xl text-white shadow-2xl relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-white/5"><ShoppingBag size={100}/></div>
          <p className="text-[10px] font-black text-chrome-400 uppercase tracking-widest mb-2">Fondo Comisiones Venta</p>
          <h4 className="text-4xl font-black tracking-tighter text-emerald-400">${sharedSalesCommission.totalPool.toFixed(2)}</h4>
          <p className="mt-4 text-[10px] font-bold text-chrome-500 uppercase">2.5% de ${sharedSalesCommission.totalSales.toFixed(2)} en ventas</p>
        </div>
        <div className="bg-metal-mid p-7 rounded-2xl border border-metal-border shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 text-slate-50 opacity-10 group-hover:scale-110 transition-transform"><Wrench size={100}/></div>
          <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-2">Comisiones Técnicas</p>
          <h4 className="text-4xl font-black text-chrome-100 tracking-tighter">${(totals.commissions - sharedSalesCommission.totalPool * factor).toFixed(2)}</h4>
          <p className="mt-4 text-[10px] font-bold text-chrome-500 uppercase italic">Para personal técnico</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-metal-dark p-1 rounded-2xl border border-metal-border w-fit">
        <button onClick={() => setActiveTab('nomina')} className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'nomina' ? 'bg-blue-600 text-white shadow-lg' : 'text-chrome-500 hover:text-chrome-300'}`}>
          <Users size={14}/> Personal
        </button>
        <button onClick={() => setActiveTab('consolidado')} className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'consolidado' ? 'bg-blue-600 text-white shadow-lg' : 'text-chrome-500 hover:text-chrome-300'}`}>
          <LayoutList size={14}/> Consolidado
        </button>
      </div>

      {/* TAB: Nómina de Personal */}
      {activeTab === 'nomina' && (
        <div className="bg-metal-mid rounded-2xl border border-metal-border shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-metal-dark border-b border-metal-border">
                  <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Colaborador / Cargo</th>
                  <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Esquema</th>
                  <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-right">Base ({period})</th>
                  <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-right">Comisión</th>
                  <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-center">Total a Pagar</th>
                  <th className="px-8 py-5 no-print text-center text-[10px] font-black text-chrome-500 uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-metal-border">
                {filteredEmployees.map((emp: Employee) => {
                  const earnings = getEmployeeEarnings(emp, factor);
                  return (
                    <tr key={emp.id} className="hover:bg-metal-dark/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg ${ROLE_COLORS[emp.role] || 'bg-slate-700'}`}>
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-chrome-100 uppercase text-sm leading-tight">{emp.name}</p>
                            <p className="text-[10px] font-bold text-chrome-500 uppercase mt-0.5 tracking-tighter">{emp.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border w-fit block ${
                          emp.role === 'Mecánico' || emp.role === 'Ayudante de Mecánica'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : emp.role === 'Vendedor'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-metal-dark text-chrome-400 border-metal-border'
                        }`}>{earnings.commissionType}</span>
                        <p className="text-[8px] font-bold text-chrome-500 mt-1 uppercase italic">Tasa: {(emp.commissionRate * 100).toFixed(0)}% mano obra</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className="font-bold text-chrome-200 text-sm">${earnings.base.toFixed(2)}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={`font-black text-sm ${earnings.commission > 0 ? 'text-emerald-600' : 'text-chrome-500'}`}>
                          +${earnings.commission.toFixed(2)}
                        </span>
                        {earnings.repairCount > 0 && (
                          <p className="text-[9px] font-bold text-chrome-500 uppercase italic">de {earnings.repairCount} serv.</p>
                        )}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="inline-flex flex-col items-center px-4 py-2 bg-metal-dark rounded-2xl border border-metal-border group-hover:border-emerald-200 transition-all">
                          <span className="text-lg font-black text-chrome-100 tracking-tighter">${earnings.total.toFixed(2)}</span>
                          <span className="text-[8px] font-bold text-chrome-500 uppercase">{period}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center no-print">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleLiquidate(emp)} className="p-2 bg-metal-mid border border-metal-border rounded-xl text-chrome-500 hover:text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all" title="Liquidar Pago">
                            <CheckCircle2 size={16}/>
                          </button>
                          {isAdm && (
                            <>
                              <button onClick={() => handleOpenEdit(emp)} className="p-2 bg-metal-mid border border-metal-border rounded-xl text-chrome-500 hover:text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-all" title="Editar">
                                <Edit3 size={16}/>
                              </button>
                              <button onClick={() => handleDelete(emp.id, emp.name)} className="p-2 bg-metal-mid border border-metal-border rounded-xl text-chrome-500 hover:text-red-600 hover:border-red-500 hover:bg-red-50 transition-all" title="Eliminar">
                                <Trash2 size={16}/>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredEmployees.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-24 text-chrome-500">
              <Users size={64} className="opacity-20 mb-4"/>
              <p className="text-[10px] font-black uppercase tracking-widest">No se encontró personal registrado</p>
            </div>
          )}
        </div>
      )}

      {/* TAB: Consolidado */}
      {activeTab === 'consolidado' && (
        <div className="bg-metal-mid rounded-2xl border border-metal-border shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="px-8 py-5 bg-metal-dark border-b border-metal-border flex justify-between items-center">
            <h4 className="text-sm font-black text-chrome-100 uppercase tracking-widest flex items-center gap-2">
              <LayoutList size={16}/> Historial de Pagos de Nómina
            </h4>
            <span className="text-[10px] font-bold text-chrome-500">{payrollHistory.length} registros</span>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-metal-border">
                  <th className="px-8 py-4 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Empleado</th>
                  <th className="px-8 py-4 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Fecha</th>
                  <th className="px-8 py-4 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Período</th>
                  <th className="px-8 py-4 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-right">Base</th>
                  <th className="px-8 py-4 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-right">Comisión</th>
                  <th className="px-8 py-4 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-right">Total</th>
                  <th className="px-8 py-4 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-metal-border">
                {payrollHistory.map((record: PayrollRecord) => {
                  const emp = (store.employees || []).find((e: Employee) => e.id === record.employeeId);
                  return (
                    <tr key={record.id} className="hover:bg-metal-dark/50 transition-colors">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-xs ${ROLE_COLORS[emp?.role || ''] || 'bg-slate-700'}`}>
                            {emp?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-black text-chrome-100 text-sm">{emp?.name || 'Empleado eliminado'}</p>
                            <p className="text-[9px] font-bold text-chrome-500 uppercase">{emp?.role || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <span className="text-sm font-bold text-chrome-400 flex items-center gap-1">
                          <Calendar size={12}/> {new Date(record.date).toLocaleDateString('es-VE')}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          record.period === 'Mensual' ? 'bg-blue-500/20 text-blue-400' :
                          record.period === 'Quincenal' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>{record.period || 'Mensual'}</span>
                      </td>
                      <td className="px-8 py-4 text-right font-bold text-chrome-300 text-sm">${record.baseSalary.toFixed(2)}</td>
                      <td className="px-8 py-4 text-right font-bold text-emerald-500 text-sm">+${record.commission.toFixed(2)}</td>
                      <td className="px-8 py-4 text-right font-black text-chrome-100 text-base">${record.total.toFixed(2)}</td>
                      <td className="px-8 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${record.status === 'Pagado' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {payrollHistory.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-24 text-chrome-500">
              <LayoutList size={48} className="opacity-20 mb-4"/>
              <p className="text-[10px] font-black uppercase tracking-widest">No hay pagos de nómina registrados</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Agregar/Editar Personal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-metal-border">
            <div className="p-10 bg-slate-950 text-white relative">
              <div className="absolute top-0 right-0 p-10 opacity-10"><Users size={120}/></div>
              <h3 className="text-3xl font-black uppercase tracking-tighter relative z-10">
                {editingEmployee ? 'Modificar Colaborador' : 'Alta de Personal'}
              </h3>
              <p className="text-chrome-400 text-[10px] font-black uppercase tracking-widest mt-1 relative z-10">
                {editingEmployee ? `Editando: ${editingEmployee.name}` : 'Definición de esquema de pago'}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                <input required type="text" placeholder="Ej: María González" className="w-full px-6 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold transition-all" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Cargo</label>
                  <select className="w-full px-4 py-4 bg-metal-dark border border-metal-border rounded-2xl font-black uppercase text-[10px] tracking-widest outline-none focus:ring-4 focus:ring-blue-500/15 transition-all appearance-none cursor-pointer"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as Employee['role']})}>
                    {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <CurrencyInput
                    valueUsd={formData.baseSalary || 0}
                    onChangeUsd={(val) => setFormData({...formData, baseSalary: val})}
                    label="Sueldo Base"
                    required
                  />
                </div>
              </div>

              {/* Commission panel — visible for ALL roles */}
              <div className="p-5 bg-blue-950/40 rounded-2xl border border-blue-500/20 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">
                      Comisión sobre Mano de Obra / Servicios
                    </label>
                    <p className="text-[9px] text-chrome-500 font-medium mt-0.5">
                      Se aplica sobre el total de mano de obra en reparaciones entregadas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      className="w-16 px-2 py-1.5 bg-metal-dark border border-blue-500/30 rounded-xl text-center font-black text-lg text-blue-300 outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                      value={Math.round((formData.commissionRate || 0) * 100)}
                      onChange={e => {
                        const pct = Math.min(100, Math.max(0, Number(e.target.value)));
                        setFormData({...formData, commissionRate: pct / 100});
                      }}
                    />
                    <span className="text-xl font-black text-blue-400">%</span>
                  </div>
                </div>
                <input
                  type="range" min="0" max="100" step="1"
                  className="w-full accent-blue-500 cursor-pointer"
                  value={Math.round((formData.commissionRate || 0) * 100)}
                  onChange={e => setFormData({...formData, commissionRate: Number(e.target.value) / 100})}
                />
                <div className="flex justify-between text-[9px] font-bold text-chrome-500">
                  <span>0% (Sin comisión)</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {formData.role === 'Vendedor' && (
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-start gap-3">
                  <ShoppingBag className="text-emerald-400 shrink-0 mt-0.5" size={16}/>
                  <p className="text-[10px] text-emerald-300 font-bold leading-relaxed uppercase">
                    Además participa del 2.50% compartido de ventas totales.
                  </p>
                </div>
              )}
              {['Gerente','Administrador','Administradora','Contadora'].includes(formData.role || '') && formData.commissionRate === 0 && (
                <div className="p-6 bg-metal-dark rounded-3xl border border-metal-border flex items-start gap-4">
                  <DollarSign className="text-chrome-400 shrink-0" size={20}/>
                  <p className="text-[10px] text-chrome-400 font-bold leading-relaxed uppercase">Percibe sueldo fijo mensual sin comisiones variables.</p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-chrome-500 font-black uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors">
                  <X size={16} className="inline mr-1"/> Cancelar
                </button>
                <button type="submit" className="flex-[1.5] btn-chrome py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95">
                  <Check size={16}/> {editingEmployee ? 'Guardar Cambios' : 'Confirmar Alta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default PayrollModule;
