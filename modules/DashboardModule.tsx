import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, DollarSign, Wrench, UserRound, Package, 
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Activity,
  Calendar, CheckCircle2, Database, Coins
} from 'lucide-react';

interface DashboardModuleProps {
  store: any;
  localRate: number;
  setLocalRate: (v: number) => void;
  handleRateUpdate: () => void;
}

const DashboardModule: React.FC<DashboardModuleProps> = ({ store, localRate, setLocalRate, handleRateUpdate }) => {
  // Chart Data: Last 14 days Revenue
  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const salesTotal = store.sales
        .filter((s: any) => s.date && s.date.startsWith(dateStr))
        .reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
        
      const repairsTotal = store.repairs.reduce((acc: number, r: any) => {
        const payments = (r.installments || []).filter((inst: any) => inst.date && inst.date.startsWith(dateStr));
        return acc + payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      }, 0);

      data.push({
        name: d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }),
        date: dateStr,
        Ventas: salesTotal,
        Taller: repairsTotal,
        Total: salesTotal + repairsTotal
      });
    }
    return data;
  }, [store.sales, store.repairs]);

  // Donut Chart Data: Distribution (Current Month)
  const donutData = useMemo(() => {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
    
    const salesTotal = store.sales
      .filter((s: any) => s.date && s.date.startsWith(currentMonthStr))
      .reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      
    const repairsTotal = store.repairs.reduce((acc: number, r: any) => {
      const payments = (r.installments || []).filter((inst: any) => inst.date && inst.date.startsWith(currentMonthStr));
      return acc + payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    }, 0);

    return [
      { name: 'Ventas (POS)', value: salesTotal, color: '#3b82f6' },
      { name: 'Servicio (Taller)', value: repairsTotal, color: '#8b5cf6' }
    ];
  }, [store.sales, store.repairs]);

  // KPIs
  const kpiData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // Ventas
    const todaySales = store.sales.filter((s: any) => s.date === today).reduce((a: number, s: any) => a + Number(s.total || 0), 0);
    const yesterSales = store.sales.filter((s: any) => s.date === yesterday).reduce((a: number, s: any) => a + Number(s.total || 0), 0);
    const salesDelta = yesterSales > 0 ? ((todaySales - yesterSales) / yesterSales) * 100 : 0;

    // Gastos del Mes vs Mes Anterior
    const currentMonth = today.slice(0, 7);
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);
    
    const currExpenses = store.expenses.filter((e: any) => e.date.startsWith(currentMonth)).reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
    const prevExpenses = store.expenses.filter((e: any) => e.date.startsWith(lastMonth)).reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
    const expenseDelta = prevExpenses > 0 ? ((currExpenses - prevExpenses) / prevExpenses) * 100 : 0;

    return { todaySales, salesDelta, currExpenses, expenseDelta };
  }, [store.sales, store.expenses]);

  const inTaller = store.repairs?.filter((r: any) => r.status !== 'Entregado').length || 0;

  // Recent Activity Feed (Combine latest 5 sales, repairs, expenses)
  const recentActivity = useMemo(() => {
    const activities: any[] = [];
    store.sales.forEach((s: any) => {
      activities.push({ id: s.id, type: 'venta', date: s.date, title: `Venta POS: ${s.customerName || 'Cliente'}`, amount: s.total, time: new Date(s.date).getTime() });
    });
    store.expenses.forEach((e: any) => {
      activities.push({ id: e.id, type: 'gasto', date: e.date, title: `Gasto: ${e.category} - ${e.description}`, amount: -e.amount, time: new Date(e.date).getTime() });
    });
    store.repairs.forEach((r: any) => {
      if (r.createdAt) {
        activities.push({ id: r.id, type: 'taller', date: r.createdAt.split('T')[0], title: `Ingreso Taller: ${r.plate} - ${r.ownerName}`, amount: 0, time: new Date(r.createdAt).getTime() });
      }
    });
    
    return activities.sort((a, b) => b.time - a.time).slice(0, 7);
  }, [store.sales, store.expenses, store.repairs]);

  // Helpers
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-chrome-100 tracking-tight uppercase leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Panel de Control
          </h1>
          <p className="text-chrome-400 font-medium mt-2 text-sm">
            Monitoreo en tiempo real de operaciones, ingresos y servicios.
          </p>
        </div>
        <div className="flex gap-2.5 items-center">
          <div className="flex items-center gap-3 mr-4 p-2 px-4 rounded-xl border border-metal-border bg-metal-dark/50">
             <Database size={16} className="text-emerald-400"/>
             <span className="text-xs font-black text-chrome-200 uppercase tracking-widest">En Línea</span>
          </div>
          <button
            onClick={() => store.refreshData()}
            disabled={store.loading}
            className="btn-metallic flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            <RefreshCw size={14} className={store.loading ? 'animate-spin text-blue-400' : ''}/> Sync
          </button>
        </div>
      </div>

      {/* KPI Cards (Tremor Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          title="Ingresos Hoy (Ventas)"
          value={formatCurrency(kpiData.todaySales)}
          delta={kpiData.salesDelta}
          icon={<DollarSign size={20} className="text-emerald-400"/>}
          accentColor="emerald"
        />
        <KpiCard
          title="Gastos (Mes Actual)"
          value={formatCurrency(kpiData.currExpenses)}
          delta={kpiData.expenseDelta}
          icon={<Minus size={20} className="text-red-400"/>}
          accentColor="red"
          invertDeltaColor={true} // For expenses, increase is bad (red), decrease is good (green)
        />
        <KpiCard
          title="Vehículos en Taller"
          value={String(inTaller)}
          icon={<Wrench size={20} className="text-blue-400"/>}
          accentColor="blue"
        />
        <KpiCard
          title="Clientes Activos"
          value={String(store.customers?.length || 0)}
          icon={<UserRound size={20} className="text-purple-400"/>}
          accentColor="purple"
        />
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Area Chart: Revenue Trend */}
        <div className="xl:col-span-2 p-6 rounded-2xl surface-raised border border-metal-border flex flex-col h-[400px]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-base font-black text-chrome-100 uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                <TrendingUp className="text-blue-400" size={20}/> Tendencia de Ingresos
              </h3>
              <p className="text-xs text-chrome-500 font-medium mt-1">Comparativa de Ventas POS vs Taller (Últimos 14 días)</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTaller" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2f42"/>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#8890a6' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8890a6' }} tickFormatter={v => `$${v}`} dx={-10} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #2a2f42', background: '#10131a', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                  itemStyle={{ color: '#e8eaf0', fontWeight: 700, fontSize: '13px' }}
                  labelStyle={{ color: '#8890a6', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
                  formatter={(v: number, name: string) => [formatCurrency(v), name]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#8890a6', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="Ventas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" activeDot={{ r: 6, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="Taller" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorTaller)" activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Revenue Distribution */}
        <div className="xl:col-span-1 p-6 rounded-2xl surface-raised border border-metal-border flex flex-col h-[400px]">
          <div className="mb-2">
            <h3 className="text-base font-black text-chrome-100 uppercase tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Distribución (Mes Actual)
            </h3>
            <p className="text-xs text-chrome-500 font-medium mt-1">Origen de ingresos</p>
          </div>
          <div className="flex-1 flex justify-center items-center">
            {donutData[0].value === 0 && donutData[1].value === 0 ? (
               <div className="text-chrome-500 text-sm font-bold">No hay datos suficientes</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #2a2f42', background: '#10131a' }}
                    itemStyle={{ color: '#e8eaf0', fontWeight: 700 }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#8890a6' }}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Lower Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Activity List */}
        <div className="lg:col-span-2 p-6 rounded-2xl surface-raised border border-metal-border">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-black text-chrome-100 uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <Activity className="text-emerald-400" size={20}/> Actividad Reciente
            </h3>
          </div>
          <div className="space-y-4">
            {recentActivity.length > 0 ? recentActivity.map((act, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-metal-dark/30 hover:bg-metal-dark/70 transition-colors border border-metal-border/50">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-lg border flex-shrink-0
                    ${act.type === 'venta' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      act.type === 'gasto' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                    {act.type === 'venta' ? <DollarSign size={18}/> : act.type === 'gasto' ? <Minus size={18}/> : <Wrench size={18}/>}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-chrome-100 truncate">{act.title}</p>
                    <p className="text-xs text-chrome-500 font-medium flex items-center gap-1 mt-0.5">
                      <Calendar size={12}/> {act.date}
                    </p>
                  </div>
                </div>
                {act.amount !== 0 && (
                  <div className={`text-sm font-black tracking-tight ${act.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {act.amount > 0 ? '+' : ''}{formatCurrency(act.amount)}
                  </div>
                )}
              </div>
            )) : (
              <div className="text-center py-8 text-chrome-500 text-sm font-medium">No hay actividad reciente</div>
            )}
          </div>
        </div>

        {/* Exchange Rate Card (Quick Actions) */}
        <div className="p-6 rounded-2xl relative overflow-hidden flex flex-col justify-center" style={{ background: 'linear-gradient(160deg, #1c2030, #10131a)', border: '1px solid #2a2f42', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
            <Coins className="absolute -bottom-8 -right-8 text-white/5" size={160} />
            <h3 className="text-base font-black text-chrome-100 uppercase tracking-tight flex items-center gap-2 mb-6 relative z-10" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Cotización del Día
            </h3>
            
            <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-2 relative z-10">Tasa Manual (Bs/$)</p>
            <div className="flex items-center gap-3 relative z-10">
              <input
                type="number"
                className="flex-1 bg-black/20 border border-metal-border rounded-xl px-4 py-4 text-3xl font-black text-chrome-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition-all min-w-0"
                value={localRate}
                onChange={e => setLocalRate(Number(e.target.value))}
              />
              <button
                onClick={handleRateUpdate}
                className="btn-chrome p-4 rounded-xl transition-all active:scale-95 flex-shrink-0"
                title="Actualizar Tasa"
              >
                <RefreshCw size={24}/>
              </button>
            </div>
        </div>

      </div>
    </div>
  );
};

// Extracted KPI Card Component for reuse
interface KpiCardProps {
  title: string; value: string; icon: React.ReactNode;
  accentColor?: string; delta?: number; invertDeltaColor?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, accentColor = 'blue', delta, invertDeltaColor = false }) => {
  const hasDelta = delta !== undefined && delta !== null && !isNaN(delta);
  const isPositive = hasDelta && delta > 0;
  const isNeutral = hasDelta && delta === 0;

  let deltaColorClass = 'text-chrome-500';
  if (hasDelta && !isNeutral) {
    if (invertDeltaColor) {
      deltaColorClass = isPositive ? 'text-red-400' : 'text-emerald-400';
    } else {
      deltaColorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
    }
  }

  const glowColors: Record<string, string> = {
    emerald: 'rgba(52,211,153,0.08)',
    blue: 'rgba(59,130,246,0.08)',
    purple: 'rgba(168,85,247,0.08)',
    red: 'rgba(248,113,113,0.08)'
  };

  return (
    <div className="stats-card metallic-shine p-5 rounded-2xl surface-raised border border-metal-border relative overflow-hidden group hover:border-chrome-500/30 transition-all">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <p className="text-[11px] font-black text-chrome-400 uppercase tracking-widest leading-tight">{title}</p>
        <div className="p-2.5 rounded-xl transition-transform group-hover:scale-110" style={{ background: glowColors[accentColor] || glowColors.blue, border: '1px solid rgba(255,255,255,0.04)' }}>
          {icon}
        </div>
      </div>
      <h3 className="text-4xl font-black text-chrome-100 tracking-tight leading-none relative z-10" style={{ fontFamily: 'Outfit, sans-serif' }}>
        {value}
      </h3>
      {hasDelta && (
        <div className={`flex items-center gap-1 mt-4 text-[10px] font-black uppercase tracking-wider relative z-10 ${deltaColorClass}`}>
          {isNeutral ? <Minus size={14}/> : isPositive ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
          {isNeutral ? 'Sin cambio' : `${Math.abs(delta).toFixed(1)}% vs anterior`}
        </div>
      )}
    </div>
  );
};

export default DashboardModule;
