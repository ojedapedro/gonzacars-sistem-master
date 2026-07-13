
import React, { useState, useMemo, useEffect, useCallback, createContext, useContext } from 'react';
import { 
  LayoutDashboard, 
  Wrench, 
  ClipboardList, 
  ShoppingCart, 
  Package, 
  Truck, 
  BarChart3, 
  Wallet, 
  Users,
  DollarSign,
  UserRound,
  Database,
  RefreshCw,
  Lock,
  LogOut,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Coins,
  Share2,
  Copy,
  Smartphone,
  ExternalLink,
  CheckCircle2,
  Menu,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  Zap,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useGonzacarsStore } from './store';
import RepairRegistration from './modules/RepairRegistration';
import RepairReport from './modules/RepairReport';
import SalesPOS from './modules/SalesPOS';
import PurchaseRegistry from './modules/PurchaseRegistry';
import InventoryModule from './modules/InventoryModule';
import FinanceModule from './modules/FinanceModule';
import ExpenseModule from './modules/ExpenseModule';
import PayrollModule from './modules/PayrollModule';
import CustomerModule from './modules/CustomerModule';
import UserManagement from './modules/UserManagement';
import DashboardModule from './modules/DashboardModule';

const LOGO_URL = "https://i.ibb.co/MDhy5tzK/image-2.png";

/* ============================================================
   TOAST SYSTEM
   ============================================================ */
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: string; type: ToastType; title: string; message?: string; duration?: number; }

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error:   (title: string, message?: string) => void;
  info:    (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {}, success: () => {}, error: () => {}, info: () => {}, warning: () => {},
});

export const useToast = () => useContext(ToastContext);

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} />,
  error:   <AlertCircle size={16} />,
  info:    <Info size={16} />,
  warning: <AlertTriangle size={16} />,
};

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration = 4000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const ctx: ToastContextValue = {
    toast:   addToast,
    success: (t, m) => addToast('success', t, m),
    error:   (t, m) => addToast('error',   t, m),
    info:    (t, m) => addToast('info',    t, m),
    warning: (t, m) => addToast('warning', t, m),
  };

  const toastColors: Record<ToastType, { border: string; iconBg: string; iconText: string }> = {
    success: { border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-400' },
    error:   { border: 'border-red-500/20',     iconBg: 'bg-red-500/15',     iconText: 'text-red-400' },
    info:    { border: 'border-blue-500/20',     iconBg: 'bg-blue-500/15',    iconText: 'text-blue-400' },
    warning: { border: 'border-amber-500/20',    iconBg: 'bg-amber-500/15',   iconText: 'text-amber-400' },
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map(t => {
          const colors = toastColors[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 bg-metal-base rounded-xl border ${colors.border} min-w-[280px] max-w-[380px] animate-slide-in-right`}
              style={{ boxShadow: '0 8px 32px -4px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)' }}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.iconBg} ${colors.iconText}`}>
                {TOAST_ICONS[t.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-chrome-100 text-sm leading-tight" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>{t.title}</p>
                {t.message && <p className="text-xs text-chrome-400 font-medium mt-0.5 leading-relaxed">{t.message}</p>}
              </div>
              <button onClick={() => removeToast(t.id)} className="text-chrome-500 hover:text-chrome-200 transition-colors flex-shrink-0 mt-0.5">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

/* ============================================================
   MAIN APP
   ============================================================ */
const TAB_LABELS: Record<string, string> = {
  dashboard:  'Escritorio',
  customers:  'Clientes',
  'repair-reg': 'Registro de Vehículo',
  'repair-rep': 'Informes de Taller',
  sales:      'Punto de Venta',
  inventory:  'Inventario',
  purchases:  'Compras',
  finance:    'Finanzas',
  expenses:   'Gastos',
  payroll:    'Nómina',
  'user-mgmt':'Gestión de Usuarios',
};

const App: React.FC = () => {
  const store = useGonzacarsStore();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [prevTab, setPrevTab] = useState('');
  const [tempUrl, setTempUrl] = useState(store.sheetsUrl);
  const [localRate, setLocalRate] = useState(store.exchangeRate);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Hide splash loader on mount
  useEffect(() => {
    const loader = document.getElementById('app-loader');
    if (loader) loader.classList.add('hidden');
  }, []);

  // Close mobile menu on resize
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setIsMobileMenuOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // --- CHART DATA & KPI DELTAS moved to DashboardModule ---

  const handleTabChange = (tab: string) => {
    setPrevTab(activeTab);
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    await new Promise(r => setTimeout(r, 200)); // subtle UX delay
    const result = store.login(username, password);
    setLoginLoading(false);
    if (result === 'loading') {
      toast.warning('Conectando...', 'El sistema aún está cargando los datos. Intenta de nuevo en un momento.');
    } else if (!result) {
      setLoginError(true);
      setTimeout(() => setLoginError(false), 3000);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginLoading(true);
    try {
      await store.loginWithGoogle();
      toast.success('Sesión iniciada', `Bienvenido al sistema`);
    } catch (error: any) {
      toast.error('Error de autenticación', error.message || 'No se pudo iniciar sesión con Google.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRateUpdate = () => {
    store.setExchangeRate(localRate);
    toast.success('Tasa actualizada', `Nueva tasa: ${localRate.toFixed(2)} Bs/$`);
  };

  const hasPermission = (tab: string) => {
    const role = store.currentUser?.role;
    if (role === 'administrador') return true;
    if (role === 'vendedor') return ['dashboard', 'customers', 'repair-reg', 'repair-rep', 'sales', 'inventory'].includes(tab);
    if (role === 'cajero') return ['dashboard', 'sales', 'expenses', 'finance', 'payroll'].includes(tab);
    return false;
  };

  /* ---- INITIAL FIREBASE LOADING SCREEN ---- */
  if (!store.currentUser && store.isInitialLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center animated-gradient relative overflow-hidden gap-6">
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-blue-600/15 rounded-full blur-[130px] pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-cyan-500/10 rounded-full blur-[110px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center border border-white/8 p-2.5 animate-pulse-slow" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <img src={LOGO_URL} alt="Gonzacars Logo" className="w-full h-full object-contain" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black uppercase tracking-tight text-gradient" style={{ fontFamily: 'Outfit, sans-serif' }}>Gonzacars C.A.</h1>
          <p className="text-chrome-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Conectando con el servidor…</p>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  /* ---- LOGIN SCREEN ---- */
  if (!store.currentUser) {
    return (
      <div className="h-screen w-screen flex items-center justify-center animated-gradient relative overflow-hidden p-4">
        {/* Ambient blobs */}
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-blue-600/15 rounded-full blur-[130px] pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-cyan-500/10 rounded-full blur-[110px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-[40%] right-[20%] w-[20%] h-[20%] bg-blue-400/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10 animate-scale-in">
          <div className="glass-panel rounded-2xl overflow-hidden glow-box">
            {/* Header */}
            <div className="p-8 lg:p-10 text-center border-b border-white/5">
              <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-white/8 p-2.5" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                <img src={LOGO_URL} alt="Gonzacars Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tight leading-none text-gradient" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Gonzacars C.A.
              </h1>
              <p className="text-chrome-400 font-semibold uppercase text-[10px] tracking-[0.25em] mt-2">
                Sistema de Gestión Integral
              </p>
              {store.isDemoMode && (
                <div className="mt-4 bg-amber-500/10 text-amber-400 px-4 py-2.5 rounded-xl border border-amber-500/20 animate-fade-in">
                  <p className="text-[10px] font-black uppercase tracking-widest">⚡ Modo Demostración</p>
                  <p className="text-[10px] mt-1 opacity-80">usuario: <b>admin</b> / clave: <b>admin</b></p>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="p-8 lg:p-10 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Usuario</label>
                <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18} />
                  <input
                    required
                    type="text"
                    className={`w-full pl-12 pr-4 py-3.5 bg-white/5 border rounded-xl text-white outline-none transition-all font-semibold text-sm placeholder:text-chrome-500/50
                      ${loginError ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-white/8 focus:border-blue-500 focus:ring-blue-500/20'} focus:ring-4`}
                    placeholder="admin, vendedor, cajero…"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18} />
                  <input
                    required
                    type="password"
                    className={`w-full pl-12 pr-4 py-3.5 bg-white/5 border rounded-xl text-white outline-none transition-all font-semibold text-sm placeholder:text-chrome-500/50
                      ${loginError ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-white/8 focus:border-blue-500 focus:ring-blue-500/20'} focus:ring-4`}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {loginError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 animate-fade-in">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-xs font-black uppercase tracking-widest">Credenciales inválidas</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] active:scale-95 disabled:opacity-50 mt-2 flex justify-center items-center gap-2 btn-pulse"
              >
                {loginLoading ? (
                  <><RefreshCw size={16} className="animate-spin" /> Verificando…</>
                ) : (
                  <>Acceder al Sistema <ChevronRight size={16} /></>
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="flex-shrink mx-4 text-chrome-500 text-[10px] font-black uppercase tracking-widest">O</span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loginLoading}
                className="btn-metallic w-full py-4 rounded-xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Continuar con Google
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ---- MAIN MODULE RENDER ---- */
  const renderModule = () => {
    const moduleProps = { store, toast };
    switch (activeTab) {
      case 'customers':   return <CustomerModule   {...moduleProps} />;
      case 'repair-reg':  return <RepairRegistration {...moduleProps} />;
      case 'repair-rep':  return <RepairReport       {...moduleProps} />;
      case 'sales':       return <SalesPOS           {...moduleProps} />;
      case 'purchases':   return <PurchaseRegistry   {...moduleProps} />;
      case 'inventory':   return <InventoryModule    {...moduleProps} />;
      case 'finance':     return <FinanceModule      {...moduleProps} />;
      case 'expenses':    return <ExpenseModule      {...moduleProps} />;
      case 'payroll':     return <PayrollModule      {...moduleProps} />;
      case 'user-mgmt':   return <UserManagement     {...moduleProps} />;
      default: return <DashboardModule store={store} localRate={localRate} setLocalRate={setLocalRate} handleRateUpdate={handleRateUpdate} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans relative" style={{ background: '#08090d' }}>
      {/* Demo Mode Banner */}
      {store.isDemoMode && (
        <div className="absolute top-0 left-0 w-full z-[60] bg-gradient-to-r from-amber-600/90 to-orange-600/90 text-white text-[10px] font-black uppercase tracking-widest text-center py-1.5 no-print backdrop-blur-sm">
          ⚡ Modo Demostración — Los datos no se guardarán
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR — Floating Panel */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 w-72 glass-panel shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${store.isDemoMode ? 'top-7' : ''}`}
      >
        <div className={`flex flex-col h-full m-2.5 rounded-2xl sidebar-panel overflow-hidden ${store.isDemoMode ? 'mt-0' : ''}`}>
          {/* Logo */}
          <div className="px-5 pt-5 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center p-1.5 border border-white/8" style={{ background: 'linear-gradient(145deg, #1c2030, #10131a)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.4)' }}>
                <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="font-black text-chrome-100 text-sm tracking-tight uppercase leading-none block" style={{ fontFamily: 'Outfit, sans-serif' }}>Gonzacars</span>
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.15em] mt-0.5 block">Taller y Repuestos</span>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-chrome-500 hover:text-chrome-200 transition-colors rounded-lg hover:bg-white/5">
              <X size={20} />
            </button>
          </div>

          {/* User pill */}
          <div className="mx-3 mb-3 rounded-xl px-3.5 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(145deg, #1c2030, #161922)', border: '1px solid #2a2f42', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}>
              {store.currentUser?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-chrome-100 font-bold text-xs truncate leading-tight">{store.currentUser?.name}</p>
              <p className="text-chrome-500 text-[10px] font-medium capitalize leading-tight mt-0.5">{store.currentUser?.role}</p>
            </div>
            <div className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} title="Conectado" />
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
            <NavItem icon={<LayoutDashboard size={17}/>} label="Escritorio"      tab="dashboard"   active={activeTab} onClick={handleTabChange} visible={hasPermission('dashboard')} badge={store.loading ? '…' : ''} />
            <MenuHeader label="Base de Datos" />
            <NavItem icon={<UserRound size={17}/>}       label="Clientes"        tab="customers"   active={activeTab} onClick={handleTabChange} visible={hasPermission('customers')} badge={store.customers?.length > 0 ? String(store.customers.length) : ''} />
            <MenuHeader label="Servicio Técnico" />
            <NavItem icon={<Wrench size={17}/>}          label="Reg. Vehículo"   tab="repair-reg"  active={activeTab} onClick={handleTabChange} visible={hasPermission('repair-reg')} />
            <NavItem icon={<ClipboardList size={17}/>}   label="Informes"        tab="repair-rep"  active={activeTab} onClick={handleTabChange} visible={hasPermission('repair-rep')} badge={String(store.repairs?.filter((r: any) => r.status !== 'Entregado').length || '')} />
            <MenuHeader label="Unidad Comercial" />
            <NavItem icon={<ShoppingCart size={17}/>}    label="Punto de Venta"  tab="sales"       active={activeTab} onClick={handleTabChange} visible={hasPermission('sales')} />
            <NavItem icon={<Package size={17}/>}         label="Inventario"      tab="inventory"   active={activeTab} onClick={handleTabChange} visible={hasPermission('inventory')} badge={String(store.inventory?.filter((p: any) => p.quantity <= 5).length || '')} badgeColor="amber" />
            <NavItem icon={<Truck size={17}/>}           label="Compras"         tab="purchases"   active={activeTab} onClick={handleTabChange} visible={hasPermission('purchases')} />
            <MenuHeader label="Administración" />
            <NavItem icon={<BarChart3 size={17}/>}       label="Finanzas"        tab="finance"     active={activeTab} onClick={handleTabChange} visible={hasPermission('finance')} />
            <NavItem icon={<Wallet size={17}/>}          label="Gastos"          tab="expenses"    active={activeTab} onClick={handleTabChange} visible={hasPermission('expenses')} />
            <NavItem icon={<Users size={17}/>}           label="Nómina"          tab="payroll"     active={activeTab} onClick={handleTabChange} visible={hasPermission('payroll')} />
            <NavItem icon={<ShieldCheck size={17}/>}     label="Usuarios"        tab="user-mgmt"   active={activeTab} onClick={handleTabChange} visible={hasPermission('user-mgmt')} />
          </nav>

          {/* Logout */}
          <div className="p-3 border-t border-metal-border">
            <button
              onClick={() => store.logout()}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-chrome-500 hover:text-red-400 transition-all text-[10px] font-black uppercase tracking-widest metallic-shine"
              style={{ background: 'linear-gradient(180deg, #1c2030, #161922)', border: '1px solid #2a2f42' }}
            >
              <LogOut size={15}/> Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative w-full lg:pl-72" style={{ marginTop: store.isDemoMode ? '28px' : '0' }}>
        {/* Top Header */}
        <header className="h-[56px] flex items-center justify-between px-4 lg:px-6 no-print z-10 shrink-0 border-b border-metal-border/50 glass-panel">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 text-chrome-500 hover:bg-white/5 rounded-lg transition-colors"
            >
              <Menu size={22} />
            </button>
            <div>
              <h2 className="text-sm font-black text-chrome-100 uppercase tracking-tight leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {TAB_LABELS[activeTab] || activeTab}
              </h2>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
                <span className="text-[10px] font-bold text-chrome-500 uppercase tracking-wider hidden sm:inline">Operativo</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => store.refreshData()}
              disabled={store.loading}
              className="hidden sm:flex items-center gap-2 btn-metallic px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              <RefreshCw size={14} className={store.loading ? 'animate-spin text-blue-400' : ''} />
              {store.loading ? 'Sync…' : 'Sync'}
            </button>
            <div className="text-right px-3 py-1.5 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <p className="text-[9px] font-black text-chrome-500 uppercase tracking-widest leading-tight">Tasa Bs/$</p>
              <p className="text-sm font-black text-blue-400 tracking-tight leading-tight">{store.exchangeRate.toFixed(2)}</p>
            </div>
          </div>
        </header>

        {/* Module Area */}
        <div key={activeTab} className="flex-1 overflow-y-auto animate-fade-in-up" style={{ background: 'var(--metal-darkest)' }}>
          {renderModule()}
        </div>
      </main>
    </div>
  );
};

/* ============================================================
   SIDEBAR COMPONENTS
   ============================================================ */
const MenuHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="pt-4 pb-1.5 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-chrome-500">{label}</div>
);

interface NavItemProps {
  icon: React.ReactNode; label: string; tab: string;
  active: string; onClick: (tab: string) => void;
  visible?: boolean; badge?: string; badgeColor?: 'blue' | 'amber' | 'red';
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, tab, active, onClick, visible = true, badge, badgeColor = 'blue' }) => {
  if (!visible) return null;
  const isActive = active === tab;
  const badgeColors = { 
    blue: 'bg-blue-500/15 text-blue-400', 
    amber: 'bg-amber-500/15 text-amber-400', 
    red: 'bg-red-500/15 text-red-400' 
  };

  return (
    <button
      onClick={() => onClick(tab)}
      className={`nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left group
        ${isActive
          ? 'nav-item-active'
          : 'text-chrome-400 hover:bg-white/4 hover:text-chrome-200'
        }`}
      style={!isActive ? {} : undefined}
    >
      <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-blue-400' : 'text-chrome-500 group-hover:text-chrome-300'}`}>
        {icon}
      </span>
      <span className="flex-1 text-[11px] font-bold uppercase tracking-tight truncate" style={{ fontFamily: 'Inter, sans-serif' }}>
        {label}
      </span>
      {badge && badge !== '0' && badge !== '' && (
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 ${isActive ? 'bg-blue-500/20 text-blue-300' : badgeColors[badgeColor]}`}>
          {badge}
        </span>
      )}
    </button>
  );
};

/* ============================================================
   ROOT WITH TOAST PROVIDER
   ============================================================ */
const AppWithProviders: React.FC = () => (
  <ToastProvider>
    <App />
  </ToastProvider>
);

export default AppWithProviders;
