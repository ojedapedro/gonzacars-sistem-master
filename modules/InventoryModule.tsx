
import React, { useState, useMemo, useRef } from 'react';
import { Package, Search, Edit3, AlertCircle, Barcode, RotateCw, History, X, Truck, Calendar, DollarSign, ArrowRight, Filter, ChevronDown, ArrowUp, ArrowDown, ClipboardCheck, TrendingUp, TrendingDown, AlertTriangle, Save, FileSpreadsheet, UploadCloud, CheckCircle, ShieldCheck, Download } from 'lucide-react';
import { Product, Purchase, Sale } from '../types';

// Declare XLSX globally to bypass build resolution issues
declare const XLSX: any;

const InventoryModule: React.FC<{ store: any }> = ({ store }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBarcodeId, setEditingBarcodeId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null); // State for editing name
  const [newPrice, setNewPrice] = useState(0);
  const [newBarcode, setNewBarcode] = useState('');
  const [newName, setNewName] = useState(''); // State for new name value
  
  // Filtering & Sorting States
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // History & Audit Modal States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Audit Form State
  const [physicalCount, setPhysicalCount] = useState<number>(0);
  const [auditReason, setAuditReason] = useState('');

  // Bulk Import States
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStep, setBulkStep] = useState<'preview' | 'confirm'>('preview');
  const [bulkResult, setBulkResult] = useState<{
    updates: { product: Product; oldQty: number; newQty: number; diff: number }[];
    newProducts: { name: string; category: string; price: number; cost: number; quantity: number; barcode?: string }[];
    unchanged: { product: Product }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived Data for Filters
  const categories = useMemo(() => 
    Array.from(new Set((store.inventory || []).map((p: Product) => p.category))).filter(Boolean).sort()
  , [store.inventory]);

  const suppliers = useMemo(() => 
    Array.from(new Set((store.purchases || []).map((p: Purchase) => p.provider))).filter(Boolean).sort()
  , [store.purchases]);

  // Filtered and Sorted Inventory
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    
    let result = (store.inventory || []).filter((p: Product) => {
      // FIX CRÍTICO: Asegurar que las propiedades sean strings antes de usar toLowerCase
      // Esto previene pantalla blanca si barcode o name vienen como números desde Sheets
      const name = String(p.name || '').toLowerCase();
      const category = String(p.category || '').toLowerCase();
      const barcode = String(p.barcode || '').toLowerCase();
      
      return name.includes(term) || category.includes(term) || barcode.includes(term);
    });

    if (categoryFilter) {
      result = result.filter((p: Product) => p.category === categoryFilter);
    }

    if (supplierFilter) {
      const suppliedProductNames = new Set(
        (store.purchases || [])
          .filter((pur: Purchase) => pur.provider === supplierFilter)
          .map((pur: Purchase) => pur.productName)
      );
      result = result.filter((p: Product) => suppliedProductNames.has(p.name));
    }

    return result.sort((a: Product, b: Product) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [store.inventory, store.purchases, searchTerm, categoryFilter, supplierFilter, sortConfig]);

  const handleSort = (key: keyof Product) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handlePriceUpdate = (id: string) => {
    store.updateInventoryPrice(id, newPrice);
    setEditingId(null);
  };

  const handleQuantityUpdate = (id: string, val: number) => {
    store.updateInventoryQuantity(id, val);
  };

  const handleBarcodeUpdate = (id: string) => {
    store.updateBarcode(id, newBarcode);
    setEditingBarcodeId(null);
  };

  const handleNameUpdate = (id: string) => {
    if (newName.trim()) {
      store.updateProductName(id, newName);
    }
    setEditingNameId(null);
  };

  const regenerateBarcode = (id: string) => {
    store.updateBarcode(id, store.generateBarcode());
  };

  const openHistory = (product: Product) => {
    setSelectedProduct(product);
    setShowHistoryModal(true);
  };

  const openAudit = (product: Product) => {
    setSelectedProduct(product);
    setPhysicalCount(product.quantity); // Default to current system stock
    setAuditReason('');
    setShowAuditModal(true);
  };

  const submitAudit = () => {
    if (!selectedProduct) return;
    if (physicalCount < 0) return alert("La cantidad no puede ser negativa");
    
    // Update store
    store.updateInventoryQuantity(selectedProduct.id, physicalCount);
    
    alert(`Inventario ajustado correctamente.\nSistema: ${selectedProduct.quantity} -> Físico: ${physicalCount}\nMotivo: ${auditReason || 'Auditoría de rutina'}`);
    setShowAuditModal(false);
  };

  const handleDownloadExcel = () => {
    if (typeof XLSX === 'undefined') {
        alert("La librería de Excel no se ha cargado correctamente. Verifique su conexión a internet.");
        return;
    }

    const data = store.inventory.map((p: Product) => ({
      "Código de Barras": p.barcode || '',
      "Producto": p.name,
      "Categoría": p.category,
      "Costo": p.cost || 0,
      "Precio": p.price || 0,
      "Cantidad Teórica": p.quantity,
      "Cantidad Contada": "" // Empty for manual entry
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Adjust column widths
    const wscols = [
      { wch: 20 }, // Barcode
      { wch: 40 }, // Name
      { wch: 20 }, // Category
      { wch: 12 }, // Cost
      { wch: 12 }, // Price
      { wch: 15 }, // Theoretical
      { wch: 15 }  // Counted
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario Físico");
    XLSX.writeFile(workbook, `Inventario_Gonzacars_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (typeof XLSX === 'undefined') {
      alert('Error: La librería XLSX no está cargada. Verifique su conexión a internet.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const updates: { product: Product; oldQty: number; newQty: number; diff: number }[] = [];
        const newProducts: { name: string; category: string; price: number; cost: number; quantity: number; barcode?: string }[] = [];
        const unchanged: { product: Product }[] = [];
        const processedNames = new Set<string>();

        jsonData.forEach((row: any) => {
          const getCol = (target: string) => {
            const key = Object.keys(row).find(k => k.trim().toLowerCase() === target.toLowerCase());
            return key ? row[key] : undefined;
          };

          const barcode = String(getCol('Código de Barras') ?? getCol('Codigo de Barras') ?? '').trim();
          const name = String(getCol('Producto') ?? getCol('Nombre') ?? '').trim();
          const quantityRaw = getCol('Cantidad Contada');
          const category = String(getCol('Categoría') ?? getCol('Categoria') ?? '').trim();
          const priceRaw = getCol('Precio');
          const costRaw = getCol('Costo');

          if (!name) return;
          if (processedNames.has(name.toLowerCase())) return;
          processedNames.add(name.toLowerCase());

          // Only process rows where a quantity was explicitly entered
          const hasQty = quantityRaw !== undefined && quantityRaw !== '';
          const quantity = hasQty ? Number(String(quantityRaw).trim()) : NaN;

          // Try to match against existing inventory
          let product: Product | undefined;
          if (barcode) {
            product = (store.inventory as Product[]).find(p => String(p.barcode).trim() === barcode);
          }
          if (!product && name) {
            product = (store.inventory as Product[]).find(p => p.name.trim().toLowerCase() === name.toLowerCase());
          }

          if (product) {
            if (!hasQty || isNaN(quantity)) {
              unchanged.push({ product });
            } else if (quantity === product.quantity) {
              unchanged.push({ product });
            } else {
              updates.push({ product, oldQty: product.quantity, newQty: quantity, diff: quantity - product.quantity });
            }
          } else {
            // New product — only add if it has a quantity specified
            if (hasQty && !isNaN(quantity) && name) {
              newProducts.push({
                name,
                category: category || 'Sin Categoría',
                price: Number(priceRaw) || 0,
                cost: Number(costRaw) || 0,
                quantity,
                barcode: barcode || undefined
              });
            }
          }
        });

        if (updates.length === 0 && newProducts.length === 0 && unchanged.length === 0) {
          alert('Archivo procesado pero no se encontraron datos válidos.\n\nAsegúrese de usar el formato oficial descargado y completar la columna "Cantidad Contada".');
          return;
        }

        setBulkResult({ updates, newProducts, unchanged });
        setBulkStep('preview');
        setShowBulkModal(true);
      } catch (err) {
        console.error('Error parsing file:', err);
        alert('Error al procesar el archivo. Asegúrese de usar un archivo Excel (.xlsx) válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processBulkUpdate = async () => {
    if (!bulkResult) return;
    const { updates, newProducts } = bulkResult;

    // 1. Apply quantity updates to existing products
    if (updates.length > 0) {
      const stockUpdates = updates.map(u => ({ id: u.product.id, quantity: u.newQty }));
      await store.updateStockBatch(stockUpdates);
    }

    // 2. Add new products to inventory (persists to Firebase)
    for (const np of newProducts) {
      const newProduct: Product = {
        id: Math.random().toString(36).substr(2, 9),
        barcode: np.barcode || store.generateBarcode(),
        name: np.name,
        category: np.category,
        quantity: np.quantity,
        cost: np.cost,
        price: np.price,
        lastEntry: new Date().toISOString().split('T')[0]
      };
      await store.addProduct(newProduct);
    }

    setShowBulkModal(false);
    setBulkResult(null);
  };

  const handleGlobalAudit = () => {
    if (confirm("¿Estás seguro de ejecutar la Auditoría Global?\n\nEsta acción revisará TODAS las compras y ventas históricas para recalcular el inventario y asegurar que no falte ningún producto registrado en compras.\n\nEste proceso puede tomar unos segundos.")) {
      store.runGlobalAudit();
    }
  };

  // KARDEX LOGIC: Combine Purchases (Entries) and Sales (Exits)
  const getProductMovements = (product: Product) => {
    const movements: any[] = [];

    // Add Purchases (Entries)
    store.purchases.forEach((p: Purchase) => {
      if (p.productId === product.id || p.productName === product.name) {
        movements.push({
          id: p.id,
          date: p.date,
          type: 'ENTRADA',
          quantity: p.quantity,
          price: p.price,
          reference: p.provider,
          doc: `Fac. ${p.invoiceNumber}`
        });
      }
    });

    // Add Sales (Exits)
    store.sales.forEach((s: Sale) => {
      const soldItem = s.items.find(i => i.productId === product.id || i.name === product.name);
      if (soldItem) {
        movements.push({
          id: s.id,
          date: s.date,
          type: 'SALIDA',
          quantity: soldItem.quantity,
          price: soldItem.price,
          reference: s.customerName,
          doc: `Venta #${s.id.substring(0,6)}`
        });
      }
    });

    // Sort descending by date
    return movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const SortIcon = ({ column }: { column: keyof Product }) => {
    if (sortConfig.key !== column) return <ArrowDown size={12} className="opacity-20 ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={12} className="text-blue-600 ml-1" /> 
      : <ArrowDown size={12} className="text-blue-600 ml-1" />;
  };

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h3 className="text-3xl font-black text-chrome-100 tracking-tighter uppercase">Control de Inventario</h3>
          <p className="text-chrome-400 font-medium">Gestión de stock, precios y auditoría de abastecimiento</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button 
             onClick={handleDownloadExcel}
             className="btn-chrome px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-black shadow-lg shadow-metal-border transition-all active:scale-95"
          >
             <Download size={18}/> Descargar Excel
          </button>
          <button 
             onClick={handleGlobalAudit}
             disabled={store.isProcessingBatch}
             className="bg-purple-600 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-purple-700 shadow-lg shadow-purple-100 transition-all active:scale-95 disabled:opacity-50"
          >
             <ShieldCheck size={18}/> Auditoría Compras
          </button>
          <button 
             onClick={() => setShowBulkModal(true)}
             className="bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
          >
             <FileSpreadsheet size={18}/> Carga Masiva
          </button>
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18}/>
            <input 
              type="text" 
              placeholder="Buscar por nombre, categoría o código..." 
              className="w-full pl-12 pr-4 py-3 bg-metal-mid border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 transition-all font-bold text-sm shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6 bg-metal-mid p-4 rounded-2xl border border-metal-border shadow-sm">
        <div className="flex items-center gap-2 text-chrome-500 text-xs font-black uppercase tracking-widest px-2">
          <Filter size={16} /> Filtros:
        </div>
        
        <div className="relative group">
          <select 
            className="appearance-none bg-metal-dark border border-metal-border pl-4 pr-10 py-2 rounded-xl text-xs font-bold text-chrome-200 outline-none focus:border-blue-500 cursor-pointer min-w-[150px]"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Todas las Categorías</option>
            {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none group-hover:text-blue-500" />
        </div>

        <div className="relative group">
          <select 
            className="appearance-none bg-metal-dark border border-metal-border pl-4 pr-10 py-2 rounded-xl text-xs font-bold text-chrome-200 outline-none focus:border-blue-500 cursor-pointer min-w-[180px]"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="">Todos los Proveedores</option>
            {suppliers.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none group-hover:text-blue-500" />
        </div>

        {(categoryFilter || supplierFilter) && (
          <button 
            onClick={() => { setCategoryFilter(''); setSupplierFilter(''); }}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-xl transition-all"
          >
            <X size={12} /> Limpiar
          </button>
        )}

        <div className="ml-auto text-[10px] font-bold text-chrome-500">
           Mostrando {filtered.length} productos
        </div>
      </div>

      <div className="bg-metal-mid rounded-2xl shadow-sm border border-metal-border overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-metal-dark border-b border-metal-border">
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest cursor-pointer hover:bg-metal-mid transition-colors" onClick={() => handleSort('barcode')}>
                <div className="flex items-center">Código / Barcode <SortIcon column="barcode" /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest cursor-pointer hover:bg-metal-mid transition-colors" onClick={() => handleSort('name')}>
                <div className="flex items-center">Producto <SortIcon column="name" /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-center cursor-pointer hover:bg-metal-mid transition-colors" onClick={() => handleSort('quantity')}>
                <div className="flex items-center justify-center">Stock <SortIcon column="quantity" /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-right cursor-pointer hover:bg-metal-mid transition-colors" onClick={() => handleSort('cost')}>
                <div className="flex items-center justify-end">Costo ($) <SortIcon column="cost" /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-right cursor-pointer hover:bg-metal-mid transition-colors" onClick={() => handleSort('price')}>
                <div className="flex items-center justify-end">Precio Venta ($) <SortIcon column="price" /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-metal-border font-medium">
            {filtered.map((p: Product) => (
              <tr key={p.id} className="hover:bg-metal-dark/50 transition-colors group">
                <td className="px-8 py-5">
                  {editingBarcodeId === p.id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        className="w-32 text-xs p-2 border border-blue-500/30 rounded-lg outline-none font-mono font-bold"
                        value={newBarcode}
                        onChange={(e) => setNewBarcode(e.target.value)}
                        onBlur={() => handleBarcodeUpdate(p.id)}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col group/code cursor-pointer" onClick={() => { setEditingBarcodeId(p.id); setNewBarcode(p.barcode || ''); }}>
                      <div className="flex items-center gap-2 text-chrome-500 group-hover/code:text-blue-600 transition-colors">
                        <Barcode size={14}/>
                        <span className="font-mono text-xs font-bold">{p.barcode || 'N/A'}</span>
                      </div>
                      {p.barcode && <div className="h-4 w-16 bg-[repeating-linear-gradient(90deg,black,black_1px,transparent_1px,transparent_3px)] mt-1 opacity-10"></div>}
                    </div>
                  )}
                </td>
                <td className="px-8 py-5">
                  {editingNameId === p.id ? (
                    <input 
                      className="w-full text-sm font-black text-chrome-100 uppercase p-2 border border-blue-500/30 rounded-lg outline-none"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onBlur={() => handleNameUpdate(p.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate(p.id)}
                      autoFocus
                    />
                  ) : (
                    <div className="group/name cursor-pointer" onClick={() => { setEditingNameId(p.id); setNewName(p.name); }}>
                       <div className="flex items-center gap-2">
                         <div className="font-black text-chrome-100 uppercase text-sm tracking-tight">{p.name}</div>
                         <Edit3 size={12} className="text-chrome-500 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                       </div>
                       <div className="text-[10px] text-chrome-500 font-black uppercase tracking-widest mt-0.5">{p.category}</div>
                    </div>
                  )}
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center justify-center gap-2">
                    <input 
                      type="number" 
                      className={`w-16 px-2 py-1.5 border rounded-xl text-xs font-black text-center outline-none transition-all ${p.quantity <= 5 ? 'bg-red-500/10 border-red-500/30 text-red-400 focus:ring-4 focus:ring-red-500/15' : 'bg-metal-dark border-metal-border text-chrome-200 focus:ring-4 focus:ring-blue-500/15'}`}
                      value={p.quantity}
                      onChange={(e) => handleQuantityUpdate(p.id, Number(e.target.value))}
                    />
                    {p.quantity <= 5 && <AlertCircle size={14} className="text-red-500 animate-pulse" />}
                  </div>
                </td>
                <td className="px-8 py-5 text-right font-bold text-chrome-500 text-sm">${Number(p.cost || 0).toFixed(2)}</td>
                <td className="px-8 py-5 text-right">
                  {editingId === p.id ? (
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-24 px-3 py-1.5 border border-blue-500/30 rounded-lg focus:ring-4 focus:ring-blue-500/15 outline-none font-black text-right text-sm"
                      value={newPrice}
                      onChange={(e) => setNewPrice(Number(e.target.value))}
                      autoFocus
                      onBlur={() => handlePriceUpdate(p.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePriceUpdate(p.id)}
                    />
                  ) : (
                    <span className="font-black text-blue-600 text-lg tracking-tighter">${Number(p.price || 0).toFixed(2)}</span>
                  )}
                </td>
                <td className="px-8 py-5">
                  <div className="flex justify-center gap-1">
                    <button 
                      onClick={() => { setEditingId(p.id); setNewPrice(p.price); }} 
                      title="Editar Precio"
                      className="p-2 text-chrome-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
                    >
                      <Edit3 size={18}/>
                    </button>
                    <button 
                      onClick={() => openHistory(p)} 
                      title="Auditoría de Movimientos (Kardex)"
                      className="p-2 text-chrome-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"
                    >
                      <History size={18}/>
                    </button>
                    <button 
                      onClick={() => openAudit(p)} 
                      title="Conteo Físico (Ajuste de Inventario)"
                      className="p-2 text-chrome-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-all"
                    >
                      <ClipboardCheck size={18}/>
                    </button>
                    <button 
                      onClick={() => regenerateBarcode(p.id)} 
                      title="Regenerar Código"
                      className="p-2 text-chrome-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"
                    >
                      <RotateCw size={18}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filtered.length === 0 && (
          <div className="py-32 text-center">
            <div className="w-20 h-20 bg-metal-dark rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-slate-200">
               <Package size={40} />
            </div>
            <p className="font-black text-chrome-500 uppercase tracking-widest text-xs">No se encontraron productos en el inventario</p>
          </div>
        )}
      </div>

      {/* MODAL BULK IMPORT — INTELIGENTE */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden border border-metal-border">

            {/* Header */}
            <div className="p-8 bg-gradient-to-r from-emerald-900/40 to-metal-darkest text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
                  <FileSpreadsheet size={24} className="text-emerald-400"/>
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Carga Masiva Inteligente</h3>
                  <p className="text-emerald-400/70 text-[10px] font-black uppercase tracking-widest mt-0.5">
                    {!bulkResult ? 'Sube tu archivo Excel para comparar con el inventario actual' :
                     `${bulkResult.updates.length} actualizaciones · ${bulkResult.newProducts.length} nuevos · ${bulkResult.unchanged.length} sin cambios`}
                  </p>
                </div>
              </div>
              <button onClick={() => { setShowBulkModal(false); setBulkResult(null); }} className="text-chrome-500 hover:text-white transition-colors p-2">
                <X size={24}/>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">

              {/* Step 1: Upload zone */}
              {!bulkResult && (
                <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-metal-border rounded-2xl bg-metal-dark/50 gap-4">
                  <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                    <UploadCloud size={40} className="text-emerald-400"/>
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-black text-chrome-100 uppercase">Selecciona tu archivo Excel</h4>
                    <p className="text-xs text-chrome-500 font-medium mt-1 max-w-sm">
                      Usa <strong>"Descargar Excel"</strong> para obtener la plantilla. Rellena <strong>"Cantidad Contada"</strong> y sube el archivo aquí.
                    </p>
                    <p className="text-[10px] text-chrome-500 mt-2">Productos nuevos serán detectados automáticamente si tienen cantidad.</p>
                  </div>
                  <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden"/>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-chrome px-10 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-95"
                  >
                    Seleccionar Archivo
                  </button>
                </div>
              )}

              {/* Step 2: Preview results */}
              {bulkResult && (
                <div className="space-y-6">

                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
                      <p className="text-3xl font-black text-blue-400">{bulkResult.updates.length}</p>
                      <p className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest mt-1">Stock a Actualizar</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                      <p className="text-3xl font-black text-emerald-400">{bulkResult.newProducts.length}</p>
                      <p className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest mt-1">Productos Nuevos</p>
                    </div>
                    <div className="bg-metal-dark border border-metal-border rounded-2xl p-4 text-center">
                      <p className="text-3xl font-black text-chrome-400">{bulkResult.unchanged.length}</p>
                      <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mt-1">Sin Cambios</p>
                    </div>
                  </div>

                  {/* Updates table */}
                  {bulkResult.updates.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <TrendingUp size={14}/> Actualizaciones de Stock ({bulkResult.updates.length})
                      </h4>
                      <div className="border border-metal-border rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-metal-dark border-b border-metal-border">
                            <tr>
                              <th className="px-5 py-3 font-black text-chrome-400 uppercase tracking-widest">Producto</th>
                              <th className="px-5 py-3 font-black text-chrome-400 uppercase tracking-widest text-center">Stock Sistema</th>
                              <th className="px-5 py-3 font-black text-chrome-400 uppercase tracking-widest text-center">Stock Físico</th>
                              <th className="px-5 py-3 font-black text-chrome-400 uppercase tracking-widest text-right">Diferencia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-metal-border">
                            {bulkResult.updates.map((item, idx) => (
                              <tr key={idx} className={item.diff < 0 ? 'bg-red-500/5' : 'bg-emerald-500/5'}>
                                <td className="px-5 py-3 font-bold text-chrome-100 max-w-[220px] truncate">{item.product.name}</td>
                                <td className="px-5 py-3 text-center text-chrome-400 font-bold">{item.oldQty}</td>
                                <td className="px-5 py-3 text-center font-black text-blue-400">{item.newQty}</td>
                                <td className={`px-5 py-3 text-right font-black text-lg ${item.diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {item.diff > 0 ? '+' : ''}{item.diff}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* New products table */}
                  {bulkResult.newProducts.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <CheckCircle size={14}/> Productos Nuevos a Agregar ({bulkResult.newProducts.length})
                      </h4>
                      <div className="border border-emerald-500/20 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-emerald-950/40 border-b border-emerald-500/20">
                            <tr>
                              <th className="px-5 py-3 font-black text-emerald-400/70 uppercase tracking-widest">Nombre</th>
                              <th className="px-5 py-3 font-black text-emerald-400/70 uppercase tracking-widest">Categoría</th>
                              <th className="px-5 py-3 font-black text-emerald-400/70 uppercase tracking-widest text-center">Cantidad</th>
                              <th className="px-5 py-3 font-black text-emerald-400/70 uppercase tracking-widest text-right">Precio</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-500/10">
                            {bulkResult.newProducts.map((np, idx) => (
                              <tr key={idx} className="bg-emerald-500/5">
                                <td className="px-5 py-3 font-bold text-chrome-100 max-w-[200px] truncate">{np.name}</td>
                                <td className="px-5 py-3 text-chrome-400">{np.category}</td>
                                <td className="px-5 py-3 text-center font-black text-emerald-400">{np.quantity}</td>
                                <td className="px-5 py-3 text-right text-chrome-400">${np.price.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-emerald-500/70 font-bold mt-2 flex items-center gap-1">
                        <AlertCircle size={11}/> Se generará un código de barras automático para productos nuevos sin código.
                      </p>
                    </div>
                  )}

                  {/* Unchanged info */}
                  {bulkResult.unchanged.length > 0 && (
                    <div className="bg-metal-dark/50 border border-metal-border rounded-2xl p-4 flex items-center gap-3">
                      <CheckCircle size={18} className="text-chrome-500 shrink-0"/>
                      <p className="text-[11px] font-bold text-chrome-400">
                        <strong className="text-chrome-200">{bulkResult.unchanged.length} productos</strong> ya tienen la misma cantidad o no tenían "Cantidad Contada" — no se modificarán.
                      </p>
                    </div>
                  )}

                  <div className="text-center">
                    <button
                      onClick={() => { setBulkResult(null); setTimeout(() => fileInputRef.current?.click(), 50); }}
                      className="text-xs font-black text-chrome-500 uppercase tracking-widest hover:text-blue-400 transition-colors underline underline-offset-4"
                    >
                      Cambiar archivo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {bulkResult && (
              <div className="p-6 border-t border-metal-border bg-metal-dark shrink-0 flex gap-4">
                <button
                  onClick={() => { setShowBulkModal(false); setBulkResult(null); }}
                  className="flex-1 py-4 text-chrome-500 font-black uppercase text-[10px] tracking-widest hover:text-chrome-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={processBulkUpdate}
                  disabled={bulkResult.updates.length === 0 && bulkResult.newProducts.length === 0}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/25 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16}/>
                  Confirmar: {bulkResult.updates.length} actualizaciones + {bulkResult.newProducts.length} nuevos
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE HISTORIAL (KARDEX) */}
      {showHistoryModal && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in duration-300">
            <div className="p-10 bg-metal-darkest text-white flex justify-between items-start relative overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-5">
                  <History size={150} />
               </div>
               <div className="relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                      <History size={20} />
                    </div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">Kardex de Producto</h3>
                  </div>
                  <div className="mt-4">
                    <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em]">Auditoría de Entradas y Salidas</p>
                    <p className="text-chrome-500 font-bold text-xl uppercase tracking-tight mt-1">{selectedProduct.name}</p>
                    <p className="text-chrome-400 text-[10px] font-black uppercase tracking-widest mt-1">Barcode: {selectedProduct.barcode || 'N/A'}</p>
                  </div>
               </div>
               <button onClick={() => setShowHistoryModal(false)} className="w-12 h-12 flex items-center justify-center bg-metal-mid/5 hover:bg-metal-mid/10 rounded-2xl transition-all relative z-10 text-white">
                 <X size={24} />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-metal-dark/50">
              {(() => {
                const history = getProductMovements(selectedProduct);
                return history.length > 0 ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="bg-metal-mid p-6 rounded-[2rem] border border-metal-border shadow-sm">
                          <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-1">Stock Actual (Sistema)</p>
                          <p className="text-3xl font-black text-chrome-100 tracking-tighter">{selectedProduct.quantity} u.</p>
                       </div>
                       <div className="bg-metal-mid p-6 rounded-[2rem] border border-metal-border shadow-sm">
                          <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-1">Total Movimientos</p>
                          <p className="text-3xl font-black text-blue-600 tracking-tighter">{history.length}</p>
                       </div>
                       <div className="bg-metal-mid p-6 rounded-[2rem] border border-metal-border shadow-sm">
                          <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-1">Último Costo</p>
                          <p className="text-3xl font-black text-emerald-600 tracking-tighter">${selectedProduct.cost.toFixed(2)}</p>
                       </div>
                    </div>

                    <div className="bg-metal-mid rounded-[2rem] border border-metal-border overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-metal-dark border-b border-metal-border">
                            <th className="px-6 py-4 text-[9px] font-black text-chrome-500 uppercase tracking-widest">Fecha</th>
                            <th className="px-6 py-4 text-[9px] font-black text-chrome-500 uppercase tracking-widest text-center">Tipo</th>
                            <th className="px-6 py-4 text-[9px] font-black text-chrome-500 uppercase tracking-widest">Referencia / Documento</th>
                            <th className="px-6 py-4 text-[9px] font-black text-chrome-500 uppercase tracking-widest text-center">Cantidad</th>
                            <th className="px-6 py-4 text-[9px] font-black text-chrome-500 uppercase tracking-widest text-right">Valor Unit.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-metal-border">
                          {history.map((h) => (
                            <tr key={`${h.type}-${h.id}`} className="hover:bg-metal-dark/80 transition-colors group">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2 text-chrome-400">
                                   <Calendar size={12} className="text-chrome-500" />
                                   <span className="text-xs font-bold">{new Date(h.date).toLocaleDateString()}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${h.type === 'ENTRADA' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-red-500/15 text-red-400 border-red-500/20'}`}>
                                   {h.type === 'ENTRADA' ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {h.type}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                   <span className="text-xs font-black text-chrome-100 uppercase truncate max-w-[150px]">{h.reference}</span>
                                   <span className="text-[9px] font-bold text-chrome-500">{h.doc}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-xs font-black text-chrome-100 bg-metal-mid px-3 py-1 rounded-full">
                                    {h.type === 'SALIDA' ? '-' : '+'}{h.quantity}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="text-xs font-black text-chrome-400">${Number(h.price || 0).toFixed(2)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="py-24 text-center">
                     <div className="w-16 h-16 bg-metal-mid rounded-2xl flex items-center justify-center mx-auto mb-4 text-chrome-500">
                        <History size={32} />
                     </div>
                     <p className="font-black text-chrome-500 uppercase tracking-widest text-[10px]">Sin movimientos registrados</p>
                     <p className="text-chrome-500 text-[9px] mt-1 italic">No hay compras ni ventas vinculadas a este producto aún.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AUDITORÍA FÍSICA (CONTEO) */}
      {showAuditModal && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300 border border-metal-border">
             <div className="p-8 bg-metal-mid border-b border-metal-border text-center relative">
                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange-400">
                   <ClipboardCheck size={32} />
                </div>
                <h3 className="text-2xl font-black text-chrome-100 uppercase tracking-tight">Ajuste de Stock</h3>
                <p className="text-chrome-500 text-[10px] font-bold uppercase tracking-widest mt-1">Conteo Físico vs. Sistema</p>
                <button onClick={() => setShowAuditModal(false)} className="absolute top-6 right-6 text-chrome-500 hover:text-chrome-400">
                    <X size={24} />
                </button>
             </div>
             
             <div className="p-8 space-y-6">
                <div className="bg-metal-dark p-6 rounded-2xl border border-metal-border flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest">Stock en Sistema</p>
                        <p className="text-3xl font-black text-chrome-100">{selectedProduct.quantity} <span className="text-sm text-chrome-500 font-bold">Unid.</span></p>
                    </div>
                    <ArrowRight size={24} className="text-chrome-500" />
                    <div className="text-right">
                        <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest">Diferencia</p>
                        <p className={`text-3xl font-black ${physicalCount - selectedProduct.quantity < 0 ? 'text-red-500' : physicalCount - selectedProduct.quantity > 0 ? 'text-emerald-500' : 'text-chrome-500'}`}>
                            {physicalCount - selectedProduct.quantity > 0 ? '+' : ''}{physicalCount - selectedProduct.quantity}
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Conteo Físico Real</label>
                    <input 
                      type="number" 
                      autoFocus
                      className="w-full px-6 py-4 bg-metal-mid border-2 border-metal-border rounded-2xl outline-none focus:border-orange-500 text-center font-black text-2xl"
                      value={physicalCount}
                      onChange={(e) => setPhysicalCount(Number(e.target.value))}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Motivo del Ajuste</label>
                    <textarea 
                        className="w-full px-4 py-3 bg-metal-dark border border-metal-border rounded-xl outline-none focus:ring-4 focus:ring-orange-50 font-bold text-sm h-24 resize-none"
                        placeholder="Ej: Merma, Robo, Error de entrada, Devolución..."
                        value={auditReason}
                        onChange={(e) => setAuditReason(e.target.value)}
                    />
                </div>

                {physicalCount !== selectedProduct.quantity && (
                    <div className="flex items-start gap-2 bg-orange-500/10 p-3 rounded-xl">
                        <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0"/>
                        <p className="text-[10px] font-bold text-orange-800 leading-tight">
                            Esta acción modificará el inventario permanentemente. Asegúrese de que el conteo es correcto.
                        </p>
                    </div>
                )}

                <button 
                    onClick={submitAudit}
                    className="w-full btn-chrome py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"
                >
                    <Save size={18} /> Confirmar Ajuste
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryModule;
