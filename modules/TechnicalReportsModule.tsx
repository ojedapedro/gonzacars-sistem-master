import React, { useState, useMemo } from 'react';
import { useGonzacarsStore } from '../store';
import { VehicleRepair } from '../types';
import { Calendar, Car, Clock, CheckCircle2, Wrench, Search, Filter, TrendingUp, LogIn, LogOut } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { formatDate } from '../lib/utils/finance';

const TechnicalReportsModule: React.FC = () => {
  const store = useGonzacarsStore();
  const repairs = store.repairs || [];
  
  const [dateFilter, setDateFilter] = useState<'esteMes' | 'mesPasado' | 'esteAno' | 'historico'>('esteMes');
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to filter dates
  const filterRepairsByDate = (r: VehicleRepair) => {
    if (dateFilter === 'historico') return true;
    
    const repairDate = new Date(r.createdAt);
    const now = new Date();
    
    if (dateFilter === 'esteMes') {
      return repairDate.getMonth() === now.getMonth() && repairDate.getFullYear() === now.getFullYear();
    }
    if (dateFilter === 'mesPasado') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return repairDate.getMonth() === lastMonth.getMonth() && repairDate.getFullYear() === lastMonth.getFullYear();
    }
    if (dateFilter === 'esteAno') {
      return repairDate.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filteredRepairs = useMemo(() => {
    let filtered = repairs.filter(filterRepairsByDate);
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.plate.toLowerCase().includes(term) ||
        r.ownerName.toLowerCase().includes(term) ||
        r.brand.toLowerCase().includes(term)
      );
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [repairs, dateFilter, searchTerm]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    let entradas = 0;
    let salidas = 0;
    let permanenciaTotal = 0;
    let vehiculosConSalida = 0;
    
    filteredRepairs.forEach(r => {
      entradas++;
      if (r.status === 'Entregado' && r.finishedAt) {
        salidas++;
        const entryDate = new Date(r.createdAt);
        const exitDate = new Date(r.finishedAt);
        const diffTime = Math.abs(exitDate.getTime() - entryDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        permanenciaTotal += diffDays;
        vehiculosConSalida++;
      }
    });

    return {
      entradas,
      salidas,
      enTaller: entradas - salidas,
      permanenciaPromedio: vehiculosConSalida > 0 ? (permanenciaTotal / vehiculosConSalida).toFixed(1) : '0'
    };
  }, [filteredRepairs]);

  // Chart Data: Entradas vs Salidas by day/month depending on filter
  const chartData = useMemo(() => {
    const dataMap: Record<string, { name: string, date: string, entradas: number, salidas: number }> = {};
    
    // Si es esteAno, agrupamos por mes. Si no, por día.
    const groupByMonth = dateFilter === 'esteAno' || dateFilter === 'historico';
    
    filteredRepairs.forEach(r => {
      const dEntry = new Date(r.createdAt);
      const keyEntry = groupByMonth 
        ? `${dEntry.getFullYear()}-${String(dEntry.getMonth() + 1).padStart(2, '0')}`
        : dEntry.toISOString().split('T')[0];
        
      if (!dataMap[keyEntry]) {
        dataMap[keyEntry] = { 
          name: groupByMonth ? dEntry.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' }) : dEntry.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }), 
          date: keyEntry, 
          entradas: 0, 
          salidas: 0 
        };
      }
      dataMap[keyEntry].entradas++;

      if (r.status === 'Entregado' && r.finishedAt) {
        const dExit = new Date(r.finishedAt);
        const keyExit = groupByMonth 
          ? `${dExit.getFullYear()}-${String(dExit.getMonth() + 1).padStart(2, '0')}`
          : dExit.toISOString().split('T')[0];
          
        if (!dataMap[keyExit]) {
          dataMap[keyExit] = { 
            name: groupByMonth ? dExit.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' }) : dExit.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }), 
            date: keyExit, 
            entradas: 0, 
            salidas: 0 
          };
        }
        dataMap[keyExit].salidas++;
      }
    });

    return Object.values(dataMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRepairs, dateFilter]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-chrome-100 flex items-center gap-3">
            <Wrench className="text-blue-500" size={32} />
            Reportes Técnicos
          </h1>
          <p className="text-chrome-400 mt-1">Análisis de flujo, permanencia e histórico del taller.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-metal-800/50 p-1.5 rounded-xl border border-metal-700/50">
          {(['esteMes', 'mesPasado', 'esteAno', 'historico'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                dateFilter === filter 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-metal-800/50 p-5 rounded-2xl border border-metal-700/50">
          <div className="flex items-center gap-3 mb-2 text-chrome-400">
            <LogIn size={18} className="text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Vehículos Ingresados</span>
          </div>
          <p className="text-3xl font-black text-chrome-100">{kpis.entradas}</p>
        </div>
        <div className="bg-metal-800/50 p-5 rounded-2xl border border-metal-700/50">
          <div className="flex items-center gap-3 mb-2 text-chrome-400">
            <LogOut size={18} className="text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Vehículos Entregados</span>
          </div>
          <p className="text-3xl font-black text-chrome-100">{kpis.salidas}</p>
        </div>
        <div className="bg-metal-800/50 p-5 rounded-2xl border border-metal-700/50">
          <div className="flex items-center gap-3 mb-2 text-chrome-400">
            <Car size={18} className="text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider">En Taller (Retenidos)</span>
          </div>
          <p className="text-3xl font-black text-chrome-100">{kpis.enTaller}</p>
        </div>
        <div className="bg-metal-800/50 p-5 rounded-2xl border border-metal-700/50">
          <div className="flex items-center gap-3 mb-2 text-chrome-400">
            <Clock size={18} className="text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Permanencia Prom.</span>
          </div>
          <p className="text-3xl font-black text-chrome-100">{kpis.permanenciaPromedio} <span className="text-lg text-chrome-500 font-medium">días</span></p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-metal-900 border border-metal-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-chrome-100 mb-6 flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-500" />
          Flujo de Entradas y Salidas
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f42" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#10131a', border: '1px solid #2a2f42', borderRadius: '12px' }}
                itemStyle={{ color: '#f8fafc' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="entradas" name="Entradas" fill="#34d399" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="salidas" name="Salidas" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-metal-900 border border-metal-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-metal-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-chrome-100">Histórico de Informes</h3>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por placa, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-metal-800 border border-metal-700 rounded-xl pl-10 pr-4 py-2 text-sm text-chrome-100 placeholder-chrome-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-metal-800/30">
                <th className="py-3 px-5 text-xs font-bold text-chrome-400 uppercase tracking-wider">Fecha Ingreso</th>
                <th className="py-3 px-5 text-xs font-bold text-chrome-400 uppercase tracking-wider">Vehículo</th>
                <th className="py-3 px-5 text-xs font-bold text-chrome-400 uppercase tracking-wider">Cliente</th>
                <th className="py-3 px-5 text-xs font-bold text-chrome-400 uppercase tracking-wider">Estado</th>
                <th className="py-3 px-5 text-xs font-bold text-chrome-400 uppercase tracking-wider">Fecha Salida</th>
                <th className="py-3 px-5 text-xs font-bold text-chrome-400 uppercase tracking-wider text-center">Días en Taller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-metal-800/50">
              {filteredRepairs.map(r => {
                const entryDate = new Date(r.createdAt);
                const exitDate = r.finishedAt ? new Date(r.finishedAt) : new Date();
                const diffTime = Math.abs(exitDate.getTime() - entryDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

                return (
                  <tr key={r.id} className="hover:bg-metal-800/20 transition-colors">
                    <td className="py-3 px-5 text-sm text-chrome-300">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="py-3 px-5">
                      <p className="font-bold text-chrome-100 uppercase">{r.plate}</p>
                      <p className="text-xs text-chrome-500">{r.brand} {r.model}</p>
                    </td>
                    <td className="py-3 px-5 text-sm text-chrome-300">
                      {r.ownerName}
                    </td>
                    <td className="py-3 px-5">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border
                        ${r.status === 'Entregado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                        ${r.status === 'Ingresado' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                        ${r.status === 'En Reparación' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : ''}
                        ${r.status === 'Esperando Repuestos' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                        ${r.status === 'En Diagnóstico' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : ''}
                        ${r.status === 'Finalizado' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : ''}
                      `}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-sm text-chrome-300">
                      {r.finishedAt ? formatDate(r.finishedAt) : '-'}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <span className={`font-bold ${diffDays > 7 ? 'text-amber-400' : 'text-chrome-300'}`}>
                        {diffDays}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredRepairs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-chrome-500">
                    No se encontraron registros para este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TechnicalReportsModule;
