import React, { useState, useMemo } from 'react';
import { Car, Search, Plus, User, Info, Hash, Calendar, Wrench, X, Activity, ShieldCheck, MapPin, Gauge, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { useGonzacarsStore } from '../store';
import { VehicleRepair, Customer } from '../types';
import { fuzzySearch } from '../lib/utils/search';
import CurrencyBadge from '../components/CurrencyBadge';

// A vehicle "record" derived from Repairs data
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

const STATUS_COLORS: Record<string, string> = {
  'Ingresado': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'En Diagnóstico': 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  'En Reparación': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  'Esperando Repuestos': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  'Finalizado': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  'Entregado': 'bg-chrome-500/20 text-chrome-400 border border-chrome-500/20',
};

const VehiclesModule: React.FC = () => {
  const store = useGonzacarsStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    customerId: ''
  });

  // Derive unique vehicles from repairs data (the real source of truth)
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
          repairs: []
        });
      }
      map.get(plate)!.repairs.push(repair);
    });

    // Sort repairs within each vehicle by date descending
    map.forEach(v => {
      v.repairs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      // Update mileage to latest entry
      if (v.repairs[0]?.mileage) v.mileage = v.repairs[0].mileage;
    });

    return Array.from(map.values()).sort((a, b) => a.plate.localeCompare(b.plate));
  }, [store.repairs]);

  // Filtered list
  const filteredVehicles = useMemo(() => {
    return fuzzySearch(vehicleRecords, searchTerm, ['plate', 'brand', 'model', 'ownerName']);
  }, [vehicleRecords, searchTerm]);

  const selectedVehicle = useMemo(() =>
    vehicleRecords.find(v => v.plate === selectedPlate) ?? null,
    [vehicleRecords, selectedPlate]
  );

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = store.customers.find((c: Customer) => c.id === newVehicle.customerId);
    if (!newVehicle.plate || !newVehicle.brand || !newVehicle.model || !customer) return;

    const repair: VehicleRepair = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: customer.id,
      ownerName: customer.name,
      plate: newVehicle.plate.toUpperCase().trim(),
      brand: newVehicle.brand,
      model: newVehicle.model,
      year: Number(newVehicle.year),
      responsible: '',
      status: 'Ingresado',
      diagnosis: 'Vehículo registrado desde Directorio',
      serviceType: 'Registro',
      mechanicId: '',
      items: [],
      createdAt: new Date().toISOString()
    };

    await store.addRepair(repair);
    setShowAddModal(false);
    setNewVehicle({ plate: '', brand: '', model: '', year: new Date().getFullYear(), customerId: '' });
    setSelectedPlate(newVehicle.plate.toUpperCase().trim());
  };

  const latestRepair = selectedVehicle?.repairs[0];
  const totalSpent = selectedVehicle?.repairs.reduce(
    (acc, r) => acc + r.items.reduce((s, i) => s + i.price * i.quantity, 0), 0
  ) ?? 0;

  return (
    <div className="module-page max-w-7xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
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
          onClick={() => setShowAddModal(true)}
          className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(2,132,199,0.3)] hover:shadow-[0_0_30px_rgba(2,132,199,0.5)] active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Registrar Vehículo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left: Vehicle List */}
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

          {/* List */}
          <div className="glass-panel rounded-2xl flex-1 overflow-y-auto custom-scrollbar p-2">
            {filteredVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-chrome-500">
                <Car size={32} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">
                  {vehicleRecords.length === 0
                    ? 'No hay vehículos registrados aún'
                    : 'No hay resultados para tu búsqueda'}
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

        {/* Right: Detail Panel */}
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
                      {selectedVehicle.brand} <span className="text-sky-400">{selectedVehicle.model}
                      </span>
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

              {/* History */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8">
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
                          <div
                            key={repair.id}
                            className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-colors"
                          >
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

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-metal-base border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Car className="text-sky-400" size={20} /> Registrar Vehículo
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-chrome-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddVehicle} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Placa *</label>
                  <input required type="text" value={newVehicle.plate}
                    onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white uppercase font-mono font-black focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all"
                    placeholder="ABC-123" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Propietario *</label>
                  <select required value={newVehicle.customerId}
                    onChange={e => setNewVehicle({ ...newVehicle, customerId: e.target.value })}
                    className="w-full bg-chrome-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium">
                    <option value="">Seleccione...</option>
                    {store.customers.map((c: Customer) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Marca *</label>
                  <input required type="text" value={newVehicle.brand}
                    onChange={e => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium"
                    placeholder="Toyota, Ford, Chevrolet..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Modelo *</label>
                  <input required type="text" value={newVehicle.model}
                    onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium"
                    placeholder="Corolla, Ranger..." />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Año</label>
                  <input type="number" min="1950" max={new Date().getFullYear() + 1} value={newVehicle.year}
                    onChange={e => setNewVehicle({ ...newVehicle, year: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition-all font-medium" />
                </div>
              </div>

              <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3">
                <p className="text-xs text-sky-300/70 font-medium flex items-start gap-2">
                  <AlertCircle size={14} className="text-sky-400 mt-0.5 shrink-0" />
                  El vehículo quedará registrado en el sistema listo para recibir servicios en el módulo de Taller.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-3 text-chrome-300 font-bold hover:text-white transition-colors">Cancelar</button>
                <button type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 active:scale-95">
                  <Plus size={18} /> Registrar
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
