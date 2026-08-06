/* Hallmark · component: SalesPOS · genre: atmospheric-utilitarian · theme: Terminal-Workbench
 * macrostructure: Workbench (split-panel) · nav: N/A (embedded module) · footer: N/A
 * states: default · hover · active · disabled · loading(cart-bounce)
 * contrast: pass
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShoppingCart, User, Plus, Minus, Trash2, Search, Receipt,
  Wallet, Percent, Printer, FileText, ChevronDown, DollarSign,
  ScanBarcode as Barcode, X, TrendingUp, Clock, ArrowUpRight,
  BarChart3, Tag, ClipboardList, Zap, CreditCard, Smartphone,
  Banknote, Bitcoin, Package
} from 'lucide-react';
import { useGonzacarsStore } from '../store';
import { Product, Sale, Customer, PaymentMethod } from '../types';
import CurrencyBadge from '../components/CurrencyBadge';

const LOGO_URL = 'https://i.ibb.co/MDhy5tzK/image-2.png';

// Payment method config with icons and colors
const PAYMENT_METHODS: { id: PaymentMethod; label: string; short: string; icon: React.ReactNode; color: string }[] = [
  { id: 'Efectivo $',   label: 'Efectivo $',   short: 'USD',    icon: <DollarSign size={14} />,  color: '#34d399' },
  { id: 'Efectivo Bs',  label: 'Efectivo Bs',  short: 'Bs',     icon: <Banknote size={14} />,    color: '#fbbf24' },
  { id: 'Pago Móvil',   label: 'Pago Móvil',   short: 'Móvil',  icon: <Smartphone size={14} />,  color: '#60a5fa' },
  { id: 'TDD',          label: 'Tarjeta Déb.',  short: 'TDD',    icon: <CreditCard size={14} />,  color: '#a78bfa' },
  { id: 'TDC',          label: 'Tarjeta Créd.', short: 'TDC',    icon: <CreditCard size={14} />,  color: '#f472b6' },
  { id: 'Zelle',        label: 'Zelle',         short: 'Zelle',  icon: <Zap size={14} />,         color: '#38bdf8' },
  { id: 'Binance',      label: 'Binance',       short: 'Crypto', icon: <Bitcoin size={14} />,     color: '#fbbf24' },
];

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
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('TODOS');
  const [cartBounce, setCartBounce] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const cartIconRef = useRef<HTMLDivElement>(null);

  // Barcode scan handler
  useEffect(() => {
    if (barcodeInput.length >= 8) {
      const product = store.inventory.find((p: Product) => p.barcode === barcodeInput);
      if (product) { addToCart(product); setBarcodeInput(''); }
    }
  }, [barcodeInput]);

  // Derive categories from inventory
  const categories = ['TODOS', ...Array.from(new Set(
    store.inventory.filter((p: Product) => p.quantity > 0).map((p: Product) => p.category?.toUpperCase() || 'OTROS')
  )).sort() as string[]];

  // Filter products
  const filteredProducts = store.inventory.filter((p: Product) => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = activeCategory === 'TODOS' || (p.category?.toUpperCase() || 'OTROS') === activeCategory;
    return matchSearch && matchCat && p.quantity > 0;
  });

  const triggerCartBounce = () => {
    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 420);
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.quantity) return;
      setCart(cart.map(item =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    triggerCartBounce();
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
  const totalBS = total * Number(store.exchangeRate || 0);
  const cartQty = cart.reduce((a, b) => a + b.quantity, 0);

  const processSale = () => {
    if (cart.length === 0) return;
    const totalCost = cart.reduce((acc, item) => acc + ((Number(item.product.cost) || 0) * item.quantity), 0);
    const profit = total - totalCost;
    const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
    const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const hasConsignment = cart.some(item => (item.product as any).isConsignment === true);

    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      customerId: selectedCustomer?.id || '',
      date: new Date().toISOString().split('T')[0],
      customerName: selectedCustomer?.name || 'Cliente General',
      items: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: Number(item.product.price || 0),
        cost: Number(item.product.cost || 0),
        quantity: item.quantity
      })),
      total, iva: ivaEnabled, paymentMethod, totalCost, profit, profitMargin, hasConsignment
    };

    store.addSale(newSale);
    setLastSale(newSale);
    setShowReceiptModal(true);
    setTimeout(() => window.print(), 500);
    setCart([]);
    setSelectedCustomer(null);
  };

  // Daily stats
  const getDailyTotals = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = store.sales.filter((s: Sale) => s.date === today);
    const totalsByMethod = todaySales.reduce((acc: any, sale: Sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + Number(sale.total || 0);
      return acc;
    }, {});
    const totalUSD = todaySales.reduce((acc: number, s: Sale) => acc + Number(s.total || 0), 0);
    const totalBS = totalUSD * Number(store.exchangeRate || 0);
    const itemsSold = todaySales.flatMap((s: Sale) => s.items).reduce((acc: number, item: any) => acc + item.quantity, 0);
    const itemsStats = todaySales.flatMap((s: Sale) => s.items).reduce((acc: any, item: any) => {
      if (!acc[item.name]) acc[item.name] = { name: item.name, qty: 0, val: 0 };
      acc[item.name].qty += item.quantity;
      acc[item.name].val += (item.price * item.quantity);
      return acc;
    }, {});
    const topItemsByQty = Object.values(itemsStats).sort((a: any, b: any) => b.qty - a.qty).slice(0, 5);
    const topItemsByValue = Object.values(itemsStats).sort((a: any, b: any) => b.val - a.val).slice(0, 5);
    const ticketPromedio = todaySales.length > 0 ? totalUSD / todaySales.length : 0;
    return { totalsByMethod, totalUSD, totalBS, count: todaySales.length, topItemsByQty, topItemsByValue, todaySales, itemsSold, ticketPromedio };
  };

  // Inline daily stats for the bar (always computed)
  const today = new Date().toISOString().split('T')[0];
  const todaySales = store.sales.filter((s: Sale) => s.date === today);
  const dailyUSD = todaySales.reduce((acc: number, s: Sale) => acc + Number(s.total || 0), 0);
  const dailyBS = dailyUSD * Number(store.exchangeRate || 0);
  const dailyCount = todaySales.length;

  const dailyStats = showDailyReport ? getDailyTotals() : null;

  // ─── RECEIPT PRINT (invisible) ───────────────────────────────────────────
  const ReceiptPrint = () => {
    if (!showReceiptModal || !lastSale || showDailyReport) return null;
    return (
      <div className="print-only p-8 bg-white text-black w-full" style={{ maxWidth: '80mm' }}>
        <div className="text-center mb-6">
          <img src={LOGO_URL} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" />
          <h1 className="text-xl font-black uppercase tracking-tighter">Gonzacars C.A.</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest">R.I.F. J-50030426-9</p>
          <p className="text-[8px] font-medium leading-tight">Av. Bolivar norte; Calle Miranda, Local 113-109C<br />Valencia 2001, Carabobo</p>
        </div>
        <div className="border-y-2 border-dashed border-gray-300 py-3 mb-4 text-[10px]">
          <div className="flex justify-between"><span className="font-bold">Factura No:</span><span className="font-black">#{lastSale.id}</span></div>
          <div className="flex justify-between"><span className="font-bold">Fecha:</span><span>{new Date(lastSale.date).toLocaleDateString()}</span></div>
          <div className="flex justify-between mt-1"><span className="font-bold">Cliente:</span><span className="uppercase font-black truncate max-w-[150px]">{lastSale.customerName}</span></div>
        </div>
        <table className="w-full text-[10px] mb-6">
          <thead className="border-b border-gray-300">
            <tr><th className="text-left py-1 font-black uppercase">Prod</th><th className="text-center py-1 font-black uppercase">Cant</th><th className="text-right py-1 font-black uppercase">Total</th></tr>
          </thead>
          <tbody>
            {lastSale.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2 pr-2"><span className="block font-bold uppercase text-[9px] leading-tight">{item.name}</span><span className="text-[8px] text-gray-400">${Number(item.price).toFixed(2)} c/u</span></td>
                <td className="text-center py-2 font-bold">{item.quantity}</td>
                <td className="text-right py-2 font-black">${(Number(item.price) * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 mb-6">
          {lastSale.iva && (<div className="flex justify-between text-[10px]"><span className="uppercase">IVA (16%):</span><span>${(Number(lastSale.total) * 0.16).toFixed(2)}</span></div>)}
          <div className="flex justify-between text-xs font-black"><span className="uppercase">Total USD:</span><span>${Number(lastSale.total).toFixed(2)}</span></div>
          <div className="flex justify-between text-[10px] font-black"><span className="uppercase">Total BS:</span><span>{(Number(lastSale.total) * Number(store.exchangeRate)).toLocaleString('es-VE')} Bs</span></div>
          <div className="flex justify-between text-[9px] font-bold pt-2"><span className="uppercase tracking-widest">Pago:</span><span className="uppercase">{lastSale.paymentMethod}</span></div>
        </div>
        <div className="text-center border-t-2 border-dashed border-gray-300 pt-4">
          <p className="text-[10px] font-black uppercase tracking-tighter">¡Gracias por su compra!</p>
          <p className="text-[8px] font-medium italic mt-1">Gonzacars: Calidad y Confianza en cada repuesto.</p>
        </div>
      </div>
    );
  };

  // ─── DAILY REPORT PRINT (invisible) ──────────────────────────────────────
  const DailyReportPrint = () => {
    if (!dailyStats) return null;
    return (
      <div className="hidden print:block print-only bg-white text-black p-8 w-full max-w-[216mm] mx-auto min-h-screen">
        <div className="text-center border-b-2 border-gray-300 pb-6 mb-8">
          <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Reporte de Cierre de Caja</h1>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Gonzacars C.A. | RIF: J-50030426-9</p>
          <p className="text-sm font-bold mt-2">FECHA: {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="border border-gray-200 p-4 rounded-xl"><p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Ventas Totales (USD)</p><p className="text-4xl font-black">${dailyStats.totalUSD.toFixed(2)}</p></div>
          <div className="border border-gray-200 p-4 rounded-xl"><p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Ventas Totales (Bs)</p><p className="text-4xl font-black">{dailyStats.totalBS.toLocaleString('es-VE')} Bs</p></div>
          <div className="border border-gray-200 p-4 rounded-xl"><p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Transacciones</p><p className="text-2xl font-black">{dailyStats.count} Operaciones</p></div>
          <div className="border border-gray-200 p-4 rounded-xl"><p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Ticket Promedio</p><p className="text-2xl font-black">${dailyStats.ticketPromedio.toFixed(2)}</p></div>
        </div>
        <div className="mb-8">
          <h4 className="text-xs font-black uppercase tracking-widest border-b border-gray-200 pb-2 mb-4">Desglose por Método de Pago</h4>
          <table className="w-full text-xs"><thead><tr className="bg-gray-50"><th className="text-left py-2 px-2">Método</th><th className="text-right py-2 px-2">Total ($)</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{Object.entries(dailyStats.totalsByMethod).map(([method, amount]: [string, any]) => (<tr key={method}><td className="py-2 px-2 font-bold uppercase">{method}</td><td className="py-2 px-2 text-right font-black">${Number(amount).toFixed(2)}</td></tr>))}</tbody>
          </table>
        </div>
        <div className="mb-8">
          <h4 className="text-xs font-black uppercase tracking-widest border-b border-gray-200 pb-2 mb-4">Productos Más Vendidos</h4>
          <table className="w-full text-xs"><thead><tr className="bg-gray-50"><th className="text-left py-2 px-2">Producto</th><th className="text-center py-2 px-2">Cant.</th><th className="text-right py-2 px-2">Total ($)</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{dailyStats.topItemsByValue.map((item: any, idx: number) => (<tr key={idx}><td className="py-2 px-2 font-bold uppercase">{item.name}</td><td className="py-2 px-2 text-center">{item.qty}</td><td className="py-2 px-2 text-right font-black">${item.val.toFixed(2)}</td></tr>))}</tbody>
          </table>
        </div>
        <div className="mt-12 pt-8 border-t-2 border-gray-200 flex justify-between px-10">
          <div className="text-center"><div className="w-40 border-t border-gray-400 mb-2"></div><p className="text-[10px] font-black uppercase tracking-widest">Firma Cajero</p></div>
          <div className="text-center"><div className="w-40 border-t border-gray-400 mb-2"></div><p className="text-[10px] font-black uppercase tracking-widest">Firma Supervisor</p></div>
        </div>
      </div>
    );
  };

  // ─── MAIN RENDER ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Print layers (invisible on screen) ── */}
      <ReceiptPrint />
      <DailyReportPrint />

      {/* ── Stats Bar ── */}
      <div className="pos-stat-bar print:hidden flex-shrink-0">
        {/* Live badge */}
        <div className="flex items-center gap-2 pr-5 border-r border-metal-border">
          <div className="live-dot" />
          <span className="text-[0.55rem] font-black uppercase tracking-widest text-chrome-500">En vivo</span>
        </div>

        <div className="pos-stat-item">
          <span className="pos-stat-label">Ventas hoy</span>
          <span className="pos-stat-value accent">${dailyUSD.toFixed(2)}</span>
        </div>
        <div className="pos-stat-item">
          <span className="pos-stat-label">En Bs</span>
          <span className="pos-stat-value">{dailyBS.toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs</span>
        </div>
        <div className="pos-stat-item">
          <span className="pos-stat-label">Operaciones</span>
          <span className="pos-stat-value success">{dailyCount}</span>
        </div>
        <div className="pos-stat-item">
          <span className="pos-stat-label">Tasa ref.</span>
          <span className="pos-stat-value">{Number(store.exchangeRate || 0).toFixed(2)} Bs/$</span>
        </div>
        <div className="pos-stat-item">
          <span className="pos-stat-label">En carrito</span>
          <span className="pos-stat-value">{cartQty > 0 ? `${cartQty} art.` : '—'}</span>
        </div>

        {/* Spacer + actions */}
        <div className="ml-auto flex items-center gap-2 pl-4">
          {lastSale && (
            <button
              onClick={() => setShowReceiptModal(true)}
              title="Re-imprimir última venta"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-[0.6rem] font-black uppercase tracking-wider"
            >
              <FileText size={12} /> Último ticket
            </button>
          )}
          <button
            onClick={() => setShowDailyReport(true)}
            title="Arqueo de caja"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-metal-mid border border-metal-border text-chrome-400 hover:bg-metal-light hover:text-chrome-100 transition-all text-[0.6rem] font-black uppercase tracking-wider"
          >
            <ClipboardList size={12} /> Arqueo
          </button>
        </div>
      </div>

      {/* ── Main split layout ── */}
      <div className="flex flex-1 overflow-hidden print:hidden">

        {/* ════ LEFT: Product browser ════ */}
        <div className="flex-1 flex flex-col overflow-hidden bg-metal-dark/40">

          {/* Search + Barcode row */}
          <div className="flex gap-3 p-4 pb-3 border-b border-metal-border flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none" size={15} />
              <input
                type="text"
                placeholder="Buscar repuesto por nombre..."
                className="w-full pl-10 pr-4 py-2.5 bg-metal-mid border border-metal-border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition-all text-sm font-medium text-chrome-100 placeholder:text-chrome-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative w-56">
              <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={15} />
              <input
                ref={barcodeRef}
                type="text"
                placeholder="Escanear Código..."
                className="w-full pl-10 pr-4 py-2.5 border border-blue-500/30 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 bg-blue-500/5 font-mono text-xs font-bold text-chrome-100 placeholder:text-chrome-500"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Category filter chips */}
          <div className="px-4 py-2.5 border-b border-metal-border flex-shrink-0">
            <div className="pos-category-row">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`pos-chip ${activeCategory === cat ? 'active' : ''}`}
                >
                  {cat === 'TODOS' && <Package size={9} />}
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-20 lg:pb-4">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-40">
                <Search size={48} className="stroke-[1] text-chrome-500" />
                <p className="text-xs font-black uppercase tracking-widest text-chrome-500">Sin resultados</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {filteredProducts.map((p: Product) => {
                  const isConsignment = (p as any).isConsignment;
                  const isLowStock = p.quantity <= 3;
                  const inCart = cart.find(item => item.product.id === p.id);

                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className={`pos-product-card text-left group ${isConsignment ? 'consignment' : ''} ${isLowStock ? 'low-stock' : ''}`}
                    >
                      {/* Top row: category + indicators */}
                      <div className="flex items-start justify-between gap-1 mb-2 relative z-10">
                        <span className="text-[0.55rem] font-black uppercase tracking-widest text-chrome-500 bg-metal-dark/80 px-2 py-0.5 rounded-full truncate max-w-[70%]">
                          {p.category}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isConsignment && (
                            <span className="text-[0.5rem] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-full font-black uppercase">C</span>
                          )}
                          {inCart && (
                            <span className="text-[0.5rem] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full font-black">
                              ×{inCart.quantity}
                            </span>
                          )}
                          {isLowStock && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" title="Stock bajo" />}
                        </div>
                      </div>

                      {/* Product name */}
                      <h4
                        className="text-[0.72rem] font-black text-chrome-100 leading-tight relative z-10 group-hover:text-blue-300 transition-colors"
                        title={p.name}
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {p.name}
                      </h4>

                      {/* Stock */}
                      <p className={`text-[0.6rem] font-bold uppercase mt-1 relative z-10 ${isLowStock ? 'text-red-400' : 'text-chrome-500'}`}>
                        Stock: {p.quantity} unid.
                      </p>
                      {(p as any).consignmentProvider && (
                        <p className="text-[0.55rem] text-purple-400/70 font-bold uppercase mt-0.5 truncate relative z-10">
                          {(p as any).consignmentProvider}
                        </p>
                      )}

                      {/* Price + Add button */}
                      <div className="flex items-end justify-between mt-3 relative z-10">
                        <div>
                          <span className={`text-base font-black tracking-tight leading-none ${isConsignment ? 'text-purple-400' : 'text-blue-400'}`}>
                            ${Number(p.price || 0).toFixed(2)}
                          </span>
                          <div className="text-[0.6rem] font-bold text-chrome-500 mt-0.5">
                            {(Number(p.price || 0) * Number(store.exchangeRate || 0)).toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs
                          </div>
                        </div>
                        <div className="pos-product-add-btn">
                          <Plus size={14} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ════ RIGHT: Checkout panel ════ */}

        {/* Mobile FAB */}
        {!showMobileCart && (
          <button
            onClick={() => setShowMobileCart(true)}
            className="lg:hidden fixed bottom-6 right-6 w-16 h-16 bg-blue-600 rounded-full shadow-[0_8px_30px_rgba(37,99,235,0.5)] flex items-center justify-center text-white z-30 hover:bg-blue-500 transition-colors"
          >
            <div className={`relative ${cartBounce ? 'cart-bounce' : ''}`} ref={cartIconRef}>
              <ShoppingCart size={26} />
              {cartQty > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-metal-darkest">
                  {cartQty}
                </span>
              )}
            </div>
          </button>
        )}

        {/* Cart sidebar */}
        <div className={`
          w-full lg:w-[360px] xl:w-[380px] pos-checkout-panel
          fixed inset-0 z-40 lg:static lg:z-auto
          transition-transform duration-300 ease-out
          ${showMobileCart ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
        `}>

          {/* ── Panel header ── */}
          <div className="pos-checkout-header flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-metal-darkest rounded-xl flex items-center justify-center shadow-xl p-2 border border-metal-border">
                  <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-chrome-100 uppercase tracking-tighter leading-none">Caja POS</h3>
                  <p className="text-[0.55rem] font-black text-chrome-500 uppercase tracking-widest mt-0.5">Facturación Directa</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Cart item count badge */}
                {cartQty > 0 && (
                  <div className={`w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-[0.6rem] font-black ${cartBounce ? 'cart-bounce' : ''}`}>
                    {cartQty}
                  </div>
                )}
                <button
                  onClick={() => setShowMobileCart(false)}
                  className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-chrome-500 hover:bg-metal-mid hover:text-red-400 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Cart items ── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="pos-empty-cart">
                <ShoppingCart size={56} />
                <p>Carrito vacío</p>
                <p className="text-[0.55rem] text-chrome-500 normal-case font-medium tracking-normal opacity-70" style={{ textTransform: 'none', letterSpacing: 'normal', fontWeight: 400 }}>
                  Haz click en un producto para agregar
                </p>
              </div>
            ) : cart.map(item => (
              <div key={item.product.id} className="pos-cart-item">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[0.7rem] font-black text-chrome-100 uppercase leading-tight"
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    title={item.product.name}
                  >
                    {item.product.name}
                  </p>
                  <p className="text-[0.6rem] text-chrome-500 font-bold mt-0.5">
                    ${Number(item.product.price || 0).toFixed(2)} c/u
                  </p>
                </div>

                {/* Qty control */}
                <div className="pos-qty-control flex-shrink-0">
                  <button className="pos-qty-btn" onClick={() => updateQuantity(item.product.id, -1)}>
                    <Minus size={11} />
                  </button>
                  <span className="pos-qty-display">{item.quantity}</span>
                  <button className="pos-qty-btn" onClick={() => updateQuantity(item.product.id, 1)}>
                    <Plus size={11} />
                  </button>
                </div>

                {/* Line total + delete */}
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-chrome-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                  <span className="text-sm font-black text-chrome-100 tracking-tight">
                    ${(Number(item.product.price || 0) * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Checkout controls ── */}
          <div className="px-4 pb-4 pt-3 border-t border-metal-border space-y-3 flex-shrink-0 bg-metal-darker/50">

            {/* Customer selector */}
            <div className="relative">
              <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none" />
              <select
                className="w-full pl-8 pr-4 py-2.5 bg-metal-dark border border-metal-border rounded-xl text-[0.65rem] outline-none font-black uppercase tracking-wide cursor-pointer appearance-none focus:border-blue-500/40 transition-all text-chrome-200"
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
              <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none" />
            </div>

            {/* Payment method chips */}
            <div>
              <p className="text-[0.55rem] font-black uppercase tracking-widest text-chrome-500 mb-1.5">Método de pago</p>
              <div className="pos-payment-grid">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`pos-payment-chip ${paymentMethod === pm.id ? 'selected' : ''}`}
                    style={paymentMethod === pm.id ? { '--chip-color': pm.color } as React.CSSProperties : {}}
                  >
                    <span style={paymentMethod === pm.id ? { color: pm.color } : {}}>
                      {pm.icon}
                    </span>
                    <span style={paymentMethod === pm.id ? { color: pm.color } : {}}>{pm.short}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* IVA toggle */}
            <button
              onClick={() => setIvaEnabled(!ivaEnabled)}
              className={`w-full py-2 rounded-xl text-[0.6rem] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border ${
                ivaEnabled
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : 'bg-metal-dark border-metal-border text-chrome-500 hover:text-chrome-300 hover:border-metal-border-light'
              }`}
            >
              <Percent size={12} />
              {ivaEnabled ? 'IVA Incluido (16%)' : 'Sin IVA'}
            </button>

            {/* Totals */}
            <div className="bg-metal-dark/60 rounded-xl p-3 space-y-1.5 border border-metal-border">
              <div className="pos-total-row">
                <span className="pos-total-label">Subtotal</span>
                <span className="pos-total-amount">${subtotal.toFixed(2)}</span>
              </div>
              {ivaEnabled && (
                <div className="pos-total-row">
                  <span className="pos-total-label">I.V.A (16%)</span>
                  <span className="pos-total-amount">${iva.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-metal-border pt-1.5 mt-1">
                <div className="flex items-end justify-between">
                  <div>
                    <span className="pos-total-label block">Total a pagar</span>
                    <span className="pos-grand-total-bs">{totalBS.toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs</span>
                  </div>
                  <span className="pos-grand-total">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Process button */}
            <button
              disabled={cart.length === 0}
              onClick={processSale}
              className={`pos-process-btn ${cart.length > 0 ? 'has-items' : ''}`}
            >
              <Receipt size={18} />
              Procesar Venta
              {cart.length > 0 && (
                <span className="ml-1 bg-white/20 text-white text-[0.6rem] font-black px-2 py-0.5 rounded-full">
                  {cartQty} art.
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ════ DAILY REPORT MODAL ════ */}
      {showDailyReport && dailyStats && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 print:hidden">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-6xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-scale-in border border-metal-border">

            {/* Modal header */}
            <div className="p-8 bg-metal-darker flex justify-between items-center border-b border-metal-border relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.04]"><BarChart3 size={140} /></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-chrome-100 leading-none">Arqueo de Caja Diario</h3>
                  <p className="text-chrome-500 text-[0.6rem] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-1.5">
                    <Clock size={11} />
                    {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDailyReport(false)}
                className="w-10 h-10 flex items-center justify-center bg-metal-mid hover:bg-metal-light rounded-xl transition-all border border-metal-border text-chrome-400 hover:text-chrome-100 relative z-10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal content */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-metal-dark/30">
              <div className="space-y-10">

                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Ingreso Bruto USD', value: `$${dailyStats.totalUSD.toFixed(2)}`, sub: `${dailyStats.totalBS.toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs`, subLabel: 'En Bolívares', color: 'text-blue-400' },
                    { label: 'Ticket Promedio', value: `$${dailyStats.ticketPromedio.toFixed(2)}`, sub: `${dailyStats.count} ventas`, subLabel: 'Volumen diario', color: 'text-chrome-100' },
                    { label: 'Artículos Vendidos', value: dailyStats.itemsSold, sub: 'Salida de stock', subLabel: 'Total unidades', color: 'text-purple-400' },
                    { label: 'Tasa Referencial', value: `${store.exchangeRate.toFixed(2)} Bs/$`, sub: 'Tasa activa', subLabel: '', color: 'text-emerald-400' },
                  ].map((kpi, i) => (
                    <div key={i} className="bg-metal-mid rounded-2xl border border-metal-border p-6 hover:border-metal-border-light transition-all">
                      <p className="text-[0.6rem] font-black text-chrome-500 uppercase tracking-widest mb-2">{kpi.label}</p>
                      <p className={`text-3xl font-black tracking-tight ${kpi.color}`}>{kpi.value}</p>
                      <div className="mt-3 pt-3 border-t border-metal-border">
                        <p className="text-[0.6rem] text-chrome-500 uppercase font-black">{kpi.subLabel}</p>
                        <p className="text-sm font-black text-chrome-200">{kpi.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Admin profitability section */}
                {store.currentUser?.role === 'administrador' && (() => {
                  const todaySalesArr: Sale[] = store.sales.filter((s: Sale) => s.date === new Date().toISOString().split('T')[0]);
                  const dayTotalCost = todaySalesArr.reduce((acc, s) => acc + (Number((s as any).totalCost) || 0), 0);
                  const dayProfit = todaySalesArr.reduce((acc, s) => acc + (Number((s as any).profit) || 0), 0);
                  const dayMargin = dayTotalCost > 0 ? (dayProfit / dayTotalCost) * 100 : 0;
                  const consignmentSales = todaySalesArr.filter(s => (s as any).hasConsignment).length;
                  return (
                    <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-6">
                      <h4 className="text-[0.6rem] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-500" /> Rentabilidad del Día — Admin
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Costo Total', value: `$${dayTotalCost.toFixed(2)}`, color: 'text-red-400' },
                          { label: 'Ganancia Neta', value: `$${dayProfit.toFixed(2)}`, color: dayProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
                          { label: 'Margen Promedio', value: `${dayMargin.toFixed(1)}%`, color: 'text-blue-400' },
                          { label: 'Ventas Consig.', value: consignmentSales, color: 'text-purple-400' },
                        ].map((item, i) => (
                          <div key={i} className="bg-metal-dark/60 p-4 rounded-xl border border-metal-border">
                            <p className="text-[0.55rem] font-black text-chrome-500 uppercase tracking-widest mb-1">{item.label}</p>
                            <p className={`text-2xl font-black tracking-tighter ${item.color}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Payment breakdown */}
                <div>
                  <div className="flex items-center gap-2 border-b border-metal-border pb-3 mb-4">
                    <Wallet size={16} className="text-blue-500" />
                    <h4 className="text-[0.6rem] font-black text-chrome-100 uppercase tracking-[0.2em]">Desglose por Método de Pago</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {PAYMENT_METHODS.map((pm) => {
                      const amount = Number(dailyStats.totalsByMethod[pm.id] || 0);
                      return (
                        <div key={pm.id} className="bg-metal-mid p-4 rounded-xl border border-metal-border hover:border-metal-border-light transition-all">
                          <div style={{ color: pm.color }} className="mb-2">{pm.icon}</div>
                          <span className="font-black text-chrome-500 text-[0.6rem] uppercase block mb-1">{pm.short}</span>
                          <span className="font-black text-chrome-100 text-sm">${amount.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top products */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {[
                    { title: 'Top por Cantidad', icon: <TrendingUp size={14} className="text-blue-500" />, items: dailyStats.topItemsByQty, getVal: (item: any) => `${item.qty} unid.`, getPct: (item: any) => (item.qty / dailyStats.itemsSold) * 100, barColor: 'bg-blue-600', valColor: 'text-blue-400 bg-blue-500/10' },
                    { title: 'Top por Valor', icon: <DollarSign size={14} className="text-emerald-500" />, items: dailyStats.topItemsByValue, getVal: (item: any) => `$${item.val.toFixed(2)}`, getPct: (item: any) => (item.val / dailyStats.totalUSD) * 100, barColor: 'bg-emerald-500', valColor: 'text-emerald-400 bg-emerald-500/10' },
                  ].map((section, si) => (
                    <div key={si}>
                      <div className="flex items-center gap-2 border-b border-metal-border pb-3 mb-4">
                        {section.icon}
                        <h4 className="text-[0.6rem] font-black text-chrome-100 uppercase tracking-[0.2em]">{section.title}</h4>
                      </div>
                      <div className="bg-metal-mid rounded-2xl border border-metal-border p-6 space-y-4">
                        {section.items.length === 0 ? (
                          <p className="text-[0.65rem] text-chrome-500 text-center py-4">Sin datos</p>
                        ) : section.items.map((item: any, idx: number) => (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-black text-chrome-100 text-[0.65rem] uppercase truncate max-w-[55%]">{item.name}</span>
                              <span className={`font-black text-[0.65rem] px-2.5 py-0.5 rounded-full ${section.valColor}`}>
                                {section.getVal(item)}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-metal-dark rounded-full overflow-hidden">
                              <div
                                className={`h-full ${section.barColor} rounded-full transition-all duration-700`}
                                style={{ width: `${section.getPct(item)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-6 bg-metal-mid border-t border-metal-border no-print">
              <button
                onClick={() => window.print()}
                className="w-full bg-metal-darker text-chrome-100 py-4 rounded-xl font-black uppercase text-[0.65rem] tracking-[0.3em] hover:bg-metal-darkest transition-all flex items-center justify-center gap-3 border border-metal-border hover:border-metal-border-light"
              >
                <Printer size={18} /> Imprimir Reporte de Cierre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPOS;
