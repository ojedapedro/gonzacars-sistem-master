
import React, { useState, useMemo } from 'react';
import { 
  UserRound, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  History, 
  Car, 
  ShoppingBag, 
  MapPin, 
  Calendar,
  ExternalLink,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  Filter,
  X,
  Wrench,
  ChevronDown,
  User,
  Pencil,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Customer, VehicleRepair, Sale } from '../types';

const CustomerModule: React.FC<{ store: any }> = ({ store }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showDeleteVehicleModal, setShowDeleteVehicleModal] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<{ plate: string; brand: string; model: string } | null>(null);
  const [newVehicle, setNewVehicle] = useState({ plate: '', brand: '', model: '', year: new Date().getFullYear() });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'repairs' | 'sales'>('repairs');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [plateFilter, setPlateFilter] = useState<string | null>(null);

  // Estados para filtros avanzados
  const [filters, setFilters] = useState({
    nameExact: '',
    address: '',
    dateStart: '',
    dateEnd: ''
  });

  const filteredCustomers = useMemo(() => {
    return store.customers.filter((c: Customer) => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.phone.includes(searchTerm);
      
      // Filtro sensible a mayúsculas y minúsculas (Case-Sensitive)
      const matchNameExact = !filters.nameExact || c.name.includes(filters.nameExact);
      
      const matchAddress = !filters.address || 
                           (c.address?.toLowerCase().includes(filters.address.toLowerCase()));
      
      const customerDate = c.createdAt.split('T')[0];
      const matchDateStart = !filters.dateStart || customerDate >= filters.dateStart;
      const matchDateEnd = !filters.dateEnd || customerDate <= filters.dateEnd;

      return matchSearch && matchNameExact && matchAddress && matchDateStart && matchDateEnd;
    });
  }, [store.customers, searchTerm, filters]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const customer: Customer = {
      ...newCustomer,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    store.addCustomer(customer);
    setShowAddModal(false);
    setNewCustomer({ name: '', phone: '', email: '', address: '' });
  };

  const handleOpenEdit = () => {
    if (!selectedCustomer) return;
    setEditForm({
      name: selectedCustomer.name,
      phone: selectedCustomer.phone,
      email: selectedCustomer.email || '',
      address: selectedCustomer.address || ''
    });
    setShowEditModal(true);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const updated: Customer = { ...selectedCustomer, ...editForm };
    store.updateCustomer(updated);
    setSelectedCustomer(updated);
    setShowEditModal(false);
  };

  const handleDelete = async () => {
    if (!selectedCustomer) return;
    await store.deleteCustomer(selectedCustomer.id);
    setSelectedCustomer(null);
    setShowDeleteModal(false);
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const repair: VehicleRepair = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: selectedCustomer.id,
      ownerName: selectedCustomer.name,
      plate: newVehicle.plate.toUpperCase().trim(),
      brand: newVehicle.brand,
      model: newVehicle.model,
      year: Number(newVehicle.year),
      responsible: '',
      status: 'Ingresado',
      diagnosis: 'Vehículo registrado desde perfil de cliente',
      serviceType: 'Registro',
      mechanicId: '',
      items: [],
      createdAt: new Date().toISOString()
    };
    await store.addRepair(repair);
    setShowAddVehicleModal(false);
    setNewVehicle({ plate: '', brand: '', model: '', year: new Date().getFullYear() });
  };

  const handleDeleteVehicle = async () => {
    if (!selectedCustomer || !vehicleToDelete) return;
    await store.deleteVehicleByPlate(selectedCustomer.id, vehicleToDelete.plate);
    setVehicleToDelete(null);
    setShowDeleteVehicleModal(false);
    if (plateFilter === vehicleToDelete.plate) setPlateFilter(null);
  };

  const getCustomerRepairs = (id: string) => {
    let repairs = store.repairs.filter((r: VehicleRepair) => r.customerId === id);
    if (plateFilter) {
      repairs = repairs.filter((r: VehicleRepair) => r.plate === plateFilter);
    }
    return repairs;
  };

  const getCustomerSales = (id: string) => store.sales.filter((s: Sale) => s.customerId === id);
  
  const getCustomerVehicles = (id: string) => {
    const repairs = store.repairs.filter((r: VehicleRepair) => r.customerId === id);
    const uniquePlates = new Set();
    return repairs.filter((r: VehicleRepair) => {
      const isDuplicate = uniquePlates.has(r.plate);
      uniquePlates.add(r.plate);
      return !isDuplicate;
    });
  };

  const calculateTotalLTV = (id: string) => {
    const salesTotal = getCustomerSales(id).reduce((acc: number, s: Sale) => acc + s.total, 0);
    const repairsTotal = store.repairs.filter((r: VehicleRepair) => r.customerId === id).reduce((acc: number, r: VehicleRepair) => {
      const itemsTotal = r.items.reduce((a, i) => a + (i.price * i.quantity), 0);
      return acc + itemsTotal;
    }, 0);
    return salesTotal + repairsTotal;
  };

  const handleViewVehicleHistory = (plate: string) => {
    setPlateFilter(plate);
    setActiveTab('repairs');
  };

  const clearFilters = () => {
    setFilters({ nameExact: '', address: '', dateStart: '', dateEnd: '' });
    setSearchTerm('');
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 lg:mb-8 gap-4">
        <div>
          <h3 className="text-2xl lg:text-3xl font-black text-chrome-100 tracking-tighter uppercase">Gestión de Clientes</h3>
          <p className="text-xs lg:text-base text-chrome-400 font-medium">Directorio estratégico y analíticas de lealtad de Gonzacars</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="flex bg-metal-mid p-1 rounded-2xl border border-metal-border shadow-sm h-fit w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" size={18}/>
              <input 
                type="text" 
                placeholder="Nombre o Teléfono..." 
                className="w-full pl-10 pr-4 py-2 bg-transparent outline-none text-sm font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`p-2 rounded-xl transition-all ${showAdvancedFilters || filters.address || filters.dateStart || filters.nameExact ? 'bg-blue-500/10 text-blue-400' : 'text-chrome-500 hover:bg-metal-dark'}`}
              title="Filtros Avanzados"
            >
              <Filter size={20}/>
            </button>
          </div>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="btn-chrome px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 w-full sm:w-auto"
          >
            <Plus size={20}/> Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Panel de Filtros Avanzados */}
      {showAdvancedFilters && (
        <div className="mb-8 bg-metal-mid p-6 rounded-[2rem] border border-blue-500/20 shadow-xl shadow-blue-500/5 animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
              <Filter size={14}/> Parámetros de Búsqueda Avanzada
            </h4>
            <button onClick={clearFilters} className="text-[9px] font-black text-chrome-500 uppercase tracking-widest hover:text-red-500 transition-colors">Limpiar Todo</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-chrome-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                <User size={10}/> Nombre (Sensible a Mayús.)
              </label>
              <input 
                type="text" 
                placeholder="Ej: Juan (no juan)..."
                className="w-full px-4 py-2.5 bg-metal-dark border border-metal-border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/15 transition-all"
                value={filters.nameExact}
                onChange={(e) => setFilters({...filters, nameExact: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-chrome-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                <MapPin size={10}/> Dirección / Ubicación
              </label>
              <input 
                type="text" 
                placeholder="Ej: Urb. Los Olivos..."
                className="w-full px-4 py-2.5 bg-metal-dark border border-metal-border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/15 transition-all"
                value={filters.address}
                onChange={(e) => setFilters({...filters, address: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-chrome-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                <Calendar size={10}/> Registrado Desde
              </label>
              <input 
                type="date" 
                className="w-full px-4 py-2.5 bg-metal-dark border border-metal-border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/15 transition-all"
                value={filters.dateStart}
                onChange={(e) => setFilters({...filters, dateStart: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-chrome-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                <Calendar size={10}/> Registrado Hasta
              </label>
              <input 
                type="date" 
                className="w-full px-4 py-2.5 bg-metal-dark border border-metal-border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/15 transition-all"
                value={filters.dateEnd}
                onChange={(e) => setFilters({...filters, dateEnd: e.target.value})}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden">
        {/* Sidebar: Lista de Clientes */}
        <div className="lg:col-span-4 bg-metal-mid rounded-[2rem] border border-metal-border overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 border-b bg-metal-dark/50 flex justify-between items-center">
            <span className="font-black text-chrome-500 text-[10px] uppercase tracking-widest">Base de Datos ({filteredCustomers.length})</span>
            {(searchTerm || filters.address || filters.dateStart || filters.nameExact) && (
              <span className="text-[8px] font-black text-blue-400 uppercase bg-blue-500/15 px-2 py-0.5 rounded-full">Filtrado</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-metal-border custom-scrollbar">
            {filteredCustomers.map((c: Customer) => (
              <button 
                key={c.id} 
                onClick={() => { setSelectedCustomer(c); setPlateFilter(null); }}
                className={`w-full p-5 flex items-center gap-4 text-left transition-all hover:bg-metal-dark ${selectedCustomer?.id === c.id ? 'bg-blue-500/10 border-r-4 border-blue-500' : ''}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black uppercase transition-colors ${selectedCustomer?.id === c.id ? 'btn-chrome' : 'bg-metal-mid text-chrome-500'}`}>
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-chrome-100 truncate uppercase text-sm tracking-tight">{c.name}</div>
                  <div className="text-[10px] text-chrome-400 flex items-center gap-1 font-bold mt-0.5">
                    <Phone size={12} className="text-blue-500"/> {c.phone}
                  </div>
                </div>
                <ArrowRight size={16} className={`text-chrome-500 transition-transform ${selectedCustomer?.id === c.id ? 'translate-x-1 text-blue-400' : ''}`} />
              </button>
            ))}
            {filteredCustomers.length === 0 && (
              <div className="p-10 text-center flex flex-col items-center">
                <Search size={32} className="text-chrome-500 mb-2"/>
                <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest">No hay coincidencias</p>
              </div>
            )}
          </div>
        </div>

        {/* Content: Detalles del Cliente */}
        <div className="lg:col-span-8 flex flex-col gap-6 overflow-hidden">
          {selectedCustomer ? (
            <>
              {/* Header de Perfil */}
              <div className="bg-metal-mid p-8 rounded-2xl border border-metal-border shadow-sm relative overflow-hidden">
                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center relative z-10">
                  <div className="w-24 h-24 rounded-2xl btn-chrome flex items-center justify-center text-4xl font-black shadow-2xl rotate-3">
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl font-black text-chrome-100 leading-tight uppercase tracking-tighter">{selectedCustomer.name}</h2>
                    <div className="flex flex-wrap gap-4 mt-3">
                      <span className="flex items-center gap-1.5 text-chrome-400 text-[10px] font-black uppercase tracking-widest bg-metal-dark px-3 py-1.5 rounded-xl border border-metal-border">
                        <Phone size={14} className="text-blue-500"/> {selectedCustomer.phone}
                      </span>
                      <span className="flex items-center gap-1.5 text-chrome-400 text-[10px] font-black uppercase tracking-widest bg-metal-dark px-3 py-1.5 rounded-xl border border-metal-border">
                        <Mail size={14} className="text-blue-500"/> {selectedCustomer.email || 'Sin correo'}
                      </span>
                      {selectedCustomer.address && (
                        <span className="flex items-center gap-1.5 text-chrome-400 text-[10px] font-black uppercase tracking-widest bg-metal-dark px-3 py-1.5 rounded-xl border border-metal-border max-w-xs truncate">
                          <MapPin size={14} className="text-blue-500"/> {selectedCustomer.address}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleOpenEdit}
                      title="Editar cliente"
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                      <Pencil size={13}/> Editar
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      title="Eliminar cliente"
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                      <Trash2 size={13}/> Eliminar
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
                   <div className="bg-blue-500/5 p-5 rounded-2xl border border-blue-500/20">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Valor de Vida (LTV)</p>
                      <p className="text-2xl font-black text-blue-700">${calculateTotalLTV(selectedCustomer.id).toFixed(2)}</p>
                   </div>
                   <div className="bg-metal-dark p-5 rounded-2xl border border-metal-border">
                      <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-1">Vehículos Totales</p>
                      <p className="text-2xl font-black text-chrome-100">{getCustomerVehicles(selectedCustomer.id).length}</p>
                   </div>
                   <div className="bg-metal-dark p-5 rounded-2xl border border-metal-border">
                      <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-1">Fecha Registro</p>
                      <p className="text-xl font-black text-chrome-100">{new Date(selectedCustomer.createdAt).toLocaleDateString()}</p>
                   </div>
                </div>
              </div>

              {/* Sección: Vehículos Asociados */}
              <div className="bg-metal-mid p-8 rounded-[2rem] border border-metal-border shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                      <Car size={18} />
                    </div>
                    <h4 className="text-sm font-black text-chrome-100 uppercase tracking-widest">Vehículos Registrados</h4>
                  </div>
                  <button
                    onClick={() => setShowAddVehicleModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    <Plus size={13}/> Agregar Vehículo
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getCustomerVehicles(selectedCustomer.id).length > 0 ? (
                    getCustomerVehicles(selectedCustomer.id).map((v: VehicleRepair) => (
                      <div
                        key={v.plate}
                        className={`p-5 rounded-2xl border-2 transition-all text-left flex flex-col gap-3 relative overflow-hidden group ${
                          plateFilter === v.plate
                            ? 'border-blue-600 bg-blue-500/10'
                            : 'border-metal-border bg-metal-dark/50 hover:border-blue-500/40 hover:bg-metal-mid'
                        }`}
                      >
                        {/* Top row: plate + filter button */}
                        <div className="flex justify-between items-start">
                          <button
                            onClick={() => handleViewVehicleHistory(v.plate)}
                            className="btn-chrome px-3 py-1 rounded-lg font-mono text-[11px] font-black tracking-widest shadow-lg"
                          >
                            {v.plate}
                          </button>
                          <button
                            onClick={() => handleViewVehicleHistory(v.plate)}
                            className="text-chrome-500 hover:text-blue-400 transition-colors"
                          >
                            <ExternalLink size={14}/>
                          </button>
                        </div>
                        {/* Vehicle info */}
                        <div onClick={() => handleViewVehicleHistory(v.plate)} className="cursor-pointer">
                          <p className="text-xs font-black text-chrome-100 uppercase leading-none">{v.brand} {v.model}</p>
                          <p className="text-[10px] font-bold text-chrome-500 uppercase mt-1">Año {v.year}</p>
                        </div>
                        {/* Delete vehicle button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVehicleToDelete({ plate: v.plate, brand: v.brand, model: v.model });
                            setShowDeleteVehicleModal(true);
                          }}
                          className="mt-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all w-fit"
                        >
                          <Trash2 size={11}/> Eliminar Vehículo
                        </button>
                        {plateFilter === v.plate && (
                          <div className="absolute bottom-2 right-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-10 border-2 border-dashed border-metal-border rounded-2xl text-center">
                      <Car size={32} className="mx-auto text-chrome-500 mb-2" />
                      <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest">No hay vehículos registrados en el historial</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pestañas de Historial */}
              <div className="bg-metal-mid rounded-2xl border border-metal-border shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="flex p-2 bg-metal-dark/50 border-b">
                  <button onClick={() => setActiveTab('repairs')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'repairs' ? 'bg-metal-mid text-blue-400 shadow-sm border border-metal-border' : 'text-chrome-500 hover:text-chrome-200'}`}>
                    <History size={16}/> Historial Taller
                  </button>
                  <button onClick={() => setActiveTab('sales')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sales' ? 'bg-metal-mid text-blue-400 shadow-sm border border-metal-border' : 'text-chrome-500 hover:text-chrome-200'}`}>
                    <ShoppingBag size={16}/> Compras Directas
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  {activeTab === 'repairs' && (
                    <div className="space-y-6">
                      {plateFilter && (
                        <div className="bg-blue-600 p-4 rounded-2xl flex justify-between items-center shadow-lg shadow-blue-500/20 mb-2">
                          <div className="flex items-center gap-3 text-white">
                            <Filter size={18} /> 
                            <span className="text-[10px] font-black uppercase tracking-widest">Filtrando historial de: {plateFilter}</span>
                          </div>
                          <button onClick={() => setPlateFilter(null)} className="bg-metal-mid/20 hover:bg-metal-mid/30 text-white p-1.5 rounded-xl transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      
                      {getCustomerRepairs(selectedCustomer.id).length > 0 ? (
                        getCustomerRepairs(selectedCustomer.id).reverse().map((r: VehicleRepair) => (
                          <div key={r.id} className="p-6 border border-metal-border rounded-[2rem] flex items-center justify-between hover:border-blue-100 hover:bg-metal-dark/50 transition-all group">
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                <Wrench size={24}/>
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <p className="font-black text-chrome-100 uppercase tracking-tight text-sm">{r.brand} {r.model} <span className="text-chrome-500 font-bold ml-1">{r.year}</span></p>
                                  <span className={`text-[9px] font-black uppercase tracking-tighter px-3 py-1 rounded-full ${r.status === 'Entregado' ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'}`}>{r.status}</span>
                                </div>
                                <div className="flex items-center gap-4 mt-2">
                                  <span className="text-[10px] font-black text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-lg border border-blue-500/20">PLACA: {r.plate}</span>
                                  <span className="text-[10px] font-bold text-chrome-500 uppercase">{new Date(r.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-chrome-100">${r.items.reduce((a, i) => a + (i.price * i.quantity), 0).toFixed(2)}</p>
                              <p className="text-[9px] font-black text-chrome-500 uppercase mt-1">Total Facturado</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState message="Sin historial registrado" icon={<History size={40}/>} />
                      )}
                    </div>
                  )}

                  {activeTab === 'sales' && (
                    <div className="space-y-4">
                      {getCustomerSales(selectedCustomer.id).length > 0 ? (
                        getCustomerSales(selectedCustomer.id).reverse().map((s: Sale) => (
                          <div key={s.id} className="p-6 border border-metal-border rounded-[2rem] hover:border-blue-100 hover:bg-metal-dark/50 transition-all flex justify-between items-center">
                            <div>
                              <p className="text-[10px] font-black text-chrome-500 uppercase tracking-[0.2em] mb-1">Orden de Venta #{s.id}</p>
                              <p className="text-sm text-chrome-100 font-black uppercase">{new Date(s.date).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                              <p className="text-[10px] font-bold text-blue-500 uppercase mt-1">Pago: {s.paymentMethod}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-blue-700">${s.total.toFixed(2)}</p>
                              <p className="text-[10px] font-bold text-chrome-500 uppercase italic">{(s.total * store.exchangeRate).toLocaleString('es-VE')} Bs</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState message="Sin compras registradas" icon={<ShoppingBag size={40}/>} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full bg-metal-mid rounded-2xl border-2 border-dashed border-metal-border flex flex-col items-center justify-center text-chrome-500 p-20 text-center animate-pulse-slow">
              <UserRound size={80} className="opacity-10 mb-8" />
              <h3 className="text-2xl font-black text-chrome-500 uppercase tracking-tighter">Seleccione un Cliente</h3>
              <p className="text-sm font-medium mt-2 max-w-xs">Elija un perfil del directorio para gestionar su flota, historial de servicios y analíticas de consumo.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Añadir Cliente */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-metal-border">
            <div className="p-10 btn-chrome relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <UserRound size={120} />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tighter relative z-10">Nuevo Cliente</h3>
              <p className="text-chrome-500 text-xs font-bold uppercase tracking-widest mt-1 relative z-10">Registro de base de datos</p>
            </div>
            <form onSubmit={handleAdd} className="p-10 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                <input required type="text" placeholder="Ej: Juan Pérez" className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold transition-all" value={newCustomer.name} onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Teléfono</label>
                <input required type="tel" placeholder="0412-0000000" className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold transition-all" value={newCustomer.phone} onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Correo Electrónico</label>
                <input type="email" placeholder="cliente@correo.com" className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold transition-all" value={newCustomer.email} onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Dirección (Opcional)</label>
                <textarea placeholder="Ej: Urb. Los Olivos..." className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none h-24 resize-none font-bold transition-all" value={newCustomer.address} onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-chrome-500 font-black uppercase text-[10px] tracking-widest hover:text-chrome-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-[1.5] btn-chrome py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all">Guardar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-metal-border">
            <div className="p-8 bg-gradient-to-br from-blue-900 to-metal-dark relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Pencil size={100} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tighter text-white relative z-10">Editar Cliente</h3>
              <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mt-1 relative z-10">{selectedCustomer.name}</p>
            </div>
            <form onSubmit={handleEdit} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                <input required type="text" className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold text-chrome-100 transition-all" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Teléfono</label>
                <input required type="tel" className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold text-chrome-100 transition-all" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Correo Electrónico</label>
                <input type="email" className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold text-chrome-100 transition-all" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Dirección</label>
                <textarea className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none h-20 resize-none font-bold text-chrome-100 transition-all" value={editForm.address} onChange={(e) => setEditForm({...editForm, address: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-4 text-chrome-500 font-black uppercase text-[10px] tracking-widest hover:text-chrome-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-[1.5] btn-chrome py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/25 transition-all active:scale-95">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {showDeleteModal && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-red-500/20">
            <div className="p-8 bg-gradient-to-br from-red-950 to-metal-dark flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-4">
                <AlertTriangle size={32} className="text-red-400" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white">Eliminar Cliente</h3>
              <p className="text-red-300 text-xs font-bold mt-2">Esta acción no se puede deshacer</p>
            </div>
            <div className="p-8 text-center">
              <p className="text-chrome-200 font-bold text-sm mb-1">¿Estás seguro que deseas eliminar a:</p>
              <p className="text-xl font-black text-chrome-100 uppercase mb-6">{selectedCustomer.name}?</p>
              <p className="text-[10px] text-chrome-500 font-bold mb-6">Su historial de servicios y compras se conservará en el sistema, pero el perfil de cliente será eliminado permanentemente.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-4 bg-metal-dark hover:bg-metal-mid border border-metal-border text-chrome-200 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">Cancelar</button>
                <button onClick={handleDelete} className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/25 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Trash2 size={13}/> Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Vehículo */}
      {showAddVehicleModal && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-metal-border">
            <div className="p-8 bg-gradient-to-br from-slate-800 to-metal-dark relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Car size={100} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tighter text-white relative z-10">Agregar Vehículo</h3>
              <p className="text-chrome-400 text-xs font-bold uppercase tracking-widest mt-1 relative z-10">Cliente: {selectedCustomer.name}</p>
            </div>
            <form onSubmit={handleAddVehicle} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Placa del Vehículo</label>
                <input
                  required type="text" placeholder="Ej: AC302PV"
                  className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-black text-chrome-100 uppercase tracking-widest transition-all"
                  value={newVehicle.plate}
                  onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Marca</label>
                  <input
                    required type="text" placeholder="Toyota"
                    className="w-full px-4 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold text-chrome-100 transition-all"
                    value={newVehicle.brand}
                    onChange={(e) => setNewVehicle({...newVehicle, brand: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Modelo</label>
                  <input
                    required type="text" placeholder="Corolla"
                    className="w-full px-4 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold text-chrome-100 transition-all"
                    value={newVehicle.model}
                    onChange={(e) => setNewVehicle({...newVehicle, model: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Año</label>
                <input
                  required type="number" min="1950" max={new Date().getFullYear() + 1} placeholder="2020"
                  className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold text-chrome-100 transition-all"
                  value={newVehicle.year}
                  onChange={(e) => setNewVehicle({...newVehicle, year: Number(e.target.value)})}
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setShowAddVehicleModal(false)} className="flex-1 py-4 text-chrome-500 font-black uppercase text-[10px] tracking-widest hover:text-chrome-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-[1.5] btn-chrome py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/25 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Car size={14}/> Registrar Vehículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación de Vehículo */}
      {showDeleteVehicleModal && vehicleToDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-red-500/20">
            <div className="p-8 bg-gradient-to-br from-red-950 to-metal-dark flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-4">
                <Car size={28} className="text-red-400" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white">Eliminar Vehículo</h3>
              <p className="text-red-300 text-xs font-bold mt-2">Esta acción eliminará todo el historial del vehículo</p>
            </div>
            <div className="p-8 text-center">
              <p className="text-chrome-200 font-bold text-sm mb-2">¿Eliminar el vehículo con placa:</p>
              <p className="text-2xl font-black text-chrome-100 font-mono tracking-widest mb-1">{vehicleToDelete.plate}</p>
              <p className="text-chrome-400 text-xs font-bold mb-6">{vehicleToDelete.brand} {vehicleToDelete.model}</p>
              <p className="text-[10px] text-chrome-500 font-bold mb-6 bg-metal-dark/50 p-3 rounded-xl border border-red-500/10">
                ⚠️ Se eliminarán <strong>todos los registros de taller</strong> asociados a esta placa. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-4">
                <button onClick={() => { setShowDeleteVehicleModal(false); setVehicleToDelete(null); }} className="flex-1 py-4 bg-metal-dark hover:bg-metal-mid border border-metal-border text-chrome-200 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">Cancelar</button>
                <button onClick={handleDeleteVehicle} className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/25 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Trash2 size={13}/> Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

const EmptyState: React.FC<{ message: string, icon: React.ReactNode }> = ({ message, icon }) => (
  <div className="flex flex-col items-center justify-center py-20 text-chrome-500 opacity-30">
    {icon}
    <p className="mt-4 font-black uppercase text-xs tracking-widest">{message}</p>
  </div>
);

export default CustomerModule;
