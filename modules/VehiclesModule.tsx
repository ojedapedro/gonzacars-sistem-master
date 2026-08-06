/* Hallmark · macrostructure: Workbench · theme: Cobalt · genre: modern-minimal
 * nav: embedded-module · footer: none
 * audience: workshop operators · tone: utilitarian
 * pre-emit critique: P4 H5 E4 S4 R5 V4
 */

import React, { useState, useMemo } from 'react';
import {
  Car, Search, Plus, User, Calendar, Wrench, X, Activity,
  MapPin, Gauge, AlertCircle, Fuel, Hash, Truck, Lightbulb,
  CheckCircle2, XCircle, HelpCircle, ClipboardList, ShieldCheck,
  ChevronDown, FileText
} from 'lucide-react';
import { useGonzacarsStore } from '../store';
import { VehicleRepair, Customer, VehicleChecklist, FuelLevel, ServiceStatus } from '../types';
import { fuzzySearch } from '../lib/utils/search';
import CurrencyBadge from '../components/CurrencyBadge';

// ─── Design tokens (Cobalt / Workbench) ──────────────────────────────────────

const T = {
  // surfaces
  bg:          'var(--metal-darkest)',
  surface:     'var(--metal-base)',
  surfaceHigh: 'var(--metal-mid)',
  border:      'var(--metal-border)',
  borderLight: 'var(--metal-border-light)',

  // text
  textPrimary:   'var(--chrome-100)',
  textSecondary: 'var(--chrome-300)',
  textMuted:     'var(--chrome-500)',

  // accent – cobalt blue/cyan
  accent:        'var(--accent-primary)',
  accentHover:   'var(--accent-hover)',
  accentGlow:    'var(--accent-glow)',
  accentSubtle:  'var(--accent-subtle)',

  // status
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger:  'var(--danger)',
  info:    'var(--info)',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface VehicleRecord {
  plate: string;
  brand: string;
  model: string;
  year: number;
  ownerName: string;
  customerId: string;
  mileage?: number;
  repairs: VehicleRepair[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  'Ingresado':          { label: 'Ingresado',         dot: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  text: '#38bdf8', border: 'rgba(56,189,248,0.25)' },
  'En Diagnóstico':     { label: 'En Diagnóstico',    dot: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  'En Reparación':      { label: 'En Reparación',     dot: '#fb923c', bg: 'rgba(251,146,60,0.08)',  text: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'Esperando Repuestos':{ label: 'Esp. Repuestos',    dot: '#a78bfa', bg: 'rgba(167,139,250,0.08)', text: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
  'Finalizado':         { label: 'Finalizado',         dot: '#34d399', bg: 'rgba(52,211,153,0.08)',  text: '#34d399', border: 'rgba(52,211,153,0.25)' },
  'Entregado':          { label: 'Entregado',          dot: '#94a3b8', bg: 'rgba(148,163,184,0.08)', text: '#94a3b8', border: 'rgba(148,163,184,0.2)'  },
};

const FUEL_LEVELS: { value: FuelLevel; label: string; pct: number; color: string }[] = [
  { value: 'Vacío',  label: 'Vacío', pct: 0,   color: '#ef4444' },
  { value: '1/4',   label: '¼',     pct: 25,  color: '#f97316' },
  { value: '1/2',   label: '½',     pct: 50,  color: '#eab308' },
  { value: '3/4',   label: '¾',     pct: 75,  color: '#84cc16' },
  { value: 'Lleno', label: 'Lleno', pct: 100, color: '#22c55e' },
];

const LIGHT_STATUS_OPTIONS = ['OK', 'Falla', 'Sin verificar'] as const;

const DEFAULT_CHECKLIST: VehicleChecklist = {
  fuelLevel: '1/2',
  serialVerified: false,
  serialNumber: '',
  serialMismatch: false,
  arrivedByTow: false,
  lightsRear: 'Sin verificar',
  lightsFront: 'Sin verificar',
  checklistNotes: '',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Status pill */
const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const m = STATUS_META[status] ?? { label: status, dot: '#94a3b8', bg: 'rgba(148,163,184,0.08)', text: '#94a3b8', border: 'rgba(148,163,184,0.2)' };
  return (
    <span
      style={{ backgroundColor: m.bg, color: m.text, borderColor: m.border }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider border leading-none"
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.dot }} />
      {m.label}
    </span>
  );
};

/** Light status toggle */
const LightStatusBadge: React.FC<{
  value: 'OK' | 'Falla' | 'Sin verificar';
  onChange: (v: 'OK' | 'Falla' | 'Sin verificar') => void;
}> = ({ value, onChange }) => {
  const cfg = {
    'OK':           { icon: CheckCircle2, active: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' },
    'Falla':        { icon: XCircle,      active: 'bg-red-500/15 border-red-500/40 text-red-400' },
    'Sin verificar':{ icon: HelpCircle,   active: 'bg-white/8 border-white/15 text-chrome-400' },
  };
  return (
    <div className="flex gap-2">
      {LIGHT_STATUS_OPTIONS.map(opt => {
        const { icon: Icon, active } = cfg[opt];
        const isActive = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
              isActive ? active : 'bg-white/3 border-white/8 text-chrome-500 hover:bg-white/8 hover:border-white/12'
            }`}
          >
            <Icon size={10} />
            {opt}
          </button>
        );
      })}
    </div>
  );
};

/** Read-only checklist badge */
const ChecklistBadgeRO: React.FC<{ value: 'OK' | 'Falla' | 'Sin verificar' }> = ({ value }) => {
  if (value === 'OK')
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 px-2 py-0.5 rounded"><CheckCircle2 size={9} />OK</span>;
  if (value === 'Falla')
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/8 border border-red-500/20 px-2 py-0.5 rounded"><XCircle size={9} />Falla</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-chrome-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded"><HelpCircle size={9} />Sin verificar</span>;
};

/** Fuel gauge */
const FuelGauge: React.FC<{ level: FuelLevel; onChange: (v: FuelLevel) => void }> = ({ level, onChange }) => {
  const current = FUEL_LEVELS.find(f => f.value === level) ?? FUEL_LEVELS[2];
  return (
    <div className="space-y-3">
      <div className="relative h-5 bg-white/5 border border-white/8 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${current.pct}%`, background: `linear-gradient(90deg, ${current.color}80, ${current.color})` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white drop-shadow">{current.label.toUpperCase()}</span>
        </div>
      </div>
      <div className="flex gap-1.5">
        {FUEL_LEVELS.map(fl => (
          <button
            key={fl.value}
            type="button"
            onClick={() => onChange(fl.value)}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all"
            style={
              level === fl.value
                ? { backgroundColor: fl.color + '20', borderColor: fl.color + '60', color: fl.color }
                : { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--chrome-500)' }
            }
          >
            {fl.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Section label ────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ icon: React.ReactNode; label: string; count?: number }> = ({ icon, label, count }) => (
  <div className="flex items-center gap-2 mb-4">
    <span className="text-chrome-500">{icon}</span>
    <span className="text-xs font-bold text-chrome-300 uppercase tracking-widest">{label}</span>
    {count !== undefined && (
      <span className="ml-auto text-[10px] font-bold text-chrome-600 bg-white/5 border border-white/8 px-2 py-0.5 rounded-md">
        {count}
      </span>
    )}
  </div>
);

// ─── Field group ──────────────────────────────────────────────────────────────

const FieldBlock: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-[10px] font-bold text-chrome-500 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full bg-white/4 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-medium placeholder:text-chrome-600 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 transition-all";
const selectCls = "w-full bg-metal-base border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 transition-all appearance-none";

// ─── Main Component ───────────────────────────────────────────────────────────

interface VehiclesModuleProps {
  store?: any;
  toast?: any;
}

const VehiclesModule: React.FC<VehiclesModuleProps> = ({ store: storeProp, toast }) => {
  const storeHook = useGonzacarsStore();
  const store = storeProp ?? storeHook;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(true);

  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    customerId: '',
    mileage: '' as string | number,
    serviceType: 'Mecánica General',
    status: 'Ingresado' as ServiceStatus,
    diagnosis: '',
    photos: [] as string[],
  });

  const [checklist, setChecklist] = useState<VehicleChecklist>({ ...DEFAULT_CHECKLIST });

  const patchChecklist = <K extends keyof VehicleChecklist>(key: K, value: VehicleChecklist[K]) =>
    setChecklist(prev => ({ ...prev, [key]: value }));

  // ── Derived data ────────────────────────────────────────────────────────────

  const vehicleRecords = useMemo((): VehicleRecord[] => {
    const map = new Map<string, VehicleRecord>();
    (store.repairs as VehicleRepair[]).forEach(repair => {
      const plate = repair.plate?.toUpperCase();
      if (!plate) return;
      if (!map.has(plate)) {
        map.set(plate, { plate, brand: repair.brand, model: repair.model, year: repair.year, ownerName: repair.ownerName, customerId: repair.customerId, mileage: repair.mileage, repairs: [] });
      }
      map.get(plate)!.repairs.push(repair);
    });
    map.forEach(v => {
      v.repairs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (v.repairs[0]?.mileage) v.mileage = v.repairs[0].mileage;
    });
    return Array.from(map.values()).sort((a, b) => a.plate.localeCompare(b.plate));
  }, [store.repairs]);

  const filteredVehicles = useMemo(() =>
    fuzzySearch(vehicleRecords, searchTerm, ['plate', 'brand', 'model', 'ownerName']),
    [vehicleRecords, searchTerm]
  );

  const selectedVehicle = useMemo(() =>
    vehicleRecords.find(v => v.plate === selectedPlate) ?? null,
    [vehicleRecords, selectedPlate]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOpenModal = () => {
    setChecklist({ ...DEFAULT_CHECKLIST });
    setNewVehicle({ plate: '', brand: '', model: '', year: new Date().getFullYear(), customerId: '', mileage: '', serviceType: 'Mecánica General', status: 'Ingresado', diagnosis: '', photos: [] });
    setShowAddModal(true);
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = store.customers.find((c: Customer) => c.id === newVehicle.customerId);
    if (!newVehicle.plate || !newVehicle.brand || !newVehicle.model || !customer) return;
    const finalChecklist: VehicleChecklist = { ...checklist, checkedAt: new Date().toISOString() };
    const repair: VehicleRepair = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: customer.id,
      ownerName: customer.name,
      plate: newVehicle.plate.toUpperCase().trim(),
      brand: newVehicle.brand,
      model: newVehicle.model,
      year: Number(newVehicle.year),
      mileage: newVehicle.mileage ? Number(newVehicle.mileage) : undefined,
      responsible: '',
      status: newVehicle.status,
      diagnosis: newVehicle.diagnosis || 'Vehículo registrado desde Directorio',
      serviceType: newVehicle.serviceType,
      evidencePhotos: newVehicle.photos,
      mechanicId: '',
      checklist: finalChecklist,
      items: [],
      createdAt: new Date().toISOString(),
    };
    await store.addRepair(repair);
    setShowAddModal(false);
    setSelectedPlate(newVehicle.plate.toUpperCase().trim());
  };

  const latestRepair = selectedVehicle?.repairs[0];
  const latestChecklist = latestRepair?.checklist;
  const totalSpent = selectedVehicle?.repairs.reduce(
    (acc, r) => acc + r.items.reduce((s, i) => s + i.price * i.quantity, 0), 0
  ) ?? 0;

  const activeCount = vehicleRecords.filter(v => v.repairs.some(r => r.status !== 'Entregado' && r.status !== 'Finalizado')).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="module-page flex flex-col h-[calc(100vh-6rem)]" style={{ maxWidth: '100%' }}>

      {/* ── Workbench header ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center gap-4 mb-5">
        {/* Title block */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(56,189,248,0.1))', border: '1px solid rgba(59,130,246,0.3)' }}
          >
            <Car size={18} className="text-blue-400" />
          </div>
          <div>
            <h2
              className="text-lg font-bold leading-none"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--chrome-100)', letterSpacing: '-0.02em' }}
            >
              Directorio de Vehículos
            </h2>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--chrome-500)' }}>
              {vehicleRecords.length} vehículo{vehicleRecords.length !== 1 ? 's' : ''} · {activeCount} en taller
            </p>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex items-center gap-2">
          <StatChip value={vehicleRecords.length} label="Total" />
          <StatChip value={store.repairs?.length ?? 0} label="Servicios" />
          <StatChip value={activeCount} label="Activos" accent />
        </div>

        {/* CTA */}
        <button
          id="btn-registrar-vehiculo"
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            boxShadow: '0 0 0 1px rgba(59,130,246,0.4), 0 4px 16px rgba(59,130,246,0.25)',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 0 1px rgba(59,130,246,0.6), 0 6px 24px rgba(59,130,246,0.35)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 0 1px rgba(59,130,246,0.4), 0 4px 16px rgba(59,130,246,0.25)')}
        >
          <Plus size={16} />
          Registrar Vehículo
        </button>
      </div>

      {/* ── Workbench layout: list + detail ──────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">

        {/* ── Left rail: vehicle list ──────────────────────────────────── */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Placa, marca, propietario…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: 'var(--metal-mid)',
                border: '1px solid var(--metal-border)',
                color: 'var(--chrome-100)',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--metal-border)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-chrome-500 hover:text-chrome-200 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* List */}
          <div
            className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-xl"
            style={{ background: 'var(--metal-base)', border: '1px solid var(--metal-border)' }}
          >
            {filteredVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <Car size={20} className="text-chrome-600" />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--chrome-400)' }}>
                    {vehicleRecords.length === 0 ? 'Sin vehículos registrados' : 'Sin resultados'}
                  </p>
                  {vehicleRecords.length === 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--chrome-600)' }}>
                      Se crean al registrar una reparación en Taller
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredVehicles.map(vehicle => {
                  const isSelected = selectedPlate === vehicle.plate;
                  const activeRepair = vehicle.repairs.find(r => r.status !== 'Entregado' && r.serviceType !== 'Registro');
                  const totalServices = vehicle.repairs.filter(r => r.serviceType !== 'Registro').length;
                  return (
                    <button
                      key={vehicle.plate}
                      id={`vehicle-${vehicle.plate}`}
                      onClick={() => setSelectedPlate(vehicle.plate)}
                      className="w-full text-left px-3 py-3 rounded-xl transition-all group"
                      style={{
                        background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                        border: isSelected ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Row top */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="text-[11px] font-black font-mono tracking-[0.12em] px-2 py-0.5 rounded-md"
                          style={
                            isSelected
                              ? { background: 'rgba(59,130,246,0.25)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.35)' }
                              : { background: 'rgba(255,255,255,0.06)', color: 'var(--chrome-200)', border: '1px solid rgba(255,255,255,0.08)' }
                          }
                        >
                          {vehicle.plate}
                        </span>
                        {activeRepair && (
                          <span
                            className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded"
                            style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            EN TALLER
                          </span>
                        )}
                      </div>

                      {/* Vehicle name */}
                      <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--chrome-100)' }}>
                        {vehicle.brand} {vehicle.model}
                        <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--chrome-500)' }}>{vehicle.year}</span>
                      </p>

                      {/* Owner + count */}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] flex items-center gap-1 truncate max-w-[160px]" style={{ color: 'var(--chrome-500)' }}>
                          <User size={10} className="flex-shrink-0" />
                          <span className="truncate">{vehicle.ownerName}</span>
                        </span>
                        <span className="text-[10px] font-medium flex-shrink-0" style={{ color: 'var(--chrome-600)' }}>
                          {totalServices} serv.
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: vehicle detail ─────────────────────────────────────── */}
        <div
          className="rounded-xl flex flex-col min-h-0 overflow-hidden"
          style={{ background: 'var(--metal-base)', border: '1px solid var(--metal-border)' }}
        >
          {selectedVehicle ? (
            <div className="flex flex-col h-full min-h-0">

              {/* ── Vehicle header ─────────────────────────────────────── */}
              <div className="flex-shrink-0 px-6 pt-6 pb-5 border-b" style={{ borderColor: 'var(--metal-border)' }}>
                {/* Top row */}
                <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
                  <div className="min-w-0">
                    {/* Tag */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                        style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                      >
                        <Car size={10} /> Ficha Técnica
                      </span>
                    </div>

                    {/* Vehicle name */}
                    <h2
                      className="text-2xl font-bold leading-tight"
                      style={{ fontFamily: 'var(--font-heading)', color: 'var(--chrome-100)', letterSpacing: '-0.025em' }}
                    >
                      {selectedVehicle.brand}{' '}
                      <span style={{ color: '#60a5fa' }}>{selectedVehicle.model}</span>
                    </h2>

                    {/* Plate + metadata chips */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span
                        className="text-base font-black font-mono tracking-[0.18em] px-3 py-1.5 rounded-lg"
                        style={{ background: 'var(--metal-mid)', color: 'var(--chrome-100)', border: '1px solid var(--metal-border-light)' }}
                      >
                        {selectedVehicle.plate}
                      </span>
                      <MetaChip>{selectedVehicle.year}</MetaChip>
                      {selectedVehicle.mileage && (
                        <MetaChip icon={<Gauge size={11} className="text-chrome-500" />}>
                          {selectedVehicle.mileage.toLocaleString()} km
                        </MetaChip>
                      )}
                    </div>
                  </div>

                  {/* Owner card */}
                  <div
                    className="rounded-xl p-4 flex-shrink-0 min-w-[200px]"
                    style={{ background: 'var(--metal-mid)', border: '1px solid var(--metal-border)' }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--chrome-500)' }}>Propietario</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--chrome-100)' }}>{selectedVehicle.ownerName}</p>
                    {(() => {
                      const c = store.customers.find((c: Customer) => c.id === selectedVehicle.customerId);
                      return c?.address ? (
                        <p className="text-xs mt-1.5 flex items-start gap-1.5" style={{ color: 'var(--chrome-500)' }}>
                          <MapPin size={10} className="mt-0.5 flex-shrink-0" />
                          {c.address}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* KPI bar */}
                <div className="grid grid-cols-3 gap-3 mt-5">
                  <KpiCell
                    value={selectedVehicle.repairs.filter(r => r.serviceType !== 'Registro').length}
                    label="Servicios"
                  />
                  <KpiCell
                    value={latestRepair ? new Date(latestRepair.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) : '—'}
                    label="Último Servicio"
                  />
                  <KpiCell
                    label="Total Invertido"
                    custom={<CurrencyBadge amountUsd={totalSpent} />}
                  />
                </div>
              </div>

              {/* ── Scrollable body ─────────────────────────────────────── */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6">

                {/* Checklist de Ingreso */}
                {latestChecklist && (
                  <section>
                    <SectionLabel
                      icon={<ClipboardList size={14} />}
                      label="Checklist de Ingreso"
                      count={latestChecklist.checkedAt ? undefined : undefined}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      {/* Combustible */}
                      <ChecklistCard label="Combustible" icon={<Fuel size={11} className="text-amber-400" />}>
                        {(() => {
                          const fl = FUEL_LEVELS.find(f => f.value === latestChecklist.fuelLevel);
                          return (
                            <div className="space-y-1.5 mt-2">
                              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="h-full rounded-full" style={{ width: `${fl?.pct ?? 50}%`, backgroundColor: fl?.color ?? '#eab308' }} />
                              </div>
                              <p className="text-sm font-bold" style={{ color: fl?.color }}>{latestChecklist.fuelLevel}</p>
                            </div>
                          );
                        })()}
                      </ChecklistCard>

                      {/* Grúa */}
                      <ChecklistCard label="Llegó en Grúa" icon={<Truck size={11} className="text-orange-400" />}>
                        <div className="mt-2">
                          {latestChecklist.arrivedByTow ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/8 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                              <Truck size={12} /> Sí, en grúa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                              <Car size={12} /> Por sus medios
                            </span>
                          )}
                        </div>
                      </ChecklistCard>

                      {/* Serial */}
                      <ChecklistCard label="Serial / VIN" icon={<Hash size={11} className="text-purple-400" />}>
                        <div className="mt-2 space-y-1">
                          {latestChecklist.serialVerified ? (
                            <>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 px-2 py-0.5 rounded">
                                <CheckCircle2 size={9} /> Verificado
                              </span>
                              {latestChecklist.serialNumber && (
                                <p className="text-xs font-mono mt-1" style={{ color: 'var(--chrome-300)' }}>{latestChecklist.serialNumber}</p>
                              )}
                              {latestChecklist.serialMismatch && (
                                <p className="text-[10px] font-bold text-red-400 flex items-center gap-1 mt-1">
                                  <AlertCircle size={9} /> No coincide con docs.
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-chrome-400 bg-white/4 border border-white/10 px-2 py-0.5 rounded">
                              <HelpCircle size={9} /> No verificado
                            </span>
                          )}
                        </div>
                      </ChecklistCard>

                      {/* Luces */}
                      <ChecklistCard label="Estado de Luces" icon={<Lightbulb size={11} className="text-yellow-400" />}>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px]" style={{ color: 'var(--chrome-400)' }}>Delantera</span>
                            <ChecklistBadgeRO value={latestChecklist.lightsFront} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px]" style={{ color: 'var(--chrome-400)' }}>Trasera</span>
                            <ChecklistBadgeRO value={latestChecklist.lightsRear} />
                          </div>
                        </div>
                      </ChecklistCard>
                    </div>

                    {latestChecklist.checklistNotes && (
                      <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--metal-mid)', border: '1px solid var(--metal-border)' }}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--chrome-500)' }}>
                          <FileText size={9} /> Observaciones
                        </p>
                        <p className="text-xs" style={{ color: 'var(--chrome-300)' }}>{latestChecklist.checklistNotes}</p>
                      </div>
                    )}
                  </section>
                )}

                {/* Historial de Servicios */}
                <section>
                  <SectionLabel
                    icon={<Activity size={14} />}
                    label="Historial de Servicios"
                    count={selectedVehicle.repairs.filter(r => r.serviceType !== 'Registro').length}
                  />

                  <div className="space-y-2">
                    {selectedVehicle.repairs.filter(r => r.serviceType !== 'Registro').length === 0 ? (
                      <div className="flex flex-col items-center py-10 gap-3" style={{ border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '0.75rem' }}>
                        <Wrench size={24} style={{ color: 'var(--chrome-600)' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--chrome-400)' }}>Sin historial de servicios</p>
                      </div>
                    ) : (
                      selectedVehicle.repairs
                        .filter(r => r.serviceType !== 'Registro')
                        .map(repair => {
                          const repairTotal = repair.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
                          return (
                            <div
                              key={repair.id}
                              className="rounded-xl p-4 transition-colors"
                              style={{ background: 'var(--metal-mid)', border: '1px solid var(--metal-border)' }}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--metal-border-light)')}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--metal-border)')}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  {/* Icon */}
                                  <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                                  >
                                    <Wrench size={14} style={{ color: 'var(--chrome-400)' }} />
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold leading-snug truncate" style={{ color: 'var(--chrome-100)' }}>
                                      {repair.diagnosis}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                      <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--chrome-500)' }}>
                                        <Calendar size={9} />
                                        {new Date(repair.createdAt).toLocaleDateString()}
                                      </span>
                                      <StatusPill status={repair.status} />
                                      {repair.serviceType && repair.serviceType !== 'Registro' && (
                                        <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--chrome-600)' }}>
                                          {repair.serviceType}
                                        </span>
                                      )}
                                      {repair.mileage ? (
                                        <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--chrome-500)' }}>
                                          <Gauge size={9} />{repair.mileage.toLocaleString()} km
                                        </span>
                                      ) : null}
                                    </div>

                                    {repair.items.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {repair.items.slice(0, 3).map(item => (
                                          <span
                                            key={item.id}
                                            className="text-[9px] px-2 py-0.5 rounded"
                                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--chrome-400)' }}
                                          >
                                            {item.description}
                                          </span>
                                        ))}
                                        {repair.items.length > 3 && (
                                          <span className="text-[9px]" style={{ color: 'var(--chrome-600)' }}>+{repair.items.length - 3}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Amount */}
                                <div className="flex-shrink-0 text-right">
                                  <CurrencyBadge amountUsd={repairTotal} />
                                  {repair.items.length > 0 && (
                                    <p className="text-[9px] mt-1" style={{ color: 'var(--chrome-600)' }}>
                                      {repair.items.length} ítem{repair.items.length !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </section>
              </div>
            </div>

          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Car size={28} style={{ color: 'var(--chrome-600)' }} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold" style={{ color: 'var(--chrome-400)' }}>Selecciona un vehículo</p>
                <p className="text-sm mt-1" style={{ color: 'var(--chrome-600)' }}>
                  Haz clic en cualquier vehículo para ver su ficha técnica
                </p>
              </div>
              {vehicleRecords.length === 0 && (
                <div
                  className="mt-2 rounded-xl p-4 max-w-sm text-center"
                  style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
                >
                  <AlertCircle className="mx-auto mb-2 text-blue-400" size={18} />
                  <p className="text-sm font-semibold text-blue-400">Los vehículos aparecen aquí automáticamente</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(96,165,250,0.6)' }}>
                    al registrar una reparación en Taller, o añade uno con el botón de arriba.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Registrar Vehículo + Checklist de Inspección
      ══════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl my-4 animate-scale-in"
            style={{ background: 'var(--metal-dark)', border: '1px solid var(--metal-border)' }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--metal-border)', background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}
                >
                  <Car size={15} className="text-blue-400" />
                </div>
                <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--chrome-100)', letterSpacing: '-0.01em' }}>
                  Registrar Vehículo
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--chrome-500)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--chrome-100)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--chrome-500)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddVehicle}>
              <div
                className="grid grid-cols-1 lg:grid-cols-2"
                style={{ borderBottom: '1px solid var(--metal-border)' }}
              >

                {/* ═ LEFT: Vehicle data ══════════════════════════════════ */}
                <div
                  className="flex flex-col divide-y overflow-y-auto max-h-[68vh]"
                  style={{ divideColor: 'var(--metal-border)', borderRight: '1px solid var(--metal-border)' }}
                >

                  {/* Datos del vehículo */}
                  <div className="p-5 space-y-4">
                    <SectionLabel icon={<Car size={12} />} label="Datos del Vehículo" />
                    <div className="grid grid-cols-2 gap-3">
                      <FieldBlock label="Placa *">
                        <input
                          required type="text" value={newVehicle.plate}
                          onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })}
                          className={inputCls + ' uppercase font-mono font-bold tracking-widest'}
                          placeholder="ABC-123"
                        />
                      </FieldBlock>
                      <FieldBlock label="Propietario *">
                        <select
                          required value={newVehicle.customerId}
                          onChange={e => setNewVehicle({ ...newVehicle, customerId: e.target.value })}
                          className={selectCls}
                        >
                          <option value="">Seleccione…</option>
                          {store.customers.map((c: Customer) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </FieldBlock>
                      <FieldBlock label="Marca *">
                        <input
                          required type="text" value={newVehicle.brand}
                          onChange={e => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                          className={inputCls}
                          placeholder="Toyota, Ford…"
                        />
                      </FieldBlock>
                      <FieldBlock label="Modelo *">
                        <input
                          required type="text" value={newVehicle.model}
                          onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
                          className={inputCls}
                          placeholder="Corolla, Ranger…"
                        />
                      </FieldBlock>
                      <FieldBlock label="Año">
                        <input
                          type="number" min="1950" max={new Date().getFullYear() + 1} value={newVehicle.year}
                          onChange={e => setNewVehicle({ ...newVehicle, year: Number(e.target.value) })}
                          className={inputCls}
                        />
                      </FieldBlock>
                      <FieldBlock label="Kilometraje">
                        <input
                          type="number" min="0" value={newVehicle.mileage}
                          onChange={e => setNewVehicle({ ...newVehicle, mileage: e.target.value })}
                          className={inputCls}
                          placeholder="85 000"
                        />
                      </FieldBlock>
                    </div>
                  </div>

                  {/* Servicio y estado */}
                  <div className="p-5 space-y-4">
                    <SectionLabel icon={<Wrench size={12} />} label="Servicio y Estado" />
                    <div className="grid grid-cols-2 gap-3">
                      <FieldBlock label="Tipo de Servicio *">
                        <select
                          required value={newVehicle.serviceType}
                          onChange={e => setNewVehicle({ ...newVehicle, serviceType: e.target.value })}
                          className={selectCls}
                        >
                          <option>Mecánica General</option>
                          <option>Mantenimiento Preventivo</option>
                          <option>Electricidad</option>
                          <option>Latonería y Pintura</option>
                          <option>Revisión General</option>
                        </select>
                      </FieldBlock>
                      <FieldBlock label="Estado de Entrada *">
                        <select
                          required value={newVehicle.status}
                          onChange={e => setNewVehicle({ ...newVehicle, status: e.target.value as ServiceStatus })}
                          className={selectCls}
                        >
                          <option>Ingresado</option>
                          <option>En Diagnóstico</option>
                          <option>En Reparación</option>
                          <option>Esperando Repuestos</option>
                        </select>
                      </FieldBlock>
                    </div>
                  </div>

                  {/* Diagnóstico inicial */}
                  <div className="p-5 space-y-3">
                    <SectionLabel icon={<FileText size={12} />} label="Diagnóstico Inicial" />
                    <textarea
                      rows={3}
                      value={newVehicle.diagnosis}
                      onChange={e => setNewVehicle({ ...newVehicle, diagnosis: e.target.value })}
                      className={inputCls + ' resize-none'}
                      placeholder="Descripción del problema o motivo de ingreso…"
                    />
                  </div>

                </div>

                {/* ═ RIGHT: Checklist ════════════════════════════════════ */}
                <div className="p-5 space-y-5 overflow-y-auto max-h-[68vh]">
                  {/* Collapsible header */}
                  <button
                    type="button"
                    onClick={() => setChecklistOpen(v => !v)}
                    className="w-full flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardList size={12} className="text-emerald-400" />
                      <span className="text-xs font-bold text-chrome-300 uppercase tracking-widest">Checklist de Inspección</span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${checklistOpen ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--chrome-500)' }}
                    />
                  </button>

                  {checklistOpen && (
                    <div className="space-y-4">

                      {/* ① Combustible */}
                      <ChecklistFormCard label="Nivel de Combustible" icon={<Fuel size={11} className="text-amber-400" />}>
                        <FuelGauge level={checklist.fuelLevel} onChange={v => patchChecklist('fuelLevel', v)} />
                      </ChecklistFormCard>

                      {/* ② Serial */}
                      <ChecklistFormCard label="Serial / VIN / Chasis" icon={<Hash size={11} className="text-purple-400" />}>
                        <div className="flex items-center gap-3 mt-1">
                          <button
                            type="button"
                            onClick={() => patchChecklist('serialVerified', !checklist.serialVerified)}
                            className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                            style={{
                              background: checklist.serialVerified ? '#10b981' : 'rgba(255,255,255,0.08)',
                              border: checklist.serialVerified ? '1px solid rgba(16,185,129,0.6)' : '1px solid rgba(255,255,255,0.12)',
                              boxShadow: checklist.serialVerified ? '0 0 10px rgba(16,185,129,0.3)' : 'none',
                            }}
                          >
                            <span
                              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
                              style={{ left: checklist.serialVerified ? '22px' : '2px' }}
                            />
                          </button>
                          <span className="text-sm font-medium transition-colors" style={{ color: checklist.serialVerified ? '#34d399' : 'var(--chrome-500)' }}>
                            {checklist.serialVerified ? 'Verificado' : 'No verificado'}
                          </span>
                        </div>

                        {checklist.serialVerified && (
                          <div className="mt-3 space-y-3 animate-fade-in">
                            <input
                              type="text"
                              placeholder="Número de serial / VIN…"
                              value={checklist.serialNumber ?? ''}
                              onChange={e => patchChecklist('serialNumber', e.target.value.toUpperCase())}
                              className={inputCls + ' font-mono text-xs tracking-wider'}
                            />
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={checklist.serialMismatch ?? false}
                                onChange={e => patchChecklist('serialMismatch', e.target.checked)}
                                className="w-4 h-4 rounded border accent-red-500"
                                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                              />
                              <span className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                                <AlertCircle size={11} /> Serial NO coincide con la documentación
                              </span>
                            </label>
                          </div>
                        )}
                      </ChecklistFormCard>

                      {/* ③ Grúa */}
                      <ChecklistFormCard label="¿Llegó en Grúa?" icon={<Truck size={11} className="text-orange-400" />}>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {[
                            { val: true,  icon: <Truck size={14} />,  text: 'Sí, en grúa',   activeColor: '#f97316', activeBg: 'rgba(249,115,22,0.12)', activeBorder: 'rgba(249,115,22,0.35)' },
                            { val: false, icon: <Car size={14} />,   text: 'Por sus medios', activeColor: '#34d399', activeBg: 'rgba(52,211,153,0.12)', activeBorder: 'rgba(52,211,153,0.35)' },
                          ].map(opt => (
                            <button
                              key={String(opt.val)}
                              type="button"
                              onClick={() => patchChecklist('arrivedByTow', opt.val)}
                              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all"
                              style={
                                checklist.arrivedByTow === opt.val
                                  ? { color: opt.activeColor, background: opt.activeBg, borderColor: opt.activeBorder }
                                  : { color: 'var(--chrome-500)', background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }
                              }
                            >
                              {opt.icon} {opt.text}
                            </button>
                          ))}
                        </div>
                      </ChecklistFormCard>

                      {/* ④ Luces */}
                      <ChecklistFormCard label="Estado de las Luces" icon={<Lightbulb size={11} className="text-yellow-400" />}>
                        <div className="space-y-3 mt-1">
                          <div className="space-y-1.5">
                            <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--chrome-400)' }}>
                              <span className="w-2 h-2 rounded-full bg-sky-400" /> Delanteras
                            </p>
                            <LightStatusBadge value={checklist.lightsFront} onChange={v => patchChecklist('lightsFront', v)} />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--chrome-400)' }}>
                              <span className="w-2 h-2 rounded-full bg-red-400" /> Traseras
                            </p>
                            <LightStatusBadge value={checklist.lightsRear} onChange={v => patchChecklist('lightsRear', v)} />
                          </div>
                        </div>
                      </ChecklistFormCard>

                      {/* ⑤ Observaciones */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--chrome-500)' }}>
                          <FileText size={10} /> Observaciones
                        </p>
                        <textarea
                          rows={2}
                          placeholder="Daños visibles, elementos faltantes, novedades al ingreso…"
                          value={checklist.checklistNotes ?? ''}
                          onChange={e => patchChecklist('checklistNotes', e.target.value)}
                          className={inputCls + ' resize-none'}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div
                className="flex items-center justify-between px-6 py-4 gap-4"
                style={{ background: 'rgba(255,255,255,0.015)' }}
              >
                <p className="text-xs flex items-start gap-1.5" style={{ color: 'var(--chrome-500)' }}>
                  <AlertCircle size={13} className="text-blue-400/60 flex-shrink-0 mt-0.5" />
                  El vehículo quedará registrado con su checklist de inspección.
                </p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 text-sm font-medium rounded-xl transition-colors"
                    style={{ color: 'var(--chrome-400)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--chrome-100)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--chrome-400)')}
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-submit-vehiculo"
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      boxShadow: '0 0 0 1px rgba(59,130,246,0.4), 0 4px 12px rgba(59,130,246,0.2)',
                    }}
                  >
                    <Plus size={15} />
                    Registrar Vehículo
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Micro-components ─────────────────────────────────────────────────────────

const StatChip: React.FC<{ value: number; label: string; accent?: boolean }> = ({ value, label, accent }) => (
  <div
    className="flex flex-col items-center px-3 py-1.5 rounded-lg min-w-[52px]"
    style={{
      background: accent ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.04)',
      border: accent ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.07)',
    }}
  >
    <span
      className="text-base font-bold leading-none"
      style={{ color: accent ? '#60a5fa' : 'var(--chrome-100)' }}
    >
      {value}
    </span>
    <span className="text-[9px] font-medium mt-0.5" style={{ color: 'var(--chrome-500)' }}>{label}</span>
  </div>
);

const MetaChip: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <span
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--chrome-300)', border: '1px solid rgba(255,255,255,0.07)' }}
  >
    {icon}
    {children}
  </span>
);

const KpiCell: React.FC<{ value?: string | number; label: string; custom?: React.ReactNode }> = ({ value, label, custom }) => (
  <div
    className="rounded-xl p-3 text-center"
    style={{ background: 'var(--metal-mid)', border: '1px solid var(--metal-border)' }}
  >
    {custom ?? <p className="text-base font-bold leading-none" style={{ color: 'var(--chrome-100)' }}>{value}</p>}
    <p className="text-[9px] font-bold uppercase tracking-wider mt-1.5" style={{ color: 'var(--chrome-500)' }}>{label}</p>
  </div>
);

const ChecklistCard: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <div className="rounded-xl p-4" style={{ background: 'var(--metal-mid)', border: '1px solid var(--metal-border)' }}>
    <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--chrome-500)' }}>
      {icon} {label}
    </p>
    {children}
  </div>
);

const ChecklistFormCard: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
    <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--chrome-400)' }}>
      {icon} {label}
    </p>
    {children}
  </div>
);

export default VehiclesModule;
