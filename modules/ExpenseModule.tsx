import React, { useState, useMemo } from 'react';
import { Sparkles, Loader2, CalendarClock, Activity, Edit3, Trash2, Tag, Calendar, Wallet, Plus } from 'lucide-react';
import { useGonzacarsStore } from '../store';
import { Expense, ExpenseCategory, ExpenseType, FixedExpenseCategory, VariableExpenseCategory } from '../types';
import { suggestExpenseCategory } from '../lib/gemini';
import CurrencyInput from '../components/CurrencyInput';
import CurrencyBadge from '../components/CurrencyBadge';

const fixedCategories = ['Alquiler', 'Luz', 'Agua', 'Internet', 'Impuestos', 'Nómina Administrativa', 'Servicios de Aseo', 'Oficina'];
const variableCategories = ['Repuestos Adicionales', 'Herramientas', 'Mantenimiento', 'Viáticos', 'Imprevistos', 'Limpieza', 'Víveres'];

const ExpenseModule: React.FC<{ store: any }> = ({ store }) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    expenseType: 'Gasto Fijo',
    category: 'Oficina',
    amount: 0,
    description: ''
  });

  const handleDescriptionBlur = async () => {
    if (!formData.description || formData.description.length < 3) return;
    setIsAiLoading(true);
    try {
      const suggested = await suggestExpenseCategory(formData.description);
      if (suggested && suggested.includes('|')) {
        const [type, cat] = suggested.split('|');
        if ((type === 'Gasto Fijo' || type === 'Gasto Variable') && (fixedCategories.includes(cat) || variableCategories.includes(cat))) {
          setFormData(prev => ({ 
            ...prev, 
            expenseType: type as ExpenseType,
            category: cat as ExpenseCategory 
          }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      store.updateExpense(editingId, formData as Expense);
      alert('Gasto actualizado exitosamente');
      setEditingId(null);
    } else {
      store.addExpense({ ...formData as Expense, id: Math.random().toString(36).substr(2, 9) });
      alert('Gasto registrado exitosamente');
    }
    setFormData({ 
      date: new Date().toISOString().split('T')[0], 
      expenseType: 'Gasto Fijo',
      category: 'Oficina', 
      amount: 0, 
      description: '' 
    });
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setFormData({ ...expense });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculate summaries for current month
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthExpenses = store.expenses.filter((exp: Expense) => {
    const expDate = new Date(exp.date);
    return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
  });

  const totalFixed = currentMonthExpenses
    .filter((exp: Expense) => exp.expenseType === 'Gasto Fijo')
    .reduce((acc: number, exp: Expense) => acc + exp.amount, 0);

  const totalVariable = currentMonthExpenses
    .filter((exp: Expense) => exp.expenseType === 'Gasto Variable')
    .reduce((acc: number, exp: Expense) => acc + exp.amount, 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Summary Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-metal-mid p-6 rounded-3xl border border-blue-500/30 shadow-lg flex items-center justify-between">
           <div>
             <h4 className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                <CalendarClock size={16} /> Gastos Fijos (Mes)
             </h4>
             <p className="text-3xl font-black text-chrome-100">${totalFixed.toFixed(2)}</p>
           </div>
           <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
             <Wallet size={32}/>
           </div>
        </div>
        <div className="bg-metal-mid p-6 rounded-3xl border border-orange-500/30 shadow-lg flex items-center justify-between">
           <div>
             <h4 className="text-sm font-black text-orange-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                <Activity size={16} /> Gastos Variables (Mes)
             </h4>
             <p className="text-3xl font-black text-chrome-100">${totalVariable.toFixed(2)}</p>
           </div>
           <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
             <Activity size={32}/>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-metal-mid p-8 rounded-3xl shadow-xl border border-metal-border h-fit">
          <h3 className="text-xl font-black text-chrome-100 mb-6 flex items-center gap-2">
            {editingId ? <Edit3 size={24} className="text-blue-600"/> : <Plus size={24} className="text-blue-600"/>}
            {editingId ? 'Editar Egreso' : 'Nuevo Egreso'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-2 ml-1">Tipo de Gasto</label>
              <div className="grid grid-cols-2 gap-3">
                 <button
                   type="button"
                   onClick={() => setFormData(prev => ({ ...prev, expenseType: 'Gasto Fijo', category: fixedCategories[0] }))}
                   className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${formData.expenseType === 'Gasto Fijo' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-metal-dark text-chrome-500 hover:text-chrome-300'}`}
                 >
                   Fijo
                 </button>
                 <button
                   type="button"
                   onClick={() => setFormData(prev => ({ ...prev, expenseType: 'Gasto Variable', category: variableCategories[0] }))}
                   className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${formData.expenseType === 'Gasto Variable' ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/30' : 'bg-metal-dark text-chrome-500 hover:text-chrome-300'}`}
                 >
                   Variable
                 </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-1.5 ml-1">Descripción del Pago</label>
              <div className="relative">
                 <textarea 
                  required 
                  className="w-full px-4 py-3 bg-metal-dark border border-metal-border rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/15 h-24 resize-none transition-all" 
                  value={formData.description || ''} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  onBlur={handleDescriptionBlur}
                  placeholder="Ej: Pago de electricidad mensual..."
                />
                {isAiLoading && (
                  <div className="absolute bottom-2 right-2 animate-spin text-blue-500">
                    <Loader2 size={16}/>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Categoría</label>
                {!isAiLoading && formData.description && (
                  <span className="text-[9px] font-black text-blue-500 flex items-center gap-1 animate-pulse">
                    <Sparkles size={10}/> IA Activa
                  </span>
                )}
              </div>
              <select 
                className="w-full px-4 py-3 bg-metal-dark border border-metal-border rounded-2xl text-sm font-black outline-none appearance-none focus:ring-4 focus:ring-blue-500/15" 
                value={formData.category} 
                onChange={(e) => setFormData({...formData, category: e.target.value as ExpenseCategory})}
              >
                {formData.expenseType === 'Gasto Fijo' 
                  ? fixedCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                  : variableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                }
              </select>
            </div>
            
            <CurrencyInput
              valueUsd={formData.amount || 0}
              onChangeUsd={(val) => setFormData({...formData, amount: val})}
              label="Monto"
              required
            />
            
            <div className="flex gap-3">
              <button type="submit" className="flex-1 btn-chrome py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-lg">
                {editingId ? 'Actualizar Egreso' : 'Registrar Egreso'}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ date: new Date().toISOString().split('T')[0], expenseType: 'Gasto Fijo', category: 'Oficina', amount: 0, description: '' });
                  }}
                  className="px-6 bg-metal-dark text-chrome-500 rounded-2xl font-black text-xs hover:text-white hover:bg-red-500/20 transition-all border border-metal-border hover:border-red-500/50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-xl font-black text-chrome-100 uppercase tracking-tighter">Historial de Salidas</h3>
            <span className="text-xs font-bold text-chrome-500">Cronológico</span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
            {store.expenses.slice().reverse().map((exp: Expense) => (
              <div key={exp.id} className="bg-metal-mid p-5 rounded-3xl border border-metal-border shadow-sm flex items-center justify-between hover:border-blue-500/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${exp.expenseType === 'Gasto Fijo' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
                    {exp.expenseType === 'Gasto Fijo' ? <CalendarClock size={20}/> : <Activity size={20}/>}
                  </div>
                  <div>
                    <h5 className="font-black text-chrome-100 leading-tight uppercase text-sm">{exp.description}</h5>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[10px] font-bold text-chrome-500 flex items-center gap-1"><Calendar size={10}/> {exp.date}</span>
                       <span className="w-1 h-1 rounded-full bg-metal-border"></span>
                       <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${exp.expenseType === 'Gasto Fijo' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                         {exp.expenseType || 'Variable'}
                       </span>
                       <span className="w-1 h-1 rounded-full bg-metal-border"></span>
                       <span className="text-[10px] font-bold text-chrome-400 flex items-center gap-1"><Tag size={10}/> {exp.category}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <CurrencyBadge amountUsd={exp.amount} size="md" className="text-red-500" />
                  </div>
                  <button 
                    onClick={() => handleEdit(exp)}
                    className="p-2 text-chrome-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
                    title="Editar gasto"
                  >
                    <Edit3 size={18}/>
                  </button>
                </div>
              </div>
            ))}
            {store.expenses.length === 0 && (
              <div className="text-center py-20 bg-metal-dark/50 rounded-3xl border-2 border-dashed border-metal-border">
                <Wallet size={48} className="mx-auto mb-4 text-chrome-500" />
                <p className="font-bold text-chrome-500">No hay egresos registrados</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseModule;
