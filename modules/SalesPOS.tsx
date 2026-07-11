
import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  Search, 
  Barcode, 
  UserRound, 
  X, 
  DollarSign, 
  Wallet, 
  ChevronDown, 
  TrendingUp,
  Clock,
  ArrowUpRight,
  Receipt,
  Percent,
  Tag,
  BarChart3,
  Package,
  ClipboardList,
  FileText
} from 'lucide-react';
import { Product, PaymentMethod, Sale, Customer } from '../types';

const LOGO_URL = "https://i.ibb.co/MDhy5tzK/image-2.png";

const SalesPOS: React.FC<{ store: any }> = ({ store }) => {
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo $');
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [ivaEnabled, setIvaEnabled] = useState(false);
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (barcodeInput.length >= 8) {
      const product = store.inventory.find((p: Product) => p.barcode === barcodeInput);
      if (product) {
        addToCart(product);
        setBarcodeInput('');
      }
    }
  }, [barcodeInput]);

  const filteredProducts = store.inventory.filter((p: Product) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.quantity > 0
  );

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.quantity) return;
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === id) {
        const newQty = Math.max(1, Math.min(item.product.quantity, item.quantity + delta));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => setCart(cart.filter(item => item.product.id !== id));

  const subtotal = cart.reduce((acc, item) => acc + (Number(item.product.price || 0) * item.quantity), 0);
  const iva = ivaEnabled ? subtotal * 0.16 : 0;
  const total = subtotal + iva;

  const processSale = () => {
    if (cart.length === 0) return;
    
    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      customerId: selectedCustomer?.id,
      date: new Date().toISOString().split('T')[0],
      customerName: selectedCustomer?.name || 'Cliente General',
      items: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: Number(item.product.price || 0),
        quantity: item.quantity
      })),
      total,
      iva: ivaEnabled,
      paymentMethod
    };

    store.addSale(newSale);
    setLastSale(newSale);
    setShowReceiptModal(true);

    // Disparar impresión automática al procesar
    setTimeout(() => {
      window.print();
    }, 500);
    
    setCart([]);
    setSelectedCustomer(null);
  };

  const getDailyTotals = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = store.sales.filter((s: Sale) => s.date === today);
    
    const totalsByMethod = todaySales.reduce((acc: any, sale: Sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + Number(sale.total || 0);
      return acc;
    }, {});

    const totalUSD = todaySales.reduce((acc: number, s: Sale) => acc + Number(s.total || 0), 0);
    const totalBS = totalUSD * Number(store.exchangeRate || 0);

    const itemsSold = todaySales.flatMap(s => s.items).reduce((acc: number, item) => acc + item.quantity, 0);

    // Agregación de ítems para estadísticas
    const itemsStats = todaySales.flatMap(s => s.items).reduce((acc: any, item) => {
      if (!acc[item.name]) {
        acc[item.name] = { name: item.name, qty: 0, val: 0 };
      }
      acc[item.name].qty += item.quantity;
      acc[item.name].val += (item.price * item.quantity);
      return acc;
    }, {});

    const topItemsByQty = Object.values(itemsStats)
      .sort((a: any, b: any) => b.qty - a.qty)
      .slice(0, 5);

    const topItemsByValue = Object.values(itemsStats)
      .sort((a: any, b: any) => b.val - a.val)
      .slice(0, 5);

    const ticketPromedio = todaySales.length > 0 ? totalUSD / todaySales.length : 0;

    return { 
      totalsByMethod, 
      totalUSD, 
      totalBS, 
      count: todaySales.length, 
      topItemsByQty,
      topItemsByValue, 
      todaySales,
      itemsSold,
      ticketPromedio 
    };
  };

  const dailyStats = showDailyReport ? getDailyTotals() : null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-full relative">
      <div className="flex flex-1 h-full print:hidden">
        <div className="flex-1 p-8 border-r border-metal-border overflow-y-auto custom-scrollbar bg-metal-dark/30">
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18}/>
              <input 
                type="text" 
                placeholder="Buscar repuesto por nombre..." 
                className="w-full pl-12 pr-4 py-3 bg-metal-mid border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 transition-all shadow-sm font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative w-72">
              <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={18}/>
              <input 
                ref={barcodeRef}
                type="text" 
                placeholder="Escanear Código..." 
                className="w-full pl-12 pr-4 py-3 border-2 border-blue-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 bg-blue-50/30 font-mono text-sm font-bold"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p: Product) => (
              <button 
                key={p.id}
                onClick={() => addToCart(p)}
                className="bg-metal-mid p-5 rounded-3xl border border-metal-border hover:border-blue-500 hover:shadow-xl hover:shadow-blue-900/5 transition-all text-left flex flex-col justify-between group relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] bg-metal-mid px-2.5 py-1 rounded-full font-black uppercase text-chrome-400 tracking-widest">{p.category}</span>
                    {p.quantity <= 5 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                  </div>
                  <h4 className="font-bold text-chrome-100 mt-3 truncate group-hover:text-blue-600 uppercase text-xs tracking-tight">{p.name}</h4>
                  <p className="text-[10px] text-chrome-500 font-bold uppercase mt-1">Stock: {p.quantity} unid.</p>
                </div>
                <div className="mt-6 flex items-end justify-between relative z-10">
                  <p className="font-black text-blue-600 text-2xl tracking-tighter">${Number(p.price || 0).toFixed(2)}</p>
                  <div className="w-8 h-8 rounded-xl bg-metal-dark flex items-center justify-center text-chrome-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Plus size={16} />
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -translate-y-12 translate-x-12 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            ))}
          </div>
        </div>

        <div className="w-[400px] bg-metal-mid p-8 flex flex-col shadow-2xl border-l border-metal-border relative z-20">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-metal-border p-2">
                <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="text-xl font-black text-chrome-100 uppercase tracking-tighter leading-none">Caja POS</h3>
                <p className="text-[10px] font-bold text-chrome-500 uppercase tracking-widest mt-1">Facturación Directa</p>
              </div>
            </div>
            <div className="flex gap-2">
              {lastSale && (
                <button 
                  onClick={() => setShowReceiptModal(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all border border-blue-100"
                  title="Re-imprimir última venta"
                >
                  <FileText size={20} />
                </button>
              )}
              <button 
                onClick={() => setShowDailyReport(true)}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-chrome-500 hover:bg-metal-dark hover:text-chrome-200 transition-all border border-metal-border"
                title="Reporte de Caja Diario"
              >
                <ClipboardList size={22} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 mb-6 custom-scrollbar pr-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-chrome-500 opacity-40">
                 <ShoppingCart size={64} className="mb-4 stroke-[1.5]"/>
                 <p className="text-xs font-black uppercase tracking-[0.2em] italic">Carrito Vacío</p>
              </div>
            ) : cart.map(item => (
              <div key={item.product.id} className="bg-metal-dark/50 p-4 rounded-[2rem] border border-metal-border flex gap-4 group animate-in slide-in-from-right-2 duration-300 hover:bg-metal-mid hover:shadow-md transition-all">
                <div className="flex-1 min-w-0">
                  <h5 className="font-black text-xs text-chrome-100 truncate uppercase tracking-tight">{item.product.name}</h5>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2 bg-metal-mid px-2 py-1 rounded-xl border border-metal-border shadow-sm">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 flex items-center justify-center text-chrome-500 hover:text-blue-600"><Minus size={12}/></button>
                      <span className="font-black text-xs text-chrome-200 w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 flex items-center justify-center text-chrome-500 hover:text-blue-600"><Plus size={12}/></button>
                    </div>
                    <span className="text-[10px] font-bold text-chrome-500 uppercase">x ${Number(item.product.price || 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right flex flex-col justify-between items-end">
                  <button onClick={() => removeFromCart(item.product.id)} className="text-chrome-500 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                  <span className="font-black text-chrome-100 text-sm tracking-tighter">${(Number(item.product.price || 0) * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 border-t border-metal-border pt-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <UserRound size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none"/>
                <select 
                  className="w-full pl-10 pr-4 py-3 bg-metal-dark border border-metal-border rounded-xl text-[10px] outline-none font-black uppercase tracking-widest cursor-pointer appearance-none focus:border-blue-500 transition-all"
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const customer = store.customers.find((c: Customer) => c.id === e.target.value);
                    setSelectedCustomer(customer || null);
                  }}
                >
                  <option value="">Cliente General</option>
                  {store.customers.map((c: Customer) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Wallet size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none" />
                <select 
                  className="w-full pl-10 pr-8 py-3 bg-metal-dark border border-metal-border rounded-xl text-[10px] font-black uppercase tracking-widest appearance-none outline-none focus:border-blue-500 transition-all cursor-pointer"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  {['Efectivo $', 'Efectivo Bs', 'Pago Móvil', 'TDD', 'TDC', 'Zelle'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none" />
              </div>
            </div>

            <button 
              onClick={() => setIvaEnabled(!ivaEnabled)}
              className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${ivaEnabled ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-metal-dark border-metal-border text-chrome-500'}`}
            >
              <Percent size={14}/> {ivaEnabled ? 'IVA Incluido (16%)' : 'Sin IVA'}
            </button>

            <div className="py-6 border-y border-metal-border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-chrome-500 uppercase tracking-widest">Subtotal</span>
                <span className="text-sm font-bold text-chrome-200">${Number(subtotal).toFixed(2)}</span>
              </div>
              {ivaEnabled && (
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-chrome-500 uppercase tracking-widest">I.V.A (16%)</span>
                  <span className="text-sm font-bold text-chrome-200">${Number(iva).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                <span className="text-[10px] font-black text-chrome-500 uppercase tracking-[0.2em]">Total a Pagar</span>
                <span className="text-4xl font-black text-blue-600 tracking-tighter leading-none">${Number(total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-[9px] font-bold text-chrome-500 uppercase italic">Tasa: {store.exchangeRate} Bs/$</span>
                <span className="text-xs font-black text-chrome-400">{(Number(total) * Number(store.exchangeRate)).toLocaleString('es-VE')} Bs</span>
              </div>
            </div>

            <button 
              disabled={cart.length === 0}
              onClick={processSale}
              className="w-full btn-chrome py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-black shadow-2xl shadow-metal-border disabled:bg-metal-mid disabled:text-chrome-500 disabled:shadow-none transition-all active:scale-95"
            >
              <Receipt size={20}/> Procesar Venta
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Invisible para Impresión (Factura de Venta) */}
      {showReceiptModal && lastSale && !showDailyReport && (
        <div className="print-only p-8 bg-metal-mid text-chrome-100 w-full" style={{ maxWidth: '80mm' }}>
          <div className="text-center mb-6">
            <img src={LOGO_URL} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" />
            <h1 className="text-xl font-black uppercase tracking-tighter">Gonzacars C.A.</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest">R.I.F. J-50030426-9</p>
            <p className="text-[8px] font-medium leading-tight">Av. Bolivar norte; Calle Miranda, Local 113-109C<br/>Valencia 2001, Carabobo</p>
          </div>

          <div className="border-y-2 border-dashed border-slate-900 py-3 mb-4 text-[10px]">
            <div className="flex justify-between">
              <span className="font-bold">Factura No:</span>
              <span className="font-black">#{lastSale.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Fecha:</span>
              <span>{new Date(lastSale.date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-bold">Cliente:</span>
              <span className="uppercase font-black truncate max-w-[150px]">{lastSale.customerName}</span>
            </div>
          </div>

          <table className="w-full text-[10px] mb-6">
            <thead className="border-b border-slate-900">
              <tr>
                <th className="text-left py-1 font-black uppercase">Prod</th>
                <th className="text-center py-1 font-black uppercase">Cant</th>
                <th className="text-right py-1 font-black uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {lastSale.items.map((item, idx) => (
                <tr key={idx} className="border-b border-metal-border">
                  <td className="py-2 pr-2">
                    <span className="block font-bold uppercase text-[9px] leading-tight">{item.name}</span>
                    <span className="text-[8px] text-chrome-400">${Number(item.price).toFixed(2)} c/u</span>
                  </td>
                  <td className="text-center py-2 font-bold">{item.quantity}</td>
                  <td className="text-right py-2 font-black">${(Number(item.price) * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 mb-6">
            {lastSale.iva && (
               <div className="flex justify-between text-[10px]">
                <span className="uppercase">IVA (16%):</span>
                <span>${(Number(lastSale.total) * 0.16).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-black">
              <span className="uppercase">Total USD:</span>
              <span>${Number(lastSale.total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] font-black italic text-chrome-200">
              <span className="uppercase">Total BS:</span>
              <span>{(Number(lastSale.total) * Number(store.exchangeRate)).toLocaleString('es-VE')} Bs</span>
            </div>
            <div className="flex justify-between text-[9px] font-bold pt-2">
              <span className="uppercase tracking-widest">Pago:</span>
              <span className="uppercase">{lastSale.paymentMethod}</span>
            </div>
          </div>

          <div className="text-center border-t-2 border-dashed border-slate-900 pt-4">
            <p className="text-[10px] font-black uppercase tracking-tighter">¡Gracias por su compra!</p>
            <p className="text-[8px] font-medium italic mt-1">Gonzacars: Calidad y Confianza en cada repuesto.</p>
          </div>
        </div>
      )}

      {/* VISTA DE IMPRESIÓN DEL REPORTE DIARIO (Visible solo al imprimir) */}
      {dailyStats && (
        <div className="hidden print:block print-only bg-metal-mid text-chrome-100 p-8 w-full max-w-[216mm] mx-auto min-h-screen">
          <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Reporte de Cierre de Caja</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-chrome-400">Gonzacars C.A. | RIF: J-50030426-9</p>
            <p className="text-sm font-bold mt-2">FECHA: {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="border border-metal-border p-4 rounded-xl">
               <p className="text-[10px] font-black uppercase text-chrome-500 tracking-widest">Ventas Totales (USD)</p>
               <p className="text-4xl font-black text-chrome-100">${dailyStats.totalUSD.toFixed(2)}</p>
            </div>
            <div className="border border-metal-border p-4 rounded-xl">
               <p className="text-[10px] font-black uppercase text-chrome-500 tracking-widest">Ventas Totales (Bs)</p>
               <p className="text-4xl font-black text-chrome-100">{dailyStats.totalBS.toLocaleString('es-VE')} Bs</p>
            </div>
            <div className="border border-metal-border p-4 rounded-xl">
               <p className="text-[10px] font-black uppercase text-chrome-500 tracking-widest">Transacciones</p>
               <p className="text-2xl font-black text-chrome-100">{dailyStats.count} Operaciones</p>
            </div>
            <div className="border border-metal-border p-4 rounded-xl">
               <p className="text-[10px] font-black uppercase text-chrome-500 tracking-widest">Ticket Promedio</p>
               <p className="text-2xl font-black text-chrome-100">${dailyStats.ticketPromedio.toFixed(2)}</p>
            </div>
          </div>

          <div className="mb-8">
            <h4 className="text-xs font-black uppercase tracking-widest border-b border-metal-border pb-2 mb-4">Desglose por Método de Pago</h4>
            <table className="w-full text-xs">
               <thead>
                 <tr className="bg-metal-mid">
                    <th className="text-left py-2 px-2">Método</th>
                    <th className="text-right py-2 px-2">Total ($)</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {Object.entries(dailyStats.totalsByMethod).map(([method, amount]: [string, any]) => (
                    <tr key={method}>
                       <td className="py-2 px-2 font-bold uppercase">{method}</td>
                       <td className="py-2 px-2 text-right font-black">${Number(amount).toFixed(2)}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
          </div>

          <div className="mb-8">
             <h4 className="text-xs font-black uppercase tracking-widest border-b border-metal-border pb-2 mb-4">Productos Más Vendidos</h4>
             <table className="w-full text-xs">
               <thead>
                 <tr className="bg-metal-mid">
                    <th className="text-left py-2 px-2">Producto</th>
                    <th className="text-center py-2 px-2">Cant.</th>
                    <th className="text-right py-2 px-2">Total ($)</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {dailyStats.topItemsByValue.map((item: any, idx: number) => (
                    <tr key={idx}>
                       <td className="py-2 px-2 font-bold uppercase">{item.name}</td>
                       <td className="py-2 px-2 text-center">{item.qty}</td>
                       <td className="py-2 px-2 text-right font-black">${item.val.toFixed(2)}</td>
                    </tr>
                  ))}
               </tbody>
             </table>
          </div>

          <div className="mt-12 pt-8 border-t-2 border-slate-900 flex justify-between px-10">
             <div className="text-center">
                <div className="w-40 border-t border-slate-400 mb-2"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">Firma Cajero</p>
             </div>
             <div className="text-center">
                <div className="w-40 border-t border-slate-400 mb-2"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">Firma Supervisor</p>
             </div>
          </div>
        </div>
      )}

      {/* Modal de Reporte Diario UI (Arqueo en Pantalla) - OCULTO AL IMPRIMIR */}
      {showDailyReport && dailyStats && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 print:hidden">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-6xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-8 duration-500 border border-metal-border">
            <div className="p-10 bg-slate-950 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-5">
                 <BarChart3 size={160} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <ClipboardList size={24} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">Arqueo de Caja Diario</h3>
                    <p className="text-chrome-400 text-[10px] font-black uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
                      <Clock size={12}/> {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDailyReport(false)} className="w-12 h-12 flex items-center justify-center bg-metal-mid/5 hover:bg-metal-mid/10 rounded-2xl transition-all relative z-10 border border-white/5">
                <X size={24} />
              </button>
            </div>

            <div className="p-10 overflow-y-auto custom-scrollbar flex-1 bg-metal-dark/50">
              <div className="space-y-12">
                {/* Tarjetas Principales */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-metal-mid p-8 rounded-2xl border border-metal-border shadow-xl shadow-metal-border/50 relative group">
                    <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-2">Ingreso Bruto (USD)</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-chrome-100 tracking-tighter">${dailyStats.totalUSD.toFixed(2)}</span>
                      <ArrowUpRight size={20} className="text-emerald-500" />
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50">
                      <p className="text-[10px] font-black text-emerald-600 uppercase">En Bolívares</p>
                      <p className="text-xl font-black text-emerald-700 tracking-tight">{dailyStats.totalBS.toLocaleString('es-VE')} Bs</p>
                    </div>
                  </div>

                  <div className="bg-metal-mid p-8 rounded-2xl border border-metal-border shadow-xl shadow-metal-border/50">
                    <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-2">Ticket Promedio</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-blue-600 tracking-tighter">${dailyStats.ticketPromedio.toFixed(2)}</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50">
                      <p className="text-[10px] font-black text-chrome-500 uppercase">Volumen Diario</p>
                      <p className="text-xl font-black text-chrome-100">{dailyStats.count} Ventas</p>
                    </div>
                  </div>

                  <div className="bg-metal-mid p-8 rounded-2xl border border-metal-border shadow-xl shadow-metal-border/50">
                    <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mb-2">Artículos Vendidos</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-purple-600 tracking-tighter">{dailyStats.itemsSold}</span>
                      <Tag size={20} className="text-purple-200" />
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50">
                      <p className="text-[10px] font-black text-chrome-500 uppercase">Total Unidades</p>
                      <p className="text-xl font-black text-chrome-100">Salida de Stock</p>
                    </div>
                  </div>

                  <div className="bg-slate-900 p-8 rounded-2xl text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
                    <DollarSign className="absolute -bottom-4 -right-4 text-white/5" size={140} />
                    <div>
                      <p className="text-[10px] font-black text-chrome-400 uppercase tracking-widest mb-1">Tasa Ref.</p>
                      <p className="text-2xl font-black tracking-tight text-blue-400">{store.exchangeRate.toFixed(2)} Bs/$</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  {/* Desglose por Método */}
                  <div className="lg:col-span-12 space-y-6">
                    <div className="flex items-center justify-between border-b border-metal-border pb-4">
                      <h4 className="text-[10px] font-black text-chrome-100 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Wallet size={18} className="text-blue-500" /> Desglose por Método de Pago
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {['Efectivo $', 'Efectivo Bs', 'Pago Móvil', 'TDD', 'TDC', 'Zelle'].map((method) => {
                        const amount = Number(dailyStats.totalsByMethod[method] || 0);
                        return (
                          <div key={method} className="bg-metal-mid p-6 rounded-[2rem] border border-metal-border hover:shadow-xl transition-all group">
                            <span className="font-black text-chrome-500 text-[9px] uppercase block mb-3">{method}</span>
                            <p className="font-black text-slate-950 text-xl tracking-tighter">${amount.toFixed(2)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Productos por Cantidad */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-metal-border pb-4">
                      <h4 className="text-[10px] font-black text-chrome-100 uppercase tracking-[0.2em] flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-500" /> Top Vendidos (Cantidad)
                      </h4>
                    </div>
                    <div className="bg-metal-mid rounded-2xl border border-metal-border p-8 space-y-4 shadow-sm">
                      {dailyStats.topItemsByQty.map((item: any, idx: number) => {
                        const percentage = (item.qty / dailyStats.itemsSold) * 100;
                        return (
                          <div key={idx} className="space-y-2 group">
                            <div className="flex justify-between items-center">
                              <span className="font-black text-chrome-100 text-xs uppercase truncate max-w-[250px]">{item.name}</span>
                              <span className="font-black text-blue-600 text-xs bg-blue-50 px-3 py-1 rounded-full whitespace-nowrap">{item.qty} unid.</span>
                            </div>
                            <div className="h-1.5 w-full bg-metal-mid rounded-full overflow-hidden">
                                <div 
                                className="h-full bg-blue-600 rounded-full transition-all duration-1000" 
                                style={{ width: `${percentage}%` }}
                                />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Productos por Valor */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-metal-border pb-4">
                      <h4 className="text-[10px] font-black text-chrome-100 uppercase tracking-[0.2em] flex items-center gap-2">
                        <DollarSign size={18} className="text-emerald-500" /> Top Rendimiento (Valor)
                      </h4>
                    </div>
                    <div className="bg-metal-mid rounded-2xl border border-metal-border p-8 space-y-4 shadow-sm">
                      {dailyStats.topItemsByValue.map((item: any, idx: number) => {
                        const percentage = (item.val / dailyStats.totalUSD) * 100;
                        return (
                          <div key={idx} className="space-y-2 group">
                            <div className="flex justify-between items-center">
                              <span className="font-black text-chrome-100 text-xs uppercase truncate max-w-[250px]">{item.name}</span>
                              <span className="font-black text-emerald-600 text-xs bg-emerald-50 px-3 py-1 rounded-full whitespace-nowrap">${item.val.toFixed(2)}</span>
                            </div>
                            <div className="h-1.5 w-full bg-metal-mid rounded-full overflow-hidden">
                                <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                                style={{ width: `${percentage}%` }}
                                />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-metal-mid border-t border-metal-border flex gap-4 no-print">
              <button 
                onClick={() => window.print()}
                className="flex-1 bg-slate-950 text-white py-6 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] hover:bg-black transition-all shadow-2xl flex items-center justify-center gap-3"
              >
                <Printer size={20} /> Imprimir Reporte de Cierre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPOS;
