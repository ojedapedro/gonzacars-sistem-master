import React, { useState, useMemo } from 'react';
import { useGonzacarsStore } from '../store';
import { formatCurrency, formatDate } from '../lib/utils/finance';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3, TrendingUp, DollarSign, Wallet, Package, Wrench, Download, FileText, LayoutDashboard } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FinancialReportsModule: React.FC = () => {
  const store = useGonzacarsStore();
  const [dateFilter, setDateFilter] = useState<'esteMes' | 'mesPasado' | 'esteAno' | 'historico' | 'personalizado'>('esteMes');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'resumen' | 'detalle'>('resumen');

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
    if (dateFilter === 'personalizado') {
      if (!startDate && !endDate) return true;
      const dTime = d.getTime();
      const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
      const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Infinity;
      return dTime >= start && dTime <= end;
    }
    return true;
  };

  const {
    ingresosTaller, ingresosPOS, gastos, compras, nomina, cogsVentas, cogsTaller, chartData,
    detalle
  } = useMemo(() => {
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

    const ventasTallerRepuestos: Record<string, { qty: number, total: number }> = {};
    const ventasTallerServicios: Record<string, { qty: number, total: number }> = {};
    const ventasTallerConsumibles: Record<string, { qty: number, total: number }> = {};

    fRepairs.forEach(r => {
      (r.items || []).forEach(item => {
        const itemTotal = item.price * item.quantity;
        const targetDesc = item.description || 'Desconocido';
        
        if (item.type === 'Repuesto') {
          ingresosTallerRepuestos += itemTotal;
          if (!ventasTallerRepuestos[targetDesc]) ventasTallerRepuestos[targetDesc] = { qty: 0, total: 0 };
          ventasTallerRepuestos[targetDesc].qty += item.quantity;
          ventasTallerRepuestos[targetDesc].total += itemTotal;
        } else if (item.type === 'Consumible') {
          ingresosTallerConsumibles += itemTotal;
          if (!ventasTallerConsumibles[targetDesc]) ventasTallerConsumibles[targetDesc] = { qty: 0, total: 0 };
          ventasTallerConsumibles[targetDesc].qty += item.quantity;
          ventasTallerConsumibles[targetDesc].total += itemTotal;
        } else if (item.type === 'Servicio') {
          ingresosTallerServicios += itemTotal;
          if (!ventasTallerServicios[targetDesc]) ventasTallerServicios[targetDesc] = { qty: 0, total: 0 };
          ventasTallerServicios[targetDesc].qty += item.quantity;
          ventasTallerServicios[targetDesc].total += itemTotal;
        }
        
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
    const ventasTienda: Record<string, { qty: number, total: number }> = {};

    fSales.forEach(s => {
      totalIngresosPOS += s.total;
      cogsVentas += s.totalCost || 0;
      
      (s.items || []).forEach(item => {
        const targetDesc = item.name || 'Desconocido';
        if (!ventasTienda[targetDesc]) ventasTienda[targetDesc] = { qty: 0, total: 0 };
        ventasTienda[targetDesc].qty += item.quantity;
        ventasTienda[targetDesc].total += item.price * item.quantity;
      });
    });

    // Egresos (Gastos Operativos)
    const totalGastos = fExpenses.reduce((sum, e) => sum + e.amount, 0);
    const gastosFijos: Record<string, number> = {};
    const gastosVariables: Record<string, number> = {};
    const fixedCats = ['Alquiler', 'Luz', 'Agua', 'Internet', 'Impuestos', 'Nómina Administrativa', 'Servicios de Aseo', 'Oficina'];

    fExpenses.forEach(e => {
      const isFixed = e.expenseType === 'Gasto Fijo' || (!e.expenseType && fixedCats.includes(e.category));
      const target = isFixed ? gastosFijos : gastosVariables;
      const cat = e.category || 'Otros';
      if (!target[cat]) target[cat] = 0;
      target[cat] += e.amount;
    });

    // Compras
    const totalCompras = fPurchases.reduce((sum, p) => sum + p.total, 0);
    const comprasDetalle: Record<string, number> = {};
    fPurchases.forEach(p => {
      const cat = p.category || 'Sin Categoría';
      if (!comprasDetalle[cat]) comprasDetalle[cat] = 0;
      comprasDetalle[cat] += p.total;
    });

    // Nómina
    const totalNomina = fPayroll.reduce((sum, p) => sum + p.total, 0);
    const nominaDetalle: Record<string, number> = {};
    fPayroll.forEach(p => {
      const emp = store.employees?.find(e => e.id === p.employeeId);
      const name = emp ? emp.name : 'Desconocido';
      if (!nominaDetalle[name]) nominaDetalle[name] = 0;
      nominaDetalle[name] += p.total;
    });

    // Chart Data
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
    fPurchases.forEach(p => addToChart(p.date, p.total, 'egresos'));
    fPayroll.forEach(p => addToChart(p.date, p.total, 'egresos'));

    return {
      ingresosTaller: { repuestos: ingresosTallerRepuestos, consumibles: ingresosTallerConsumibles, servicios: ingresosTallerServicios, total: totalIngresosTaller },
      ingresosPOS: totalIngresosPOS,
      gastos: totalGastos,
      compras: totalCompras,
      nomina: totalNomina,
      cogsVentas,
      cogsTaller,
      chartData: Object.values(dataMap).sort((a, b) => a.date.localeCompare(b.date)),
      detalle: {
        ventasTienda,
        ventasTallerRepuestos,
        ventasTallerServicios,
        ventasTallerConsumibles,
        gastosFijos,
        gastosVariables,
        comprasDetalle,
        nominaDetalle
      }
    };
  }, [store.repairs, store.sales, store.expenses, store.purchases, store.payroll, store.inventory, dateFilter, startDate, endDate]);

  const totalIngresos = ingresosTaller.total + ingresosPOS;
  const totalEgresosFlujo = gastos + compras + nomina; 
  const utilidadNetaFlujo = totalIngresos - totalEgresosFlujo; // Resultado del ejercicio basado en Flujo (incluye compras en vez de COGS)
  
  // Utilidad Neta real (usando COGS) si se desea ver rentabilidad contable pura, pero usaremos Flujo para el reporte Presidencial.
  const utilidadNetaContable = totalIngresos - (gastos + nomina + cogsVentas + cogsTaller);
  const margenNeto = totalIngresos > 0 ? (utilidadNetaFlujo / totalIngresos) * 100 : 0;

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

  const renderTableSection = (title: string, data: Record<string, any>, isQty: boolean = false, isExpense = false) => {
    const entries = Object.entries(data);
    if (entries.length === 0) return null;

    const total = entries.reduce((sum, [_, val]) => sum + (isQty ? val.total : val), 0);
    const colorClass = isExpense ? 'text-red-400' : 'text-emerald-400';

    return (
      <div className="mb-6">
        <h4 className="text-sm font-bold text-chrome-200 mb-2 uppercase tracking-wide border-b border-metal-700 pb-2">{title}</h4>
        <div className="bg-metal-900/50 rounded-xl overflow-hidden border border-metal-800">
          <table className="w-full text-sm">
            <thead className="bg-metal-800 text-chrome-400 text-left">
              <tr>
                <th className="py-2 px-4 font-semibold">Descripción</th>
                {isQty && <th className="py-2 px-4 font-semibold text-right">Cantidad</th>}
                <th className="py-2 px-4 font-semibold text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-metal-800">
              {entries.sort((a, b) => (isQty ? b[1].total - a[1].total : b[1] - a[1])).map(([key, val]) => (
                <tr key={key} className="hover:bg-metal-800/30">
                  <td className="py-2 px-4 text-chrome-300">{key}</td>
                  {isQty && <td className="py-2 px-4 text-right text-chrome-400">{val.qty}</td>}
                  <td className="py-2 px-4 text-right font-medium text-chrome-200">{formatCurrency(isQty ? val.total : val)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-metal-800/50 font-bold">
              <tr>
                <td className="py-2 px-4 text-chrome-100" colSpan={isQty ? 2 : 1}>Subtotal</td>
                <td className={`py-2 px-4 text-right ${colorClass}`}>{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text('REPORTE FINANCIERO PRESIDENCIAL', 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-VE')}`, 14, 28);
    
    let filterText = "Período: ";
    if (dateFilter === 'esteMes') filterText += "Este Mes";
    else if (dateFilter === 'mesPasado') filterText += "Mes Pasado";
    else if (dateFilter === 'esteAno') filterText += "Este Año";
    else if (dateFilter === 'historico') filterText += "Histórico Completo";
    else filterText += `${startDate || 'Inicio'} hasta ${endDate || 'Fin'}`;
    
    doc.text(filterText, 14, 34);

    let startY = 48;

    // Resumen Ejecutivo (KPIs)
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text('Resumen Ejecutivo del Período', 14, startY);
    
    autoTable(doc, {
      startY: startY + 5,
      head: [['Métrica', 'Valor']],
      body: [
        ['Ingresos Totales (Tienda + Taller)', formatCurrency(totalIngresos)],
        ['Total Egresos (Compras + Nómina + Gastos)', formatCurrency(totalEgresosFlujo)],
        ['Resultado del Ejercicio (Utilidad Flujo)', formatCurrency(utilidadNetaFlujo)],
        ['Margen de Ejercicio', `${margenNeto.toFixed(2)}%`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [52, 211, 153], textColor: 255 }, // Emerald 400
      styles: { fontSize: 11, cellPadding: 4 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    });

    const docAsAny = doc as any;
    let nextY = docAsAny.lastAutoTable.finalY + 15;

    // Helper para tablas detalladas en PDF
    const addSectionTable = (title: string, data: Record<string, any>, isQty: boolean, isExpense: boolean) => {
      const entries = Object.entries(data);
      if (entries.length === 0) return;

      if (nextY > 260) { doc.addPage(); nextY = 20; } // Salto de página

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(isExpense ? 220 : 50, isExpense ? 50 : 150, 50);
      doc.text(title.toUpperCase(), 14, nextY);

      const tableData = entries.sort((a, b) => (isQty ? b[1].total - a[1].total : b[1] - a[1])).map(([key, val]) => {
        if (isQty) return [key, val.qty.toString(), formatCurrency(val.total)];
        return [key, formatCurrency(val)];
      });
      
      const total = entries.reduce((sum, [_, val]) => sum + (isQty ? val.total : val), 0);
      tableData.push(['TOTAL', isQty ? '' : '', formatCurrency(total)]);

      autoTable(doc, {
        startY: nextY + 4,
        head: isQty ? [['Descripción', 'Cant.', 'Monto']] : [['Descripción', 'Monto']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: isExpense ? [244, 63, 94] : [16, 185, 129] }, // Rose 500 / Emerald 500
        styles: { fontSize: 9 },
        willDrawCell: function(data) {
          // Destacar la fila de total
          if (data.row.index === tableData.length - 1) {
            doc.setFillColor(240, 240, 240);
            doc.setFont("helvetica", "bold");
          }
        },
        columnStyles: isQty ? { 1: { halign: 'center' }, 2: { halign: 'right' } } : { 1: { halign: 'right' } }
      });
      
      nextY = docAsAny.lastAutoTable.finalY + 10;
    };

    addSectionTable('Ventas Tienda (Punto de Venta)', detalle.ventasTienda, true, false);
    addSectionTable('Ingresos Taller - Repuestos', detalle.ventasTallerRepuestos, true, false);
    addSectionTable('Ingresos Taller - Servicios', detalle.ventasTallerServicios, true, false);
    addSectionTable('Ingresos Taller - Consumibles', detalle.ventasTallerConsumibles, true, false);
    
    addSectionTable('Egresos - Compras de Inventario', detalle.comprasDetalle, false, true);
    addSectionTable('Egresos - Nómina (Personal)', detalle.nominaDetalle, false, true);
    addSectionTable('Egresos - Gastos Fijos', detalle.gastosFijos, false, true);
    addSectionTable('Egresos - Gastos Variables', detalle.gastosVariables, false, true);

    // Página Final: Estado de Resultados Resumido
    doc.addPage();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('ESTADO DE RESULTADOS (FLUJO)', 14, 20);

    const totalGastosFijos = Object.values(detalle.gastosFijos).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
    const totalGastosVar = Object.values(detalle.gastosVariables).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
    const resultColor = utilidadNetaFlujo >= 0 ? [16, 185, 129] : [244, 63, 94];

    autoTable(doc, {
      startY: 40,
      body: [
        ['(+) Ventas Punto de Venta (Tienda)', formatCurrency(ingresosPOS)],
        ['(+) Ingresos de Taller', formatCurrency(ingresosTaller.total)],
        ['= TOTAL INGRESOS', formatCurrency(totalIngresos)],
        ['', ''],
        ['(-) Compras de Inventario', formatCurrency(compras)],
        ['(-) Pago de Nómina', formatCurrency(nomina)],
        ['(-) Gastos Fijos', formatCurrency(totalGastosFijos)],
        ['(-) Gastos Variables', formatCurrency(totalGastosVar)],
        ['= TOTAL EGRESOS', formatCurrency(totalEgresosFlujo)],
        ['', ''],
        ['RESULTADO DEL EJERCICIO (NETO)', formatCurrency(utilidadNetaFlujo)]
      ],
      theme: 'plain',
      styles: { fontSize: 12, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
      willDrawCell: function(data) {
        const text = data.row.raw[0].toString();
        if (text.includes('TOTAL INGRESOS')) {
          doc.setTextColor(16, 185, 129); // Emerald
        } else if (text.includes('TOTAL EGRESOS')) {
          doc.setTextColor(244, 63, 94); // Rose
        } else if (text.includes('RESULTADO DEL EJERCICIO')) {
          doc.setFillColor(resultColor[0], resultColor[1], resultColor[2]);
          doc.setTextColor(255, 255, 255);
        } else {
          doc.setTextColor(80, 80, 80);
        }
      }
    });

    doc.save(`Reporte_Presidencial_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header and Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-metal-900 border border-metal-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h1 className="text-3xl font-black text-chrome-100 flex items-center gap-3">
            <BarChart3 className="text-emerald-500" size={32} />
            Reportes Financieros
          </h1>
          <p className="text-chrome-400 mt-1">Análisis de resultados, flujo de caja y estado consolidado de la empresa.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-metal-800 p-1.5 rounded-xl border border-metal-700">
            <button 
              onClick={() => setViewMode('resumen')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                viewMode === 'resumen' ? 'bg-chrome-100 text-metal-900' : 'text-chrome-400 hover:text-chrome-200 hover:bg-metal-700'
              }`}
            >
              <LayoutDashboard size={18} /> Resumen Visual
            </button>
            <button 
              onClick={() => setViewMode('detalle')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                viewMode === 'detalle' ? 'bg-amber-500 text-metal-900' : 'text-chrome-400 hover:text-chrome-200 hover:bg-metal-700'
              }`}
            >
              <FileText size={18} /> Reporte Presidencial
            </button>
          </div>

          <button onClick={handleDownloadPDF} className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all bg-blue-600 text-white shadow-lg shadow-blue-900/20 flex items-center gap-2 hover:bg-blue-500 border border-blue-500">
            <Download size={18} /> Exportar a PDF
          </button>
        </div>
      </div>

      <div className="bg-metal-900 border border-metal-800 p-4 rounded-2xl flex flex-wrap items-center gap-4">
        <span className="text-chrome-300 font-medium text-sm flex items-center gap-2">
          <TrendingUp size={16} className="text-chrome-400" />
          Filtro de Período:
        </span>
        <div className="flex items-center gap-2">
          {(['esteMes', 'mesPasado', 'esteAno', 'historico', 'personalizado'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilter === filter 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : 'text-chrome-400 bg-metal-800 hover:bg-metal-700'
              }`}
            >
              {filter === 'esteMes' ? 'Este Mes' : 
               filter === 'mesPasado' ? 'Mes Pasado' : 
               filter === 'esteAno' ? 'Este Año' : 
               filter === 'personalizado' ? 'Personalizado' : 'Histórico'}
            </button>
          ))}
        </div>

        {dateFilter === 'personalizado' && (
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-metal-800 border border-metal-700 rounded-lg px-3 py-1.5 text-sm text-chrome-100 focus:outline-none focus:border-emerald-500 transition-colors" />
            <span className="text-chrome-500">-</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-metal-800 border border-metal-700 rounded-lg px-3 py-1.5 text-sm text-chrome-100 focus:outline-none focus:border-emerald-500 transition-colors" />
          </div>
        )}
      </div>

      {viewMode === 'resumen' && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-metal-900 p-5 rounded-2xl border border-metal-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={64} /></div>
              <p className="text-chrome-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Ingresos Totales</p>
              <p className="text-3xl font-black text-emerald-400 relative z-10">{formatCurrency(totalIngresos)}</p>
            </div>
            <div className="bg-metal-900 p-5 rounded-2xl border border-metal-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet size={64} /></div>
              <p className="text-chrome-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Egresos (Flujo)</p>
              <p className="text-3xl font-black text-red-400 relative z-10">{formatCurrency(totalEgresosFlujo)}</p>
            </div>
            <div className="bg-metal-900 p-5 rounded-2xl border border-metal-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={64} /></div>
              <p className="text-chrome-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Utilidad Neta (Flujo)</p>
              <p className={`text-3xl font-black relative z-10 ${utilidadNetaFlujo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(utilidadNetaFlujo)}
              </p>
            </div>
            <div className="bg-metal-900 p-5 rounded-2xl border border-metal-800 relative overflow-hidden">
              <p className="text-chrome-400 text-xs font-bold uppercase tracking-wider mb-2">Margen Neto</p>
              <p className={`text-3xl font-black ${margenNeto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {margenNeto.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-metal-900 border border-metal-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-chrome-100 mb-6 flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-500" />
                Flujo de Caja a través del Tiempo
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

            <div className="flex flex-col gap-6">
              <div className="bg-metal-900 border border-metal-800 rounded-2xl p-6 flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-chrome-100 mb-2">Distribución de Ingresos</h3>
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
              </div>

              <div className="bg-metal-900 border border-metal-800 rounded-2xl p-6 flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-chrome-100 mb-2">Distribución de Egresos</h3>
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
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'detalle' && (
        <div className="animate-fade-in space-y-8">
          <div className="bg-metal-900/40 p-8 rounded-3xl border border-metal-800 shadow-2xl">
            <h2 className="text-2xl font-black text-chrome-100 mb-8 border-b border-metal-800 pb-4 text-center tracking-tight">
              ESTADO DE RESULTADOS DETALLADO
            </h2>

            {/* SECCION INGRESOS */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-6 bg-emerald-900/20 p-3 rounded-xl border border-emerald-900/30">
                <DollarSign className="text-emerald-500" size={24} />
                <h3 className="text-xl font-bold text-emerald-400">INGRESOS (ENTRADAS)</h3>
              </div>
              
              <div className="grid xl:grid-cols-2 gap-8">
                <div>
                  {renderTableSection('Ventas Tienda (Punto de Venta)', detalle.ventasTienda, true, false)}
                </div>
                <div>
                  {renderTableSection('Taller: Repuestos', detalle.ventasTallerRepuestos, true, false)}
                  {renderTableSection('Taller: Servicios (Mano de Obra)', detalle.ventasTallerServicios, true, false)}
                  {renderTableSection('Taller: Consumibles', detalle.ventasTallerConsumibles, true, false)}
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-metal-800/50 rounded-xl flex justify-between items-center border border-emerald-900/30">
                <span className="text-lg font-bold text-chrome-100">TOTAL INGRESOS</span>
                <span className="text-2xl font-black text-emerald-400">{formatCurrency(totalIngresos)}</span>
              </div>
            </div>

            {/* SECCION EGRESOS */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-6 bg-rose-900/20 p-3 rounded-xl border border-rose-900/30">
                <Wallet className="text-rose-500" size={24} />
                <h3 className="text-xl font-bold text-rose-400">EGRESOS (SALIDAS)</h3>
              </div>
              
              <div className="grid xl:grid-cols-2 gap-8">
                <div>
                  {renderTableSection('Compras de Inventario', detalle.comprasDetalle, false, true)}
                  {renderTableSection('Nómina', detalle.nominaDetalle, false, true)}
                </div>
                <div>
                  {renderTableSection('Gastos Fijos', detalle.gastosFijos, false, true)}
                  {renderTableSection('Gastos Variables', detalle.gastosVariables, false, true)}
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-metal-800/50 rounded-xl flex justify-between items-center border border-rose-900/30">
                <span className="text-lg font-bold text-chrome-100">TOTAL EGRESOS</span>
                <span className="text-2xl font-black text-rose-400">{formatCurrency(totalEgresosFlujo)}</span>
              </div>
            </div>

            {/* RESULTADO FINAL */}
            <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-4 ${
              utilidadNetaFlujo >= 0 
                ? 'bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]' 
                : 'bg-rose-900/20 border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.15)]'
            }`}>
              <div>
                <h3 className="text-xl font-black text-chrome-100">RESULTADO DEL EJERCICIO</h3>
                <p className="text-chrome-400 text-sm mt-1">Utilidad Neta (Ingresos - Egresos)</p>
              </div>
              <span className={`text-4xl font-black tracking-tight ${utilidadNetaFlujo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(utilidadNetaFlujo)}
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialReportsModule;
