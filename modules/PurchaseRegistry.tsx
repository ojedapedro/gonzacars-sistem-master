import React, { useState, useMemo } from 'react';
import { ShoppingCart, Package, Plus, Trash2, Calendar, FileText, User, Hash, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useGonzacarsStore } from '../store';
import { Purchase, Product } from '../types';
import CurrencyInput from '../components/CurrencyInput';
import CurrencyBadge from '../components/CurrencyBadge';

interface TemporaryItem {
  id: string;
  productId: string; // ID real del producto si existe
  productName: string;
  category: string;
  price: number;
  quantity: number;
}

const PurchaseRegistry: React.FC<{ store: any }> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('history');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  
  // Datos del Encabezado (Proveedor y Factura)
  const [invoiceHeader, setInvoiceHeader] = useState({
    date: new Date().toISOString().split('T')[0],
    provider: '',
    invoiceNumber: '',
    type: 'Contado' as 'Contado' | 'Crédito',
    warehouseId: 'gonzacars'
  });

  // Ítem actual que se está redactando
  const [currentItem, setCurrentItem] = useState<Partial<TemporaryItem>>({
    productId: '',
    productName: '',
    category: '',
    price: 0,
    quantity: 1
  });

  // Lista de ítems cargados en la factura actual
  const [invoiceItems, setInvoiceItems] = useState<TemporaryItem[]>([]);

  // Filtros para el historial
  const [filters, setFilters] = useState({
    invoiceNumber: '',
    provider: '',
    status: 'Todas' as 'Todas' | 'Pendiente' | 'Cerrada' | 'Pagada',
    dateStart: '',
    dateEnd: ''
  });

  const addItemToInvoice = () => {
    if (!currentItem.productName || !currentItem.category || (currentItem.price || 0) <= 0) {
      alert("Complete los datos del producto correctamente.");
      return;
    }
    
    const newItem: TemporaryItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: currentItem.productId || '', // Preservar ID si se seleccionó de la lista
      productName: currentItem.productName || '',
      category: currentItem.category || '',
      price: Number(currentItem.price) || 0,
      quantity: Number(currentItem.quantity) || 1
    };
    
    setInvoiceItems([...invoiceItems, newItem]);
    setCurrentItem({ productId: '', productName: '', category: '', price: 0, quantity: 1 });
  };

  const handleProductSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCurrentItem(prev => ({ ...prev, productName: val }));
    
    // Buscar si existe en inventario (Búsqueda insensible a mayúsculas)
    const existing = store.inventory.find((p: Product) => p.name.toLowerCase() === val.toLowerCase());
    
    if (existing) {
        setCurrentItem(prev => ({
            ...prev,
            productName: existing.name, // Usar nombre oficial del inventario
            productId: existing.id,
            category: existing.category,
            price: existing.cost // Sugerir último costo
        }));
    } else {
        // Si no existe o se cambió el nombre, resetear ID para que se cree como nuevo
        setCurrentItem(prev => ({ ...prev, productId: '' }));
    }
  };

  const removeItemFromInvoice = (id: string) => {
    setInvoiceItems(invoiceItems.filter(item => item.id !== id));
  };

  const processInvoice = async (status: 'Pendiente' | 'Cerrada') => {
    if (!invoiceHeader.provider || !invoiceHeader.invoiceNumber || invoiceItems.length === 0) {
      alert("Debe completar el encabezado y añadir al menos un producto.");
      return;
    }

    setIsSaving(true);
    const invoiceId = Math.random().toString(36).substr(2, 9).toUpperCase();
    
    // Preparar el lote de compras
    const purchasesBatch: Purchase[] = invoiceItems.map(item => ({
        id: Math.random().toString(36).substr(2, 9),
        invoiceId,
        date: invoiceHeader.date,
        provider: invoiceHeader.provider,
        invoiceNumber: invoiceHeader.invoiceNumber,
        productId: item.productId, // Pasar el ID vinculado si existe
        productName: item.productName,
        category: item.category,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
        type: invoiceHeader.type,
        status: status,
        warehouseId: invoiceHeader.warehouseId
    }));

    try {
        // Enviar lote completo al store para procesamiento secuencial
        await store.registerPurchaseBatch(purchasesBatch);

        alert(`Factura ${status} registrada con éxito. Se han procesado ${purchasesBatch.length} items y actualizado el inventario.`);
        
        // Resetear formulario
        setInvoiceHeader({
          date: new Date().toISOString().split('T')[0],
          provider: '',
          invoiceNumber: '',
          type: 'Contado',
          warehouseId: 'gonzacars'
        });
        setInvoiceItems([]);
        if (status === 'Cerrada') setActiveTab('history');
    } catch (error) {
        alert("Ocurrió un error al procesar algunos items. Por favor verifique el historial.");
        console.error(error);
    } finally {
        setIsSaving(false);
    }
  };

  // --- LÓGICA DE HISTORIAL AGRUPADO ---
  
  // 1. Filtrar filas crudas
  const filteredRawPurchases = useMemo(() => {
    return store.purchases.filter((p: Purchase) => {
      const matchStatus = filters.status === 'Todas' || p.status === filters.status;
      const matchProvider = !filters.provider || p.provider.toLowerCase().includes(filters.provider.toLowerCase());
      const matchInvoice = !filters.invoiceNumber || p.invoiceNumber.toLowerCase().includes(filters.invoiceNumber.toLowerCase());
      const matchDateStart = !filters.dateStart || p.date >= filters.dateStart;
      const matchDateEnd = !filters.dateEnd || p.date <= filters.dateEnd;
      return matchStatus && matchProvider && matchInvoice && matchDateStart && matchDateEnd;
    });
  }, [store.purchases, filters]);

  // 2. Agrupar por Factura
  const groupedInvoices = useMemo(() => {
    const groups: Record<string, { header: Purchase, items: Purchase[], total: number }> = {};
    
    filteredRawPurchases.forEach((p: Purchase) => {
      // Clave única: Factura + Proveedor (por si hay números repetidos entre proveedores)
      const key = `${p.invoiceNumber}-${p.provider}`;
      
      if (!groups[key]) {
        groups[key] = {
          header: p, // Tomamos la primera fila como cabecera (contiene fecha, proveedor, tipo, etc.)
          items: [],
          total: 0
        };
      }
      groups[key].items.push(p);
      groups[key].total += p.total;
    });

    // Convertir a array y ordenar por fecha descendente
    return Object.values(groups).sort((a, b) => b.header.date.localeCompare(a.header.date));
  }, [filteredRawPurchases]);

  const handlePayInvoice = async (invoiceNumber: string) => {
    if (confirm(`¿Confirmas que deseas marcar la factura #${invoiceNumber} como PAGADA?`)) {
      await store.payCreditInvoice(invoiceNumber);
    }
  };

  const invoiceTotal = invoiceItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  // Sugerencias de categorías y productos
  const categories = Array.from(new Set(store.inventory.map((p: Product) => p.category))) as string[];
  const existingProducts = store.inventory as Product[];

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-3xl font-black text-chrome-100 tracking-tighter uppercase">Abastecimiento de Almacén</h3>
          <p className="text-chrome-400 font-medium">Registro multi-ítem de facturas de proveedores</p>
        </div>
        <div className="flex bg-metal-mid p-1 rounded-2xl border border-metal-border shadow-sm">
          <button 
            onClick={() => setActiveTab('register')}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'register' ? 'btn-chrome shadow-lg shadow-metal-border' : 'text-chrome-500 hover:text-chrome-200'}`}
          >
            Nueva Factura
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'btn-chrome shadow-lg shadow-metal-border' : 'text-chrome-500 hover:text-chrome-200'}`}
          >
            Historial de Facturas
          </button>
        </div>
      </div>

      {activeTab === 'register' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Columna Izquierda: Encabezado y Carga de Ítems */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-metal-mid rounded-2xl shadow-sm p-8 border border-metal-border">
              <h4 className="text-[10px] font-black text-chrome-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <FileText size={16} className="text-blue-500" /> Información del Proveedor
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-chrome-400 uppercase tracking-widest ml-1">Proveedor / Razón Social</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18}/>
                    <input required type="text" placeholder="Ej: Repuestos El Chamo C.A." className="w-full pl-12 pr-4 py-3 bg-metal-dark border border-metal-border rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/15 transition-all" value={invoiceHeader.provider} onChange={(e) => setInvoiceHeader({...invoiceHeader, provider: e.target.value})} disabled={isSaving} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-chrome-400 uppercase tracking-widest ml-1">Nro. Factura</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18}/>
                      <input required type="text" placeholder="000123" className="w-full pl-12 pr-4 py-3 bg-metal-dark border border-metal-border rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/15 transition-all" value={invoiceHeader.invoiceNumber} onChange={(e) => setInvoiceHeader({...invoiceHeader, invoiceNumber: e.target.value})} disabled={isSaving} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-chrome-400 uppercase tracking-widest ml-1">Fecha</label>
                    <input type="date" className="w-full px-4 py-3 bg-metal-dark border border-metal-border rounded-2xl font-bold outline-none" value={invoiceHeader.date} onChange={(e) => setInvoiceHeader({...invoiceHeader, date: e.target.value})} disabled={isSaving} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-metal-mid rounded-2xl shadow-sm p-8 border border-metal-border">
              <h4 className="text-[10px] font-black text-chrome-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Package size={16} className="text-blue-500" /> Carga de Productos
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-metal-dark p-6 rounded-3xl border border-metal-border">
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[9px] font-black text-chrome-500 uppercase tracking-widest ml-1">Nombre del Repuesto</label>
                  <input 
                    type="text" 
                    list="existingProducts" 
                    placeholder="Escriba para buscar..." 
                    className="w-full px-4 py-2.5 bg-metal-mid border border-metal-border rounded-xl font-bold outline-none" 
                    value={currentItem.productName} 
                    onChange={handleProductSelect} 
                    disabled={isSaving}
                  />
                  <datalist id="existingProducts">
                    {existingProducts.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[9px] font-black text-chrome-500 uppercase tracking-widest ml-1">Categoría</label>
                  <input type="text" list="categories" placeholder="Motor..." className="w-full px-4 py-2.5 bg-metal-mid border border-metal-border rounded-xl font-bold outline-none" value={currentItem.category} onChange={(e) => setCurrentItem({...currentItem, category: e.target.value})} disabled={isSaving} />
                  <datalist id="categories">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="md:col-span-2 space-y-1.5 flex flex-col justify-end">
                  <CurrencyInput
                    valueUsd={currentItem.price || 0}
                    onChangeUsd={(val) => setCurrentItem({...currentItem, price: val})}
                    label="Costo Unit."
                    disabled={isSaving}
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[9px] font-black text-chrome-500 uppercase tracking-widest ml-1">Cant.</label>
                  <input type="number" className="w-full px-2 py-2.5 bg-metal-mid border border-metal-border rounded-xl font-black outline-none text-center" value={currentItem.quantity || ''} onChange={(e) => setCurrentItem({...currentItem, quantity: Number(e.target.value)})} disabled={isSaving} />
                </div>
                <div className="md:col-span-1">
                  <button onClick={addItemToInvoice} disabled={isSaving} className="w-full h-[46px] btn-chrome rounded-xl flex items-center justify-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50">
                    <Plus size={20}/>
                  </button>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                {invoiceItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-metal-mid border border-metal-border rounded-2xl hover:border-blue-200 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-metal-dark rounded-xl flex items-center justify-center text-chrome-500">
                        <Package size={18}/>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                            <p className="font-black text-chrome-100 text-sm uppercase tracking-tight">{item.productName}</p>
                            {item.productId && <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Vinculado</span>}
                        </div>
                        <p className="text-[10px] font-bold text-chrome-500 uppercase tracking-widest">{item.category} • Cant: {item.quantity}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <CurrencyBadge amountUsd={item.price * item.quantity} size="md" />
                        <p className="text-[9px] font-bold text-chrome-500 uppercase italic">@ ${item.price.toFixed(2)}</p>
                      </div>
                      <button onClick={() => removeItemFromInvoice(item.id)} disabled={isSaving} className="text-chrome-500 hover:text-red-500 transition-colors p-2 disabled:opacity-30">
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>
                ))}
                {invoiceItems.length === 0 && (
                  <div className="py-20 text-center border-2 border-dashed border-metal-border rounded-2xl">
                    <Package size={48} className="mx-auto text-slate-200 mb-3 opacity-30" />
                    <p className="text-[10px] font-black text-chrome-500 uppercase tracking-[0.2em]">Factura vacía, añada productos arriba</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panel Derecho: Resumen y Procesamiento */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
              <DollarSign className="absolute -bottom-8 -right-8 opacity-10" size={160} />
              <div className="relative z-10">
                <p className="text-[10px] font-black text-chrome-500 uppercase tracking-[0.3em] mb-2">Total de Factura</p>
                <h3 className="text-5xl font-black tracking-tighter">${invoiceTotal.toFixed(2)}</h3>
                <div className="mt-8 space-y-4">
                  <div className="flex justify-between items-center py-3 border-t border-white/10">
                    <span className="text-[10px] font-black text-chrome-400 uppercase">En Moneda Local</span>
                    <span className="text-xl font-bold text-emerald-400">{(invoiceTotal * store.exchangeRate).toLocaleString('es-VE')} Bs</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-t border-white/10">
                    <span className="text-[10px] font-black text-chrome-400 uppercase">Tasa de Cambio</span>
                    <span className="text-xs font-black">{store.exchangeRate} Bs</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-metal-mid rounded-2xl p-8 border border-metal-border shadow-sm space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Almacén de Destino</label>
                <select 
                  className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl font-black uppercase text-[10px] tracking-widest outline-none appearance-none cursor-pointer" 
                  value={invoiceHeader.warehouseId} 
                  onChange={(e) => setInvoiceHeader({...invoiceHeader, warehouseId: e.target.value})} 
                  disabled={isSaving}
                >
                  <option value="gonzacars">Gonzacars (Principal)</option>
                  <option value="externo_1">Almacén Externo 1</option>
                  <option value="externo_2">Almacén Externo 2</option>
                  <option value="externo_3">Almacén Externo 3</option>
                  <option value="externo_4">Almacén Externo 4</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Forma de Pago</label>
                <select className="w-full px-5 py-4 bg-metal-dark border border-metal-border rounded-2xl font-black uppercase text-[10px] tracking-widest outline-none appearance-none cursor-pointer" value={invoiceHeader.type} onChange={(e) => setInvoiceHeader({...invoiceHeader, type: e.target.value as 'Contado' | 'Crédito'})} disabled={isSaving}>
                  <option value="Contado">Pago Inmediato (Contado)</option>
                  <option value="Crédito">Compra a Crédito</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-3 pt-4">
                <button 
                  disabled={invoiceItems.length === 0 || isSaving}
                  onClick={() => processInvoice('Pendiente')}
                  className="w-full bg-metal-mid text-chrome-200 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Clock size={16}/>} 
                  {isSaving ? 'Procesando...' : 'Guardar como Pendiente'}
                </button>
                <button 
                  disabled={invoiceItems.length === 0 || isSaving}
                  onClick={() => processInvoice('Cerrada')}
                  className="w-full btn-chrome py-5 rounded-3xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-blue-700 shadow-2xl shadow-blue-100 transition-all disabled:opacity-50 active:scale-95"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle size={20}/>} 
                  {isSaving ? 'Guardando (No cerrar)...' : 'Procesar y Cerrar'}
                </button>
              </div>
              <p className="text-[9px] text-chrome-500 font-medium italic text-center px-4">
                {isSaving 
                  ? "Por favor espere. Estamos registrando los productos uno por uno para asegurar la integridad de la base de datos." 
                  : "Al cerrar la factura, los ítems se sumarán al inventario automáticamente."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* Filtros Historial Avanzados */}
          <div className="bg-metal-mid p-6 rounded-[2rem] border border-metal-border shadow-sm flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[150px] space-y-1.5">
              <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Nro. Factura</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" size={16}/>
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 bg-metal-dark border border-metal-border rounded-xl text-sm font-bold outline-none uppercase"
                  placeholder="000123"
                  value={filters.invoiceNumber}
                  onChange={(e) => setFilters({...filters, invoiceNumber: e.target.value})}
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Proveedor</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" size={16}/>
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 bg-metal-dark border border-metal-border rounded-xl text-sm font-bold outline-none"
                  placeholder="Filtrar proveedor..."
                  value={filters.provider}
                  onChange={(e) => setFilters({...filters, provider: e.target.value})}
                />
              </div>
            </div>
            <div className="w-48 space-y-1.5">
              <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Estado</label>
              <select 
                className="w-full px-3 py-2 bg-metal-dark border border-metal-border rounded-xl text-xs font-black uppercase outline-none cursor-pointer"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value as any})}
              >
                <option value="Todas">Ver Todas</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Cerrada">Procesada</option>
                <option value="Pagada">Pagada</option>
              </select>
            </div>
            <div className="w-40 space-y-1.5">
              <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Desde</label>
              <input type="date" className="w-full px-3 py-2 bg-metal-dark border border-metal-border rounded-xl text-xs font-bold outline-none" value={filters.dateStart} onChange={(e) => setFilters({...filters, dateStart: e.target.value})} />
            </div>
            <div className="w-40 space-y-1.5">
              <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Hasta</label>
              <input type="date" className="w-full px-3 py-2 bg-metal-dark border border-metal-border rounded-xl text-xs font-bold outline-none" value={filters.dateEnd} onChange={(e) => setFilters({...filters, dateEnd: e.target.value})} />
            </div>
            <button 
              onClick={() => setFilters({ invoiceNumber: '', provider: '', status: 'Todas', dateStart: '', dateEnd: '' })}
              className="p-2.5 bg-metal-mid text-chrome-500 rounded-xl hover:bg-slate-200 transition-colors"
              title="Limpiar filtros"
            >
              <Filter size={18}/>
            </button>
          </div>

          {/* Lista de Facturas Agrupadas */}
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
            {groupedInvoices.map((invoice, idx) => {
              const { header, items, total } = invoice;
              const isExpanded = expandedInvoice === `${header.invoiceNumber}-${header.provider}`;
              const isCredit = header.type === 'Crédito';
              const isPaid = header.status === 'Pagada' || (!isCredit && header.status === 'Cerrada');
              const isPendingPayment = isCredit && header.status !== 'Pagada';

              return (
                <div key={idx} className="bg-metal-mid rounded-3xl border border-metal-border shadow-sm overflow-hidden transition-all hover:shadow-md">
                  <div 
                    className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:bg-metal-dark transition-colors gap-4"
                    onClick={() => setExpandedInvoice(isExpanded ? null : `${header.invoiceNumber}-${header.provider}`)}
                  >
                    <div className="flex items-center gap-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg ${isPendingPayment ? 'bg-amber-500' : 'bg-slate-900'}`}>
                        {isPendingPayment ? <Clock size={20}/> : <CheckCircle size={20}/>}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-black text-chrome-100 uppercase tracking-tight">#{header.invoiceNumber}</h4>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${isCredit ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                            {header.type}
                          </span>
                          {isPaid && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-metal-mid text-chrome-400">Pagada</span>}
                        </div>
                        <p className="text-xs font-bold text-chrome-400 uppercase mt-1">{header.provider}</p>
                        <p className="text-[10px] font-medium text-chrome-500 mt-0.5">{header.date}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest">Total Factura</p>
                        <p className={`text-2xl font-black tracking-tighter ${isPendingPayment ? 'text-amber-600' : 'text-chrome-100'}`}>${total.toFixed(2)}</p>
                      </div>
                      
                      {isPendingPayment && store.payCreditInvoice && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePayInvoice(header.invoiceNumber);
                          }}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 z-10"
                        >
                          <CreditCard size={14}/> Registrar Pago
                        </button>
                      )}

                      <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-slate-200' : 'bg-metal-mid'}`}>
                        <ChevronDown size={16} className="text-chrome-400"/>
                      </div>
                    </div>
                  </div>

                  {/* Detalle de Productos Expandible */}
                  {isExpanded && (
                    <div className="border-t border-metal-border bg-metal-dark/50 p-6 animate-in slide-in-from-top-2 duration-200">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] font-black text-chrome-500 uppercase tracking-widest border-b border-metal-border">
                            <th className="pb-3 pl-4">Producto</th>
                            <th className="pb-3 text-center">Categoría</th>
                            <th className="pb-3 text-center">Almacén</th>
                            <th className="pb-3 text-center">Cantidad</th>
                            <th className="pb-3 text-right pr-4">Costo Unit.</th>
                            <th className="pb-3 text-right pr-4">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs">
                          {items.map((item) => (
                            <tr key={item.id} className="border-b border-metal-border last:border-0 hover:bg-metal-mid transition-colors">
                              <td className="py-3 pl-4 font-bold text-chrome-200 uppercase">{item.productName}</td>
                              <td className="py-3 text-center text-chrome-400 font-medium uppercase text-[10px]">{item.category}</td>
                              <td className="py-3 text-center text-chrome-400 font-bold uppercase text-[10px]">
                                {item.warehouseId === 'gonzacars' ? 'Gonzacars' : 
                                 item.warehouseId === 'externo_1' ? 'Ext 1' : 
                                 item.warehouseId === 'externo_2' ? 'Ext 2' : 
                                 item.warehouseId === 'externo_3' ? 'Ext 3' : 
                                 item.warehouseId === 'externo_4' ? 'Ext 4' : 'Gonzacars'}
                              </td>
                              <td className="py-3 text-center font-black text-chrome-100 bg-metal-mid rounded-lg border border-metal-border w-16 mx-auto block mt-1">{item.quantity}</td>
                              <td className="py-3 text-right pr-4 text-chrome-400">${item.price.toFixed(2)}</td>
                              <td className="py-3 text-right pr-4 font-black text-chrome-100">${item.total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {groupedInvoices.length === 0 && (
              <div className="py-20 text-center">
                <div className="flex flex-col items-center opacity-30">
                  <AlertCircle size={64} className="mb-4" />
                  <p className="font-black text-xl text-chrome-500 uppercase tracking-widest">Sin resultados</p>
                  <p className="text-sm font-medium text-chrome-500 mt-2">No se encontraron facturas con los filtros actuales</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseRegistry;
