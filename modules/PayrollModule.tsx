
import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  DollarSign, 
  TrendingUp, 
  Wrench, 
  Search, 
  CheckCircle2, 
  ShoppingBag, 
  Info,
  Edit3,
  Trash2,
  X,
  Check
} from 'lucide-react';
import { Employee, VehicleRepair, RepairItem, PayrollRecord, Sale } from '../types';

const PayrollModule: React.FC<{ store: any }> = ({ store }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Partial<Employee>>({
    role: 'Mecánico',
    baseSalary: 0,
    commissionRate: 0.50 
  });

  const isAdm = store.currentUser?.role === 'administrador';

  const filteredEmployees = useMemo(() => {
    return (store.employees || []).filter((e: Employee) => 
      e.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [store.employees, searchQuery]);

  // Cálculo de comisiones compartidas para vendedores (2.5% de ventas totales)
  const sharedSalesCommission = useMemo(() => {
    const totalSales = (store.sales || []).reduce((acc: number, s: Sale) => acc + Number(s.total || 0), 0);
    const commissionPool = totalSales * 0.025; 
    const sellerCount = (store.employees || []).filter((e: Employee) => e.role === 'Vendedor').length;
    
    return {
      totalPool: commissionPool,
      perSeller: sellerCount > 0 ? commissionPool / sellerCount : 0,
      totalSales
    };
  }, [store.sales, store.employees]);

  const getEmployeeEarnings = (emp: Employee) => {
    if (emp.role === 'Mecánico') {
      const completedRepairs = (store.repairs || []).filter((r: VehicleRepair) => 
        r.mechanicId === emp.id && r.status === 'Entregado'
      );

      const commissionTotal = completedRepairs.reduce((total: number, repair: VehicleRepair) => {
        const laborTotal = repair.items
          .filter((item: RepairItem) => item.type === 'Servicio')
          .reduce((sum: number, item: RepairItem) => sum + (item.price * item.quantity), 0);
        
        return total + (laborTotal * emp.commissionRate);
      }, 0);

      return { 
        base: emp.baseSalary, 
        commission: commissionTotal, 
        total: emp.baseSalary + commissionTotal,
        repairCount: completedRepairs.length,
        commissionType: 'Individual (Taller)'
      };
    }

    if (emp.role === 'Vendedor') {
      return {
        base: emp.baseSalary,
        commission: sharedSalesCommission.perSeller,
        total: emp.baseSalary + sharedSalesCommission.perSeller,
        repairCount: 0,
        commissionType: 'Compartida (2.5% Ventas Detal)'
      };
    }

    return { 
      base: emp.baseSalary, 
      commission: 0, 
      total: emp.baseSalary, 
      repairCount: 0,
      commissionType: 'Sueldo Fijo'
    };
  };

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setFormData({ role: 'Mecánico', baseSalary: 0, commissionRate: 0.50 });
    setShowAddModal(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({ ...emp });
    setShowAddModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`¿Está seguro de eliminar a ${name} de la nómina? Esta acción no se puede deshacer.`)) return;
    store.deleteEmployee(id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      store.updateEmployee({
        ...editingEmployee,
        ...formData
      } as Employee);
      alert('Información del colaborador actualizada');
    } else {
      store.addEmployee({
        ...formData as Employee,
        id: Math.random().toString(36).substr(2, 9)
      });
      alert('Nuevo colaborador registrado');
    }
    setShowAddModal(false);
  };

  const handleLiquidate = (emp: Employee) => {
    const earnings = getEmployeeEarnings(emp);
    if (earnings.total <= 0) {
      alert("No hay montos pendientes para liquidar a este empleado.");
      return;
    }

    const confirmPay = confirm(`¿Desea liquidar el pago de $${earnings.total.toFixed(2)} para ${emp.name}? Incluye base y comisiones.`);
    if (confirmPay) {
      const record: PayrollRecord = {
        id: Math.random().toString(36).substr(2, 9),
        employeeId: emp.id,
        date: new Date().toISOString(),
        baseSalary: earnings.base,
        commission: earnings.commission,
        total: earnings.total,
        status: 'Pagado'
      };
      
      if (store.addPayrollRecord) {
        store.addPayrollRecord(record);
      } else {
        alert(`Pago de $${earnings.total.toFixed(2)} registrado con éxito para ${emp.name}`);
      }
    }
  };

  const totals = useMemo(() => {
    return (store.employees || []).reduce((acc: any, emp: Employee) => {
      const e = getEmployeeEarnings(emp);
      acc.total += e.total;
      acc.commissions += e.commission;
      acc.base += e.base;
      return acc;
    }, { total: 0, commissions: 0, base: 0 });
  }, [store.employees, store.repairs, store.sales, sharedSalesCommission]);

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
        <div>
          <h3 className="text-3xl font-black text-chrome-100 tracking-tighter uppercase leading-none">Nómina y Participaciones</h3>
          <p className="text-chrome-400 font-medium mt-2">Gestión de sueldos y comisiones de taller y oficina</p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18}/>
            <input 
              type="text" 
              placeholder="Buscar personal..." 
              className="pl-12 pr-6 py-3 bg-metal-mid border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold text-sm transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {isAdm && (
            <button 
              onClick={handleOpenAdd}
              className="btn-chrome px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center gap-2 active:scale-95"
            >
              <UserPlus size={18}/> Alta de Personal
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-metal-mid p-8 rounded-2xl border border-metal-border shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 text-slate-50 opacity-10 group-hover:scale-110 transition-transform">
             <DollarSign size={120} />
          </div>
          <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-2">Presupuesto Total Nómina</p>
          <h4 className="text-4xl font-black text-chrome-100 tracking-tighter">${totals.total.toFixed(2)}</h4>
          <div className="mt-4 flex items-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 px-3 py-1 rounded-full w-fit">
            <TrendingUp size={14}/> {totals.total > 0 ? ((totals.commissions / totals.total) * 100).toFixed(1) : 0}% es variable
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-2xl text-white shadow-2xl relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-white/5">
             <ShoppingBag size={120} />
          </div>
          <p className="text-[10px] font-black text-chrome-400 uppercase tracking-widest mb-2">Fondo de Comisiones de Venta</p>
          <h4 className="text-4xl font-black tracking-tighter text-emerald-400">${sharedSalesCommission.totalPool.toFixed(2)}</h4>
          <p className="mt-4 text-[10px] font-bold text-chrome-500 uppercase">2.5% de ${sharedSalesCommission.totalSales.toFixed(2)} en ventas</p>
        </div>

        <div className="bg-metal-mid p-8 rounded-2xl border border-metal-border shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 text-slate-50 opacity-10 group-hover:scale-110 transition-transform">
             <Wrench size={120} />
          </div>
          <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-2">Comisiones por Servicios</p>
          <h4 className="text-4xl font-black text-chrome-100 tracking-tighter">${(totals.commissions - sharedSalesCommission.totalPool).toFixed(2)}</h4>
          <p className="mt-4 text-[10px] font-bold text-chrome-500 uppercase italic">Para personal técnico</p>
        </div>
      </div>

      <div className="bg-blue-50/50 p-4 rounded-3xl border border-blue-100 mb-6 flex items-center gap-4 text-blue-800">
         <div className="btn-chrome p-2 rounded-xl shadow-lg">
            <Info size={20} />
         </div>
         <p className="text-xs font-bold leading-relaxed">
            <b>Suministro Informativo:</b> Los Vendedores perciben el 2.50% de las ventas. Mecánicos cobran comisión sobre mano de obra.
         </p>
      </div>

      {/* Lista de Empleados */}
      <div className="bg-metal-mid rounded-2xl border border-metal-border shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-metal-dark border-b border-metal-border">
                <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Colaborador / Rol</th>
                <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Esquema de Pago</th>
                <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-right">Base</th>
                <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-right">Comisión</th>
                <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-center">Total</th>
                <th className="px-8 py-5 no-print text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEmployees.map((emp: Employee) => {
                const earnings = getEmployeeEarnings(emp);
                return (
                  <tr key={emp.id} className="hover:bg-metal-dark/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg ${emp.role === 'Mecánico' ? 'bg-blue-600' : emp.role === 'Vendedor' ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-chrome-100 uppercase text-sm leading-tight">{emp.name}</p>
                          <p className="text-[10px] font-bold text-chrome-500 uppercase mt-0.5 tracking-tighter">{emp.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border w-fit ${
                          emp.role === 'Mecánico' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : emp.role === 'Vendedor'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-metal-dark text-chrome-400 border-metal-border'
                        }`}>
                          {earnings.commissionType}
                        </span>
                        {emp.role === 'Mecánico' && (
                          <p className="text-[8px] font-bold text-chrome-500 mt-1 uppercase italic">Tasa: {(emp.commissionRate * 100).toFixed(0)}% mano obra</p>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className="font-bold text-chrome-200 text-sm">${emp.baseSalary.toFixed(2)}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-black text-sm ${earnings.commission > 0 ? 'text-emerald-600' : 'text-chrome-500'}`}>
                          +${earnings.commission.toFixed(2)}
                        </span>
                        {earnings.repairCount > 0 && (
                          <p className="text-[9px] font-bold text-chrome-500 uppercase italic">de {earnings.repairCount} serv.</p>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-flex flex-col items-center px-4 py-2 bg-metal-dark rounded-2xl border border-metal-border group-hover:bg-metal-mid group-hover:border-blue-200 transition-all">
                        <span className="text-lg font-black text-chrome-100 tracking-tighter">${earnings.total.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center no-print">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleLiquidate(emp)}
                          className="p-2 bg-metal-mid border border-metal-border rounded-xl text-chrome-500 hover:text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all shadow-sm"
                          title="Liquidar Pagos"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        {isAdm && (
                          <>
                            <button 
                              onClick={() => handleOpenEdit(emp)}
                              className="p-2 bg-metal-mid border border-metal-border rounded-xl text-chrome-500 hover:text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm"
                              title="Editar Empleado"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(emp.id, emp.name)}
                              className="p-2 bg-metal-mid border border-metal-border rounded-xl text-chrome-500 hover:text-red-600 hover:border-red-500 hover:bg-red-50 transition-all shadow-sm"
                              title="Eliminar Empleado"
                            >
                              <Trash2 size={16} />
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
             <Users size={64} className="opacity-20 mb-4" />
             <p className="text-[10px] font-black uppercase tracking-widest">No se encontró personal registrado</p>
          </div>
        )}
      </div>

      {/* Modal Agregar/Editar Personal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-metal-border animate-in zoom-in duration-300">
            <div className="p-10 bg-slate-950 text-white relative">
              <div className="absolute top-0 right-0 p-10 opacity-10">
                <Users size={120} />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tighter relative z-10">
                {editingEmployee ? 'Modificar Colaborador' : 'Contratación Personal'}
              </h3>
              <p className="text-chrome-400 text-[10px] font-black uppercase tracking-widest mt-1 relative z-10">
                {editingEmployee ? `Editando registro de ${editingEmployee.name}` : 'Definición de esquema de pago'}
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Nombre Completo del Colaborador</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Ej: Pedro Arrieche" 
                  className="w-full px-6 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold transition-all" 
                  value={formData.name || ''} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Rol / Cargo</label>
                  <select 
                    className="w-full px-6 py-4 bg-metal-dark border border-metal-border rounded-2xl font-black uppercase text-[10px] tracking-widest outline-none focus:ring-4 focus:ring-blue-500/15 transition-all appearance-none cursor-pointer" 
                    value={formData.role} 
                    onChange={(e) => setFormData({...formData, role: e.target.value as Employee['role'], commissionRate: e.target.value === 'Mecánico' ? 0.50 : 0})}
                  >
                    <option value="Mecánico">Mecánico</option>
                    <option value="Vendedor">Vendedor</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Sueldo Base ($)</label>
                  <input 
                    required 
                    type="number" 
                    className="w-full px-6 py-4 bg-metal-dark border border-metal-border rounded-2xl font-black text-lg outline-none focus:ring-4 focus:ring-blue-500/15 font-bold transition-all" 
                    value={formData.baseSalary || ''} 
                    onChange={(e) => setFormData({...formData, baseSalary: Number(e.target.value)})} 
                  />
                </div>
              </div>

              {formData.role === 'Mecánico' && (
                <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Tasa de Participación Técnica</label>
                    <span className="text-xl font-black text-blue-700">{(formData.commissionRate || 0) * 100}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    className="w-full accent-blue-600 cursor-pointer"
                    value={formData.commissionRate} 
                    onChange={(e) => setFormData({...formData, commissionRate: Number(e.target.value)})} 
                  />
                </div>
              )}

              {formData.role === 'Vendedor' && (
                <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-start gap-4">
                   <ShoppingBag className="text-emerald-600 shrink-0" size={20} />
                   <p className="text-[10px] text-emerald-800 font-bold leading-relaxed uppercase">
                      Participa automáticamente del fondo del 2.50% de las ventas totales.
                   </p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="flex-1 py-4 text-chrome-500 font-black uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors"
                >
                  <X size={16} className="inline mr-1" /> Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-[1.5] btn-chrome py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-black shadow-xl shadow-metal-border transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Check size={16} /> {editingEmployee ? 'Guardar Cambios' : 'Confirmar Registro'}
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
