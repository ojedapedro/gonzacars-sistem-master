import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList, Search, Filter, RefreshCw, ChevronDown, ChevronUp,
  ShieldAlert, User, Clock, FileEdit, Trash2, FilePlus, Eye, Download,
  ChevronLeft, ChevronRight, X, AlertTriangle
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { useGonzacarsStore } from '../store';
import type { AuditLog } from '../lib/services/auditService';

/* ─── Helpers ─── */
const MODULE_LABELS: Record<string, string> = {
  Inventory:            'Inventario',
  Sales:                'Ventas POS',
  Repairs:              'Taller / Informes',
  Quotes:               'Cotizaciones',
  Customers:            'Clientes',
  Vehicles:             'Vehículos',
  Employees:            'Empleados',
  Payroll:              'Nómina',
  Expenses:             'Gastos',
  Purchases:            'Compras',
  AccountsReceivable:   'Cuentas por Cobrar',
  AccountsPayable:      'Cuentas por Pagar',
  Appointments:         'Citas',
  Users:                'Usuarios',
  Settings:             'Configuración',
};

const ACTION_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  create: { label: 'Creación',    color: 'emerald', icon: <FilePlus  size={13}/> },
  write:  { label: 'Modificación',color: 'blue',    icon: <FileEdit  size={13}/> },
  delete: { label: 'Eliminación', color: 'red',     icon: <Trash2    size={13}/> },
};

const formatTimestamp = (ts: string) => {
  try {
    const d = new Date(ts);
    return d.toLocaleString('es-VE', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
  } catch { return ts; }
};

const PAGE_SIZE = 25;

/* ─── Component ─── */
const AuditLogModule: React.FC = () => {
  const store = useGonzacarsStore();
  const isAdmin = store.currentUser?.role === 'administrador';

  const [logs, setLogs] = useState<(AuditLog & { id?: string })[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchUser,   setSearchUser]   = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');

  // Pagination
  const [page, setPage] = useState(1);

  // Expand details
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* ── Load audit logs from Firestore ── */
  const loadLogs = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'AuditLogs'),
        orderBy('timestamp', 'desc'),
        limit(2000)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog & { id: string }));
      setLogs(data);
    } catch (err) {
      console.error('Error cargando bitácora:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadLogs();
  }, [isAdmin]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (filterModule && log.resModel !== filterModule) return false;
      if (filterAction && log.action  !== filterAction)  return false;
      if (searchUser) {
        const q = searchUser.toLowerCase();
        if (!log.userName.toLowerCase().includes(q) && !log.userId.toLowerCase().includes(q)) return false;
      }
      if (filterDateFrom && log.timestamp < filterDateFrom) return false;
      if (filterDateTo   && log.timestamp.slice(0,10) > filterDateTo) return false;
      return true;
    });
  }, [logs, filterModule, filterAction, searchUser, filterDateFrom, filterDateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const uniqueModules = [...new Set(logs.map(l => l.resModel))].sort();
  const uniqueUsers   = [...new Set(logs.map(l => l.userName))].sort();

  /* ── CSV Export ── */
  const exportCSV = () => {
    const header = ['Timestamp','Módulo','Acción','Usuario','ID Registro'];
    const rows = filtered.map(l => [
      l.timestamp,
      MODULE_LABELS[l.resModel] || l.resModel,
      l.action,
      l.userName,
      l.resId
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `bitacora_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Guard ── */
  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert size={36} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-black text-chrome-100 uppercase tracking-tight mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Acceso Restringido
          </h2>
          <p className="text-chrome-400 text-sm leading-relaxed">
            Esta sección es exclusiva para administradores del sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-black text-chrome-100 tracking-tight uppercase leading-none flex items-center gap-3"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            <ClipboardList className="text-amber-400" size={28} />
            Bitácora de Registro
          </h1>
          <p className="text-chrome-400 font-medium mt-2 text-sm">
            Auditoría completa de todas las acciones realizadas en el sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="btn-metallic flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            <Download size={13}/> Exportar CSV
          </button>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="btn-metallic flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-400' : ''}/> Actualizar
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Registros', value: logs.length, color: 'blue' },
          { label: 'Resultados Filtrados', value: filtered.length, color: 'amber' },
          { label: 'Creaciones',   value: logs.filter(l => l.action === 'create').length, color: 'emerald' },
          { label: 'Eliminaciones', value: logs.filter(l => l.action === 'delete').length, color: 'red' },
        ].map((stat, i) => (
          <div key={i} className="p-4 rounded-xl surface-raised border border-metal-border">
            <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest">{stat.label}</p>
            <p className={`text-3xl font-black mt-1 text-${stat.color}-400`} style={{ fontFamily: 'Outfit, sans-serif' }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="p-4 rounded-xl surface-raised border border-metal-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search by user */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none"/>
            <input
              type="text"
              placeholder="Buscar usuario…"
              value={searchUser}
              onChange={e => { setSearchUser(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-3 py-2.5 bg-metal-dark border border-metal-border rounded-lg text-xs font-medium text-chrome-200 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Module filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none"/>
            <select
              value={filterModule}
              onChange={e => { setFilterModule(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-3 py-2.5 bg-metal-dark border border-metal-border rounded-lg text-xs font-medium text-chrome-200 outline-none focus:border-blue-500 transition-colors appearance-none"
            >
              <option value="">Todos los módulos</option>
              {uniqueModules.map(m => (
                <option key={m} value={m}>{MODULE_LABELS[m] || m}</option>
              ))}
            </select>
          </div>

          {/* Action filter */}
          <div className="relative">
            <select
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-metal-dark border border-metal-border rounded-lg text-xs font-medium text-chrome-200 outline-none focus:border-blue-500 transition-colors appearance-none"
            >
              <option value="">Todas las acciones</option>
              <option value="create">Creación</option>
              <option value="write">Modificación</option>
              <option value="delete">Eliminación</option>
            </select>
          </div>

          {/* Date from */}
          <div className="relative">
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-metal-dark border border-metal-border rounded-lg text-xs font-medium text-chrome-200 outline-none focus:border-blue-500 transition-colors"
              title="Desde"
            />
          </div>

          {/* Date to */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="date"
                value={filterDateTo}
                onChange={e => { setFilterDateTo(e.target.value); setPage(1); }}
                className="w-full px-3 py-2.5 bg-metal-dark border border-metal-border rounded-lg text-xs font-medium text-chrome-200 outline-none focus:border-blue-500 transition-colors"
                title="Hasta"
              />
            </div>
            {(searchUser || filterModule || filterAction || filterDateFrom || filterDateTo) && (
              <button
                onClick={() => {
                  setSearchUser(''); setFilterModule(''); setFilterAction('');
                  setFilterDateFrom(''); setFilterDateTo(''); setPage(1);
                }}
                title="Limpiar filtros"
                className="px-3 rounded-lg border border-metal-border bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors flex-shrink-0"
              >
                <X size={14}/>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl surface-raised border border-metal-border overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_140px_110px_160px_80px] gap-3 px-5 py-3 border-b border-metal-border bg-metal-dark/60">
          {['Descripción / Registro', 'Módulo', 'Acción', 'Usuario', 'Detalles'].map((col, i) => (
            <span key={i} className="text-[9px] font-black text-chrome-500 uppercase tracking-widest">
              {col}
            </span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <RefreshCw size={20} className="animate-spin text-blue-400"/>
            <span className="text-chrome-400 text-sm font-bold">Cargando bitácora…</span>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ClipboardList size={36} className="text-chrome-600"/>
            <p className="text-chrome-500 text-sm font-bold">No hay registros para mostrar</p>
          </div>
        ) : (
          <div className="divide-y divide-metal-border/50">
            {paginated.map((log, i) => {
              const actionMeta = ACTION_LABELS[log.action] || { label: log.action, color: 'chrome', icon: <Eye size={13}/> };
              const moduleLabel = MODULE_LABELS[log.resModel] || log.resModel;
              const isExpanded = expandedId === (log.id || i.toString());

              return (
                <React.Fragment key={log.id || i}>
                  <div
                    className={`grid grid-cols-[1fr_140px_110px_160px_80px] gap-3 px-5 py-3.5 items-center transition-colors hover:bg-metal-dark/40 ${i % 2 === 0 ? '' : 'bg-metal-dark/20'}`}
                  >
                    {/* Description */}
                    <div>
                      <p className="text-xs font-bold text-chrome-100 truncate">
                        ID: <span className="text-chrome-400 font-mono">{log.resId.slice(0, 20)}{log.resId.length > 20 ? '…' : ''}</span>
                      </p>
                      <p className="text-[10px] text-chrome-500 flex items-center gap-1 mt-0.5">
                        <Clock size={10}/> {formatTimestamp(log.timestamp)}
                      </p>
                    </div>

                    {/* Module */}
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-bold">
                        {moduleLabel}
                      </span>
                    </div>

                    {/* Action */}
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-${actionMeta.color}-400 bg-${actionMeta.color}-500/10 border border-${actionMeta.color}-500/20 text-[10px] font-black uppercase tracking-wider`}>
                        {actionMeta.icon} {actionMeta.label}
                      </span>
                    </div>

                    {/* User */}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <User size={12} className="text-purple-400"/>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-chrome-200 truncate">{log.userName}</p>
                      </div>
                    </div>

                    {/* Expand */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : (log.id || i.toString()))}
                        className="p-1.5 rounded-lg border border-metal-border hover:border-blue-500/40 hover:bg-blue-500/10 text-chrome-500 hover:text-blue-400 transition-all"
                        title={isExpanded ? 'Colapsar' : 'Ver detalles'}
                      >
                        {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <div className="px-5 py-4 bg-black/30 border-t border-blue-500/10">
                      <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-2">Datos del Cambio</p>
                      <pre className="text-[11px] text-chrome-300 font-mono bg-metal-dark/60 rounded-xl p-4 overflow-auto max-h-60 border border-metal-border whitespace-pre-wrap break-all">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-metal-border bg-metal-dark/40">
            <span className="text-[10px] font-bold text-chrome-500">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} registros
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-metal-border hover:border-blue-500/40 text-chrome-400 hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16}/>
              </button>
              <span className="text-[11px] font-black text-chrome-300 px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-metal-border hover:border-blue-500/40 text-chrome-400 hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16}/>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Admin notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
        <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5"/>
        <p className="text-xs text-amber-300/80">
          <strong className="text-amber-300">Módulo exclusivo del Administrador.</strong>{' '}
          Esta bitácora registra automáticamente todas las operaciones de creación, modificación y eliminación
          realizadas por los usuarios en el sistema. Los registros son de solo lectura y están auditados.
        </p>
      </div>
    </div>
  );
};

export default AuditLogModule;
