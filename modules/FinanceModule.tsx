
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Calendar as CalendarIcon, Sparkles, Loader2, RefreshCw, Wrench, ShoppingBag, History, Eye, Calendar, Filter, X } from 'lucide-react';
import { generateFinanceAudit } from '../lib/gemini';
import { VehicleRepair, Installment, Sale, Purchase, Expense } from '../types';

const FinanceModule: React.FC<{ store: any }> = ({ store }) => {
  const [viewMode, setViewMode] = useState<'general' | 'daily' | 'history'>('daily');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Filtros de rango para el historial
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // IA Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPeriodType, setAiPeriodType] = useState<'daily' | 'range' | 'all'>('daily');
  const [aiDate, setAiDate] = useState(new Date().toISOString().split('T')[0]);
  const [aiStartDate, setAiStartDate] = useState('');
  const [aiEndDate, setAiEndDate] = useState('');

  // 1. Calcular Ingresos del Taller (Base: Flujo de Caja / Abonos recibidos)
  const workshopIncome = useMemo(() => {
    const repairs: VehicleRepair[] = Array.isArray(store.repairs) ? store.repairs : [];
    
    if (viewMode === 'general') {
      return repairs.reduce((acc, repair) => {
        const totalPaid = (repair.installments || []).reduce((sum, inst) => sum + Number(inst.amount), 0);
        return acc + totalPaid;
      }, 0);
    } else if (viewMode === 'daily') {
      return repairs.reduce((acc, repair) => {
        const dailyPaid = (repair.installments || []).filter((inst: Installment) => {
          return inst.date.split('T')[0] === filterDate;
        }).reduce((sum, inst) => sum + Number(inst.amount), 0);
        return acc + dailyPaid;
      }, 0);
    }
    return 0;
  }, [store.repairs, viewMode, filterDate]);

  // 2. Calcular Ingresos del POS y Gastos para vistas General/Diaria
  const filteredData = useMemo(() => {
    const sBase = Array.isArray(store.sales) ? store.sales : [];
    const pBase = Array.isArray(store.purchases) ? store.purchases : [];
    const eBase = Array.isArray(store.expenses) ? store.expenses : [];

    if (viewMode === 'general') {
      return { sales: sBase, purchases: pBase, expenses: eBase };
    } else if (viewMode === 'daily') {
      return {
        // Normalizamos la comparación de fechas
        sales: sBase.filter((s: any) => s.date.split('T')[0] === filterDate),
        purchases: pBase.filter((p: any) => p.date.split('T')[0] === filterDate),
        expenses: eBase.filter((e: any) => e.date.split('T')[0] === filterDate)
      };
    }
    return { sales: [], purchases: [], expenses: [] };
  }, [store.sales, store.purchases, store.expenses, viewMode, filterDate]);

  // 3. Generar Datos Consolidados para la vista "Historial" (Tabla por fechas)
  const historyData = useMemo(() => {
    const dates = new Set<string>();
    
    // Recolectar todas las fechas únicas normalizadas (YYYY-MM-DD)
    store.sales.forEach((s: Sale) => { if(s.date) dates.add(s.date.split('T')[0]); });
    store.purchases.forEach((p: Purchase) => { if(p.date) dates.add(p.date.split('T')[0]); });
    store.expenses.forEach((e: Expense) => { if(e.date) dates.add(e.date.split('T')[0]); });
    store.repairs.forEach((r: VehicleRepair) => {
      if(r.installments) r.installments.forEach(i => { if(i.date) dates.add(i.date.split('T')[0]); });
    });

    const history = Array.from(dates).map(date => {
      if (!date) return null;

      // Ventas POS
      const daySales = store.sales.filter((s: Sale) => s.date && s.date.split('T')[0] === date)
        .reduce((sum: number, s: Sale) => sum + s.total, 0);
      
      // Ingresos Taller
      const dayWorkshop = store.repairs.reduce((acc: number, repair: VehicleRepair) => {
        const dailyPaid = (repair.installments || []).filter((inst: Installment) => inst.date && inst.date.split('T')[0] === date)
          .reduce((sum: number, inst: Installment) => sum + Number(inst.amount), 0);
        return acc + dailyPaid;
      }, 0);

      // Egresos
      const dayPurchases = store.purchases.filter((p: Purchase) => p.date && p.date.split('T')[0] === date)
        .reduce((sum: number, p: Purchase) => sum + p.total, 0);
      
      const dayExpenses = store.expenses.filter((e: Expense) => e.date && e.date.split('T')[0] === date)
        .reduce((sum: number, e: Expense) => sum + e.amount, 0);

      const revenue = daySales + dayWorkshop;
      const expenses = dayPurchases + dayExpenses;

      return {
        date,
        revenue,
        expenses,
        purchases: dayPurchases,
        opExpenses: dayExpenses,
        balance: revenue - expenses,
        pos: daySales,
        workshop: dayWorkshop
      };
    }).filter(Boolean);

    // Ordenar de más reciente a más antiguo
    return history.sort((a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime());
  }, [store.sales, store.purchases, store.expenses, store.repairs]);

  // 4. Filtrar Historial por Rango Seleccionado
  const filteredHistory = useMemo(() => {
    return historyData.filter(day => {
      if (historyStart && day.date < historyStart) return false;
      if (historyEnd && day.date > historyEnd) return false;
      return true;
    });
  }, [historyData, historyStart, historyEnd]);

  const posSales = filteredData.sales.reduce((acc: number, s: any) => acc + Number(s.total || 0), 0);
  const totalPurchases = filteredData.purchases.reduce((acc: number, p: any) => acc + Number(p.total || 0), 0);
  const totalExpenses = filteredData.expenses.reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0);
  
  const totalRevenue = posSales + workshopIncome;
  const balance = totalRevenue - (totalPurchases + totalExpenses);

  const handleAiAudit = async () => {
    setIsAiLoading(true);
    setShowAiModal(false);
    try {
      let sales = 0;
      let purchases = 0;
      let expenses = 0;
      let bal = 0;
      let period = '';

      if (aiPeriodType === 'daily') {
        const dRev = historyData.find(d => d.date === aiDate)?.revenue || 0;
        const dPur = historyData.find(d => d.date === aiDate)?.purchases || 0;
        const dExp = historyData.find(d => d.date === aiDate)?.opExpenses || 0;
        sales = dRev;
        purchases = dPur;
        expenses = dExp;
        bal = dRev - (dPur + dExp);
        period = `Diario (${aiDate})`;
      } else if (aiPeriodType === 'range') {
        const relevantHistory = historyData.filter(day => {
          if (aiStartDate && day.date < aiStartDate) return false;
          if (aiEndDate && day.date > aiEndDate) return false;
          return true;
        });
        const hRev = relevantHistory.reduce((acc, d) => acc + d.revenue, 0);
        const hPur = relevantHistory.reduce((acc, d) => acc + d.purchases, 0);
        const hExp = relevantHistory.reduce((acc, d) => acc + d.opExpenses, 0);
        sales = hRev;
        purchases = hPur;
        expenses = hExp;
        bal = hRev - (hPur + hExp);
        if (aiStartDate && aiEndDate) period = `Rango de fechas: ${aiStartDate} al ${aiEndDate} (Semanal/Mensual)`;
        else period = 'Rango personalizado';
      } else {
        const hRev = historyData.reduce((acc, d) => acc + d.revenue, 0);
        const hPur = historyData.reduce((acc, d) => acc + d.purchases, 0);
        const hExp = historyData.reduce((acc, d) => acc + d.opExpenses, 0);
        sales = hRev;
        purchases = hPur;
        expenses = hExp;
        bal = hRev - (hPur + hExp);
        period = 'Historial General (Todo el tiempo)';
      }

      const analysis = await generateFinanceAudit({
        sales: sales, 
        purchases: purchases,
        expenses: expenses,
        balance: bal,
        period: period
      });
      setAiAnalysis(analysis || null);
      setAiError(null);
    } catch (error: any) {
      console.error("AI Audit Error:", error);
      setAiError(error.message || "Error al conectar con la Inteligencia Artificial. Verifica tu API Key o conexión a internet.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const openAiModal = () => {
    setShowAiModal(true);
    setAiError(null);
  };

  const chartData = [
    { name: 'Ventas POS', value: posSales, fill: '#3b82f6' },
    { name: 'Ingresos Taller', value: workshopIncome, fill: '#8b5cf6' },
    { name: 'Compras', value: totalPurchases, fill: '#ef4444' },
    { name: 'Gastos Op.', value: totalExpenses, fill: '#f59e0b' }
  ];

  const categoryData: { name: string; value: number }[] = Object.values(
    filteredData.expenses.reduce((acc: Record<string, { name: string; value: number }>, curr: any) => {
      const cat = curr.category || 'Varios';
      if (!acc[cat]) {
        acc[cat] = { name: cat, value: 0 };
      }
      acc[cat].value += Number(curr.amount || 0);
      return acc;
    }, {} as Record<string, { name: string; value: number }>)
  );

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const goToDate = (date: string) => {
    setFilterDate(date);
    setViewMode('daily');
    setAiAnalysis(null);
  };

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div>
          <h3 className="text-3xl font-black text-chrome-100 tracking-tighter uppercase leading-none">Análisis Financiero</h3>
          <p className="text-chrome-400 font-medium mt-2">Rentabilidad consolidada (Taller + Tienda) en tiempo real</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-metal-mid p-2 rounded-[2rem] border border-metal-border shadow-sm">
          <div className="flex bg-metal-mid p-1 rounded-2xl">
            <button onClick={() => setViewMode('general')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'general' ? 'bg-metal-mid text-blue-600 shadow-sm' : 'text-chrome-500'}`}>General</button>
            <button onClick={() => setViewMode('daily')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'daily' ? 'bg-metal-mid text-blue-600 shadow-sm' : 'text-chrome-500'}`}>Diario</button>
            <button onClick={() => setViewMode('history')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-metal-mid text-blue-600 shadow-sm' : 'text-chrome-500'}`}>Historial</button>
          </div>
          {viewMode === 'daily' && (
            <input type="date" className="px-4 py-2 bg-metal-dark border border-metal-border rounded-xl text-xs font-black outline-none" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          )}
          <button onClick={openAiModal} disabled={isAiLoading} className="btn-chrome px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-lg disabled:opacity-50">
              {isAiLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14} className="text-blue-200"/>} Análisis Financiero IA
          </button>
        </div>
      </div>

      {viewMode === 'history' ? (
        <div className="bg-metal-mid rounded-2xl border border-metal-border shadow-sm overflow-hidden animate-in fade-in duration-300">
           <div className="p-8 border-b border-metal-border bg-metal-dark/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h4 className="text-xl font-black text-chrome-100 uppercase tracking-tighter">Historial de Movimientos</h4>
                <p className="text-xs text-chrome-400 font-medium mt-1">Desglose cronológico de ingresos y egresos diarios.</p>
              </div>
              
              {/* Filtros de Fecha */}
              <div className="flex flex-wrap items-end gap-2 bg-metal-mid p-2 rounded-2xl border border-metal-border shadow-sm">
                <div className="flex items-center gap-2 text-chrome-500 px-2">
                   <Filter size={14} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Rango:</span>
                </div>
                <div>
                   <label className="block text-[8px] font-black text-chrome-500 uppercase ml-2 mb-0.5">Desde</label>
                   <input 
                      type="date" 
                      className="px-3 py-1.5 bg-metal-dark border border-metal-border rounded-xl text-xs font-bold outline-none text-chrome-200"
                      value={historyStart}
                      onChange={(e) => setHistoryStart(e.target.value)}
                   />
                </div>
                <div>
                   <label className="block text-[8px] font-black text-chrome-500 uppercase ml-2 mb-0.5">Hasta</label>
                   <input 
                      type="date" 
                      className="px-3 py-1.5 bg-metal-dark border border-metal-border rounded-xl text-xs font-bold outline-none text-chrome-200"
                      value={historyEnd}
                      onChange={(e) => setHistoryEnd(e.target.value)}
                   />
                </div>
                {(historyStart || historyEnd) && (
                   <button 
                      onClick={() => { setHistoryStart(''); setHistoryEnd(''); }}
                       className="p-2 text-chrome-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all h-[34px]"
                      title="Limpiar Filtros"
                   >
                      <X size={16} />
                   </button>
                )}
              </div>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="bg-metal-dark text-[10px] font-black text-chrome-500 uppercase tracking-widest">
                   <th className="px-8 py-4">Fecha</th>
                    <th className="px-8 py-4 text-right text-emerald-400">Ingresos Totales</th>
                    <th className="px-8 py-4 text-right text-red-400">Egresos Totales</th>
                   <th className="px-8 py-4 text-right">Balance Neto</th>
                   <th className="px-8 py-4 text-center">Acciones</th>
                 </tr>
               </thead>
                <tbody className="divide-y divide-metal-border">
                 {filteredHistory.map((day) => (
                   <tr key={day.date} className="hover:bg-metal-dark/50 transition-colors">
                     <td className="px-8 py-5">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-metal-mid flex items-center justify-center text-chrome-500">
                            <Calendar size={18} />
                         </div>
                         <div>
                            <p className="font-black text-chrome-100 text-sm">{new Date(day.date + 'T12:00:00').toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="text-[9px] font-bold text-chrome-500 uppercase tracking-wide">{day.date}</p>
                         </div>
                       </div>
                     </td>
                     <td className="px-8 py-5 text-right">
                        <p className="font-black text-emerald-400 text-sm">+${day.revenue.toFixed(2)}</p>
                       <p className="text-[9px] text-chrome-500 font-bold uppercase">POS: ${day.pos.toFixed(2)} | Taller: ${day.workshop.toFixed(2)}</p>
                     </td>
                     <td className="px-8 py-5 text-right">
                        <p className="font-black text-red-400 text-sm">-${day.expenses.toFixed(2)}</p>
                     </td>
                     <td className="px-8 py-5 text-right">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-tight ${day.balance >= 0 ? 'bg-blue-500/15 text-blue-400' : 'bg-red-500/15 text-red-400'}`}>
                         {day.balance >= 0 ? '+' : ''}${day.balance.toFixed(2)}
                       </span>
                     </td>
                     <td className="px-8 py-5 text-center">
                       <button 
                         onClick={() => goToDate(day.date)}
                          className="p-2 text-chrome-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
                         title="Ver Detalles y Auditoría IA"
                       >
                         <Eye size={18} />
                       </button>
                     </td>
                   </tr>
                 ))}
                 {filteredHistory.length === 0 && (
                   <tr>
                     <td colSpan={5} className="py-20 text-center text-chrome-500 font-black uppercase tracking-widest text-xs">
                       {historyData.length === 0 ? "No hay historial registrado aún" : "No se encontraron movimientos en este rango de fechas"}
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      ) : (
        /* Vistas General y Diario (Charts + Stats) */
        <div className="animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Ingresos Totales" amount={totalRevenue} icon={<ArrowUpCircle className="text-emerald-500"/>} rate={store.exchangeRate} />
            <StatCard title="Compras Stock" amount={totalPurchases} icon={<ArrowDownCircle className="text-red-500"/>} rate={store.exchangeRate}/>
            <StatCard title="Gastos Operativos" amount={totalExpenses} icon={<ArrowDownCircle className="text-orange-500"/>} rate={store.exchangeRate}/>
            <StatCard title="Balance Neto" amount={balance} icon={<DollarSign className="text-blue-500"/>} rate={store.exchangeRate} isBalance/>
          </div>

          {aiError && (
            <div className="bg-red-500/10 p-6 rounded-2xl border border-red-500/30 mb-8 shadow-sm flex items-start gap-4 animate-in fade-in duration-300">
               <div className="p-2 bg-red-500/20 rounded-full shrink-0">
                  <X size={20} className="text-red-500" />
               </div>
               <div>
                  <h4 className="text-sm font-black text-red-500 uppercase tracking-widest mb-1">Error de Diagnóstico</h4>
                  <p className="text-xs text-red-400 font-medium">{aiError}</p>
               </div>
            </div>
          )}

          {aiAnalysis && !aiError && (
            <div className="bg-metal-mid p-8 rounded-2xl border border-blue-500/20 mb-8 shadow-xl relative overflow-hidden animate-in fade-in duration-500">
              <h4 className="text-xs font-black text-blue-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-blue-500" /> Diagnóstico Financiero Estratégico
              </h4>
              <div className="text-chrome-200 text-sm whitespace-pre-line leading-relaxed">{aiAnalysis}</div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-metal-mid p-8 rounded-2xl border border-metal-border shadow-sm h-96 relative">
              <h4 className="absolute top-8 left-8 text-[10px] font-black text-chrome-500 uppercase tracking-widest z-10">Flujo de Caja por Fuente</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 40, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2f42"/>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#8890a6'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8890a6'}} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.04)'}} 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #2a2f42', background: '#10131a', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#e8eaf0', fontWeight: 700 }}
                    labelStyle={{ color: '#8890a6', fontSize: '12px', fontWeight: 600 }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Monto']}
                  />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-metal-mid p-8 rounded-2xl border border-metal-border shadow-sm h-96 relative">
              <h4 className="absolute top-8 left-8 text-[10px] font-black text-chrome-500 uppercase tracking-widest z-10">Desglose de Gastos</h4>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={5} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #2a2f42', background: '#10131a' }} itemStyle={{ color: '#e8eaf0', fontWeight: 700 }} formatter={(v: number) => `$${v.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {showAiModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-metal-mid border border-metal-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-metal-border flex justify-between items-center">
              <h3 className="text-lg font-black text-chrome-100 uppercase tracking-widest flex items-center gap-2"><Sparkles className="text-blue-500" size={18}/> Configurar Análisis IA</h3>
              <button onClick={() => setShowAiModal(false)} className="text-chrome-500 hover:text-white transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-black text-chrome-400 uppercase tracking-widest mb-2">Tipo de Periodo</label>
                <select className="w-full bg-metal-dark border border-metal-border rounded-xl px-4 py-3 text-chrome-100 text-sm focus:border-blue-500 outline-none" value={aiPeriodType} onChange={(e) => setAiPeriodType(e.target.value as any)}>
                  <option value="daily">Diario (Un día específico)</option>
                  <option value="range">Semanal / Mensual (Rango de fechas)</option>
                  <option value="all">Historial Completo (Todo el tiempo)</option>
                </select>
              </div>

              {aiPeriodType === 'daily' && (
                <div>
                  <label className="block text-xs font-black text-chrome-400 uppercase tracking-widest mb-2">Seleccione Fecha</label>
                  <input type="date" className="w-full bg-metal-dark border border-metal-border rounded-xl px-4 py-3 text-chrome-100 text-[13px] font-bold focus:border-blue-500 outline-none" value={aiDate} onChange={(e) => setAiDate(e.target.value)} />
                </div>
              )}

              {aiPeriodType === 'range' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-chrome-400 uppercase tracking-widest mb-2">Desde</label>
                    <input type="date" className="w-full bg-metal-dark border border-metal-border rounded-xl px-4 py-3 text-chrome-100 text-[13px] font-bold focus:border-blue-500 outline-none" value={aiStartDate} onChange={(e) => setAiStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-chrome-400 uppercase tracking-widest mb-2">Hasta</label>
                    <input type="date" className="w-full bg-metal-dark border border-metal-border rounded-xl px-4 py-3 text-chrome-100 text-[13px] font-bold focus:border-blue-500 outline-none" value={aiEndDate} onChange={(e) => setAiEndDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-metal-dark/50 border-t border-metal-border flex justify-end gap-3">
              <button onClick={() => setShowAiModal(false)} className="px-5 py-2.5 rounded-xl text-xs font-black text-chrome-500 hover:text-white uppercase tracking-widest">Cancelar</button>
              <button onClick={handleAiAudit} className="btn-chrome px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-600 shadow-lg shadow-blue-900/20">
                <Sparkles size={14} className="text-blue-200" /> Generar Informe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ title: string, amount: number, icon: React.ReactNode, rate: number, isBalance?: boolean }> = ({ title, amount, icon, rate, isBalance }) => (
  <div className="bg-metal-mid p-6 rounded-[2rem] border border-metal-border shadow-sm hover:border-blue-500/40 transition-all group">
    <div className="flex justify-between items-start mb-4">
      <span className="text-[10px] font-black text-chrome-500 uppercase tracking-widest">{title}</span>
      <div className="p-2.5 bg-metal-dark rounded-xl">{icon}</div>
    </div>
    <div className={`text-3xl font-black tracking-tighter leading-none ${isBalance ? (amount >= 0 ? 'text-blue-400' : 'text-red-400') : 'text-chrome-100'}`}>
      {amount < 0 ? `-$${Number(Math.abs(amount)).toFixed(2)}` : `$${Number(amount).toFixed(2)}`}
    </div>
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-metal-border">
      <p className="text-[10px] text-chrome-500 font-bold">{(Number(amount) * Number(rate || 0)).toLocaleString('es-VE')} Bs</p>
      <span className="text-[8px] font-black text-chrome-500 uppercase italic">Tasa: {rate}</span>
    </div>
  </div>
);

export default FinanceModule;
