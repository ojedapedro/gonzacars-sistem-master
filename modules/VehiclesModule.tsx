import React, { useState, useMemo } from 'react';
import {
  Car, Search, Plus, User, Calendar, Wrench, X, Activity,
  MapPin, Gauge, AlertCircle, Fuel, Hash, Truck, Lightbulb,
  CheckCircle2, XCircle, HelpCircle, ClipboardList, ShieldCheck,
  ChevronDown, FileText
} from 'lucide-react';
import { useGonzacarsStore } from '../store';
import { VehicleRepair, Customer, VehicleChecklist, FuelLevel } from '../types';
import { fuzzySearch } from '../lib/utils/search';
import CurrencyBadge from '../components/CurrencyBadge';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'Ingresado': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'En Diagnóstico': 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  'En Reparación': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  'Esperando Repuestos': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  'Finalizado': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  'Entregado': 'bg-chrome-500/20 text-chrome-400 border border-chrome-500/20',
};

const FUEL_LEVELS: { value: FuelLevel; label: string; pct: number; color: string }[] = [
  { value: 'Vacío',  label: 'Vacío',  pct: 0,   color: '#ef4444' },
  { value: '1/4',   label: '¼',      pct: 25,  color: '#f97316' },
  { value: '1/2',   label: '½',      pct: 50,  color: '#eab308' },
  { value: '3/4',   label: '¾',      pct: 75,  color: '#84cc16' },
  { value: 'Lleno', label: 'Lleno',  pct: 100, color: '#22c55e' },
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

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Pill badge for light status */
const LightStatusBadge: React.FC<{
  value: 'OK' | 'Falla' | 'Sin verificar';
  onChange: (v: 'OK' | 'Falla' | 'Sin verificar') => void;
}> = ({ value, onChange }) => {
  const cfg = {
    'OK':           { icon: CheckCircle2, cls: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' },
    'Falla':        { icon: XCircle,      cls: 'bg-red-500/20 border-red-500/40 text-red-400' },
    'Sin verificar':{ icon: HelpCircle,   cls: 'bg-chrome-500/10 border-white/10 text-chrome-400' },
  };

  return (
    <div className="flex gap-1.5">
      {LIGHT_STATUS_OPTIONS.map(opt => {
        const { icon: Icon, cls } = cfg[opt];
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
              active ? cls + ' scale-[1.03] shadow-lg' : 'bg-white/5 border-white/8 text-chrome-500 hover:bg-white/10'
            }`}
          >
            <Icon size={11} />
            {opt}
          </button>
        );
      })}
    </div>
  );
};

/** Read-only badge for checklist display */
const ChecklistBadgeRO: React.FC<{ value: 'OK' | 'Falla' | 'Sin verificar' }> = ({ value }) => {
  if (value === 'OK')           return <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md"><CheckCircle2 size={9} />OK</span>;
  if (value === 'Falla')        return <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md"><XCircle size={9} />Falla</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-black text-chrome-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md"><HelpCircle size={9} />Sin verificar</span>;
};

// ─── Fuel gauge visual ────────────────────────────────────────────────────────

const FuelGauge: React.FC<{ level: FuelLevel; onChange: (v: FuelLevel) => void }> = ({ level, onChange }) => {
  const current = FUEL_LEVELS.find(f => f.value === level) ?? FUEL_LEVELS[2];

  return (
    <div className="space-y-3">
      {/* Gauge bar */}
      <div className="relative h-6 bg-white/5 border border-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{ width: `${current.pct}%`, background: `linear-gradient(90deg, ${current.color}99, ${current.color})` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black text-white drop-shadow">{current.label === 'Lleno' ? 'LLENO' : current.label === 'Vacío' ? 'VACÍO' : current.label}</span>
        </div>
      </div>
      {/* Selector pills */}
      <div className="flex gap-2">
        {FUEL_LEVELS.map(fl => (
          <button
            key={fl.value}
            type="button"
            onClick={() => onChange(fl.value)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
              level === fl.value
                ? 'text-white border-white/20 shadow-lg scale-[1.05]'
                : 'bg-white/5 border-white/8 text-chrome-500 hover:bg-white/10'
            }`}
            style={level === fl.value ? { backgroundColor: fl.color + '33', borderColor: fl.color + '66', color: fl.color } : {}}
          >
            {fl.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface VehiclesModuleProps {
  store?: any;  // optional — falls back to zustand hook
  toast?: any;  // optional — for success/error notifications
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

  // Helper to patch checklist
  const patchChecklist = <K extends keyof VehicleChecklist>(key: K, value: VehicleChecklist[K]) =>
    setChecklist(prev => ({ ...prev, [key]: value }));

  // ── Derived data ──────────────────────────────────────────────────────────

  const vehicleRecords = useMemo((): VehicleRecord[] => {
    const map = new Map<string, VehicleRecord>();

    (store.repairs as VehicleRepair[]).forEach(repair => {
      const plate = repair.plate?.toUpperCase();
      if (!plate) return;

      if (!map.has(plate)) {
        map.set(plate, {
          plate,
          brand: repair.brand,
          model: repair.model,
          year: repair.year,
          ownerName: repair.ownerName,
          customerId: repair.customerId,
          mileage: repair.mileage,
          repairs: [],
        });
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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOpenModal = () => {
    setChecklist({ ...DEFAULT_CHECKLIST });
    setNewVehicle({ plate: '', brand: '', model: '', year: new Date().getFullYear(), customerId: '', mileage: '', serviceType: 'Mecánica General', status: 'Ingresado', diagnosis: '', photos: [] });
    setShowAddModal(true);
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = store.customers.find((c: Customer) => c.id === newVehicle.customerId);
    if (!newVehicle.plate || !newVehicle.brand || !newVehicle.model || !customer) return;

    const finalChecklist: VehicleChecklist = {
      ...checklist,
      checkedAt: new Date().toISOString(),
    };

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="module-page max-w-7xl mx-auto flex flex-col h-[calc(100vh-6rem)]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-600/30 border border-sky-500/30">
            <Car size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-gradient">Directorio de Vehículos</h2>
            <p className="text-chrome-400 font-semibold text-xs tracking-widest uppercase mt-1">
              {vehicleRecords.length} vehículo{vehicleRecords.length !== 1 ? 's' : ''} registrado{vehicleRecords.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenModal}
          className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(2,132,199,0.3)] hover:shadow-[0_0_30px_rgba(2,132,199,0.5)] active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Registrar Vehículo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">

        {/* ── Left: Vehicle List ─────────────────────────────────────── */}
        <div className="lg:col-span-1 flex flex-col gap-3 min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18} />
            <input
              type="text"
              placeholder="Buscar placa, marca, modelo o propietario..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder:text-chrome-500/50 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all font-medium text-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-chrome-500 hover:text-white">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Stats pills */}
          <div className="flex gap-2">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-2xl font-black text-white">{vehicleRecords.length}</p>
              <p className="text-[9px] font-black text-chrome-500 uppercase tracking-wider">Vehículos</p>
            </div>
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-2xl font-black text-white">{store.repairs?.length ?? 0}</p>
              <p className="text-[9px] font-black text-chrome-500 uppercase tracking-wider">Servicios</p>
            </div>
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-2xl font-black text-amber-400">
                {vehicleRecords.filter(v => v.repairs.some(r => r.status !== 'Entregado' && r.status !== 'Finalizado')).length}
              </p>
              <p className="text-[9px] font-black text-chrome-500 uppercase tracking-wider">Activos</p>
            </div>
          </div>

          {/* Vehicle list */}
          <div className="glass-panel rounded-2xl flex-1 overflow-y-auto custom-scrollbar p-2">
            {filteredVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-chrome-500">
                <Car size={32} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">
                  {vehicleRecords.length === 0 ? 'No hay vehículos registrados aún' : 'No hay resultados para tu búsqueda'}
                </p>
                {vehicleRecords.length === 0 && (
                  <p className="text-xs mt-1 text-chrome-600 text-center px-4">
                    Los vehículos se crean automáticamente al registrar una reparación en Taller
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredVehicles.map(vehicle => {
                  const isSelected = selectedPlate === vehicle.plate;
                  const activeRepair = vehicle.repairs.find(r => r.status !== 'Entregado' && r.serviceType !== 'Registro');
                  const totalServices = vehicle.repairs.filter(r => r.serviceType !== 'Registro').length;

                  return (
                    <button
                      key={vehicle.plate}
                      onClick={() => setSelectedPlate(vehicle.plate)}
                      className={`w-full text-left p-4 rounded-xl transition-all border ${
                        isSelected
                          ? 'bg-sky-500/10 border-sky-500/30 shadow-[inset_0_0_20px_rgba(2,132,199,0.1)]'
                          : 'bg-white/5 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg tracking-wider font-mono ${
                          isSelected ? 'bg-sky-500 text-white' : 'bg-white/10 text-chrome-200'
                        }`}>
                          {vehicle.plate}
                        </span>
                        {activeRepair && (
                          <span className="text-[9px] font-black px-2 py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <Activity size={9} /> EN TALLER
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-white text-base tracking-tight truncate">
                        {vehicle.brand} {vehicle.model} <span className="text-chrome-500 text-sm font-medium">{vehicle.year}</span>
                      </h3>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1 text-chrome-400 text-xs font-medium">
                          <User size={11} className="opacity-70" />
                          <span className="truncate max-w-[130px]">{vehicle.ownerName}</span>
                        </div>
                        <span className="text-[10px] text-chrome-600 font-bold">
                          {totalServices} servicio{totalServices !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Detail Panel ─────────────────────────────────────── */}
        <div className="lg:col-span-2 glass-panel rounded-2xl flex flex-col min-h-0 overflow-hidden">
          {selectedVehicle ? (
            <div className="flex flex-col h-full">
              {/* Vehicle Header */}
              <div className="p-6 lg:p-8 border-b border-white/10 flex-shrink-0">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest bg-sky-400/10 border border-sky-500/20 px-3 py-1 rounded-lg inline-flex items-center gap-2 mb-3">
                      <Car size={12} /> Ficha Técnica
                    </span>
                    <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight uppercase">
                      {selectedVehicle.brand} <span className="text-sky-400">{selectedVehicle.model}</span>
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="px-4 py-1.5 bg-chrome-800/80 text-white rounded-xl text-lg font-black tracking-[0.15em] border border-white/10 font-mono">
                        {selectedVehicle.plate}
                      </span>
                      <span className="px-3 py-1.5 bg-white/5 rounded-lg text-sm font-bold text-chrome-300 border border-white/5">
                        {selectedVehicle.year}
                      </span>
                      {selectedVehicle.mileage ? (
                        <span className="px-3 py-1.5 bg-white/5 rounded-lg text-sm font-bold text-chrome-300 border border-white/5 flex items-center gap-1.5">
                          <Gauge size={14} className="text-chrome-500" /> {selectedVehicle.mileage.toLocaleString()} km
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Owner info */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[220px]">
                    <p className="text-[9px] font-black text-chrome-500 uppercase tracking-widest mb-2">Propietario</p>
                    <p className="font-bold text-white text-base">{selectedVehicle.ownerName}</p>
                    {(() => {
                      const c = store.customers.find((c: Customer) => c.id === selectedVehicle.customerId);
                      return c?.address ? (
                        <p className="text-xs text-chrome-400 mt-1 flex items-start gap-1.5"><MapPin size={11} className="mt-0.5 shrink-0" /> {c.address}</p>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* KPI bar */}
                <div className="grid grid-cols-3 gap-3 mt-5">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-white">{selectedVehicle.repairs.filter(r => r.serviceType !== 'Registro').length}</p>
                    <p className="text-[9px] font-black text-chrome-500 uppercase tracking-wider mt-0.5">Servicios</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    {latestRepair ? (
                      <>
                        <p className="text-xs font-black text-white">{new Date(latestRepair.createdAt).toLocaleDateString()}</p>
                        <p className="text-[9px] font-black text-chrome-500 uppercase tracking-wider mt-0.5">Últ. Servicio</p>
                      </>
                    ) : (
                      <p className="text-[9px] font-black text-chrome-500 uppercase tracking-wider mt-0.5">Sin servicios</p>
                    )}
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <CurrencyBadge amount={totalSpent} />
                    <p className="text-[9px] font-black text-chrome-500 uppercase tracking-wider mt-0.5">Total Invertido</p>
                  </div>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 space-y-6">

                {/* ── Checklist de Ingreso ───────────────────────────── */}
                {latestChecklist && (
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                      <ClipboardList size={16} className="text-sky-400" />
                      Checklist de Ingreso
                      <span className="text-[10px] font-bold text-chrome-500 bg-white/5 px-2 py-0.5 rounded-lg ml-1">
                        {latestChecklist.checkedAt ? new Date(latestChecklist.checkedAt).toLocaleDateString() : 'Registrado'}
                      </span>
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Combustible */}
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-[9px] font-black text-chrome-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Fuel size={10} /> Nivel de Combustible
                        </p>
                        {(() => {
                          const fl = FUEL_LEVELS.find(f => f.value === latestChecklist.fuelLevel);
                          return (
                            <div className="space-y-1.5">
                              <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/8">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${fl?.pct ?? 50}%`, backgroundColor: fl?.color ?? '#eab308' }}
                                />
                              </div>
                              <p className="font-black text-white text-sm" style={{ color: fl?.color }}>{latestChecklist.fuelLevel}</p>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Grúa */}
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-[9px] font-black text-chrome-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Truck size={10} /> Llegó en Grúa
                        </p>
                        {latestChecklist.arrivedByTow ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                            <Truck size={14} /> Sí, en grúa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                            <Car size={14} /> Por sus propios medios
                          </span>
                        )}
                      </div>

                      {/* Serial */}
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-[9px] font-black text-chrome-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Hash size={10} /> Verificación de Serial
                        </p>
                        {latestChecklist.serialVerified ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                              <CheckCircle2 size={9} /> Verificado
                            </span>
                            {latestChecklist.serialNumber && (
                              <p className="text-xs font-mono text-chrome-300 mt-1">{latestChecklist.serialNumber}</p>
                            )}
                            {latestChecklist.serialMismatch && (
                              <p className="text-[9px] font-black text-red-400 flex items-center gap-1 mt-1">
                                <AlertCircle size={9} /> No coincide con documentación
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-chrome-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                            <HelpCircle size={9} /> No verificado
                          </span>
                        )}
                      </div>

                      {/* Luces */}
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-[9px] font-black text-chrome-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <Lightbulb size={10} /> Estado de Luces
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-chrome-400 font-bold">Delantera</span>
                            <ChecklistBadgeRO value={latestChecklist.lightsFront} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-chrome-400 font-bold">Trasera</span>
                            <ChecklistBadgeRO value={latestChecklist.lightsRear} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {latestChecklist.checklistNotes && (
                      <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3">
                        <p className="text-[9px] font-black text-chrome-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                          <FileText size={9} /> Observaciones del Checklist
                        </p>
                        <p className="text-xs text-chrome-300">{latestChecklist.checklistNotes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Service History ───────────────────────────────── */}
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                    <Activity size={16} className="text-sky-400" />
                    Historial de Servicios
                    <span className="text-[10px] font-bold text-chrome-500 bg-white/5 px-2 py-0.5 rounded-lg ml-1">
                      {selectedVehicle.repairs.filter(r => r.serviceType !== 'Registro').length}
                    </span>
                  </h3>

                  <div className="space-y-3">
                    {selectedVehicle.repairs.filter(r => r.serviceType !== 'Registro').length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                        <Wrench size={28} className="mx-auto text-chrome-600 mb-3" />
                        <p className="text-chrome-400 text-sm font-bold">Sin historial de servicios</p>
                        <p className="text-chrome-600 text-xs mt-1">El vehículo fue registrado pero aún no tiene reparaciones.</p>
                      </div>
                    ) : (
                      selectedVehicle.repairs
                        .filter(r => r.serviceType !== 'Registro')
                        .map(repair => {
                          const repairTotal = repair.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
                          return (
                            <div key={repair.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-chrome-800/80 flex items-center justify-center flex-shrink-0 border border-white/10 mt-0.5">
                                    <Wrench size={16} className="text-chrome-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm leading-tight truncate">{repair.diagnosis}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                      <span className="text-[10px] font-bold text-chrome-500 flex items-center gap-1">
                                        <Calendar size={10} /> {new Date(repair.createdAt).toLocaleDateString()}
                                      </span>
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${STATUS_COLORS[repair.status] ?? 'bg-white/10 text-chrome-400'}`}>
                                        {repair.status}
                                      </span>
                                      {repair.serviceType && repair.serviceType !== 'Registro' && (
                                        <span className="text-[9px] font-bold text-chrome-600 uppercase">{repair.serviceType}</span>
                                      )}
                                      {repair.mileage ? (
                                        <span className="text-[10px] font-bold text-chrome-500 flex items-center gap-1">
                                          <Gauge size={9} /> {repair.mileage.toLocaleString()} km
                                        </span>
                                      ) : null}
                                    </div>
                                    {repair.items.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {repair.items.slice(0, 3).map(item => (
                                          <span key={item.id} className="text-[9px] bg-white/5 border border-white/8 text-chrome-400 px-2 py-0.5 rounded-md">
                                            {item.description}
                                          </span>
                                        ))}
                                        {repair.items.length > 3 && (
                                          <span className="text-[9px] text-chrome-600 px-1">+{repair.items.length - 3} más</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  <CurrencyBadge amount={repairTotal} />
                                  {repair.items.length > 0 && (
                                    <p className="text-[9px] text-chrome-600 mt-1 font-medium">{repair.items.length} ítem{repair.items.length !== 1 ? 's' : ''}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-chrome-500 p-8">
              <Car size={56} className="mb-4 opacity-10" />
              <p className="text-xl font-bold text-chrome-400">Selecciona un vehículo</p>
              <p className="text-sm text-chrome-600 mt-1 text-center">
                Haz clic en cualquier vehículo de la lista para ver su ficha técnica e historial completo de servicios
              </p>
              {vehicleRecords.length === 0 && (
                <div className="mt-6 bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 max-w-sm text-center">
                  <AlertCircle className="mx-auto mb-2 text-sky-400" size={20} />
                  <p className="text-sky-300 text-sm font-bold">Los vehículos aparecen aquí automáticamente</p>
                  <p className="text-sky-400/60 text-xs mt-1">cuando se registra una reparación en el módulo de Taller, o puedes añadir uno manualmente con el botón de arriba.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Registrar Vehículo + Checklist de Inspección
      ══════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-metal-base border border-white/10 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl animate-scale-in my-4">

            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/3">
              <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Car className="text-sky-400" size={20} /> Registrar Vehículo
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-chrome-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddVehicle}>
              {/* ── TWO-COLUMN LAYOUT ──────────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/8">

                {/* ═ LEFT COLUMN (Scrollable container) ═════════════ */}
                <div className="flex flex-col divide-y divide-white/8 overflow-y-auto max-h-[70vh]">

                  {/* ── Sección 1: Datos del Vehículo ──────────────── */}
                  <div className="p-6 space-y-4 flex flex-col">
                  <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-2">
                    <Car size={11} /> Datos del Vehículo
                  </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Placa *</label>
                    <input
                      required type="text" value={newVehicle.plate}
                      onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white uppercase font-mono font-black focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all"
                      placeholder="ABC-123"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Propietario *</label>
                    <select
                      required value={newVehicle.customerId}
                      onChange={e => setNewVehicle({ ...newVehicle, customerId: e.target.value })}
                      className="w-full bg-chrome-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium"
                    >
                      <option value="">Seleccione...</option>
                      {store.customers.map((c: Customer) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Marca *</label>
                    <input
                      required type="text" value={newVehicle.brand}
                      onChange={e => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium"
                      placeholder="Toyota, Ford, Chevrolet..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Modelo *</label>
                    <input
                      required type="text" value={newVehicle.model}
                      onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium"
                      placeholder="Corolla, Ranger..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Año</label>
                    <input
                      type="number" min="1950" max={new Date().getFullYear() + 1} value={newVehicle.year}
                      onChange={e => setNewVehicle({ ...newVehicle, year: Number(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Kilometraje</label>
                    <input
                      type="number" min="0" value={newVehicle.mileage}
                      onChange={e => setNewVehicle({ ...newVehicle, mileage: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium"
                      placeholder="Ej: 85000"
                    />
                  </div>
                </div>
              </div>

              {/* ── Sección 1.1: Servicio y Estado ──────────────── */}
              <div className="p-6 space-y-4 flex flex-col">
                <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-2">
                  <Wrench size={11} /> Servicio y Estado
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Tipo de Servicio *</label>
                    <select
                      required value={newVehicle.serviceType}
                      onChange={e => setNewVehicle({ ...newVehicle, serviceType: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium"
                    >
                      <option value="Mecánica General">Mecánica General</option>
                      <option value="Mantenimiento Preventivo">Mantenimiento Preventivo</option>
                      <option value="Electricidad">Electricidad</option>
                      <option value="Latonería y Pintura">Latonería y Pintura</option>
                      <option value="Revisión General">Revisión General</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Estado de Entrada *</label>
                    <select
                      required value={newVehicle.status}
                      onChange={e => setNewVehicle({ ...newVehicle, status: e.target.value as ServiceStatus })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium"
                    >
                      <option value="Ingresado">Ingresado</option>
                      <option value="En Diagnóstico">En Diagnóstico</option>
                      <option value="Esperando Repuestos">Esperando Repuestos</option>
                    </select>
                    {/* Badge representation */}
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      {newVehicle.status}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Sección 1.2: Diagnóstico Inicial ────────────── */}
              <div className="p-6 space-y-4 flex flex-col">
                <p className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={11} /> Diagnóstico Inicial
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-chrome-400 ml-1">Describe los síntomas o la falla reportada.</label>
                    <button type="button" className="text-[10px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 hover:bg-purple-500/20 transition-colors">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/><path d="M19 19l2 1 1 2-1-2-2-1z"/><path d="M5 19l2 1 1 2-1-2-2-1z"/></svg>
                      MEJORAR CON IA
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={newVehicle.diagnosis}
                    onChange={e => setNewVehicle({ ...newVehicle, diagnosis: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-chrome-600"
                    placeholder="Ej: El vehículo presenta ruido extraño en el motor al acelerar, vibración en el volante a altas velocidades..."
                  />
                </div>
              </div>

              {/* ── Sección 1.3: Evidencias Fotográficas ────────── */}
              <div className="p-6 space-y-4 flex flex-col">
                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                  <Search size={11} /> Evidencias Fotográficas
                </p>
                <div className="grid grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-chrome-500 hover:text-white hover:border-white/30 hover:bg-white/5 cursor-pointer transition-all">
                      <Plus size={20} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-center">Foto<br/>{i}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              </div> {/* <-- Cierra el LEFT COLUMN */}

              {/* ── Sección 2: Checklist de Inspección ─────────────── */}
              <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                {/* Section Header (collapsible) */}
                <button
                  type="button"
                  onClick={() => setChecklistOpen(v => !v)}
                  className="w-full flex items-center justify-between group"
                >
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardList size={11} />
                    Checklist de Inspección de Ingreso
                  </p>
                  <ChevronDown
                    size={16}
                    className={`text-chrome-500 transition-transform duration-200 ${checklistOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {checklistOpen && (
                  <div className="space-y-5">

                    {/* ① Nivel de combustible */}
                    <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-3">
                      <p className="text-[10px] font-black text-chrome-400 uppercase tracking-widest flex items-center gap-2">
                        <Fuel size={11} className="text-amber-400" />
                        Nivel de Combustible
                      </p>
                      <FuelGauge
                        level={checklist.fuelLevel}
                        onChange={v => patchChecklist('fuelLevel', v)}
                      />
                    </div>

                    {/* ② Verificación de serial */}
                    <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-3">
                      <p className="text-[10px] font-black text-chrome-400 uppercase tracking-widest flex items-center gap-2">
                        <Hash size={11} className="text-purple-400" />
                        Verificación de Serial (VIN / Chasis)
                      </p>
                      {/* Toggle verificado */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => patchChecklist('serialVerified', !checklist.serialVerified)}
                          className={`relative w-12 h-6 rounded-full transition-all duration-200 border ${
                            checklist.serialVerified
                              ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                              : 'bg-white/10 border-white/15'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                            checklist.serialVerified ? 'left-[26px]' : 'left-0.5'
                          }`} />
                        </button>
                        <span className={`text-sm font-bold transition-colors ${checklist.serialVerified ? 'text-emerald-400' : 'text-chrome-500'}`}>
                          {checklist.serialVerified ? 'Serial verificado' : 'No verificado'}
                        </span>
                      </div>

                      {checklist.serialVerified && (
                        <div className="space-y-3 animate-fade-in">
                          <input
                            type="text"
                            placeholder="Ingrese el número de serial / VIN..."
                            value={checklist.serialNumber ?? ''}
                            onChange={e => patchChecklist('serialNumber', e.target.value.toUpperCase())}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-chrome-600"
                          />
                          {/* ¿Coincide? */}
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checklist.serialMismatch ?? false}
                              onChange={e => patchChecklist('serialMismatch', e.target.checked)}
                              className="w-4 h-4 rounded border border-white/20 bg-white/5 checked:bg-red-500 accent-red-500"
                            />
                            <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                              <AlertCircle size={12} /> El serial NO coincide con la documentación
                            </span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* ③ Vehículo llegó en grúa */}
                    <div className="bg-white/3 border border-white/8 rounded-xl p-4">
                      <p className="text-[10px] font-black text-chrome-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                        <Truck size={11} className="text-orange-400" />
                        ¿Vehículo llegó en Grúa?
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => patchChecklist('arrivedByTow', true)}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-black transition-all ${
                            checklist.arrivedByTow
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                              : 'bg-white/5 border-white/10 text-chrome-400 hover:bg-white/10'
                          }`}
                        >
                          <Truck size={16} /> Sí, en grúa
                        </button>
                        <button
                          type="button"
                          onClick={() => patchChecklist('arrivedByTow', false)}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-black transition-all ${
                            !checklist.arrivedByTow
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_16px_rgba(34,197,94,0.2)]'
                              : 'bg-white/5 border-white/10 text-chrome-400 hover:bg-white/10'
                          }`}
                        >
                          <Car size={16} /> No, por sus medios
                        </button>
                      </div>
                    </div>

                    {/* ④ Estado de luces */}
                    <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-4">
                      <p className="text-[10px] font-black text-chrome-400 uppercase tracking-widest flex items-center gap-2">
                        <Lightbulb size={11} className="text-yellow-400" />
                        Estado de las Luces
                      </p>

                      <div className="space-y-3">
                        {/* Luces delanteras */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold text-chrome-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                            Luces Delanteras
                          </p>
                          <LightStatusBadge
                            value={checklist.lightsFront}
                            onChange={v => patchChecklist('lightsFront', v)}
                          />
                        </div>

                        {/* Luces traseras */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold text-chrome-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                            Luces Traseras
                          </p>
                          <LightStatusBadge
                            value={checklist.lightsRear}
                            onChange={v => patchChecklist('lightsRear', v)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* ⑤ Observaciones */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <FileText size={10} /> Observaciones del Checklist
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Daños visibles, elementos faltantes, novedades al ingreso..."
                        value={checklist.checklistNotes ?? ''}
                        onChange={e => patchChecklist('checklistNotes', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-chrome-600"
                      />
                    </div>

                  </div>
                )}
                </div>
              </div>{/* end grid-cols-2 */}

              {/* ── Actions (full width footer) ──────────────────────── */}
              <div className="px-6 py-4 bg-sky-500/5 border-t border-sky-500/15">
                <p className="text-xs text-sky-300/70 font-medium flex items-start gap-2">
                  <AlertCircle size={14} className="text-sky-400 mt-0.5 shrink-0" />
                  El vehículo quedará registrado con su checklist de inspección. Podrás ver el estado del checklist en la ficha técnica del vehículo.
                </p>
              </div>

              {/* ── Actions ─────────────────────────────────────────── */}
              <div className="flex gap-3 justify-end p-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-3 text-chrome-300 font-bold hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 active:scale-95 shadow-[0_0_20px_rgba(2,132,199,0.3)]"
                >
                  <Plus size={18} /> Registrar Vehículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehiclesModule;
