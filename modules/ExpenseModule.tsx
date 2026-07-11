
import React, { useState } from 'react';
import { Wallet, Plus, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { Expense } from '../types';
import { suggestExpenseCategory } from '../lib/gemini';

const ExpenseModule: React.FC<{ store: any }> = ({ store }) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    category: 'Oficina',
    amount: 0,
    description: ''
  });

  const handleDescriptionBlur = async () => {
    if (!formData.description || formData.description.length < 3) return;
    setIsAiLoading(true);
    try {
      const suggested = await suggestExpenseCategory(formData.description);
      const validCategories = ['Limpieza', 'Oficina', 'Víveres', 'Impuesto', 'Aseo Urbano', 'Internet'];
      if (suggested && validCategories.includes(suggested)) {
        setFormData(prev => ({ ...prev, category: suggested as Expense['category'] }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.addExpense({ ...formData as Expense, id: Math.random().toString(36).substr(2, 9) });
    alert('Gasto registrado');
    setFormData({ date: new Date().toISOString().split('T')[0], category: 'Oficina', amount: 0, description: '' });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-metal-mid p-8 rounded-3xl shadow-xl border border-metal-border h-fit">
          <h3 className="text-xl font-black text-chrome-100 mb-6 flex items-center gap-2">
            <Plus size={24} className="text-blue-600"/> Nuevo Gasto
          </h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-1.5 ml-1">Descripción del Pago</label>
              <div className="relative">
                 <textarea 
                  required 
                  className="w-full px-4 py-3 bg-metal-dark border border-metal-border rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/15/50 h-24 resize-none transition-all" 
                  value={formData.description || ''} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  onBlur={handleDescriptionBlur}
                  placeholder="Ej: Compra de cloro y desinfectantes..."
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
                    <Sparkles size={10}/> Clasificado por IA
                  </span>
                )}
              </div>
              <select className="w-full px-4 py-3 bg-metal-dark border border-metal-border rounded-2xl text-sm font-black outline-none appearance-none" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value as Expense['category']})}>
                {['Limpieza', 'Oficina', 'Víveres', 'Impuesto', 'Aseo Urbano', 'Internet'].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-1.5 ml-1">Monto ($)</label>
              <input required type="number" step="0.01" className="w-full px-4 py-3 bg-metal-dark border border-metal-border rounded-2xl text-lg font-black outline-none focus:ring-4 focus:ring-blue-500/15/50" value={formData.amount || ''} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} />
            </div>
            <button type="submit" className="w-full btn-chrome py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-lg">
              Registrar Egreso
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-xl font-black text-chrome-100 uppercase tracking-tighter">Historial de Salidas</h3>
            <span className="text-xs font-bold text-chrome-500">Ultimos 30 días</span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
            {store.expenses.slice().reverse().map((exp: Expense) => (
              <div key={exp.id} className="bg-metal-mid p-5 rounded-3xl border border-metal-border shadow-sm flex items-center justify-between hover:border-blue-200 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-metal-dark flex items-center justify-center text-chrome-500 group-hover:bg-blue-50 group-hover:text-blue-400 transition-colors">
                    <Wallet size={20}/>
                  </div>
                  <div>
                    <h5 className="font-black text-chrome-100 leading-tight uppercase text-sm">{exp.description}</h5>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[10px] font-bold text-chrome-500">{exp.date}</span>
                       <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                       <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{exp.category}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-red-500">-${exp.amount.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-chrome-500 italic">{(exp.amount * store.exchangeRate).toLocaleString('es-VE')} Bs</p>
                </div>
              </div>
            ))}
            {store.expenses.length === 0 && (
              <div className="text-center py-20 bg-metal-dark/50 rounded-3xl border-2 border-dashed border-metal-border">
                <Wallet size={48} className="mx-auto mb-4 text-slate-200" />
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
