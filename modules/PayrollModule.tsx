import React, { useState, useMemo, useRef } from 'react';
import {
  Users, UserPlus, DollarSign, TrendingUp, Wrench, Search,
  CheckCircle2, ShoppingBag, Edit3, Trash2, X, Check,
  Calendar, CalendarClock, Banknote, LayoutList, FileText,
  Plus, Printer, Building2, CreditCard, Phone, Mail,
  ChevronDown, AlertCircle
} from 'lucide-react';
import { Employee, VehicleRepair, RepairItem, PayrollRecord, Sale, PayrollPeriod, Expense, PayrollBonus, PayrollDeduction } from '../types';
import CurrencyInput from '../components/CurrencyInput';
import { formatCurrency } from '../lib/utils/finance';

const ALL_ROLES: Employee['role'][] = [
  'Mecánico', 'Ayudante de Mecánica', 'Vendedor',
  'Administrador', 'Gerente', 'Administradora', 'Contadora'
];

const ROLE_COLORS: Record<string, string> = {
  'Mecánico':            'bg-blue-600',
  'Ayudante de Mecánica':'bg-sky-500',
  'Vendedor':            'bg-emerald-600',
  'Gerente':             'bg-purple-700',
  'Administrador':       'bg-slate-700',
  'Administradora':      'bg-pink-600',
  'Contadora':           'bg-amber-600',
};

const VENEZUELAN_BANKS = [
  'Banesco', 'Mercantil', 'BBVA Provincial', 'Banco de Venezuela',
  'BNC', 'Bancamiga', 'Bicentenario', 'Sofitasa', 'Del Tesoro',
  'Exterior', 'Venezolano de Crédito', 'Activo', 'Fondo Común', 'Otro'
];

const PERIOD_FACTOR: Record<PayrollPeriod, number> = {
  'Semanal':   1 / 4,
  'Quincenal': 1 / 2,
  'Mensual':   1,
};

/* ─── Helper: calculate earnings for one employee ─── */
const calcEarnings = (emp: Employee, factor: number, repairs: VehicleRepair[], sales: Sale[], sharedPerSeller: number) => {
  const completedRepairs = repairs.filter(r => r.mechanicId === emp.id && r.status === 'Entregado');
  const laborCommission = completedRepairs.reduce((total, repair) => {
    const laborTotal = (repair.items || [])
      .filter(item => item.type === 'Servicio')
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
    return total + laborTotal * (emp.commissionRate || 0);
  }, 0);

  let commission = laborCommission;
  if (emp.role === 'Vendedor') commission += sharedPerSeller;

  const base = emp.baseSalary * factor;
  const commissionAdjusted = commission * factor;

  // Bonuses (pro-rated by factor)
  const bonuses = emp.bonuses || [];
  const bonusesTotal = bonuses.reduce((sum, b) => {
    if (b.type === 'Fijo') return sum + b.amount * factor;
    return sum + (emp.baseSalary * (b.amount / 100)) * factor;
  }, 0);

  const grossTotal = base + commissionAdjusted + bonusesTotal;

  // Deductions (calculated on gross)
  const deductions = emp.deductions || [];
  const deductionsTotal = deductions.reduce((sum, d) => {
    if (d.type === 'Fijo') return sum + d.amount * factor;
    return sum + grossTotal * (d.amount / 100);
  }, 0);

  const netTotal = grossTotal - deductionsTotal;

  return {
    base, commission: commissionAdjusted, bonusesTotal,
    deductionsTotal, grossTotal, netTotal,
    repairCount: completedRepairs.length,
  };
};

/* ════════════════════════════════════════════════════════════════
   RECIBO DE PAGO — Modal de vista previa e impresión
════════════════════════════════════════════════════════════════ */
interface PayReceiptProps {
  record: PayrollRecord;
  emp: Employee;
  exchangeRate: number;
  onClose: () => void;
}
const PayReceipt: React.FC<PayReceiptProps> = ({ record, emp, exchangeRate, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => window.print();

  const fUSD = (v: number) => `$${v.toFixed(2)}`;
  const fBS = (v: number) => `Bs. ${(v * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const hireDate = emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No especificado';
  const payDate = new Date(record.date).toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      {/* Print stylesheet */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #pay-receipt-printable { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="w-full max-w-2xl my-4">
        {/* Controls */}
        <div className="no-print flex justify-between items-center mb-4">
          <h2 className="text-chrome-100 font-black text-lg">Vista Previa del Recibo</h2>
          <div className="flex gap-3">
            <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-sm">
              <Printer size={16} /> Imprimir / PDF
            </button>
            <button onClick={onClose} className="p-2.5 bg-metal-800 hover:bg-metal-700 text-chrome-400 rounded-xl transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Receipt Document */}
        <div id="pay-receipt-printable" ref={printRef}
          className="bg-white text-gray-900 rounded-2xl overflow-hidden shadow-2xl"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Gonzacars C.A.</h1>
                <p className="text-slate-300 text-sm mt-1">Taller Mecánico y Repuestos</p>
                <p className="text-slate-400 text-xs mt-1">RIF: J-XXXXXXXXX-X</p>
              </div>
              <div className="text-right">
                <div className="bg-blue-600 text-white px-4 py-2 rounded-xl inline-block">
                  <p className="text-xs font-bold uppercase tracking-widest">Recibo de Pago</p>
                  <p className="text-lg font-black">{record.period || 'Mensual'}</p>
                </div>
                <p className="text-slate-400 text-xs mt-2">{payDate}</p>
              </div>
            </div>
          </div>

          {/* Employee Info */}
          <div className="p-8 border-b border-gray-100 grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Datos del Colaborador</p>
              <p className="text-xl font-black text-gray-900 uppercase">{emp.name}</p>
              <p className="text-sm text-gray-500 mt-0.5 font-medium">{emp.role}</p>
              <div className="mt-3 space-y-1">
                {emp.cedula && <p className="text-sm text-gray-600"><span className="font-semibold">C.I.:</span> {emp.cedula}</p>}
                {emp.phone && <p className="text-sm text-gray-600"><span className="font-semibold">Tel.:</span> {emp.phone}</p>}
                {emp.email && <p className="text-sm text-gray-600"><span className="font-semibold">Email:</span> {emp.email}</p>}
                {emp.hireDate && <p className="text-sm text-gray-600"><span className="font-semibold">Ingreso:</span> {hireDate}</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Datos de Pago</p>
              {emp.bankName && <p className="text-sm text-gray-600"><span className="font-semibold">Banco:</span> {emp.bankName}</p>}
              {emp.bankAccount && <p className="text-sm text-gray-600"><span className="font-semibold">Cuenta:</span> {emp.bankAccount}</p>}
              <p className="text-sm text-gray-600 mt-1"><span className="font-semibold">Período:</span> {record.period || 'Mensual'}</p>
              <p className="text-sm text-gray-600"><span className="font-semibold">Fecha de Pago:</span> {payDate}</p>
              <p className="text-sm text-gray-600"><span className="font-semibold">Tasa Bs/$:</span> {exchangeRate.toFixed(2)}</p>
            </div>
          </div>

          {/* Asignaciones */}
          <div className="p-8">
            <div className="grid grid-cols-2 gap-6">
              {/* Asignaciones column */}
              <div>
                <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-3 pb-2 border-b-2 border-emerald-100">
                  Asignaciones
                </p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-50">
                    <tr>
                      <td className="py-2 text-gray-600">Sueldo Base</td>
                      <td className="py-2 text-right font-bold text-gray-900">{fUSD(record.baseSalary)}</td>
                    </tr>
                    {record.commission > 0 && (
                      <tr>
                        <td className="py-2 text-gray-600">Comisiones</td>
                        <td className="py-2 text-right font-bold text-emerald-700">{fUSD(record.commission)}</td>
                      </tr>
                    )}
                    {(record.bonusesDetail || []).map((b, i) => (
                      <tr key={i}>
                        <td className="py-2 text-gray-600">{b.name}</td>
                        <td className="py-2 text-right font-bold text-emerald-700">{fUSD(b.type === 'Fijo' ? b.amount : 0)}</td>
                      </tr>
                    ))}
                    {record.bonusesTotal > 0 && (record.bonusesDetail || []).length === 0 && (
                      <tr>
                        <td className="py-2 text-gray-600">Bonos</td>
                        <td className="py-2 text-right font-bold text-emerald-700">{fUSD(record.bonusesTotal)}</td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-emerald-200 bg-emerald-50">
                      <td className="py-2.5 font-black text-emerald-800">Total Bruto</td>
                      <td className="py-2.5 text-right font-black text-emerald-800">{fUSD(record.grossTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Deducciones column */}
              <div>
                <p className="text-xs font-black text-red-700 uppercase tracking-widest mb-3 pb-2 border-b-2 border-red-100">
                  Deducciones
                </p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-50">
                    {record.deductionsTotal <= 0 && (
                      <tr>
                        <td colSpan={2} className="py-4 text-center text-gray-400 text-xs italic">Sin deducciones</td>
                      </tr>
                    )}
                    {(record.deductionsDetail || []).map((d, i) => (
                      <tr key={i}>
                        <td className="py-2 text-gray-600">{d.name}</td>
                        <td className="py-2 text-right font-bold text-red-600">-{fUSD(d.type === 'Fijo' ? d.amount : (record.grossTotal * d.amount / 100))}</td>
                      </tr>
                    ))}
                    {record.deductionsTotal > 0 && (record.deductionsDetail || []).length === 0 && (
                      <tr>
                        <td className="py-2 text-gray-600">Deducciones</td>
                        <td className="py-2 text-right font-bold text-red-600">-{fUSD(record.deductionsTotal)}</td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-red-200 bg-red-50">
                      <td className="py-2.5 font-black text-red-800">Total Deducciones</td>
                      <td className="py-2.5 text-right font-black text-red-800">-{fUSD(record.deductionsTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Neto Final */}
            <div className="mt-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 flex justify-between items-center">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Neto a Cobrar</p>
                <p className="text-slate-300 text-sm mt-0.5">{record.period || 'Mensual'} • {payDate}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white">{fUSD(record.total)}</p>
                <p className="text-blue-400 text-sm font-bold mt-0.5">{fBS(record.total)}</p>
              </div>
            </div>
          </div>

          {/* Firma */}
          <div className="px-8 pb-8 grid grid-cols-2 gap-8">
            <div className="border-t-2 border-gray-200 pt-4 text-center">
              <p className="text-xs text-gray-400 font-medium">Firma del Empleado</p>
              <p className="text-sm font-black text-gray-700 mt-1">{emp.name}</p>
              <p className="text-xs text-gray-400">{emp.cedula ? `C.I. ${emp.cedula}` : ''}</p>
            </div>
            <div className="border-t-2 border-gray-200 pt-4 text-center">
              <p className="text-xs text-gray-400 font-medium">Autorizado por</p>
              <p className="text-sm font-black text-gray-700 mt-1">Gonzacars C.A.</p>
              <p className="text-xs text-gray-400">Departamento de RRHH</p>
            </div>
          </div>

          <div className="bg-gray-50 px-8 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              Este documento es un comprobante oficial de pago de nómina. Emitido por Gonzacars C.A.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   MODAL EMPLEADO — Alta / Edición
════════════════════════════════════════════════════════════════ */
interface EmployeeModalProps {
  employee: Employee | null;
  onClose: () => void;
  onSave: (emp: Partial<Employee>) => void;
}
const EmployeeModal: React.FC<EmployeeModalProps> = ({ employee, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Employee>>(
    employee ? { ...employee } : { role: 'Mecánico', baseSalary: 0, commissionRate: 0.50, bonuses: [], deductions: [] }
  );
  const [activeSection, setActiveSection] = useState<'personal' | 'bank' | 'payroll'>('personal');

  const set = (key: keyof Employee, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  // Bonuses management
  const addBonus = () => {
    const newBonus: PayrollBonus = { id: Math.random().toString(36).substr(2, 6), name: '', amount: 0, type: 'Fijo' };
    set('bonuses', [...(formData.bonuses || []), newBonus]);
  };
  const updateBonus = (id: string, key: keyof PayrollBonus, value: any) => {
    set('bonuses', (formData.bonuses || []).map(b => b.id === id ? { ...b, [key]: value } : b));
  };
  const removeBonus = (id: string) => set('bonuses', (formData.bonuses || []).filter(b => b.id !== id));

  // Deductions management
  const addDeduction = () => {
    const newDed: PayrollDeduction = { id: Math.random().toString(36).substr(2, 6), name: '', amount: 0, type: 'Porcentaje' };
    set('deductions', [...(formData.deductions || []), newDed]);
  };
  const addLegalDeduction = (name: string, amount: number) => {
    if ((formData.deductions || []).some(d => d.name === name)) return;
    const newDed: PayrollDeduction = { id: Math.random().toString(36).substr(2, 6), name, amount, type: 'Porcentaje' };
    set('deductions', [...(formData.deductions || []), newDed]);
  };
  const updateDeduction = (id: string, key: keyof PayrollDeduction, value: any) => {
    set('deductions', (formData.deductions || []).map(d => d.id === id ? { ...d, [key]: value } : d));
  };
  const removeDeduction = (id: string) => set('deductions', (formData.deductions || []).filter(d => d.id !== id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const sections = [
    { key: 'personal', label: 'Personal', icon: <Users size={14}/> },
    { key: 'bank', label: 'Banco', icon: <CreditCard size={14}/> },
    { key: 'payroll', label: 'Nómina', icon: <DollarSign size={14}/> },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-metal-900 border border-metal-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-950 to-metal-900 border-b border-metal-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Users size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-chrome-100">
                {employee ? 'Modificar Colaborador' : 'Alta de Personal'}
              </h3>
              <p className="text-chrome-500 text-xs">
                {employee ? `Editando: ${employee.name}` : 'Registro nuevo en nómina'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-chrome-500 hover:text-white hover:bg-metal-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex bg-metal-900 border-b border-metal-800">
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-wider transition-all
                ${activeSection === s.key ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-chrome-500 hover:text-chrome-300'}`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">

            {/* ── SECCIÓN: Personal ── */}
            {activeSection === 'personal' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-chrome-400 uppercase tracking-wider mb-1.5">Nombre Completo *</label>
                  <input required type="text" placeholder="Ej: María González"
                    className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 placeholder-chrome-600 focus:outline-none focus:border-blue-500 transition-colors"
                    value={formData.name || ''} onChange={e => set('name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-chrome-400 uppercase tracking-wider mb-1.5">Cédula</label>
                    <input type="text" placeholder="V-12.345.678"
                      className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 placeholder-chrome-600 focus:outline-none focus:border-blue-500 transition-colors"
                      value={formData.cedula || ''} onChange={e => set('cedula', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-chrome-400 uppercase tracking-wider mb-1.5">Teléfono</label>
                    <input type="text" placeholder="0414-0000000"
                      className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 placeholder-chrome-600 focus:outline-none focus:border-blue-500 transition-colors"
                      value={formData.phone || ''} onChange={e => set('phone', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-chrome-400 uppercase tracking-wider mb-1.5">Correo Electrónico</label>
                    <input type="email" placeholder="correo@ejemplo.com"
                      className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 placeholder-chrome-600 focus:outline-none focus:border-blue-500 transition-colors"
                      value={formData.email || ''} onChange={e => set('email', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-chrome-400 uppercase tracking-wider mb-1.5">Fecha de Ingreso</label>
                    <input type="date"
                      className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-blue-500 transition-colors"
                      value={formData.hireDate ? formData.hireDate.split('T')[0] : ''} onChange={e => set('hireDate', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-chrome-400 uppercase tracking-wider mb-1.5">Cargo *</label>
                  <select required
                    className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    value={formData.role} onChange={e => set('role', e.target.value as Employee['role'])}>
                    {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* ── SECCIÓN: Banco ── */}
            {activeSection === 'bank' && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                  <CreditCard size={18} className="text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-300">Los datos bancarios aparecerán en el recibo de pago del colaborador.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-chrome-400 uppercase tracking-wider mb-1.5">Banco</label>
                  <select
                    className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    value={formData.bankName || ''} onChange={e => set('bankName', e.target.value)}>
                    <option value="">Seleccionar banco...</option>
                    {VENEZUELAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-chrome-400 uppercase tracking-wider mb-1.5">Número de Cuenta</label>
                  <input type="text" placeholder="0134-XXXX-XX-XXXXXXXXXX"
                    className="w-full bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 placeholder-chrome-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    value={formData.bankAccount || ''} onChange={e => set('bankAccount', e.target.value)} />
                </div>
              </div>
            )}

            {/* ── SECCIÓN: Nómina ── */}
            {activeSection === 'payroll' && (
              <div className="space-y-5">
                {/* Sueldo base + comisión */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <CurrencyInput
                      valueUsd={formData.baseSalary || 0}
                      onChangeUsd={val => set('baseSalary', val)}
                      label="Sueldo Base Mensual ($)" required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-chrome-400 uppercase tracking-wider mb-1.5">Tasa Comisión M.O.</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={100} step={1}
                        className="flex-1 bg-metal-800 border border-metal-700 rounded-xl px-4 py-3 text-chrome-100 text-center font-black text-lg focus:outline-none focus:border-blue-500 transition-colors"
                        value={Math.round((formData.commissionRate || 0) * 100)}
                        onChange={e => set('commissionRate', Math.min(100, Math.max(0, Number(e.target.value))) / 100)} />
                      <span className="text-xl font-black text-chrome-400">%</span>
                    </div>
                  </div>
                </div>

                {/* Bonos */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Asignaciones / Bonos</p>
                    <button type="button" onClick={addBonus}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-500/30 transition-colors">
                      <Plus size={14} /> Agregar Bono
                    </button>
                  </div>
                  {/* Quick add legal bonuses */}
                  <div className="flex gap-2 flex-wrap mb-3">
                    {['Bono de Alimentación', 'Bono de Transporte', 'Bono por Antigüedad'].map(b => (
                      <button key={b} type="button" onClick={() => addBonus()}
                        className="px-2.5 py-1 text-[10px] font-bold text-chrome-400 border border-metal-700 rounded-lg hover:border-emerald-500/50 hover:text-emerald-400 transition-colors">
                        + {b}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(formData.bonuses || []).map(b => (
                      <div key={b.id} className="flex items-center gap-2 bg-metal-800/50 border border-metal-700/50 rounded-xl p-3">
                        <input type="text" placeholder="Nombre del bono"
                          className="flex-1 bg-transparent text-chrome-100 text-sm placeholder-chrome-600 focus:outline-none min-w-0"
                          value={b.name} onChange={e => updateBonus(b.id, 'name', e.target.value)} />
                        <select value={b.type} onChange={e => updateBonus(b.id, 'type', e.target.value)}
                          className="bg-metal-700 text-chrome-300 text-xs rounded-lg px-2 py-1.5 border border-metal-600 focus:outline-none">
                          <option value="Fijo">$ Fijo</option>
                          <option value="Porcentaje">%</option>
                        </select>
                        <input type="number" min={0} step={0.01} placeholder="0.00"
                          className="w-20 bg-metal-700 border border-metal-600 rounded-lg px-2 py-1.5 text-emerald-400 font-bold text-sm text-right focus:outline-none"
                          value={b.amount} onChange={e => updateBonus(b.id, 'amount', parseFloat(e.target.value) || 0)} />
                        <button type="button" onClick={() => removeBonus(b.id)} className="p-1.5 text-chrome-600 hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {(formData.bonuses || []).length === 0 && (
                      <p className="text-xs text-chrome-600 text-center py-3 italic">Sin bonos configurados</p>
                    )}
                  </div>
                </div>

                {/* Deducciones */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-black text-red-400 uppercase tracking-widest">Deducciones</p>
                    <button type="button" onClick={addDeduction}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-bold border border-red-500/30 transition-colors">
                      <Plus size={14} /> Agregar Deducción
                    </button>
                  </div>
                  {/* Quick add legal deductions */}
                  <div className="flex gap-2 flex-wrap mb-3">
                    <button type="button" onClick={() => addLegalDeduction('SSO (Empleado)', 4)}
                      className="px-2.5 py-1 text-[10px] font-bold text-chrome-400 border border-metal-700 rounded-lg hover:border-red-500/50 hover:text-red-400 transition-colors">
                      + SSO 4%
                    </button>
                    <button type="button" onClick={() => addLegalDeduction('FAOV', 1)}
                      className="px-2.5 py-1 text-[10px] font-bold text-chrome-400 border border-metal-700 rounded-lg hover:border-red-500/50 hover:text-red-400 transition-colors">
                      + FAOV 1%
                    </button>
                    <button type="button" onClick={() => addLegalDeduction('ISLR (Retención)', 3)}
                      className="px-2.5 py-1 text-[10px] font-bold text-chrome-400 border border-metal-700 rounded-lg hover:border-red-500/50 hover:text-red-400 transition-colors">
                      + ISLR
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(formData.deductions || []).map(d => (
                      <div key={d.id} className="flex items-center gap-2 bg-metal-800/50 border border-metal-700/50 rounded-xl p-3">
                        <input type="text" placeholder="Nombre de la deducción"
                          className="flex-1 bg-transparent text-chrome-100 text-sm placeholder-chrome-600 focus:outline-none min-w-0"
                          value={d.name} onChange={e => updateDeduction(d.id, 'name', e.target.value)} />
                        <select value={d.type} onChange={e => updateDeduction(d.id, 'type', e.target.value)}
                          className="bg-metal-700 text-chrome-300 text-xs rounded-lg px-2 py-1.5 border border-metal-600 focus:outline-none">
                          <option value="Porcentaje">% Bruto</option>
                          <option value="Fijo">$ Fijo</option>
                        </select>
                        <input type="number" min={0} step={0.01} placeholder="0.00"
                          className="w-20 bg-metal-700 border border-metal-600 rounded-lg px-2 py-1.5 text-red-400 font-bold text-sm text-right focus:outline-none"
                          value={d.amount} onChange={e => updateDeduction(d.id, 'amount', parseFloat(e.target.value) || 0)} />
                        <button type="button" onClick={() => removeDeduction(d.id)} className="p-1.5 text-chrome-600 hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {(formData.deductions || []).length === 0 && (
                      <p className="text-xs text-chrome-600 text-center py-3 italic">Sin deducciones configuradas</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-metal-800 flex gap-3 justify-between">
            <div className="flex gap-1">
              {sections.map((s, i) => (
                <div key={s.key} className={`w-2 h-2 rounded-full transition-colors ${activeSection === s.key ? 'bg-blue-500' : 'bg-metal-700'}`} />
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 border border-metal-700 text-chrome-400 hover:text-white hover:bg-metal-800 rounded-xl font-bold text-sm transition-colors">
                Cancelar
              </button>
              <button type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl transition-colors shadow-lg shadow-blue-900/30 flex items-center gap-2">
                <Check size={16} /> {employee ? 'Guardar Cambios' : 'Registrar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   PAYROLL MODULE — Principal
════════════════════════════════════════════════════════════════ */
const PayrollModule: React.FC<{ store: any }> = ({ store }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [receiptRecord, setReceiptRecord] = useState<{ record: PayrollRecord; emp: Employee } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<PayrollPeriod>('Mensual');
  const [activeTab, setActiveTab] = useState<'nomina' | 'consolidado'>('nomina');

  const isAdm = store.currentUser?.role === 'administrador';
  const exchangeRate: number = store.exchangeRate || 1;

  const filteredEmployees = useMemo(() =>
    (store.employees || []).filter((e: Employee) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [store.employees, searchQuery]);

  const sharedSalesCommission = useMemo(() => {
    const totalSales = (store.sales || []).reduce((acc: number, s: Sale) => acc + Number(s.total || 0), 0);
    const commissionPool = totalSales * 0.025;
    const sellerCount = (store.employees || []).filter((e: Employee) => e.role === 'Vendedor').length;
    return { totalPool: commissionPool, perSeller: sellerCount > 0 ? commissionPool / sellerCount : 0, totalSales };
  }, [store.sales, store.employees]);

  const factor = PERIOD_FACTOR[period];

  const totals = useMemo(() =>
    (store.employees || []).reduce((acc: any, emp: Employee) => {
      const e = calcEarnings(emp, factor, store.repairs || [], store.sales || [], sharedSalesCommission.perSeller);
      acc.gross += e.grossTotal;
      acc.deductions += e.deductionsTotal;
      acc.net += e.netTotal;
      return acc;
    }, { gross: 0, deductions: 0, net: 0 }),
    [store.employees, store.repairs, store.sales, sharedSalesCommission, factor]);

  const handleSaveEmployee = (data: Partial<Employee>) => {
    if (editingEmployee) {
      store.updateEmployee({ ...editingEmployee, ...data } as Employee);
    } else {
      store.addEmployee({ ...data as Employee, id: Math.random().toString(36).substr(2, 9) });
    }
    setShowModal(false);
    setEditingEmployee(null);
  };

  const handleLiquidate = (emp: Employee) => {
    const e = calcEarnings(emp, factor, store.repairs || [], store.sales || [], sharedSalesCommission.perSeller);
    if (e.netTotal <= 0) { alert('No hay montos para liquidar.'); return; }
    if (!confirm(`¿Liquidar ${formatCurrency(e.netTotal)} neto para ${emp.name} (${period})?`)) return;

    const record: PayrollRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: emp.id,
      date: new Date().toISOString(),
      period,
      status: 'Pagado',
      baseSalary: e.base,
      commission: e.commission,
      bonusesTotal: e.bonusesTotal,
      bonusesDetail: emp.bonuses || [],
      deductionsTotal: e.deductionsTotal,
      deductionsDetail: emp.deductions || [],
      grossTotal: e.grossTotal,
      total: e.netTotal,
    };
    store.addPayrollRecord?.(record);
    store.addExpense?.({
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      expenseType: 'Gasto Fijo',
      category: 'Nómina Administrativa',
      description: `Nómina ${period} — ${emp.name} (${emp.role})`,
      amount: e.netTotal,
    } as Expense);
    // Auto-open receipt after liquidation
    setReceiptRecord({ record, emp });
  };

  const handleLiquidateAll = () => {
    const employees: Employee[] = store.employees || [];
    if (employees.length === 0) return;
    const totalNet = employees.reduce((acc: number, emp: Employee) =>
      acc + calcEarnings(emp, factor, store.repairs || [], store.sales || [], sharedSalesCommission.perSeller).netTotal, 0);
    if (!confirm(`¿Liquidar nómina COMPLETA (${period}) por ${formatCurrency(totalNet)} neto para ${employees.length} colaboradores?`)) return;
    employees.forEach((emp: Employee) => {
      const e = calcEarnings(emp, factor, store.repairs || [], store.sales || [], sharedSalesCommission.perSeller);
      if (e.netTotal <= 0) return;
      store.addPayrollRecord?.({
        id: Math.random().toString(36).substr(2, 9),
        employeeId: emp.id, date: new Date().toISOString(), period, status: 'Pagado',
        baseSalary: e.base, commission: e.commission,
        bonusesTotal: e.bonusesTotal, bonusesDetail: emp.bonuses || [],
        deductionsTotal: e.deductionsTotal, deductionsDetail: emp.deductions || [],
        grossTotal: e.grossTotal, total: e.netTotal,
      } as PayrollRecord);
      store.addExpense?.({
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split('T')[0], expenseType: 'Gasto Fijo',
        category: 'Nómina Administrativa',
        description: `Nómina ${period} — ${emp.name}`, amount: e.netTotal,
      } as Expense);
    });
    alert(`✅ Nómina completa liquidada: ${formatCurrency(totalNet)} neto`);
  };

  const payrollHistory: PayrollRecord[] = useMemo(() =>
    [...(store.payroll || [])].reverse(), [store.payroll]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto pb-24">
      {/* Receipt Modal */}
      {receiptRecord && (
        <PayReceipt
          record={receiptRecord.record}
          emp={receiptRecord.emp}
          exchangeRate={exchangeRate}
          onClose={() => setReceiptRecord(null)}
        />
      )}

      {/* Employee Modal */}
      {showModal && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={() => { setShowModal(false); setEditingEmployee(null); }}
          onSave={handleSaveEmployee}
        />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-chrome-100 tracking-tighter uppercase leading-none flex items-center gap-3">
            <Users className="text-blue-500" size={32} />
            Nómina y Participaciones
          </h1>
          <p className="text-chrome-400 font-medium mt-2">Gestión de sueldos, bonos, deducciones y recibos de pago</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18}/>
            <input type="text" placeholder="Buscar personal..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3 bg-metal-800 border border-metal-700 rounded-xl text-chrome-100 placeholder-chrome-500 outline-none focus:border-blue-500 transition-all text-sm" />
          </div>
          {isAdm && (
            <>
              <button onClick={() => { setEditingEmployee(null); setShowModal(true); }}
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-colors shadow-lg shadow-blue-900/20">
                <UserPlus size={16}/> Alta Personal
              </button>
              <button onClick={handleLiquidateAll}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-colors shadow-lg shadow-emerald-900/20">
                <Banknote size={16}/> Liquidar Todo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-4 mb-8">
        <span className="text-xs font-black text-chrome-500 uppercase tracking-widest flex items-center gap-2">
          <CalendarClock size={14}/> Período:
        </span>
        <div className="flex bg-metal-800 rounded-xl p-1 border border-metal-700">
          {(['Semanal', 'Quincenal', 'Mensual'] as PayrollPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all
                ${period === p ? 'bg-blue-600 text-white shadow-lg' : 'text-chrome-500 hover:text-chrome-300'}`}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-metal-800/50 border border-metal-700/50 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -right-3 -bottom-3 opacity-10"><TrendingUp size={80}/></div>
          <p className="text-xs font-black text-chrome-400 uppercase tracking-widest mb-2">Bruto Total ({period})</p>
          <p className="text-3xl font-black text-chrome-100">{formatCurrency(totals.gross)}</p>
          <p className="text-xs text-chrome-500 mt-1">Bs. {(totals.gross * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -right-3 -bottom-3 opacity-10 text-red-400"><AlertCircle size={80}/></div>
          <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-2">Total Deducciones</p>
          <p className="text-3xl font-black text-red-400">{formatCurrency(totals.deductions)}</p>
          <p className="text-xs text-red-400/50 mt-1">SSO + FAOV + ISLR + Otros</p>
        </div>
        <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -right-3 -bottom-3 opacity-10 text-emerald-400"><DollarSign size={80}/></div>
          <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-2">Neto a Pagar ({period})</p>
          <p className="text-3xl font-black text-emerald-400">{formatCurrency(totals.net)}</p>
          <p className="text-xs text-emerald-400/50 mt-1">Bs. {(totals.net * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-metal-800 p-1 rounded-xl border border-metal-700 w-fit">
        <button onClick={() => setActiveTab('nomina')}
          className={`px-6 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all
            ${activeTab === 'nomina' ? 'bg-blue-600 text-white shadow-lg' : 'text-chrome-500 hover:text-chrome-300'}`}>
          <Users size={14}/> Personal
        </button>
        <button onClick={() => setActiveTab('consolidado')}
          className={`px-6 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all
            ${activeTab === 'consolidado' ? 'bg-blue-600 text-white shadow-lg' : 'text-chrome-500 hover:text-chrome-300'}`}>
          <LayoutList size={14}/> Historial
        </button>
      </div>

      {/* TAB: PERSONAL */}
      {activeTab === 'nomina' && (
        <div className="bg-metal-900 border border-metal-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-metal-800/50 border-b border-metal-800">
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest">Colaborador</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right">Base</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right">Comisión</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right">Bonos</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right">Deducciones</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-center">Neto a Pagar</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-center no-print">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-metal-800/50">
                {filteredEmployees.map((emp: Employee) => {
                  const e = calcEarnings(emp, factor, store.repairs || [], store.sales || [], sharedSalesCommission.perSeller);
                  return (
                    <tr key={emp.id} className="hover:bg-metal-800/30 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg ${ROLE_COLORS[emp.role] || 'bg-slate-700'}`}>
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-chrome-100 text-sm uppercase leading-tight">{emp.name}</p>
                            <p className="text-[10px] font-bold text-chrome-500 uppercase mt-0.5">{emp.role}</p>
                            {emp.cedula && <p className="text-[9px] text-chrome-600 mt-0.5">C.I. {emp.cedula}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <p className="font-bold text-chrome-200 text-sm">{formatCurrency(e.base)}</p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <p className={`font-bold text-sm ${e.commission > 0 ? 'text-blue-400' : 'text-chrome-600'}`}>
                          {formatCurrency(e.commission)}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <p className={`font-bold text-sm ${e.bonusesTotal > 0 ? 'text-emerald-400' : 'text-chrome-600'}`}>
                          {formatCurrency(e.bonusesTotal)}
                        </p>
                        {(emp.bonuses || []).length > 0 && (
                          <p className="text-[9px] text-chrome-600">{(emp.bonuses || []).length} bono(s)</p>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <p className={`font-bold text-sm ${e.deductionsTotal > 0 ? 'text-red-400' : 'text-chrome-600'}`}>
                          -{formatCurrency(e.deductionsTotal)}
                        </p>
                        {(emp.deductions || []).length > 0 && (
                          <p className="text-[9px] text-chrome-600">{(emp.deductions || []).length} deducción(es)</p>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="inline-flex flex-col items-center px-4 py-2 bg-emerald-950/30 border border-emerald-500/20 rounded-xl">
                          <p className="text-lg font-black text-emerald-400">{formatCurrency(e.netTotal)}</p>
                          <p className="text-[9px] text-emerald-600 font-bold">
                            Bs. {(e.netTotal * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center no-print">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleLiquidate(emp)}
                            title="Liquidar y generar recibo"
                            className="p-2.5 bg-emerald-600/10 border border-emerald-500/20 rounded-xl text-emerald-500 hover:bg-emerald-600/20 transition-all">
                            <CheckCircle2 size={16}/>
                          </button>
                          {isAdm && (
                            <>
                              <button onClick={() => { setEditingEmployee(emp); setShowModal(true); }}
                                title="Editar colaborador"
                                className="p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-500 hover:bg-blue-600/20 transition-all">
                                <Edit3 size={16}/>
                              </button>
                              <button onClick={() => { if (confirm(`¿Eliminar a ${emp.name}?`)) store.deleteEmployee(emp.id); }}
                                title="Eliminar"
                                className="p-2.5 bg-red-600/10 border border-red-500/20 rounded-xl text-red-500 hover:bg-red-600/20 transition-all">
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
            <div className="flex flex-col items-center justify-center py-20 text-chrome-500">
              <Users size={56} className="opacity-20 mb-4"/>
              <p className="text-xs font-black uppercase tracking-widest">No se encontró personal registrado</p>
            </div>
          )}
        </div>
      )}

      {/* TAB: HISTORIAL */}
      {activeTab === 'consolidado' && (
        <div className="bg-metal-900 border border-metal-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-metal-800 flex justify-between items-center">
            <h4 className="text-sm font-black text-chrome-100 uppercase tracking-widest flex items-center gap-2">
              <LayoutList size={16}/> Historial de Pagos
            </h4>
            <span className="text-xs font-bold text-chrome-500">{payrollHistory.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-metal-800/30 border-b border-metal-800">
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest">Empleado</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest">Fecha / Período</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right">Base</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right">Comis.</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right">Bonos</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right">Deduc.</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right">Neto</th>
                  <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-metal-800/50">
                {payrollHistory.map((record: PayrollRecord) => {
                  const emp = (store.employees || []).find((e: Employee) => e.id === record.employeeId);
                  return (
                    <tr key={record.id} className="hover:bg-metal-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-xs ${ROLE_COLORS[emp?.role || ''] || 'bg-slate-700'}`}>
                            {emp?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-black text-chrome-100 text-sm">{emp?.name || 'Emp. eliminado'}</p>
                            <p className="text-[9px] text-chrome-500 uppercase">{emp?.role || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-chrome-300 flex items-center gap-1.5">
                          <Calendar size={12} className="text-chrome-500"/>
                          {new Date(record.date).toLocaleDateString('es-VE')}
                        </p>
                        <span className={`mt-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase inline-block
                          ${record.period === 'Mensual' ? 'bg-blue-500/15 text-blue-400' :
                          record.period === 'Quincenal' ? 'bg-purple-500/15 text-purple-400' : 'bg-orange-500/15 text-orange-400'}`}>
                          {record.period || 'Mensual'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-chrome-300">{formatCurrency(record.baseSalary)}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-blue-400">{formatCurrency(record.commission)}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-emerald-400">{formatCurrency(record.bonusesTotal || 0)}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-red-400">-{formatCurrency(record.deductionsTotal || 0)}</td>
                      <td className="px-6 py-4 text-right font-black text-chrome-100">{formatCurrency(record.total)}</td>
                      <td className="px-6 py-4 text-center">
                        {emp && (
                          <button
                            onClick={() => setReceiptRecord({ record, emp })}
                            title="Ver Recibo de Pago"
                            className="p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400 hover:bg-blue-600/20 transition-all">
                            <FileText size={15}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {payrollHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-chrome-500">
              <LayoutList size={48} className="opacity-20 mb-4"/>
              <p className="text-xs font-black uppercase tracking-widest">No hay pagos de nómina registrados</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PayrollModule;
