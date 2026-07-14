import React, { useState, useMemo, useRef } from 'react';
import { Package, Search, Edit3, Barcode, X, Filter, ChevronDown, ArrowUp, ArrowDown, FileSpreadsheet, UploadCloud, CheckCircle, AlertCircle, TrendingUp, Download } from 'lucide-react';
import { Product } from '../types';
import { ProductModal } from '../components/ProductModal';

declare const XLSX: any;

const ConsignmentInventoryModule: React.FC<{ store: any }> = ({ store }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBarcodeId, setEditingBarcodeId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState(0);
  const [newBarcode, setNewBarcode] = useState('');
  const [newName, setNewName] = useState('');
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<Partial<Product> | undefined>(undefined);

  // Filtering & Sorting States
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // Bulk Import States
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStep, setBulkStep] = useState<'preview' | 'confirm'>('preview');
  const [bulkResult, setBulkResult] = useState<{
    updates: { product: Product; oldQty: number; newQty: number; diff: number }[];
    newProducts: { name: string; category: string; price: number; cost: number; quantity: number; barcode?: string; supplier: string }[];
    unchanged: { product: Product }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived Data for Filters (Only Consignment)
  const consignmentProducts = useMemo(() => 
    (store.inventory || []).filter((p: any) => p.isConsignment)
  , [store.inventory]);

  const categories = useMemo(() => 
    Array.from(new Set(consignmentProducts.map((p: Product) => p.category))).filter(Boolean).sort()
  , [consignmentProducts]);

  // Filtered and Sorted Inventory
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    
    let result = consignmentProducts.filter((p: Product) => {
      const name = String(p.name || '').toLowerCase();
      const category = String(p.category || '').toLowerCase();
      const barcode = String(p.barcode || '').toLowerCase();
      
      return name.includes(term) || category.includes(term) || barcode.includes(term);
    });

    if (categoryFilter) {
      result = result.filter((p: Product) => p.category === categoryFilter);
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
  }, [consignmentProducts, searchTerm, categoryFilter, sortConfig]);

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

  const handleSaveProduct = async (productData: Partial<Product>) => {
    if (productData.id) {
      await store.updateProductFull(productData.id, productData);
    } else {
      await store.addProduct(productData as Product);
    }
  };

  const handleDownloadExcel = () => {
    if (typeof XLSX === 'undefined') {
        alert("La librería de Excel no se ha cargado correctamente. Verifique su conexión a internet.");
        return;
    }

    const data = consignmentProducts.map((p: any) => ({
      "Código de Barras": p.barcode || '',
      "Producto": p.name,
      "Categoría": p.category,
      "Proveedor": p.supplier || 'Proveedor Consignación',
      "Costo": p.cost || 0,
      "Precio": p.price || 0,
      "Cantidad Teórica": p.quantity,
      "Cantidad Contada": "" // Empty for manual entry
    }));

    // Generate template if empty
    if (data.length === 0) {
      data.push({
        "Código de Barras": "123456789",
        "Producto": "Filtro Aceite Toyota",
        "Categoría": "Filtros",
        "Proveedor": "Distribuidora AutoParts",
        "Costo": 5.00,
        "Precio": 12.00,
        "Cantidad Teórica": 0,
        "Cantidad Contada": 20
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    
    const wscols = [
      { wch: 20 }, // Barcode
      { wch: 40 }, // Name
      { wch: 20 }, // Category
      { wch: 25 }, // Supplier
      { wch: 12 }, // Cost
      { wch: 12 }, // Price
      { wch: 15 }, // Theoretical
      { wch: 15 }  // Counted
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Consignación");
    XLSX.writeFile(workbook, `Inventario_Consignacion_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        const newProducts: { name: string; category: string; price: number; cost: number; quantity: number; barcode?: string; supplier: string }[] = [];
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
          const supplier = String(getCol('Proveedor') ?? '').trim() || 'Proveedor Externo';
          const priceRaw = getCol('Precio');
          const costRaw = getCol('Costo');

          if (!name) return;
          if (processedNames.has(name.toLowerCase())) return;
          processedNames.add(name.toLowerCase());

          const hasQty = quantityRaw !== undefined && quantityRaw !== '';
          const quantity = hasQty ? Number(String(quantityRaw).trim()) : NaN;

          let product: Product | undefined;
          if (barcode) {
            product = consignmentProducts.find((p: Product) => String(p.barcode).trim() === barcode);
          }
          if (!product && name) {
            product = consignmentProducts.find((p: Product) => p.name.trim().toLowerCase() === name.toLowerCase());
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
            if (hasQty && !isNaN(quantity) && name) {
              newProducts.push({
                name,
                category: category || 'Consignación',
                supplier,
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

    if (updates.length > 0) {
      const stockUpdates = updates.map(u => ({ id: u.product.id, quantity: u.newQty }));
      await store.updateStockBatch(stockUpdates);
    }

    for (const np of newProducts) {
      const newProduct: any = {
        id: Math.random().toString(36).substr(2, 9),
        barcode: np.barcode || store.generateBarcode(),
        name: np.name,
        category: np.category,
        quantity: np.quantity,
        cost: np.cost,
        price: np.price,
        isConsignment: true,
        supplier: np.supplier,
        lastEntry: new Date().toISOString().split('T')[0]
      };
      await store.addProduct(newProduct);
    }

    setShowBulkModal(false);
    setBulkResult(null);
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
          <h3 className="text-3xl font-black text-chrome-100 tracking-tighter uppercase">Inventario de Consignación</h3>
          <p className="text-chrome-400 font-medium">Gestión de productos de proveedores externos por consignación</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button 
             onClick={handleDownloadExcel}
             className="btn-chrome px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-black shadow-lg shadow-metal-border transition-all active:scale-95"
          >
             <Download size={18}/> Descargar Plantilla
          </button>
          <button 
             onClick={() => { setModalInitialData(undefined); setIsProductModalOpen(true); }}
             className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
             <Package size={18}/> Nueva Consignación
          </button>
          <button 
             onClick={() => setShowBulkModal(true)}
             className="bg-purple-600 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-purple-700 shadow-lg shadow-purple-100 transition-all active:scale-95"
          >
             <FileSpreadsheet size={18}/> Cargar Lista de Consignación
          </button>
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18}/>
            <input 
              type="text" 
              placeholder="Buscar consignación..." 
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

        {categoryFilter && (
          <button 
            onClick={() => setCategoryFilter('')}
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
        <div className="w-full overflow-x-auto custom-scrollbar">
        <table className="w-full text-left min-w-[800px]">
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
                <div className="flex items-center justify-end">Costo Consig. ($) <SortIcon column="cost" /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-right cursor-pointer hover:bg-metal-mid transition-colors" onClick={() => handleSort('price')}>
                <div className="flex items-center justify-end">Precio Venta ($) <SortIcon column="price" /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-center">Proveedor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-metal-border font-medium">
            {filtered.map((p: any) => (
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
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center gap-2">
                      <input 
                        type="number" 
                        className={`w-16 px-2 py-1.5 border rounded-xl text-xs font-black text-center outline-none transition-all ${p.quantity <= 5 ? 'bg-red-500/10 border-red-500/30 text-red-400 focus:ring-4 focus:ring-red-500/15' : 'bg-metal-dark border-metal-border text-chrome-200 focus:ring-4 focus:ring-purple-500/15'}`}
                        value={p.quantity}
                        onChange={(e) => handleQuantityUpdate(p.id, Number(e.target.value))}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5 text-right font-bold text-chrome-500 text-sm">${Number(p.cost || 0).toFixed(2)}</td>
                <td className="px-8 py-5 text-right">
                  {editingId === p.id ? (
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-24 px-3 py-1.5 border border-purple-500/30 rounded-lg focus:ring-4 focus:ring-purple-500/15 outline-none font-black text-right text-sm"
                      value={newPrice}
                      onChange={(e) => setNewPrice(Number(e.target.value))}
                      autoFocus
                      onBlur={() => handlePriceUpdate(p.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePriceUpdate(p.id)}
                    />
                  ) : (
                    <div className="flex items-center justify-end gap-3">
                      <span className="font-black text-purple-400 text-lg tracking-tighter">${Number(p.price || 0).toFixed(2)}</span>
                      <button 
                        onClick={() => { setModalInitialData(p); setIsProductModalOpen(true); }} 
                        title="Editar Producto"
                        className="p-2 text-chrome-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
                      >
                        <Edit3 size={18}/>
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-8 py-5 text-center">
                  <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {p.supplier || 'N/A'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        
        {filtered.length === 0 && (
          <div className="py-32 text-center">
            <div className="w-20 h-20 bg-metal-dark rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-purple-400/50 border border-purple-500/10">
               <Package size={40} />
            </div>
            <p className="font-black text-chrome-500 uppercase tracking-widest text-xs">No hay productos en consignación</p>
          </div>
        )}
      </div>

      {/* MODAL BULK IMPORT — CONSIGNACIÓN */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-metal-mid rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden border border-metal-border">

            {/* Header */}
            <div className="p-8 bg-gradient-to-r from-purple-900/40 to-metal-darkest text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center">
                  <FileSpreadsheet size={24} className="text-purple-400"/>
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Carga Masiva de Consignación</h3>
                  <p className="text-purple-400/70 text-[10px] font-black uppercase tracking-widest mt-0.5">
                    {!bulkResult ? 'Sube listas de proveedores externos' :
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
                  <div className="w-20 h-20 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center">
                    <UploadCloud size={40} className="text-purple-400"/>
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-black text-chrome-100 uppercase">Selecciona lista de Consignación</h4>
                    <p className="text-xs text-chrome-500 font-medium mt-1 max-w-sm">
                      Usa <strong>"Descargar Plantilla"</strong> para obtener el formato correcto. Todos los productos ingresados serán marcados como consignación.
                    </p>
                  </div>
                  <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden"/>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-10 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-purple-900/20 transition-all active:scale-95"
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
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 text-center">
                      <p className="text-3xl font-black text-purple-400">{bulkResult.newProducts.length}</p>
                      <p className="text-[10px] font-black text-purple-400/70 uppercase tracking-widest mt-1">Productos Nuevos</p>
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
                      <div className="flex-1 bg-metal-dark/30 rounded-xl p-4 border border-metal-border overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-xs min-w-[300px]">
                          <thead className="bg-metal-dark border-b border-metal-border">
                            <tr>
                              <th className="px-5 py-3 font-black text-chrome-400 uppercase tracking-widest">Producto</th>
                              <th className="px-5 py-3 font-black text-chrome-400 uppercase tracking-widest text-center">Stock Sistema</th>
                              <th className="px-5 py-3 font-black text-chrome-400 uppercase tracking-widest text-center">Nuevo Stock</th>
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
                      <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <CheckCircle size={14}/> Nuevos en Consignación ({bulkResult.newProducts.length})
                      </h4>
                      <div className="border border-purple-500/20 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-purple-950/40 border-b border-purple-500/20">
                            <tr>
                              <th className="px-5 py-3 font-black text-purple-400/70 uppercase tracking-widest">Nombre</th>
                              <th className="px-5 py-3 font-black text-purple-400/70 uppercase tracking-widest">Proveedor</th>
                              <th className="px-5 py-3 font-black text-purple-400/70 uppercase tracking-widest text-center">Cantidad</th>
                              <th className="px-5 py-3 font-black text-purple-400/70 uppercase tracking-widest text-right">Costo / Precio</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-500/10">
                            {bulkResult.newProducts.map((np, idx) => (
                              <tr key={idx} className="bg-purple-500/5">
                                <td className="px-5 py-3 font-bold text-chrome-100 max-w-[200px] truncate">{np.name}</td>
                                <td className="px-5 py-3 text-purple-300 font-bold">{np.supplier}</td>
                                <td className="px-5 py-3 text-center font-black text-purple-400">{np.quantity}</td>
                                <td className="px-5 py-3 text-right text-chrome-400">${np.cost.toFixed(2)} / ${np.price.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-purple-500/70 font-bold mt-2 flex items-center gap-1">
                        <AlertCircle size={11}/> Los productos se marcarán automáticamente como Consignación.
                      </p>
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Footer */}
            {bulkResult && (
              <div className="p-6 border-t border-metal-border bg-metal-dark flex justify-end gap-4 shrink-0">
                <button 
                  onClick={() => { setBulkResult(null); setBulkStep('preview'); }}
                  className="px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest text-chrome-500 hover:text-white hover:bg-metal-mid transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={processBulkUpdate}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-purple-900/20 transition-all active:scale-95"
                >
                  Confirmar y Guardar Consignación
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        initialData={modalInitialData}
        isConsignmentMode={true}
      />
    </div>
  );
};

export default ConsignmentInventoryModule;
