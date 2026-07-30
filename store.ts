import { useState, useEffect } from 'react';
import { Product, VehicleRepair, Sale, Purchase, Expense, Employee, PayrollRecord, Customer, User, Vehicle, Quote, AccountReceivable, ReceivablePayment, AccountPayable, PayablePayment, Appointment, CXCEntry } from './types';
import { db, auth, googleProvider } from './lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { roundTo } from './lib/utils/finance';
import { addAuditLog } from './lib/services/auditService';
import { createProduct, updateProduct, deleteProduct } from './lib/services/inventoryService';
import { processSaleTransaction, registerPurchaseBatchService, payCreditInvoiceService } from './lib/services/accountingService';
import { deleteImageFromUrl } from './lib/services/storageService';

const STORED_USER = localStorage.getItem('gz_active_user');

export const useGonzacarsStore = () => {
  const [loading, setLoading] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      return STORED_USER ? JSON.parse(STORED_USER) : null;
    } catch (e) {
      return null;
    }
  });
  
  const [users, setUsers] = useState<User[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(45.0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [repairs, setRepairs] = useState<VehicleRepair[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [accountsReceivable, setAccountsReceivable] = useState<AccountReceivable[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<AccountPayable[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [isDemoMode, setIsDemoMode] = useState(false);

  // Helper context for auditing
  const getUserContext = () => {
    return currentUser 
      ? { id: currentUser.id, name: currentUser.name }
      : { id: 'system', name: 'Sistema / Invitado' };
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const demo = params.get('demo');
    if (demo === 'true') {
      setIsDemoMode(true);
      loadDemoData();
    }
  }, []);

  const adjustWarehouseStockToTotal = (
    currentStock: any,
    newTotal: number,
    fallbackQty = 0
  ): Record<string, number> => {
    const stock = currentStock || {
      gonzacars: fallbackQty,
      externo_1: 0,
      externo_2: 0,
      externo_3: 0,
      externo_4: 0
    };
    const updatedStock = {
      gonzacars: stock.gonzacars || 0,
      externo_1: stock.externo_1 || 0,
      externo_2: stock.externo_2 || 0,
      externo_3: stock.externo_3 || 0,
      externo_4: stock.externo_4 || 0
    };
    const currentTotal = Object.values(updatedStock).reduce((a, b) => a + b, 0);
    if (currentTotal === newTotal) return updatedStock;

    const diff = newTotal - currentTotal;
    if (diff > 0) {
      updatedStock.gonzacars += diff;
    } else {
      let toSubtract = Math.abs(diff);
      const order = ['gonzacars', 'externo_1', 'externo_2', 'externo_3', 'externo_4'];
      for (const wId of order) {
        if (toSubtract <= 0) break;
        const currentVal = updatedStock[wId] || 0;
        if (currentVal > 0) {
          const sub = Math.min(toSubtract, currentVal);
          updatedStock[wId] = currentVal - sub;
          toSubtract -= sub;
        }
      }
    }
    return updatedStock;
  };

  const deductStockFromWarehouseStock = (wStock: Record<string, number>, qty: number): Record<string, number> => {
    const updatedStock = { ...wStock };
    const order = ['gonzacars', 'externo_1', 'externo_2', 'externo_3', 'externo_4'];
    let remaining = qty;
    for (const wId of order) {
      if (remaining <= 0) break;
      const current = updatedStock[wId] || 0;
      if (current > 0) {
        const sub = Math.min(remaining, current);
        updatedStock[wId] = current - sub;
        remaining -= sub;
      }
    }
    return updatedStock;
  };

  const loadDemoData = () => {
    setUsers([
      { id: 'demo-admin', username: 'admin', password: '123', name: 'Admin Demo', role: 'administrador' },
      { id: 'demo-seller', username: 'vendedor', password: '123', name: 'Vendedor Demo', role: 'vendedor' }
    ]);
    setCustomers([
      { id: 'c1', name: 'Juan Pérez', phone: '0412-1234567', email: 'juan@demo.com', address: 'Calle Falsa 123', createdAt: new Date().toISOString() },
    ]);
    setInventory([
      { 
        id: 'p1', 
        name: 'Aceite 20W50', 
        barcode: '1001', 
        category: 'Lubricantes', 
        quantity: 50, 
        cost: 5, 
        price: 12,
        warehouseStock: { gonzacars: 30, externo_1: 10, externo_2: 10, externo_3: 0, externo_4: 0 },
        lastEntry: new Date().toISOString().split('T')[0]
      },
    ]);
    setRepairs([
      { 
        id: 'r1', customerId: 'c1', plate: 'ABC-123', brand: 'Toyota', model: 'Corolla', year: 2015, 
        description: 'Cambio de Aceite', status: 'En Proceso', 
        items: [{ id: 'p1', name: 'Aceite 20W50', price: 12, quantity: 4, productId: 'p1' }], 
        laborCost: 20, total: 68, installments: [], createdAt: new Date().toISOString(), mechanicId: 'demo-mechanic'
      }
    ]);
    setSales([
      { id: 's1', customerId: 'c1', date: new Date().toISOString(), items: [{ id: 'p1', name: 'Aceite 20W50', price: 12, quantity: 4, productId: 'p1' }], total: 48, paymentMethod: 'Efectivo' }
    ]);
    setExchangeRate(45.5);
  };

  const login = (username: string, pass: string): boolean | 'loading' => {
    if (isDemoMode) {
      if (username === 'admin' && pass === 'admin') {
         const demoAdmin: User = { id: 'demo-admin', username: 'admin', name: 'Admin Demo', role: 'administrador' };
         setCurrentUser(demoAdmin);
         return true;
      }
      const found = users.find(u => u.username === username && u.password === pass);
      if (found) {
        const { password, ...userWithoutPass } = found;
        setCurrentUser(userWithoutPass as User);
        return true;
      }
      return false;
    }

    // If Firebase hasn't finished loading users yet, signal to wait
    if (isInitialLoading) return 'loading';

    const found = users.find(u => 
      u.username && 
      u.username.toLowerCase() === username.toLowerCase() && 
      u.password === pass
    );

    if (found) {
      const { password, ...userWithoutPass } = found;
      setCurrentUser(userWithoutPass as User);
      localStorage.setItem('gz_active_user', JSON.stringify(userWithoutPass));
      return true;
    }

    if (users.length === 0 && username.toLowerCase() === 'admin' && pass === 'admin') {
       const adminUser: User = { 
         id: 'default-admin', 
         username: 'admin', 
         name: 'Administrador de Recuperación', 
         role: 'administrador' 
       };
       setCurrentUser(adminUser);
       localStorage.setItem('gz_active_user', JSON.stringify(adminUser));
       return true;
    }

    return false;
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    if (isDemoMode) {
      const demoAdmin: User = { id: 'demo-admin', username: 'admin', email: 'admin@demo.com', name: 'Admin Demo', role: 'administrador' };
      setCurrentUser(demoAdmin);
      return true;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email;

      if (!email) {
        throw new Error('No se pudo obtener el correo de Google.');
      }

      let found = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

      // Auto-registro inicial si la base de datos está completamente vacía
      if (!found && users.length === 0) {
        const newUser: User = {
           id: Math.random().toString(36).substr(2, 9),
           username: email.split('@')[0],
           email: email,
           name: result.user.displayName || email.split('@')[0],
           role: 'administrador'
        };
        const ref = doc(db, 'Users', newUser.id);
        await setDoc(ref, newUser);
        found = newUser;
      }

      if (found) {
        const { password, ...userWithoutPass } = found;
        setCurrentUser(userWithoutPass as User);
        localStorage.setItem('gz_active_user', JSON.stringify(userWithoutPass));
        return true;
      } else {
        throw new Error('Esta cuenta de Google no está autorizada en el sistema. Solicita acceso a un administrador.');
      }
    } catch (error: any) {
      console.error('Error en login de Google:', error);
      throw error;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('gz_active_user');
  };

  const generateBarcode = () => {
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
  };

  // ─── Contador de listeners listos para saber cuándo está todo cargado ─────
  const [_readyCount, setReadyCount] = useState(0);
  const TOTAL_COLLECTIONS = 15;

  /**
   * refreshData se mantiene como función de compatibilidad.
   * Con onSnapshot los datos se sincronizan en tiempo real, pero
   * exponemos esta función para que los botones de Sync den feedback visual.
   */
  const refreshData = async (_isInitial = false) => {
    if (isDemoMode) return;
    // Pulso visual de "sincronizando" sin necesidad de volver a pedir datos
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
  };

  // ─── Listeners en tiempo real (onSnapshot) ────────────────────────────────
  useEffect(() => {
    if (isDemoMode) {
      loadDemoData();
      return;
    }

    let resolved = 0;
    const markReady = () => {
      resolved++;
      setReadyCount(resolved);
      if (resolved >= TOTAL_COLLECTIONS) {
        setIsInitialLoading(false);
      }
    };

    // Migración inline de gastos (igual lógica que antes)
    const migrateExpense = (exp: any): Expense => {
      if (!exp.expenseType) {
        const oldCategory = exp.category;
        if (['Limpieza', 'Víveres', 'Imprevistos', 'Repuestos Adicionales', 'Herramientas', 'Mantenimiento', 'Viáticos'].includes(oldCategory)) {
          exp.expenseType = 'Gasto Variable';
        } else if (['Oficina', 'Impuesto', 'Aseo Urbano', 'Internet', 'Alquiler', 'Luz', 'Agua', 'Impuestos', 'Nómina Administrativa', 'Servicios de Aseo'].includes(oldCategory)) {
          exp.expenseType = 'Gasto Fijo';
          if (oldCategory === 'Impuesto') exp.category = 'Impuestos';
          if (oldCategory === 'Aseo Urbano') exp.category = 'Servicios de Aseo';
        } else {
          exp.expenseType = 'Gasto Variable';
        }
      }
      return exp as Expense;
    };

    let firstUsers = true;
    const unsubUsers = onSnapshot(collection(db, 'Users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      if (firstUsers) { firstUsers = false; markReady(); }
    }, err => console.error('Listener Users:', err));

    let firstCust = true;
    const unsubCust = onSnapshot(collection(db, 'Customers'), snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      if (firstCust) { firstCust = false; markReady(); }
    }, err => console.error('Listener Customers:', err));

    let firstInv = true;
    const unsubInv = onSnapshot(collection(db, 'Inventory'), snap => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      if (firstInv) { firstInv = false; markReady(); }
    }, err => console.error('Listener Inventory:', err));

    let firstRep = true;
    const unsubRep = onSnapshot(collection(db, 'Repairs'), snap => {
      setRepairs(snap.docs.map(d => ({ id: d.id, ...d.data() } as VehicleRepair)));
      if (firstRep) { firstRep = false; markReady(); }
    }, err => console.error('Listener Repairs:', err));

    let firstSales = true;
    const unsubSales = onSnapshot(collection(db, 'Sales'), snap => {
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)));
      if (firstSales) { firstSales = false; markReady(); }
    }, err => console.error('Listener Sales:', err));

    let firstPurch = true;
    const unsubPurch = onSnapshot(collection(db, 'Purchases'), snap => {
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase)));
      if (firstPurch) { firstPurch = false; markReady(); }
    }, err => console.error('Listener Purchases:', err));

    let firstExp = true;
    const unsubExp = onSnapshot(collection(db, 'Expenses'), snap => {
      setExpenses(snap.docs.map(d => migrateExpense({ id: d.id, ...d.data() })));
      if (firstExp) { firstExp = false; markReady(); }
    }, err => console.error('Listener Expenses:', err));

    let firstEmp = true;
    const unsubEmp = onSnapshot(collection(db, 'Employees'), snap => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
      if (firstEmp) { firstEmp = false; markReady(); }
    }, err => console.error('Listener Employees:', err));

    let firstPay = true;
    const unsubPay = onSnapshot(collection(db, 'Payroll'), snap => {
      setPayroll(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRecord)));
      if (firstPay) { firstPay = false; markReady(); }
    }, err => console.error('Listener Payroll:', err));

    let firstSet = true;
    const unsubSet = onSnapshot(collection(db, 'Settings'), snap => {
      const exRateDoc = snap.docs.find(d => d.id === 'exchangeRate');
      if (exRateDoc) setExchangeRate(Number(exRateDoc.data().value));
      if (firstSet) { firstSet = false; markReady(); }
    }, err => console.error('Listener Settings:', err));

    let firstVeh = true;
    const unsubVeh = onSnapshot(collection(db, 'Vehicles'), snap => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
      if (firstVeh) { firstVeh = false; markReady(); }
    }, err => console.error('Listener Vehicles:', err));

    let firstQ = true;
    const unsubQ = onSnapshot(collection(db, 'Quotes'), snap => {
      setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote)));
      if (firstQ) { firstQ = false; markReady(); }
    }, err => console.error('Listener Quotes:', err));

    let firstAR = true;
    const unsubAR = onSnapshot(collection(db, 'AccountsReceivable'), snap => {
      setAccountsReceivable(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountReceivable)));
      if (firstAR) { firstAR = false; markReady(); }
    }, err => console.error('Listener AccountsReceivable:', err));

    let firstAP = true;
    const unsubAP = onSnapshot(collection(db, 'AccountsPayable'), snap => {
      setAccountsPayable(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountPayable)));
      if (firstAP) { firstAP = false; markReady(); }
    }, err => console.error('Listener AccountsPayable:', err));

    let firstAppt = true;
    const unsubAppt = onSnapshot(collection(db, 'Appointments'), snap => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
      if (firstAppt) { firstAppt = false; markReady(); }
    }, err => console.error('Listener Appointments:', err));

    // Cleanup: desuscribir todos los listeners al desmontar
    return () => {
      unsubUsers(); unsubCust(); unsubInv(); unsubRep();
      unsubSales(); unsubPurch(); unsubExp(); unsubEmp();
      unsubPay(); unsubSet(); unsubVeh(); unsubQ();
      unsubAR(); unsubAP(); unsubAppt();
    };
  }, [isDemoMode]);

  const saveToFirebase = async (collectionName: string, item: any) => {
    if (isDemoMode) return;
    try {
      const user = getUserContext();
      if (item.id) {
        const ref = doc(db, collectionName, item.id);
        await setDoc(ref, item);
        await addAuditLog({
          resModel: collectionName,
          resId: item.id,
          userId: user.id,
          userName: user.name,
          action: 'write',
          changes: { data: [null, item] }
        });
      } else {
        const docRef = doc(collection(db, collectionName));
        item.id = docRef.id;
        await setDoc(docRef, item);
        await addAuditLog({
          resModel: collectionName,
          resId: item.id,
          userId: user.id,
          userName: user.name,
          action: 'create',
          changes: { data: [null, item] }
        });
      }
    } catch (error) {
      console.error(`Error guardando en ${collectionName}:`, error);
      throw error;
    }
  };

  const deleteFromFirebase = async (collectionName: string, id: string) => {
    if (isDemoMode) return;
    try {
      const user = getUserContext();
      await deleteDoc(doc(db, collectionName, id));
      await addAuditLog({
        resModel: collectionName,
        resId: id,
        userId: user.id,
        userName: user.name,
        action: 'delete',
        changes: { id: [id, null] }
      });
    } catch (error) {
      console.error(`Error borrando en ${collectionName}:`, error);
      throw error;
    }
  };

  // --- ACCOUNTS & PURCHASES MODULES (MODULARIZED SERVICES) ---
  const registerPurchaseBatch = async (newPurchases: Purchase[]) => {
    setIsProcessingBatch(true);
    try {
      if (!isDemoMode) {
        await registerPurchaseBatchService(newPurchases, inventory, getUserContext());
      }
      await refreshData();
    } catch (error: any) {
      alert(`ERROR CRÍTICO: No se pudo registrar la factura.\n\nDetalle: ${error.message}`);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const runGlobalAudit = async () => {
    setIsProcessingBatch(true);
    try {
      alert("¡Auditoría Completa! El inventario ha sido verificado.");
      await refreshData();
    } catch (error: any) {
      alert("Error durante la auditoría: " + error.message);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const payCreditInvoice = async (invoiceNumber: string) => {
    setIsProcessingBatch(true);
    try {
      if (!isDemoMode) {
        await payCreditInvoiceService(invoiceNumber, purchases, getUserContext());
      } else {
        setPurchases(prev => prev.map(p => 
          (p.invoiceNumber === invoiceNumber && p.type === 'Crédito') ? { ...p, status: 'Pagada' } : p
        ));
      }
      await refreshData();
      alert('Factura marcada como PAGADA correctamente.');
    } catch (e) {
      console.error(e);
      alert('Error al procesar el pago de la factura.');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // --- CRUD FUNCTIONS ---

  const addUser = async (user: User) => {
    const newUser = { ...user, id: user.id || Math.random().toString(36).substr(2, 9) };
    setUsers(prev => [...prev, newUser]);
    await saveToFirebase('Users', newUser);
  };

  const updateUser = async (updated: User) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    await saveToFirebase('Users', updated);
  };

  const deleteUser = async (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    await deleteFromFirebase('Users', id);
  };

  const updateExchangeRate = async (val: number) => {
    const roundedRate = roundTo(val, 2);
    setExchangeRate(roundedRate);
    if (!isDemoMode) {
      const user = getUserContext();
      await setDoc(doc(db, "Settings", "exchangeRate"), { value: roundedRate.toString() });
      await addAuditLog({
        resModel: 'Settings',
        resId: 'exchangeRate',
        userId: user.id,
        userName: user.name,
        action: 'write',
        changes: { exchangeRate: [exchangeRate, roundedRate] }
      });
    }
  };

  const addCustomer = async (customer: Customer) => {
    const newCustomer = { ...customer, id: customer.id || Math.random().toString(36).substr(2, 9) };
    setCustomers(prev => [...prev, newCustomer]);
    await saveToFirebase('Customers', newCustomer);
  };

  const updateCustomer = async (updated: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
    await saveToFirebase('Customers', updated);
  };

  const deleteCustomer = async (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    await deleteFromFirebase('Customers', id);
  };

  // ─── CXC SYNC ─────────────────────────────────────────────────────────────
  /**
   * Crea o actualiza la CXC asociada a un VehicleRepair.
   * - Se llama cada vez que se guarda un informe (addRepair / updateRepair).
   * - Si el informe no tiene ítems, no abre cuenta.
   * - Construye el libro de movimientos (entries) desde cero a partir de
   *   repair.items (Cargos) y repair.installments (Abonos).
   */
  const syncRepairWithCXC = async (repair: VehicleRepair, currentAR?: AccountReceivable[]) => {
    if (isDemoMode) return;
    // Sin ítems → no hay cuenta que abrir o actualizar
    if (!repair.items || repair.items.length === 0) return;

    const arList = currentAR || accountsReceivable;
    const existing = arList.find(a => a.repairId === repair.id);

    // ── 1. Construir entradas de CARGO (productos/servicios del informe) ──
    const cargoEntries: CXCEntry[] = repair.items.map(item => ({
      id: `cargo-${item.id}`,
      date: repair.createdAt,
      type: 'Cargo' as const,
      description: `${item.description}${item.quantity > 1 ? ` x${item.quantity}` : ''}`,
      amount: item.price * item.quantity,
      repairItemId: item.id,
    }));

    // ── 2. Construir entradas de ABONO (cuotas del informe) ──
    const abonoEntries: CXCEntry[] = (repair.installments || []).map(inst => ({
      id: `abono-${inst.id}`,
      date: inst.date,
      type: 'Abono' as const,
      description: `Abono - ${inst.method || 'Efectivo $'}`,
      amount: inst.amount,
      method: inst.method,
      installmentId: inst.id,
    }));

    // ── 3. Combinar y ordenar cronológicamente ──
    const allEntries: CXCEntry[] = [...cargoEntries, ...abonoEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // ── 4. Calcular totales ──
    const totalAmount = cargoEntries.reduce((s, e) => s + e.amount, 0);
    const paidAmount = abonoEntries.reduce((s, e) => s + e.amount, 0);

    let status: AccountReceivable['status'] = 'Pendiente';
    if (paidAmount >= totalAmount && totalAmount > 0) status = 'Pagado';
    else if (paidAmount > 0) status = 'Parcial';
    else if (existing?.dueDate && new Date(existing.dueDate) < new Date()) status = 'Vencido';

    if (existing) {
      // ── Actualizar cuenta existente ──
      const updated: AccountReceivable = {
        ...existing,
        totalAmount,
        paidAmount,
        status,
        entries: allEntries,
        vehiclePlate: repair.plate,
        vehicleBrand: repair.brand,
        vehicleModel: repair.model,
        vehicleYear: repair.year,
        customerName: repair.ownerName || existing.customerName,
      };
      await saveToFirebase('AccountsReceivable', updated);
      setAccountsReceivable(prev => prev.map(a => a.id === updated.id ? updated : a));
    } else {
      // ── Crear nueva cuenta ──
      const newId = Math.random().toString(36).substr(2, 9);
      // Fecha de vencimiento: 30 días desde la apertura del informe
      const due = new Date(repair.createdAt);
      due.setDate(due.getDate() + 30);

      const newAccount: AccountReceivable = {
        id: newId,
        repairId: repair.id,
        referenceId: repair.id,
        customerId: repair.customerId,
        customerName: repair.ownerName || '',
        vehiclePlate: repair.plate,
        vehicleBrand: repair.brand,
        vehicleModel: repair.model,
        vehicleYear: repair.year,
        date: repair.createdAt,
        dueDate: due.toISOString(),
        totalAmount,
        paidAmount,
        status,
        payments: [],
        entries: allEntries,
      };
      await saveToFirebase('AccountsReceivable', newAccount);
      setAccountsReceivable(prev => [...prev, newAccount]);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const addRepair = async (repair: VehicleRepair) => {
    const newRepair = { 
      ...repair, 
      id: repair.id || Math.random().toString(36).substr(2, 9)
    };
    setRepairs(prev => [...prev, newRepair]);
    await saveToFirebase('Repairs', newRepair);
    // Abrir CXC si ya tiene ítems al momento de crear
    if (newRepair.items && newRepair.items.length > 0) {
      await syncRepairWithCXC(newRepair);
    }
  };

  const updateRepair = async (updated: VehicleRepair) => {
    setRepairs(prev => prev.map(r => r.id === updated.id ? updated : r));
    await saveToFirebase('Repairs', updated);
    // Sincronizar CXC en cada actualización del informe
    await syncRepairWithCXC(updated);
  };

  const deleteRepair = async (id: string) => {
    const repair = repairs.find(r => r.id === id);
    if (repair && repair.evidencePhotos) {
      await Promise.all(repair.evidencePhotos.map(url => deleteImageFromUrl(url).catch(console.error)));
    }
    setRepairs(prev => prev.filter(r => r.id !== id));
    await deleteFromFirebase('Repairs', id);
    // Eliminar CXC asociada
    const linkedCXC = accountsReceivable.find(a => a.repairId === id);
    if (linkedCXC) {
      await deleteFromFirebase('AccountsReceivable', linkedCXC.id);
      setAccountsReceivable(prev => prev.filter(a => a.id !== linkedCXC.id));
    }
  };

  // Deletes all repairs for a specific plate belonging to a specific customer
  const deleteVehicleByPlate = async (customerId: string, plate: string) => {
    const toDelete = repairs.filter(r => r.customerId === customerId && r.plate.toUpperCase() === plate.toUpperCase());
    
    // Delete photos first
    for (const repair of toDelete) {
      if (repair.evidencePhotos) {
        await Promise.all(repair.evidencePhotos.map(url => deleteImageFromUrl(url).catch(console.error)));
      }
    }

    setRepairs(prev => prev.filter(r => !(r.customerId === customerId && r.plate.toUpperCase() === plate.toUpperCase())));
    await Promise.all(toDelete.map(r => deleteFromFirebase('Repairs', r.id)));
  };
  
  const addSale = async (sale: Sale) => {
    if (!isDemoMode) {
      try {
        const newSale = await processSaleTransaction(sale, getUserContext());
        setSales(prev => [...prev, newSale]);
        await refreshData();
      } catch (e: any) {
        alert(`Error al procesar la venta: ${e.message}`);
        throw e;
      }
    } else {
      const newSale = { ...sale, id: sale.id || Math.random().toString(36).substr(2, 9) };
      // Deduct stock per warehouse and handle consignment transfer in demo mode
      setInventory(prevInv => {
        let currentInv = [...prevInv];
        sale.items.forEach(soldItem => {
          const pIndex = currentInv.findIndex(item => item.id === soldItem.productId);
          if (pIndex > -1) {
            const p = currentInv[pIndex];
            const saleQty = soldItem.quantity;
            
            if (p.isConsignment) {
              // 1. Deduct stock from consignment product
              const wStockConsignment = {
                gonzacars: p.warehouseStock?.gonzacars !== undefined ? p.warehouseStock.gonzacars : p.quantity,
                externo_1: p.warehouseStock?.externo_1 || 0,
                externo_2: p.warehouseStock?.externo_2 || 0,
                externo_3: p.warehouseStock?.externo_3 || 0,
                externo_4: p.warehouseStock?.externo_4 || 0
              };
              const updatedWStockConsignment = deductStockFromWarehouseStock(wStockConsignment, saleQty);
              const newTotalQtyConsignment = Object.values(updatedWStockConsignment).reduce((a: any, b: any) => a + b, 0) as number;
              
              currentInv[pIndex] = {
                ...p,
                quantity: newTotalQtyConsignment,
                warehouseStock: updatedWStockConsignment
              };
              
              // 2. Transfer stock to general inventory
              const matchIndex = currentInv.findIndex(gp => 
                !gp.isConsignment && 
                ((p.barcode && gp.barcode === p.barcode) || (gp.name.toLowerCase() === p.name.toLowerCase()))
              );
              
              if (matchIndex > -1) {
                const gp = currentInv[matchIndex];
                const genWStock = {
                  gonzacars: gp.warehouseStock?.gonzacars !== undefined ? gp.warehouseStock.gonzacars : gp.quantity,
                  externo_1: gp.warehouseStock?.externo_1 || 0,
                  externo_2: gp.warehouseStock?.externo_2 || 0,
                  externo_3: gp.warehouseStock?.externo_3 || 0,
                  externo_4: gp.warehouseStock?.externo_4 || 0
                };
                
                genWStock.gonzacars += saleQty;
                genWStock.gonzacars -= saleQty;
                const finalTotalQtyGen = Object.values(genWStock).reduce((a: any, b: any) => a + b, 0) as number;
                
                currentInv[matchIndex] = {
                  ...gp,
                  quantity: finalTotalQtyGen,
                  warehouseStock: genWStock
                };
              } else {
                // Create a new general product with 0 stock
                const newGenProduct: Product = {
                  id: Math.random().toString(36).substr(2, 9),
                  name: p.name,
                  category: p.category,
                  quantity: 0,
                  cost: p.cost,
                  price: p.price,
                  barcode: p.barcode || Math.floor(100000000000 + Math.random() * 900000000000).toString(),
                  lastEntry: new Date().toISOString().split('T')[0],
                  warehouseStock: {
                    gonzacars: 0,
                    externo_1: 0,
                    externo_2: 0,
                    externo_3: 0,
                    externo_4: 0
                  }
                };
                currentInv.push(newGenProduct);
              }
            } else {
              // Standard own product sale
              const wStock = {
                gonzacars: p.warehouseStock?.gonzacars !== undefined ? p.warehouseStock.gonzacars : p.quantity,
                externo_1: p.warehouseStock?.externo_1 || 0,
                externo_2: p.warehouseStock?.externo_2 || 0,
                externo_3: p.warehouseStock?.externo_3 || 0,
                externo_4: p.warehouseStock?.externo_4 || 0
              };
              if (wStock.gonzacars < saleQty) {
                let need = saleQty - wStock.gonzacars;
                const external = ['externo_1', 'externo_2', 'externo_3', 'externo_4'];
                for (const ext of external) {
                  if (need <= 0) break;
                  const extStock = wStock[ext] || 0;
                  if (extStock > 0) {
                    const trans = Math.min(need, extStock);
                    wStock[ext] -= trans;
                    wStock.gonzacars += trans;
                    need -= trans;
                  }
                }
              }
              wStock.gonzacars -= saleQty;
              const newTotalQty = Object.values(wStock).reduce((a: any, b: any) => a + b, 0) as number;
              currentInv[pIndex] = {
                ...p,
                quantity: newTotalQty,
                warehouseStock: wStock
              };
            }
          }
        });
        return currentInv;
      });
      setSales(prev => [...prev, newSale]);
    }
  };

  const addExpense = async (expense: Expense) => {
    const newExpense = { 
      ...expense, 
      id: expense.id || Math.random().toString(36).substr(2, 9),
      amount: roundTo(expense.amount, 4)
    };
    setExpenses(prev => [...prev, newExpense]);
    await saveToFirebase('Expenses', newExpense);
  };

  const updateExpense = async (id: string, updatedData: Partial<Expense>) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updatedData, amount: updatedData.amount !== undefined ? roundTo(updatedData.amount, 4) : e.amount } as Expense : e));
    await saveToFirebase('Expenses', { id, ...updatedData });
  };

  const addEmployee = async (emp: Employee) => {
    const newEmp = { 
      ...emp, 
      id: emp.id || Math.random().toString(36).substr(2, 9),
      baseSalary: roundTo(emp.baseSalary, 4)
    };
    setEmployees(prev => [...prev, newEmp]);
    await saveToFirebase('Employees', newEmp);
  };

  const updateEmployee = async (emp: Employee) => {
    const roundedEmp = {
      ...emp,
      baseSalary: roundTo(emp.baseSalary, 4)
    };
    setEmployees(prev => prev.map(e => e.id === roundedEmp.id ? roundedEmp : e));
    await saveToFirebase('Employees', roundedEmp);
  };

  const deleteEmployee = async (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    await deleteFromFirebase('Employees', id);
  };

  const addPayrollRecord = async (record: PayrollRecord) => {
    const newRec = { 
      ...record, 
      id: record.id || Math.random().toString(36).substr(2, 9),
      total: roundTo(record.total, 4)
    };
    setPayroll(prev => [...prev, newRec]);
    await saveToFirebase('Payroll', newRec);
  };

  // --- INVENTORY MODULAR SERVICES INTEGRATION ---

  const addProduct = async (product: Product) => {
    const newProduct = { 
      ...product, 
      id: product.id || Math.random().toString(36).substr(2, 9),
      warehouseStock: product.warehouseStock || {
        gonzacars: product.quantity || 0,
        externo_1: 0,
        externo_2: 0,
        externo_3: 0,
        externo_4: 0
      }
    };
    setInventory(prev => [...prev, newProduct]);
    if (!isDemoMode) {
      await saveToFirebase('Inventory', newProduct);
    }
  };

  const updateInventoryPrice = async (id: string, newPrice: number) => {
    const item = inventory.find(p => p.id === id);
    if (item) {
      if (!isDemoMode) {
        await updateProduct(id, { price: newPrice }, item, getUserContext());
      } else {
        const updated = { ...item, price: newPrice };
        setInventory(inventory.map(p => p.id === id ? updated : p));
      }
      await refreshData();
    }
  };

  const updateProductFull = async (id: string, updatedFields: Partial<Product>) => {
    const item = inventory.find(p => p.id === id);
    if (item) {
      if (!isDemoMode) {
        await updateProduct(id, updatedFields, item, getUserContext());
      } else {
        const updated = { ...item, ...updatedFields };
        setInventory(inventory.map(p => p.id === id ? updated : p));
      }
      await refreshData();
    }
  };

  const updateProductName = async (id: string, name: string) => {
    const item = inventory.find(p => p.id === id);
    if (item) {
      if (!isDemoMode) {
        await updateProduct(id, { name }, item, getUserContext());
      } else {
        const updated = { ...item, name };
        setInventory(inventory.map(p => p.id === id ? updated : p));
      }
      await refreshData();
    }
  };

  const updateInventoryQuantity = async (id: string, newQuantity: number, exactWarehouseStock?: Record<string, number>) => {
    const item = inventory.find(p => p.id === id);
    if (item) {
      const updatedWStock = exactWarehouseStock || adjustWarehouseStockToTotal(item.warehouseStock, newQuantity, item.quantity);
      if (!isDemoMode) {
        await updateProduct(id, { quantity: newQuantity, warehouseStock: updatedWStock }, item, getUserContext());
      } else {
        const updated = { ...item, quantity: newQuantity, warehouseStock: updatedWStock };
        setInventory(inventory.map(p => p.id === id ? updated : p));
      }
      await refreshData();
    }
  };
  
  const updateStockBatch = async (updates: { id: string; quantity: number }[]) => {
    const currentInventory = [...inventory];
    if (!isDemoMode) {
      const batch = writeBatch(db);
      updates.forEach(update => {
        const index = currentInventory.findIndex(p => p.id === update.id);
        if (index > -1) {
            const item = currentInventory[index];
            const updatedWStock = adjustWarehouseStockToTotal(item.warehouseStock, update.quantity, item.quantity);
            const updatedItem = { ...item, quantity: update.quantity, warehouseStock: updatedWStock };
            currentInventory[index] = updatedItem;
            if (updatedItem.id) {
              batch.update(doc(db, "Inventory", updatedItem.id), { 
                quantity: update.quantity,
                warehouseStock: updatedWStock
              });
            }
        }
      });
      setInventory(currentInventory);
      await batch.commit();
      
      const user = getUserContext();
      await addAuditLog({
        resModel: 'Inventory',
        resId: 'batch-update',
        userId: user.id,
        userName: user.name,
        action: 'write',
        changes: { stockBatchUpdates: [null, updates] }
      });
    }
  };

  const addVehicle = async (vehicle: Vehicle) => {
    if (!isDemoMode) {
      await setDoc(doc(db, "Vehicles", vehicle.id), vehicle);
    }
    setVehicles(prev => [...prev, vehicle]);
  };

  const updateVehicle = async (vehicle: Vehicle) => {
    if (!isDemoMode) {
      await setDoc(doc(db, "Vehicles", vehicle.id), vehicle);
    }
    setVehicles(prev => prev.map(v => v.id === vehicle.id ? vehicle : v));
  };

  const deleteVehicle = async (id: string) => {
    if (!isDemoMode) {
      await deleteDoc(doc(db, "Vehicles", id));
    }
    setVehicles(prev => prev.filter(v => v.id !== id));
  };

  const addQuote = async (quote: Quote) => {
    if (!isDemoMode) {
      await setDoc(doc(db, "Quotes", quote.id), quote);
    }
    setQuotes(prev => [...prev, quote]);
  };

  const updateQuote = async (quote: Quote) => {
    if (!isDemoMode) {
      await setDoc(doc(db, "Quotes", quote.id), quote);
    }
    setQuotes(prev => prev.map(q => q.id === quote.id ? quote : q));
  };

  /**
   * Aprueba una cotización y descuenta del inventario SOLO los productos físicos.
   * Los ítems cuya categoría sea "Servicio" o que no tengan productId NO descuentan stock.
   */
  const approveQuoteAndDeductStock = async (quote: Quote): Promise<Quote> => {
    const updatedQuote = { ...quote, status: 'Aprobada' as const };

    // Recopilar los descuentos necesarios por productId
    const stockDeductions: { id: string; newQuantity: number; item: Product }[] = [];

    for (const qItem of updatedQuote.items) {
      if (!qItem.productId) continue; // Item manual sin producto, no hay nada que descontar

      const product = inventory.find(p => p.id === qItem.productId);
      if (!product) continue;

      // Los servicios son estáticos — nunca descuentan inventario
      if (product.category === 'Servicio') continue;

      const newQty = Math.max(0, product.quantity - qItem.quantity);
      stockDeductions.push({ id: product.id, newQuantity: newQty, item: product });
    }

    if (!isDemoMode) {
      const batch = writeBatch(db);

      // 1. Guardar la cotización aprobada
      batch.set(doc(db, "Quotes", updatedQuote.id), updatedQuote);

      // 2. Aplicar descuentos de stock
      for (const deduction of stockDeductions) {
        const updatedWStock = deductStockFromWarehouseStock(
          deduction.item.warehouseStock || {},
          deduction.item.quantity - deduction.newQuantity
        );
        batch.update(doc(db, "Inventory", deduction.id), {
          quantity: deduction.newQuantity,
          warehouseStock: updatedWStock
        });
      }

      await batch.commit();
    }

    // Actualizar estado local
    setQuotes(prev => prev.map(q => q.id === updatedQuote.id ? updatedQuote : q));
    if (stockDeductions.length > 0) {
      setInventory(prev => prev.map(p => {
        const d = stockDeductions.find(x => x.id === p.id);
        if (!d) return p;
        return {
          ...p,
          quantity: d.newQuantity,
          warehouseStock: deductStockFromWarehouseStock(
            p.warehouseStock || {},
            p.quantity - d.newQuantity
          )
        };
      }));
    }

    return updatedQuote;
  };

  const deleteQuote = async (id: string) => {
    if (!isDemoMode) {
      await deleteDoc(doc(db, "Quotes", id));
    }
    setQuotes(prev => prev.filter(q => q.id !== id));
  };

  // --- APPOINTMENTS CRUD ---

  const addAppointment = async (appt: Appointment) => {
    const newAppt = { ...appt, id: appt.id || Math.random().toString(36).substr(2, 9) };
    setAppointments(prev => [...prev, newAppt]);
    if (!isDemoMode) {
      await saveToFirebase('Appointments', newAppt);
    }
    return newAppt;
  };

  const updateAppointment = async (appt: Appointment) => {
    setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a));
    if (!isDemoMode) {
      await saveToFirebase('Appointments', appt);
    }
  };

  const deleteAppointment = async (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
    if (!isDemoMode) {
      await deleteFromFirebase('Appointments', id);
    }
  };

  const updateBarcode = async (id: string, barcode: string) => {
    const item = inventory.find(p => p.id === id);
    if (item) {
      if (!isDemoMode) {
        await updateProduct(id, { barcode }, item, getUserContext());
      } else {
        const updated = { ...item, barcode };
        setInventory(inventory.map(p => p.id === id ? updated : p));
      }
      await refreshData();
    }
  };

  const sheetsUrl = 'firebase://connected';
  const saveUrl = (u: string) => {};

  return {
    loading, isProcessingBatch, isInitialLoading, sheetsUrl, saveUrl, refreshData,
    currentUser, login, loginWithGoogle, logout,
    users, addUser, updateUser, deleteUser,
    exchangeRate, setExchangeRate: updateExchangeRate,
    customers, addCustomer, updateCustomer, deleteCustomer,
    inventory, setInventory, addProduct, updateInventoryPrice, updateProductName, updateInventoryQuantity, updateStockBatch, updateBarcode, updateProductFull, 
    generateBarcode,
    repairs, setRepairs, addRepair, updateRepair, deleteRepair, deleteVehicleByPlate,
    sales, setSales, addSale,
    purchases, setPurchases, registerPurchaseBatch, payCreditInvoice,
    expenses, setExpenses, addExpense, updateExpense,
    employees, setEmployees, addEmployee, updateEmployee, deleteEmployee,
    payroll, setPayroll, addPayrollRecord,
    vehicles, setVehicles, addVehicle, updateVehicle, deleteVehicle,
    quotes, setQuotes, addQuote, updateQuote, deleteQuote, approveQuoteAndDeductStock,
    accountsReceivable, setAccountsReceivable, syncRepairWithCXC,
    accountsPayable, setAccountsPayable,
    appointments, setAppointments, addAppointment, updateAppointment, deleteAppointment,
    saveToFirebase,
    runGlobalAudit,
    isDemoMode, setIsDemoMode
  };
};
