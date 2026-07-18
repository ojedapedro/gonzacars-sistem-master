import React, { useState, useMemo } from 'react';
import { FileText, User, Plus, Minus, Trash2, Search, Receipt, Printer, Calendar, Clock, ChevronDown, Activity, DollarSign, Send, CheckCircle, XCircle, Car, ArrowRightLeft } from 'lucide-react';
import { useGonzacarsStore } from '../store';
import { Product, Quote, Customer, QuoteItem, VehicleRepair } from '../types';
import CurrencyBadge from '../components/CurrencyBadge';

const LOGO_URL = "https://i.ibb.co/MDhy5tzK/image-2.png";

interface QuotesModuleProps {
  localRate: number;
}

const QuotesModule: React.FC<QuotesModuleProps> = ({ localRate }) => {
  const store = useGonzacarsStore();
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  
  // Create Quote State
  const [cart, setCart] = useState<{ product?: Product; description: string; quantity: number; price: number }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehiclePlate, setSelectedVehiclePlate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom Item State
  const [customItemDesc, setCustomItemDesc] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemCurrency, setCustomItemCurrency] = useState<'USD' | 'BS'>('USD');
  
  const [ivaEnabled, setIvaEnabled] = useState(false);
  const [validDays, setValidDays] = useState(15);
  const [notes, setNotes] = useState('');
  
  // List Quotes State
  const [quoteSearchTerm, setQuoteSearchTerm] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Inventory source filter for product search
  const [inventorySource, setInventorySource] = useState<'all' | 'own' | 'consignment'>('all');

  // Derive available vehicles for the selected customer
  const customerVehicles = useMemo(() => {
    if (!selectedCustomer) return [];
    const plates = new Set<string>();
    store.repairs.forEach((r: VehicleRepair) => {
      if (r.customerId === selectedCustomer.id && r.plate) plates.add(r.plate.toUpperCase());
    });
    return Array.from(plates);
  }, [store.repairs, selectedCustomer]);

  // Reset selected plate when customer changes
  React.useEffect(() => {
    setSelectedVehiclePlate('');
  }, [selectedCustomer]);

  // Filter Inventory for Search — incluye Gonzacars + Consignación
  const filteredProducts = useMemo(() => {
    return store.inventory.filter((p: Product) => {
      // Filtro por origen
      if (inventorySource === 'own' && p.isConsignment) return false;
      if (inventorySource === 'consignment' && !p.isConsignment) return false;
      // Solo productos con stock disponible
      if (p.quantity <= 0) return false;
      // Filtro por término de búsqueda
      if (!searchTerm) return true;
      return p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (p.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
             (p.consignmentProvider || '').toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [store.inventory, searchTerm, inventorySource]);

  // Filter Quotes for List
  const filteredQuotes = useMemo(() => {
    return store.quotes.filter((q: Quote) => 
      q.customerName.toLowerCase().includes(quoteSearchTerm.toLowerCase()) || 
      q.id.toLowerCase().includes(quoteSearchTerm.toLowerCase()) ||
      (q.vehiclePlate && q.vehiclePlate.toLowerCase().includes(quoteSearchTerm.toLowerCase()))
    ).sort((a: Quote, b: Quote) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [store.quotes, quoteSearchTerm]);

  // --- Create Quote Logic ---
  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product?.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.product?.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, description: product.name, quantity: 1, price: Number(product.price) }]);
    }
    setSearchTerm('');
  };

  const addCustomItem = () => {
    if (!customItemDesc || !customItemPrice) return;
    
    // Convert to USD if inputted in BS
    let parsedPrice = Number(customItemPrice);
    if (isNaN(parsedPrice)) parsedPrice = 0;

    const priceUSD = customItemCurrency === 'USD' 
      ? parsedPrice 
      : parsedPrice / (localRate || 1);

    setCart([...cart, { description: customItemDesc, quantity: 1, price: priceUSD }]);
    setCustomItemDesc('');
    setCustomItemPrice('');
  };

  const updateQuantity = (idx: number, delta: number) => {
    setCart(cart.map((item, i) => {
      if (i === idx) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (idx: number) => setCart(cart.filter((_, i) => i !== idx));

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const iva = ivaEnabled ? subtotal * 0.16 : 0;
  const total = subtotal + iva;

  const handleCreateQuote = async () => {
    if (cart.length === 0) return;
    if (!selectedCustomer) {
      alert("Por favor seleccione un cliente");
      return;
    }

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + validDays);

    const newQuote: Quote = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      vehiclePlate: selectedVehiclePlate ? selectedVehiclePlate.toUpperCase() : undefined,
      date: new Date().toISOString(),
      validUntil: validUntilDate.toISOString(),
      items: cart.map(item => ({
        productId: item.product?.id,
        description: item.description,
        quantity: item.quantity,
        price: item.price
      })),
      subtotal,
      iva: ivaEnabled,
      total,
      status: 'Borrador',
      notes
    };

    await store.addQuote(newQuote);
    
    // Reset Form
    setCart([]);
    setSelectedCustomer(null);
    setSelectedVehiclePlate('');
    setIvaEnabled(false);
    setNotes('');
    
    // Switch to list to view the new quote
    setActiveTab('list');
    setSelectedQuote(newQuote);
  };

  // --- Update Quote Status ---
  const handleUpdateStatus = async (quote: Quote, newStatus: Quote['status']) => {
    await store.updateQuote({ ...quote, status: newStatus });
    if (selectedQuote?.id === quote.id) {
      setSelectedQuote({ ...quote, status: newStatus });
    }
  };

  // --- Convert to Work Order ---
  const handleConvertToRepair = async () => {
    if (!selectedQuote) return;
    
    if (!selectedQuote.vehiclePlate) {
      alert("Esta cotización no tiene un vehículo asociado. Debe tener una placa registrada para poder ingresar al taller.");
      return;
    }

    // FIX #3: Evitar re-conversión si ya fue procesada
    if (selectedQuote.repairId) {
      alert(`Esta cotización ya fue convertida a la Orden de Taller #${selectedQuote.repairId}. No puede convertirse nuevamente.`);
      return;
    }

    // FIX #2: Validar que la placa no tenga una orden ya abierta
    const CLOSED_STATUSES: VehicleRepair['status'][] = ['Finalizado', 'Entregado'];
    const openOrder = store.repairs.find((r: VehicleRepair) =>
      r.plate.toUpperCase() === selectedQuote.vehiclePlate!.toUpperCase() &&
      !CLOSED_STATUSES.includes(r.status)
    );
    if (openOrder) {
      alert(`El vehículo ${selectedQuote.vehiclePlate} ya tiene una orden de taller abierta (Estado: "${openOrder.status}"). Debe finalizar o entregar esa orden antes de abrir una nueva.`);
      return;
    }

    // Attempt to find brand/model from existing repairs of this plate
    let brand = 'Por Definir'; 
    let model = 'Por Definir'; 
    let year = new Date().getFullYear();
    const existingRepairs = store.repairs.filter((r: VehicleRepair) => r.plate.toUpperCase() === selectedQuote.vehiclePlate!.toUpperCase());
    if (existingRepairs.length > 0) {
      brand = existingRepairs[0].brand;
      model = existingRepairs[0].model;
      year = existingRepairs[0].year;
    }

    const newRepairId = Math.random().toString(36).substr(2, 9);

    const newRepair: VehicleRepair = {
      id: newRepairId,
      customerId: selectedQuote.customerId || '',
      ownerName: selectedQuote.customerName,
      plate: selectedQuote.vehiclePlate,
      brand,
      model,
      year,
      responsible: '',
      status: 'Ingresado',
      diagnosis: `Ingreso generado desde Cotización Aprobada #${selectedQuote.id}`,
      serviceType: 'Reparación General',
      mechanicId: '',
      quoteId: selectedQuote.id, // FIX #3: Vínculo hacia la cotización de origen
      items: selectedQuote.items.map(item => ({
        id: Math.random().toString(36).substr(2, 9),
        productId: item.productId,
        type: item.productId ? 'Repuesto' : 'Servicio',
        description: item.description,
        quantity: item.quantity,
        price: item.price
      })),
      createdAt: new Date().toISOString()
    };

    // FIX #3: Primero crear la orden, luego actualizar la cotización
    await store.addRepair(newRepair);
    const updatedQuote = { ...selectedQuote, status: 'Aprobada' as const, repairId: newRepairId };
    await store.updateQuote(updatedQuote);
    setSelectedQuote(updatedQuote);

    alert(`¡Éxito! La orden de trabajo para el vehículo ${selectedQuote.vehiclePlate} ha sido creada (Orden #${newRepairId}) y la cotización marcada como Aprobada.`);
  };

  return (
    <div className="module-page max-w-7xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 border border-amber-500/30">
            <FileText size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-gradient">Cotizaciones</h2>
            <p className="text-chrome-400 font-semibold text-xs tracking-widest uppercase mt-1">Presupuestos a Clientes</p>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'create' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-chrome-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Plus size={16} /> Crear Nueva
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'list' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-chrome-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText size={16} /> Historial
          </button>
        </div>
      </div>

      {/* CREATE TAB */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          {/* Left: Product Selection */}
          <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
            <div className="glass-panel rounded-2xl p-6 flex flex-col min-h-0">
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                <Search size={18} className="text-amber-500" />
                Buscar Productos / Servicios
              </h3>
              
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18} />
                <input
                  type="text"
                  placeholder="Buscar en el inventario..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:border-amber-500 outline-none transition-all font-medium"
                />
              </div>

              {/* Filtros de origen del inventario */}
              <div className="flex gap-1 mb-4 p-1 bg-black/20 rounded-xl border border-white/10">
                {(['all', 'own', 'consignment'] as const).map(source => {
                  const labels = { all: '🏪 Todos', own: '🔧 Gonzacars', consignment: '🤝 Consignación' };
                  return (
                    <button
                      key={source}
                      onClick={() => setInventorySource(source)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                        inventorySource === source
                          ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                          : 'text-chrome-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {labels[source]}
                    </button>
                  );
                })}
              </div>

              {searchTerm && (
                <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 rounded-xl bg-black/20 p-2 space-y-2 mb-4">
                  {filteredProducts.map((p: Product) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-white text-sm">{p.name}</p>
                          {p.isConsignment ? (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                              🤝 {p.consignmentProvider || 'Consignación'}
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                              🔧 Gonzacars
                            </span>
                          )}
                        </div>
                        <div className="flex gap-3 text-xs mt-1">
                          <span className="text-amber-400 font-bold">${Number(p.price).toFixed(2)}</span>
                          <span className="text-chrome-500 uppercase">Disp: {p.quantity}</span>
                          {p.category && <span className="text-chrome-600">{p.category}</span>}
                        </div>
                      </div>
                      <button 
                        onClick={() => addToCart(p)}
                        className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg transition-colors border border-amber-500/20 ml-3 flex-shrink-0"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="p-6 text-center text-chrome-500 text-sm">
                      <Search size={32} className="mx-auto mb-2 opacity-20" />
                      No se encontraron productos en {inventorySource === 'all' ? 'el inventario' : inventorySource === 'own' ? 'el almacén Gonzacars' : 'consignación'}.
                    </div>
                  )}
                </div>
              )}

              {/* Custom Item Form */}
              <div className="mt-auto border-t border-white/10 pt-4">
                <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  Agregar Item Manual (Mano de Obra / Servicio)
                  <span className="text-chrome-600 bg-white/5 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ArrowRightLeft size={10} /> Tasa: Bs. {localRate}
                  </span>
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Descripción del servicio..."
                    value={customItemDesc}
                    onChange={e => setCustomItemDesc(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber-500 transition-all"
                  />
                  <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-amber-500 transition-all">
                    <button 
                      onClick={() => setCustomItemCurrency(prev => prev === 'USD' ? 'BS' : 'USD')}
                      className="px-3 py-3 bg-black/40 text-white font-black text-xs hover:bg-white/10 transition-colors border-r border-white/10 min-w-[50px]"
                    >
                      {customItemCurrency === 'USD' ? '$' : 'Bs'}
                    </button>
                    <input
                      type="number"
                      placeholder="Precio"
                      value={customItemPrice}
                      onChange={e => setCustomItemPrice(e.target.value)}
                      className="w-24 bg-transparent pl-3 pr-3 py-3 text-white text-sm outline-none font-medium"
                    />
                  </div>
                  <button 
                    onClick={addCustomItem}
                    disabled={!customItemDesc || !customItemPrice}
                    className="px-5 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl font-bold transition-all"
                  >
                    Agregar
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Right: Quote Details */}
          <div className="lg:col-span-1 glass-panel rounded-2xl flex flex-col overflow-hidden min-h-0">
            <div className="p-4 bg-black/20 border-b border-white/10">
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Receipt size={18} className="text-amber-500" /> Detalle de Cotización
              </h3>
            </div>
            
            <div className="p-4 border-b border-white/10 space-y-4">
              {/* Customer Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Cliente *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" size={16} />
                  <select 
                    value={selectedCustomer?.id || ''}
                    onChange={e => {
                      const c = store.customers.find((c: Customer) => c.id === e.target.value);
                      setSelectedCustomer(c || null);
                    }}
                    className="w-full bg-chrome-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white appearance-none focus:border-amber-500 outline-none transition-all font-medium text-sm"
                  >
                    <option value="">Seleccione un cliente...</option>
                    {store.customers.map((c: Customer) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none" size={16} />
                </div>
              </div>

              {/* Vehicle Select (Appears if Customer is selected) */}
              <div className={`space-y-1 transition-all duration-300 overflow-hidden ${selectedCustomer ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Placa del Vehículo (Opcional)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" size={16} />
                    <select 
                      value={selectedVehiclePlate}
                      onChange={e => setSelectedVehiclePlate(e.target.value)}
                      className="w-full bg-chrome-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white appearance-none focus:border-amber-500 outline-none transition-all font-medium text-sm"
                    >
                      <option value="">Ninguno / Ingresar Placa Nueva...</option>
                      {customerVehicles.map(plate => (
                        <option key={plate} value={plate}>{plate}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none" size={16} />
                  </div>
                  {/* Allow entering a new plate directly if not in list */}
                  <input 
                    type="text" 
                    placeholder="ABC-123" 
                    value={selectedVehiclePlate} 
                    onChange={e => setSelectedVehiclePlate(e.target.value.toUpperCase())}
                    className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-center font-mono font-bold uppercase outline-none focus:border-amber-500 text-sm"
                  />
                </div>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Validez (Días)</label>
                  <input type="number" min="1" value={validDays} onChange={e => setValidDays(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Impuesto (IVA)</label>
                  <button 
                    onClick={() => setIvaEnabled(!ivaEnabled)}
                    className={`w-full py-2 rounded-xl text-sm font-bold transition-all border ${
                      ivaEnabled ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/5 text-chrome-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {ivaEnabled ? 'Con IVA (16%)' : 'Exento'}
                  </button>
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-chrome-500 opacity-50">
                  <Receipt size={32} className="mb-2" />
                  <p className="text-xs font-bold uppercase tracking-wider">Presupuesto Vacío</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm font-bold text-white leading-tight">{item.description}</p>
                        <button onClick={() => removeFromCart(idx)} className="text-chrome-500 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 bg-black/20 rounded-lg p-1 border border-white/5">
                          <button onClick={() => updateQuantity(idx, -1)} className="p-1 hover:bg-white/10 rounded text-chrome-400"><Minus size={14} /></button>
                          <span className="text-sm font-bold text-white w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(idx, 1)} className="p-1 hover:bg-white/10 rounded text-chrome-400"><Plus size={14} /></button>
                        </div>
                        <CurrencyBadge amountUsd={item.price * item.quantity} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20">
              <input type="text" placeholder="Notas Adicionales (Opcional)" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white mb-4 outline-none focus:border-amber-500" />
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-chrome-400 text-sm font-medium"><span>Subtotal</span> <CurrencyBadge amountUsd={subtotal} /></div>
                {ivaEnabled && <div className="flex justify-between text-chrome-400 text-sm font-medium"><span>IVA (16%)</span> <CurrencyBadge amountUsd={iva} /></div>}
                <div className="flex justify-between text-white text-lg font-black pt-2 border-t border-white/10"><span>Total Presupuestado</span> <CurrencyBadge amountUsd={total} /></div>
              </div>

              <button 
                onClick={handleCreateQuote}
                disabled={cart.length === 0 || !selectedCustomer}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 flex items-center justify-center gap-2"
              >
                Generar Cotización
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIST TAB */}
      {activeTab === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18} />
              <input
                type="text"
                placeholder="Buscar por cliente, placa o ID..."
                value={quoteSearchTerm}
                onChange={e => setQuoteSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-amber-500 transition-all font-medium text-sm"
              />
            </div>

            <div className="glass-panel rounded-2xl flex-1 overflow-y-auto custom-scrollbar p-2">
              {filteredQuotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-chrome-500">
                  <FileText size={32} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium">No hay cotizaciones registradas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredQuotes.map((quote: Quote) => {
                    const isSelected = selectedQuote?.id === quote.id;
                    const isExpired = new Date(quote.validUntil) < new Date() && quote.status === 'Borrador';
                    
                    return (
                      <button
                        key={quote.id}
                        onClick={() => setSelectedQuote(quote)}
                        className={`w-full text-left p-4 rounded-xl transition-all border ${
                          isSelected 
                            ? 'bg-amber-500/10 border-amber-500/30 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' 
                            : 'bg-white/5 border-transparent hover:bg-white/10'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-md tracking-wider ${
                            quote.status === 'Aprobada' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            quote.status === 'Rechazada' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            quote.status === 'Enviada' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            isExpired ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-white/10 text-chrome-300'
                          }`}>
                            {isExpired ? 'VENCIDA' : quote.status.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-bold text-chrome-500 bg-black/20 px-2 py-1 rounded-lg">
                            #{quote.id}
                          </span>
                        </div>
                        <h3 className="font-bold text-white text-md tracking-tight mb-1 truncate flex items-center gap-2">
                          {quote.customerName}
                          {quote.vehiclePlate && (
                            <span className="text-[10px] bg-chrome-800 text-chrome-300 border border-white/10 px-2 rounded font-mono uppercase tracking-wider">{quote.vehiclePlate}</span>
                          )}
                        </h3>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-chrome-400 text-xs font-medium flex items-center gap-1"><Calendar size={12}/> {new Date(quote.date).toLocaleDateString()}</span>
                          <CurrencyBadge amountUsd={quote.total} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 lg:p-8 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
            {selectedQuote ? (
              <div className="animate-fade-in flex flex-col h-full">
                <div className="flex justify-between items-start border-b border-white/10 pb-6 mb-6">
                  <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">Cotización <span className="text-amber-500">#{selectedQuote.id}</span></h2>
                    <p className="text-chrome-400 text-sm font-medium mt-1">Para: <span className="text-white font-bold">{selectedQuote.customerName}</span></p>
                    {selectedQuote.vehiclePlate && (
                       <p className="text-chrome-400 text-xs font-medium mt-1 flex items-center gap-1"><Car size={14}/> Vehículo: <span className="text-white font-mono font-bold tracking-widest">{selectedQuote.vehiclePlate}</span></p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-chrome-400 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Calendar size={14}/> Emitida: {new Date(selectedQuote.date).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Clock size={14}/> Válida hasta: {new Date(selectedQuote.validUntil).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setShowPrintModal(true)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold flex items-center gap-2 transition-colors border border-white/5"
                    >
                      <Printer size={16} /> Imprimir / PDF
                    </button>
                    {/* Status Modifiers */}
                    <div className="flex bg-black/30 rounded-lg p-1 border border-white/5">
                       <button onClick={() => handleUpdateStatus(selectedQuote, 'Enviada')} title="Marcar como Enviada" className={`p-2 rounded transition-colors ${selectedQuote.status === 'Enviada' ? 'bg-blue-500/20 text-blue-400' : 'text-chrome-500 hover:text-white hover:bg-white/10'}`}><Send size={16}/></button>
                       <button onClick={() => handleUpdateStatus(selectedQuote, 'Aprobada')} title="Aprobar" className={`p-2 rounded transition-colors ${selectedQuote.status === 'Aprobada' ? 'bg-emerald-500/20 text-emerald-400' : 'text-chrome-500 hover:text-emerald-400 hover:bg-white/10'}`}><CheckCircle size={16}/></button>
                       <button onClick={() => handleUpdateStatus(selectedQuote, 'Rechazada')} title="Rechazar" className={`p-2 rounded transition-colors ${selectedQuote.status === 'Rechazada' ? 'bg-red-500/20 text-red-400' : 'text-chrome-500 hover:text-red-400 hover:bg-white/10'}`}><XCircle size={16}/></button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[10px] font-black text-chrome-500 uppercase tracking-widest">
                        <th className="pb-3 pl-2">Descripción</th>
                        <th className="pb-3 text-center">Cant.</th>
                        <th className="pb-3 text-right pr-2">Precio Unit.</th>
                        <th className="pb-3 text-right pr-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium text-chrome-200">
                      {selectedQuote.items.map((item, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                          <td className="py-4 pl-2 font-bold text-white">{item.description}</td>
                          <td className="py-4 text-center">{item.quantity}</td>
                          <td className="py-4 text-right pr-2"><CurrencyBadge amountUsd={Number(item.price || 0)} /></td>
                          <td className="py-4 text-right pr-2 font-bold"><CurrencyBadge amountUsd={Number(item.price || 0) * Number(item.quantity || 1)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedQuote.notes && (
                    <div className="mt-6 pt-4 border-t border-white/10">
                      <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-1">Notas</p>
                      <p className="text-sm text-chrome-300">{selectedQuote.notes}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <div className="w-64 space-y-3">
                    <div className="flex justify-between text-chrome-400 font-medium"><span>Subtotal</span> <CurrencyBadge amountUsd={selectedQuote.subtotal} /></div>
                    {selectedQuote.iva && <div className="flex justify-between text-chrome-400 font-medium"><span>IVA (16%)</span> <CurrencyBadge amountUsd={selectedQuote.total - selectedQuote.subtotal} /></div>}
                    <div className="flex justify-between text-white text-xl font-black pt-3 border-t border-white/10"><span>Total</span> <CurrencyBadge amountUsd={selectedQuote.total} /></div>
                  </div>
                </div>
                
                {selectedQuote.status === 'Aprobada' && (
                  <div className="mt-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="text-emerald-400" size={32} />
                      <div>
                        <p className="text-white font-bold text-base">Cotización Aprobada</p>
                        {selectedQuote.repairId ? (
                          <p className="text-emerald-400/80 text-xs mt-0.5">
                            ✅ Orden de Taller generada: <span className="font-black text-emerald-300 uppercase tracking-widest">#{selectedQuote.repairId}</span>
                          </p>
                        ) : (
                          <p className="text-emerald-400/80 text-xs mt-0.5">Puedes generar la orden de taller con estos datos.</p>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={handleConvertToRepair}
                      disabled={!!selectedQuote.repairId}
                      className={`px-5 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center whitespace-nowrap ${
                        selectedQuote.repairId
                          ? 'bg-metal-dark border border-metal-border text-chrome-500 cursor-not-allowed opacity-60'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(5,150,105,0.3)]'
                      }`}
                    >
                      <Activity size={18} />
                      {selectedQuote.repairId ? 'Ya tiene Orden de Taller' : 'Convertir a Orden de Taller'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-chrome-500">
                <FileText size={48} className="mb-4 opacity-20" />
                <p className="text-lg font-bold text-chrome-400">Selecciona una Cotización</p>
                <p className="text-sm">Para ver los detalles e imprimir</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Print Modal (Simple mock) */}
      {showPrintModal && selectedQuote && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl animate-scale-in text-black p-8">
             <div className="flex justify-between items-start border-b pb-6 mb-6">
                <div>
                  <img src={LOGO_URL} alt="Logo" className="h-16 mb-2" style={{filter: 'invert(1)'}} />
                  <h1 className="text-2xl font-black uppercase">Gonzacars C.A.</h1>
                  <p className="text-sm text-gray-500">Taller y Autopartes</p>
                </div>
                <div className="text-right">
                  <h2 className="text-3xl font-black text-gray-200">PRESUPUESTO</h2>
                  <p className="text-lg font-bold mt-2">#{selectedQuote.id}</p>
                  <p className="text-sm text-gray-500 mt-1">Fecha: {new Date(selectedQuote.date).toLocaleDateString()}</p>
                </div>
             </div>
             
             <div className="mb-8 flex justify-between">
               <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Preparado para:</p>
                 <p className="text-lg font-bold">{selectedQuote.customerName}</p>
                 <p className="text-sm text-gray-500 mt-1">Válido hasta el {new Date(selectedQuote.validUntil).toLocaleDateString()}</p>
               </div>
               {selectedQuote.vehiclePlate && (
                 <div className="text-right">
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Vehículo Asociado:</p>
                   <p className="text-lg font-black font-mono tracking-widest">{selectedQuote.vehiclePlate}</p>
                 </div>
               )}
             </div>

             <table className="w-full text-left mb-8">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-sm font-bold text-gray-600">
                    <th className="pb-2">Descripción</th>
                    <th className="pb-2 text-center">Cant</th>
                    <th className="pb-2 text-right">Precio</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {selectedQuote.items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-3 font-semibold">{item.description}</td>
                      <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-600">${Number(item.price || 0).toFixed(2)}</td>
                      <td className="py-3 text-right font-bold">${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
             </table>

             <div className="flex justify-end mb-8">
               <div className="w-64 space-y-2 text-sm">
                 <div className="flex justify-between text-gray-600"><span>Subtotal:</span> <span>${Number(selectedQuote.subtotal || 0).toFixed(2)}</span></div>
                 {selectedQuote.iva && <div className="flex justify-between text-gray-600"><span>IVA (16%):</span> <span>${(Number(selectedQuote.total || 0) - Number(selectedQuote.subtotal || 0)).toFixed(2)}</span></div>}
                 <div className="flex justify-between text-lg font-black border-t-2 border-gray-200 pt-2 mt-2"><span>TOTAL USD:</span> <span>${Number(selectedQuote.total || 0).toFixed(2)}</span></div>
                 {/* Dual Currency Print */}
                 <div className="flex justify-between text-sm font-bold text-gray-500 pt-1">
                   <span>Ref. Bs (Tasa {localRate}):</span> 
                   <span>Bs. {(Number(selectedQuote.total || 0) * (localRate || 1)).toLocaleString('es-VE', {minimumFractionDigits: 2})}</span>
                 </div>
               </div>
             </div>

             <div className="flex justify-center gap-4 border-t border-gray-200 pt-6 no-print">
                <button onClick={() => {window.print(); setShowPrintModal(false);}} className="px-6 py-2 bg-black text-white font-bold rounded-lg flex items-center gap-2 hover:bg-gray-800"><Printer size={18}/> Imprimir Documento</button>
                <button onClick={() => setShowPrintModal(false)} className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300">Cerrar</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default QuotesModule;
