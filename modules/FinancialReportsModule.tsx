import React, { useState, useMemo } from 'react';
import { useGonzacarsStore } from '../store';
import { formatCurrency, formatDate } from '../lib/utils/finance';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3, TrendingUp, DollarSign, Wallet, Users, Truck, Package, Wrench } from 'lucide-react';

const FinancialReportsModule: React.FC = () => {
  const store = useGonzacarsStore();
  const [dateFilter, setDateFilter] = useState<'esteMes' | 'mesPasado' | 'esteAno' | 'historico'>('esteMes');

  // Filter function for generic objects with date/createdAt
  const filterByDate = (item: any) => {
    if (dateFilter === 'historico') return true;
    const dateStr = item.date || item.createdAt;
    if (!dateStr) return true;
    
    const d = new Date(dateStr);
    const now = new Date();
    
    if (dateFilter === 'esteMes') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (dateFilter === 'mesPasado') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
    }
    if (dateFilter === 'esteAno') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const { ingresosTaller, ingresosPOS, gastos, compras, nomina, cogsVentas, cogsTaller, chartData } = useMemo(() => {
    // Arrays filtrados
    const fRepairs = (store.repairs || []).filter(filterByDate);
    const fSales = (store.sales || []).filter(filterByDate);
    const fExpenses = (store.expenses || []).filter(filterByDate);
    const fPurchases = (store.purchases || []).filter(filterByDate);
    const fPayroll = (store.payroll || []).filter(filterByDate);

    // Ingresos Taller
    let ingresosTallerRepuestos = 0;
    let ingresosTallerConsumibles = 0;
    let ingresosTallerServicios = 0;
    let cogsTaller = 0;

    fRepairs.forEach(r => {
      // Usamos el estado del pago o los installments para saber el ingreso real,
      // pero para reporte de facturación podemos sumar los items.
      (r.items || []).forEach(item => {
        const itemTotal = item.price * item.quantity;
        if (item.type === 'Repuesto') ingresosTallerRepuestos += itemTotal;
        else if (item.type === 'Consumible') ingresosTallerConsumibles += itemTotal;
        else if (item.type === 'Servicio') ingresosTallerServicios += itemTotal;
        
        // Estimación de costo si el store de productos está disponible
        const prod = store.inventory?.find((p: any) => p.id === item.productId);
        if (prod && item.type !== 'Servicio') {
          cogsTaller += prod.cost * item.quantity;
        }
      });
    });

    const totalIngresosTaller = ingresosTallerRepuestos + ingresosTallerConsumibles + ingresosTallerServicios;

    // Ingresos POS
    let totalIngresosPOS = 0;
    let cogsVentas = 0;
    fSales.forEach(s => {
      totalIngresosPOS += s.total;
      cogsVentas += s.totalCost || 0;
    });

    // Egresos
    const totalGastos = fExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalCompras = fPurchases.reduce((sum, p) => sum + p.total, 0);
    const totalNomina = fPayroll.reduce((sum, p) => sum + p.total, 0);

    // Chart Data (P&L over time)
    const dataMap: Record<string, { name: string, date: string, ingresos: number, egresos: number }> = {};
    const groupByMonth = dateFilter === 'esteAno' || dateFilter === 'historico';

    const addToChart = (dateStr: string, amount: number, type: 'ingresos' | 'egresos') => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const key = groupByMonth 
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : d.toISOString().split('T')[0];
      
      if (!dataMap[key]) {
        dataMap[key] = {
          name: groupByMonth ? d.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' }) : d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }),
          date: key,
          ingresos: 0,
          egresos: 0
        };
      }
      dataMap[key][type] += amount;
    };

    fRepairs.forEach(r => addToChart(r.createdAt, (r.items || []).reduce((s, i) => s + (i.price * i.quantity), 0), 'ingresos'));
    fSales.forEach(s => addToChart(s.date, s.total, 'ingresos'));
    fExpenses.forEach(e => addToChart(e.date, e.amount, 'egresos'));
    fPurchases.forEach(p => addToChart(p.date, p.total, 'egresos')); // Considerar compra como egreso para flujo de caja
    fPayroll.forEach(p => addToChart(p.date, p.total, 'egresos'));

    return {
      ingresosTaller: { repuestos: ingresosTallerRepuestos, consumibles: ingresosTallerConsumibles, servicios: ingresosTallerServicios, total: totalIngresosTaller },
      ingresosPOS: totalIngresosPOS,
      gastos: totalGastos,
      compras: totalCompras,
      nomina: totalNomina,
      cogsVentas,
      cogsTaller,
      chartData: Object.values(dataMap).sort((a, b) => a.date.localeCompare(b.date))
    };
  }, [store.repairs, store.sales, store.expenses, store.purchases, store.payroll, store.inventory, dateFilter]);

  const totalIngresos = ingresosTaller.total + ingresosPOS;
  const totalEgresosFlujo = gastos + compras + nomina; 
  // Para rentabilidad real se usa COGS en vez de Compras:
  const utilidadNeta = totalIngresos - (gastos + nomina + cogsVentas + cogsTaller);
  const margenNeto = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;

  // Donut data
  const ingresosData = [
    { name: 'POS', value: ingresosPOS, color: '#3b82f6' },
    { name: 'Repuestos (Taller)', value: ingresosTaller.repuestos, color: '#34d399' },
    { name: 'Servicios (Taller)', value: ingresosTaller.servicios, color: '#f59e0b' },
    { name: 'Consumibles (Taller)', value: ingresosTaller.consumibles, color: '#a78bfa' }
  ].filter(d => d.value > 0);

  const egresosData = [
    { name: 'Gastos', value: gastos, color: '#f43f5e' },
    { name: 'Nómina', value: nomina, color: '#8b5cf6' },
    { name: 'Costo Mercancía (COGS)', value: cogsVentas + cogsTaller, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-chrome-100 flex items-center gap-3">
            <BarChart3 className="text-emerald-500" size={32} />
            Reportes Financieros
          </h1>
          <p className="text-chrome-400 mt-1">Estado de resultados, flujo de caja y rentabilidad.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-metal-800/50 p-1.5 rounded-xl border border-metal-700/50">
          {(['esteMes', 'mesPasado', 'esteAno', 'historico'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                dateFilter === filter 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : 'text-chrome-400 hover:text-chrome-200 hover:bg-metal-700/50'
              }`}
            >
              {filter === 'esteMes' ? 'Este Mes' : 
               filter === 'mesPasado' ? 'Mes Pasado' : 
               filter === 'esteAno' ? 'Este Año' : 'Histórico'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-metal-800/50 p-5 rounded-2xl border border-metal-700/50">
          <p className="text-chrome-400 text-xs font-bold uppercase tracking-wider mb-2">Ingresos Totales</p>
          <p className="text-3xl font-black text-emerald-400">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="bg-metal-800/50 p-5 rounded-2xl border border-metal-700/50">
          <p className="text-chrome-400 text-xs font-bold uppercase tracking-wider mb-2">Egresos (Flujo)</p>
          <p className="text-3xl font-black text-red-400">{formatCurrency(totalEgresosFlujo)}</p>
        </div>
        <div className="bg-metal-800/50 p-5 rounded-2xl border border-metal-700/50">
          <p className="text-chrome-400 text-xs font-bold uppercase tracking-wider mb-2">Utilidad Neta</p>
          <p className={`text-3xl font-black ${utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(utilidadNeta)}
          </p>
        </div>
        <div className="bg-metal-800/50 p-5 rounded-2xl border border-metal-700/50 relative overflow-hidden">
          <p className="text-chrome-400 text-xs font-bold uppercase tracking-wider mb-2">Margen Neto</p>
          <p className={`text-3xl font-black ${margenNeto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {margenNeto.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Area Chart */}
        <div className="lg:col-span-2 bg-metal-900 border border-metal-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-chrome-100 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-500" />
            Ingresos vs Egresos
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f42" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <RechartsTooltip 
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                  contentStyle={{ backgroundColor: '#10131a', border: '1px solid #2a2f42', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#34d399" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                <Area type="monotone" dataKey="egresos" name="Egresos" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorEgresos)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donuts */}
        <div className="flex flex-col gap-6">
          <div className="bg-metal-900 border border-metal-800 rounded-2xl p-6 flex-1 flex flex-col">
            <h3 className="text-sm font-bold text-chrome-100 mb-2">Composición de Ingresos</h3>
            <div className="flex-1 min-h-[150px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={ingresosData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                    {ingresosData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => [formatCurrency(Number(value)), '']} contentStyle={{ backgroundColor: '#10131a', border: '1px solid #2a2f42', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              {ingresosData.map((d, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}/> <span className="text-chrome-400">{d.name}</span></div>
                  <span className="font-bold text-chrome-200">{formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-metal-900 border border-metal-800 rounded-2xl p-6 flex-1 flex flex-col">
            <h3 className="text-sm font-bold text-chrome-100 mb-2">Composición de Egresos</h3>
            <div className="flex-1 min-h-[150px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={egresosData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                    {egresosData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => [formatCurrency(Number(value)), '']} contentStyle={{ backgroundColor: '#10131a', border: '1px solid #2a2f42', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              {egresosData.map((d, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}/> <span className="text-chrome-400">{d.name}</span></div>
                  <span className="font-bold text-chrome-200">{formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Taller */}
        <div className="bg-metal-800/30 p-5 rounded-2xl border border-metal-700/50">
          <div className="flex items-center gap-2 mb-4 text-chrome-100 font-bold"><Wrench size={18} className="text-amber-500" /> Ingresos Taller</div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-chrome-400">Repuestos</span> <span className="text-emerald-400 font-semibold">{formatCurrency(ingresosTaller.repuestos)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-chrome-400">Servicios (M.O.)</span> <span className="text-emerald-400 font-semibold">{formatCurrency(ingresosTaller.servicios)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-chrome-400">Consumibles</span> <span className="text-emerald-400 font-semibold">{formatCurrency(ingresosTaller.consumibles)}</span></div>
            <div className="pt-2 border-t border-metal-700/50 flex justify-between font-bold text-chrome-100"><span>Total</span> <span>{formatCurrency(ingresosTaller.total)}</span></div>
          </div>
        </div>
        
        {/* POS */}
        <div className="bg-metal-800/30 p-5 rounded-2xl border border-metal-700/50">
          <div className="flex items-center gap-2 mb-4 text-chrome-100 font-bold"><DollarSign size={18} className="text-blue-500" /> Punto de Venta</div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-chrome-400">Ventas</span> <span className="text-emerald-400 font-semibold">{formatCurrency(ingresosPOS)}</span></div>
            <div className="pt-2 border-t border-metal-700/50 flex justify-between font-bold text-chrome-100"><span>Total</span> <span>{formatCurrency(ingresosPOS)}</span></div>
          </div>
        </div>

        {/* Movimientos Inventario */}
        <div className="bg-metal-800/30 p-5 rounded-2xl border border-metal-700/50">
          <div className="flex items-center gap-2 mb-4 text-chrome-100 font-bold"><Package size={18} className="text-purple-500" /> Movimiento Inventario</div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-chrome-400">Entradas (Compras)</span> <span className="text-blue-400 font-semibold">{formatCurrency(compras)}</span></div>
            <div className="flex justify-between text-sm" title="Costo de Mercancía Vendida"><span className="text-chrome-400">Salidas (COGS)</span> <span className="text-red-400 font-semibold">{formatCurrency(cogsVentas + cogsTaller)}</span></div>
          </div>
        </div>

        {/* Egresos Operativos */}
        <div className="bg-metal-800/30 p-5 rounded-2xl border border-metal-700/50">
          <div className="flex items-center gap-2 mb-4 text-chrome-100 font-bold"><Wallet size={18} className="text-red-500" /> Egresos Operativos</div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-chrome-400">Gastos</span> <span className="text-red-400 font-semibold">{formatCurrency(gastos)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-chrome-400">Nómina</span> <span className="text-red-400 font-semibold">{formatCurrency(nomina)}</span></div>
            <div className="pt-2 border-t border-metal-700/50 flex justify-between font-bold text-chrome-100"><span>Total</span> <span>{formatCurrency(gastos + nomina)}</span></div>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default FinancialReportsModule;
