
import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Printer,
  CheckCircle,
  Package,
  Wrench,
  Minus,
  ClipboardList,
  DollarSign,
  X,
  FileText,
  Layers,
  ArrowDownCircle,
  Receipt,
  PenTool,
  Check,
  History,
  Car,
  Clock,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Camera,
  Loader2,
  ZoomIn
} from 'lucide-react';
import { VehicleRepair, RepairItem, PaymentMethod, Product, ServiceStatus, Installment } from '../types';
import { fuzzySearch } from '../lib/utils/search';
import { uploadBase64Image, deleteImageFromUrl } from '../lib/services/storageService';

/* ─── Status visual config ─── */
const STATUS_STYLE: Record<ServiceStatus, { label: string; headerBg: string; badge: string; dot: string }> = {
  'Ingresado': { label: 'Ingresado', headerBg: 'from-blue-900 to-slate-900', badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30', dot: 'bg-blue-400' },
  'En Diagnóstico': { label: 'En Diagnóstico', headerBg: 'from-yellow-900 to-slate-900', badge: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30', dot: 'bg-yellow-400' },
  'En Reparación': { label: 'En Reparación', headerBg: 'from-orange-900 to-slate-900', badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/30', dot: 'bg-orange-400' },
  'Esperando Repuestos': { label: 'Esperando Repuestos', headerBg: 'from-purple-900 to-slate-900', badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30', dot: 'bg-purple-400' },
  'Finalizado': { label: 'Finalizado', headerBg: 'from-emerald-900 to-slate-900', badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', dot: 'bg-emerald-400' },
  'Entregado': { label: 'Entregado', headerBg: 'from-slate-800 to-slate-900', badge: 'bg-metal-mid/10 text-chrome-500 border border-white/10', dot: 'bg-slate-400' },
};

const LOGO_URL = "https://i.ibb.co/MDhy5tzK/image-2.png";

const RepairReport: React.FC<{ store: any }> = ({ store }) => {
  const [searchPlate, setSearchPlate] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentRepair, setCurrentRepair] = useState<VehicleRepair | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [showInventorySearch, setShowInventorySearch] = useState(false);
  const [invSearchTerm, setInvSearchTerm] = useState('');

  // Photo evidence states
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Estado para servicio manual
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [newService, setNewService] = useState({ description: '', price: 0, quantity: 1 });

  const [tempPaymentMethod, setTempPaymentMethod] = useState<PaymentMethod>('Efectivo $');
  const [abonoAmount, setAbonoAmount] = useState<number>(0);
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>('Efectivo $');
  const [lastInstallment, setLastInstallment] = useState<Installment | null>(null);
  const [showAbonoReceipt, setShowAbonoReceipt] = useState(false);

  // Nuevos estados para el flujo de finalización
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [printMode, setPrintMode] = useState<'none' | 'report' | 'receipt' | 'abono'>('none');

  const filteredInventory = useMemo(() => {
    return (store.inventory || []).filter((p: Product) =>
      p.name.toLowerCase().includes(invSearchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(invSearchTerm.toLowerCase()) ||
      p.barcode?.includes(invSearchTerm)
    );
  }, [store.inventory, invSearchTerm]);

  const searchResults = useMemo(() => {
    if (!searchPlate.trim()) return [];
    
    // Ordenar los más nuevos primero
    const sortedRepairs = [...store.repairs].sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    return fuzzySearch(sortedRepairs, searchPlate, [
      'plate', 'ownerName', 'brand', 'model', 'id'
    ]).slice(0, 8);
  }, [store.repairs, searchPlate]);

  const handleSelectRepair = (repair: VehicleRepair) => {
    setCurrentRepair({ ...repair });
    if (repair.paymentMethod) setTempPaymentMethod(repair.paymentMethod);
    setSearchPlate('');
    setShowDropdown(false);
  };

  const handleSearch = () => {
    if (searchResults.length > 0) {
      handleSelectRepair(searchResults[0]);
    } else if (searchPlate.trim()) {
      alert('No se encontraron reportes que coincidan con la búsqueda');
      setCurrentRepair(null);
    }
  };

  const saveManualService = () => {
    if (!currentRepair || !newService.description) {
      alert("La descripción es obligatoria");
      return;
    }
    const newItem: RepairItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'Servicio',
      description: newService.description,
      quantity: newService.quantity,
      price: newService.price
    };
    const updated = { ...currentRepair, items: [...currentRepair.items, newItem] };
    setCurrentRepair(updated);
    store.updateRepair(updated);

    // Resetear y cerrar modal
    setNewService({ description: '', price: 0, quantity: 1 });
    setShowServiceModal(false);
  };

  const addFromInventory = (product: Product) => {
    if (!currentRepair) return;
    const newItem: RepairItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: product.id,
      type: 'Repuesto',
      description: product.name,
      quantity: 1,
      price: product.price
    };
    const updated = { ...currentRepair, items: [...currentRepair.items, newItem] };
    setCurrentRepair(updated);
    store.updateRepair(updated);
    setShowInventorySearch(false);
  };

  const updateItem = (itemId: string, field: keyof RepairItem, value: any) => {
    if (!currentRepair) return;
    const updatedItems = currentRepair.items.map(i => i.id === itemId ? { ...i, [field]: value } : i);
    const updated = { ...currentRepair, items: updatedItems };
    setCurrentRepair(updated);
    store.updateRepair(updated);
  };

  const removeItem = (itemId: string) => {
    if (!currentRepair) return;
    const updatedItems = currentRepair.items.filter(i => i.id !== itemId);
    const updated = { ...currentRepair, items: updatedItems };
    setCurrentRepair(updated);
    store.updateRepair(updated);
  };

  const calculateTotal = () => {
    if (!currentRepair) return 0;
    return currentRepair.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  // ─── Photo Evidence helpers ───────────────────────────────────────────────

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const MAX_DIM = 600;
      const QUALITY = 0.30;
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = evt => {
        const img = new Image();
        img.src = evt.target?.result as string;
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > h) { if (w > MAX_DIM) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; } }
          else        { if (h > MAX_DIM) { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; } }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(evt.target?.result as string); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', QUALITY));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentRepair) return;
    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImage(file);
      
      const photoName = `photo_${Date.now()}.jpg`;
      const url = await uploadBase64Image(compressed, `repairs/${currentRepair.id}/${photoName}`);
      
      const photos = currentRepair.evidencePhotos || [];
      if (photos.length < 5) {
        const updated = { ...currentRepair, evidencePhotos: [...photos, url] };
        setCurrentRepair(updated);
        try {
          await store.updateRepair(updated);
        } catch (saveErr: any) {
          // Roll back local state if Firebase save failed
          setCurrentRepair(currentRepair);
          alert(`⚠️ Error al guardar la foto en el servidor: ${saveErr?.message}`);
        }
      }
    } catch {
      alert('No se pudo procesar la foto. Intente con una imagen más pequeña o en formato JPG/PNG.');
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  const removePhoto = async (idx: number) => {
    if (!currentRepair) return;
    const photos = [...(currentRepair.evidencePhotos || [])];
    const removedUrl = photos.splice(idx, 1)[0];
    const updated = { ...currentRepair, evidencePhotos: photos };
    setCurrentRepair(updated);
    
    try {
      await store.updateRepair(updated);
      if (removedUrl) {
        await deleteImageFromUrl(removedUrl);
      }
    } catch (e) {
      console.error('Error al borrar imagen:', e);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const calculatePaid = () => {
    if (!currentRepair || !currentRepair.installments) return 0;
    return currentRepair.installments.reduce((acc, inst) => acc + Number(inst.amount), 0);
  };

  const calculateBalance = () => calculateTotal() - calculatePaid();

  const registerAbono = () => {
    if (!currentRepair || abonoAmount <= 0) return;
    const newInstallment: Installment = {
      id: `ab-${Date.now()}`,
      date: new Date().toISOString(),
      amount: abonoAmount,
      method: abonoMethod
    };
    const updated: VehicleRepair = {
      ...currentRepair,
      installments: [...(currentRepair.installments || []), newInstallment]
    };
    setCurrentRepair(updated);
    store.updateRepair(updated);
    setLastInstallment(newInstallment);
    setShowAbonoModal(false);
    setShowAbonoReceipt(true);
    setAbonoAmount(0);
  };

  const finalizeRepair = () => {
    if (!currentRepair) return;

    // 1. Calcular Saldo Restante para liquidar
    const pendingBalance = calculateBalance();

    // 2. Crear lista de abonos actualizada (Agregando el pago final si existe deuda)
    let updatedInstallments = [...(currentRepair.installments || [])];

    if (pendingBalance > 0.01) {
      updatedInstallments.push({
        id: `final-${Date.now()}`,
        date: new Date().toISOString(),
        amount: pendingBalance,
        method: tempPaymentMethod // El método seleccionado en el modal
      });
    }

    // 3. Crear objeto actualizado
    const updated: VehicleRepair = {
      ...currentRepair,
      status: 'Entregado',
      finishedAt: new Date().toISOString(),
      paymentMethod: tempPaymentMethod,
      installments: updatedInstallments
    };

    // 4. Guardar en Store y Actualizar Estado Local
    store.updateRepair(updated);
    setCurrentRepair(updated);

    // 5. Cerrar modal de pago y abrir modal de éxito/impresión
    setShowPayModal(false);
    setShowSuccessModal(true);
  };

  // ─── Generador de ventana de impresión dedicada ────────────────────────────
  // Enfoque senior: genera HTML puro en ventana nueva, sin interferencia del CSS de la app.
  // Garantiza impresión completa y multipágina en todos los navegadores.
  const handlePrint = (mode: 'report' | 'receipt' | 'abono') => {
    if (!currentRepair) return;

    const total   = currentRepair.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const paid    = (currentRepair.installments || []).reduce((s, i) => s + Number(i.amount), 0);
    const balance = Math.max(0, total - paid);
    const fmt     = (n: number) => `$${n.toFixed(2)}`;
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-VE');
    const orderId = currentRepair.id.slice(-6).toUpperCase();
    const now     = new Date().toLocaleString('es-VE');

    let html = '';

    if (mode === 'report') {
      // ── INFORME CORPORATIVO ───────────────────────────────────────────────
      const itemsRows = currentRepair.items.map(item => `
        <tr>
          <td class="center">${item.quantity}</td>
          <td><strong>${item.description.toUpperCase()}</strong></td>
          <td class="center type">${item.type}</td>
          <td class="right">${fmt(item.price)}</td>
          <td class="right bold">${fmt(item.price * item.quantity)}</td>
        </tr>
      `).join('');

      const paymentsRows = (currentRepair.installments || []).length > 0
        ? (currentRepair.installments || []).map(inst => `
            <tr>
              <td>${fmtDate(inst.date)}</td>
              <td class="bold">${inst.method.toUpperCase()}</td>
              <td class="right green bold">${fmt(inst.amount)}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" class="muted italic">No hay pagos registrados.</td></tr>';

      const diagnosisBlock = currentRepair.diagnosis ? `
        <div class="section">
          <div class="section-title">Diagnóstico / Observaciones</div>
          <p style="font-size:11px;line-height:1.5;color:#333;">${currentRepair.diagnosis}</p>
        </div>
      ` : '';

      html = `
        <!DOCTYPE html><html lang="es"><head>
        <meta charset="UTF-8"/>
        <title>Informe de Servicio – Gonzacars C.A.</title>
        <style>
          @page { size: letter; margin: 18mm 20mm 22mm 20mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
          /* ── Header ── */
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 14px; margin-bottom: 18px; }
          .logo { width: 60px; height: 60px; object-fit: contain; }
          .company h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; }
          .company p  { font-size: 9px; color: #555; margin-top: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
          .doc-info { text-align: right; }
          .doc-info h2 { font-size: 16px; font-weight: 900; text-transform: uppercase; }
          .doc-info .doc-id { font-size: 22px; font-weight: 900; color: #444; margin-top: 2px; }
          .doc-info .doc-date { font-size: 9px; color: #888; margin-top: 4px; text-transform: uppercase; }
          /* ── Grid cliente/vehículo ── */
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 18px; }
          .meta-box .label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #888; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 6px; }
          .meta-box .name  { font-size: 14px; font-weight: 900; text-transform: uppercase; }
          .meta-box .sub   { font-size: 10px; color: #555; margin-top: 2px; }
          .plate { font-family: monospace; font-size: 13px; font-weight: 900; background: #f0f0f0; border: 1px solid #ccc; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-top: 4px; }
          /* ── Tabla items ── */
          .section { margin-bottom: 18px; }
          .section-title { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #888; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; }
          thead tr { border-bottom: 2px solid #111; }
          thead th { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #555; padding: 6px 4px; }
          tbody tr { border-bottom: 1px solid #eee; page-break-inside: avoid; }
          tbody td { padding: 7px 4px; font-size: 11px; vertical-align: middle; }
          tbody tr:last-child { border-bottom: none; }
          .type { font-size: 9px; color: #888; text-transform: uppercase; }
          /* ── Totales ── */
          .totals-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; margin-top: 8px; }
          .payments-section { flex: 1; }
          .totals-box { width: 220px; background: #f7f7f7; border: 1px solid #ddd; border-radius: 8px; padding: 14px; }
          .totals-box .row { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; margin-bottom: 6px; color: #555; text-transform: uppercase; }
          .totals-box .row.total-row { border-top: 2px solid #222; padding-top: 8px; margin-top: 4px; }
          .totals-box .row.total-row span:last-child { font-size: 20px; font-weight: 900; color: #111; }
          .totals-box .row.green { color: #16a34a; }
          /* ── Estado ── */
          .status-badge { display: inline-block; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border: 1.5px solid #ccc; border-radius: 20px; padding: 2px 10px; color: #444; margin-bottom: 14px; }
          /* ── Firmas ── */
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 40px; padding-top: 8px; }
          .sig-line { border-top: 1px solid #999; text-align: center; padding-top: 6px; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #888; }
          .footer { text-align: center; margin-top: 24px; padding-top: 10px; border-top: 1px solid #eee; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #aaa; }
          /* ── Utils ── */
          .center { text-align: center; }
          .right  { text-align: right; }
          .bold   { font-weight: 900; }
          .green  { color: #16a34a; }
          .muted  { color: #999; }
          .italic { font-style: italic; }
        </style>
        </head><body>

          <div class="header">
            <div style="display:flex;align-items:center;gap:14px;">
              <img class="logo" src="${LOGO_URL}" alt="Logo" />
              <div class="company">
                <h1>Gonzacars C.A.</h1>
                <p>RIF: J-50030426-9</p>
                <p>Valencia, Edo. Carabobo</p>
                <p>Taller Mecánico &amp; Repuestos</p>
              </div>
            </div>
            <div class="doc-info">
              <h2>${currentRepair.status === 'Entregado' ? 'Informe de Servicio' : 'Presupuesto'}</h2>
              <div class="doc-id">#${orderId}</div>
              <div class="doc-date">Emisión: ${now}</div>
            </div>
          </div>

          <span class="status-badge">Estado: ${currentRepair.status}</span>

          <div class="meta-grid">
            <div class="meta-box">
              <div class="label">Cliente</div>
              <div class="name">${currentRepair.ownerName}</div>
              <div class="sub">CI / ID: ${currentRepair.customerId || '—'}</div>
              ${currentRepair.phone ? `<div class="sub">Tel: ${currentRepair.phone}</div>` : ''}
            </div>
            <div class="meta-box">
              <div class="label">Vehículo</div>
              <div class="name">${currentRepair.brand} ${currentRepair.model}</div>
              <div class="sub">Año: ${currentRepair.year} &nbsp;|&nbsp; Color: ${currentRepair.color || '—'}</div>
              <div class="sub">Km: ${currentRepair.mileage ? currentRepair.mileage.toLocaleString() : '—'}</div>
              <div class="plate">${currentRepair.plate.toUpperCase()}</div>
            </div>
          </div>

          <div class="section">
            <div class="label" style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#888;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">Servicio / Tipo</div>
            <p style="font-size:11px;font-weight:700;">${currentRepair.serviceType || '—'}</p>
          </div>

          ${diagnosisBlock}

          <div class="section">
            <div class="section-title">Detalle de Trabajos y Repuestos</div>
            <table>
              <thead>
                <tr>
                  <th class="center" style="width:40px;">Cant.</th>
                  <th>Descripción</th>
                  <th class="center" style="width:80px;">Tipo</th>
                  <th class="right" style="width:90px;">P. Unit.</th>
                  <th class="right" style="width:90px;">Importe</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
          </div>

          <div class="totals-row">
            <div class="payments-section">
              <div class="section-title">Historial de Pagos</div>
              <table>
                <thead>
                  <tr>
                    <th style="width:90px;">Fecha</th>
                    <th>Método</th>
                    <th class="right" style="width:90px;">Monto</th>
                  </tr>
                </thead>
                <tbody>${paymentsRows}</tbody>
              </table>
            </div>
            <div class="totals-box">
              <div class="row"><span>Total Servicio:</span><span>${fmt(total)}</span></div>
              <div class="row green"><span>Total Pagado:</span><span>−${fmt(paid)}</span></div>
              <div class="row total-row"><span>Saldo Pendiente:</span><span>${fmt(balance)}</span></div>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-line">Recibí Conforme (Cliente)</div>
            <div class="sig-line">Autorizado Por (Taller)</div>
          </div>

          <div class="footer">Gonzacars C.A. — Garantía de Servicio — RIF: J-50030426-9</div>
        </body></html>
      `;

    } else if (mode === 'receipt') {
      // ── RECIBO DE COBRO (TICKET) ──────────────────────────────────────────
      const itemLines = currentRepair.items.map(item => `
        <div class="item-row">
          <span>${item.quantity} x ${item.description.toUpperCase()}</span>
          <span>${fmt(item.price * item.quantity)}</span>
        </div>
      `).join('');

      html = `
        <!DOCTYPE html><html lang="es"><head>
        <meta charset="UTF-8"/>
        <title>Recibo – Gonzacars C.A.</title>
        <style>
          @page { size: 80mm auto; margin: 6mm 4mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Courier New', monospace; font-size: 11px; color: #111; background: #fff; width: 72mm; }
          .center { text-align: center; }
          .logo { width: 48px; height: 48px; object-fit: contain; }
          .title { font-size: 14px; font-weight: 900; text-transform: uppercase; margin: 6px 0 2px; }
          .company { font-weight: 700; font-size: 11px; }
          .address { font-size: 9px; color: #666; margin-top: 2px; }
          .divider-dash { border: none; border-top: 1px dashed #999; margin: 8px 0; }
          .divider-solid { border: none; border-top: 1px solid #111; margin: 8px 0; }
          .meta-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 10px; }
          .meta-row .label { color: #555; }
          .item-row { display: flex; justify-content: space-between; font-size: 10px; margin: 3px 0; }
          .item-row span:first-child { max-width: 150px; overflow: hidden; }
          .section-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ddd; padding-bottom: 2px; margin-bottom: 4px; color: #666; }
          .totals .row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin: 3px 0; }
          .totals .final { display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; border-top: 2px solid #111; padding-top: 5px; margin-top: 5px; }
          .thanks { text-align: center; margin-top: 12px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
        </style></head><body>
          <div class="center">
            <img class="logo" src="${LOGO_URL}" alt="Logo"/>
            <div class="title">Recibo de Cobro</div>
            <div class="company">Gonzacars C.A.</div>
            <div class="address">RIF: J-50030426-9 | Valencia, Carabobo</div>
          </div>
          <hr class="divider-dash"/>
          <div class="meta-row"><span class="label">ORDEN:</span><span><strong>#${orderId}</strong></span></div>
          <div class="meta-row"><span class="label">FECHA:</span><span>${new Date().toLocaleDateString('es-VE')}</span></div>
          <div class="meta-row"><span class="label">PLACA:</span><span><strong>${currentRepair.plate.toUpperCase()}</strong></span></div>
          <div class="meta-row"><span class="label">CLIENTE:</span><span>${currentRepair.ownerName.toUpperCase()}</span></div>
          <div class="meta-row"><span class="label">VEHÍCULO:</span><span>${currentRepair.brand} ${currentRepair.model} ${currentRepair.year}</span></div>
          <hr class="divider-dash"/>
          <div class="section-label">Conceptos</div>
          ${itemLines}
          <hr class="divider-dash"/>
          <div class="totals">
            <div class="row"><span>TOTAL SERVICIO:</span><span>${fmt(total)}</span></div>
            <div class="row"><span>TOTAL PAGADO:</span><span>${fmt(paid)}</span></div>
            <div class="final"><span>SALDO:</span><span>${fmt(balance)}</span></div>
          </div>
          <div class="thanks">¡Gracias por su preferencia!<br/>Conserve este ticket como comprobante.</div>
        </body></html>
      `;

    } else if (mode === 'abono' && lastInstallment) {
      // ── ESTADO DE CUENTA / ABONO ─────────────────────────────────────────
      const paymentRows = (currentRepair.installments || []).map(inst => `
        <div class="meta-row">
          <span>${fmtDate(inst.date)}</span>
          <span>${inst.method.toUpperCase()}</span>
          <span class="green bold">${fmt(inst.amount)}</span>
        </div>
      `).join('');

      html = `
        <!DOCTYPE html><html lang="es"><head>
        <meta charset="UTF-8"/>
        <title>Estado de Cuenta – Gonzacars C.A.</title>
        <style>
          @page { size: 80mm auto; margin: 6mm 4mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Courier New', monospace; font-size: 11px; color: #111; background: #fff; width: 72mm; }
          .center { text-align: center; }
          .logo { width: 48px; height: 48px; object-fit: contain; }
          .title { font-size: 14px; font-weight: 900; text-transform: uppercase; margin: 6px 0 2px; }
          .company { font-weight: 700; font-size: 11px; }
          .address { font-size: 9px; color: #666; margin-top: 2px; }
          .divider-dash { border: none; border-top: 1px dashed #999; margin: 8px 0; }
          .meta-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 10px; gap: 4px; }
          .section-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ddd; padding-bottom: 2px; margin-bottom: 6px; color: #666; }
          .highlight { background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; padding: 6px 8px; margin: 6px 0; }
          .highlight .label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #888; }
          .highlight .amount { font-size: 16px; font-weight: 900; }
          .totals .row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin: 3px 0; }
          .totals .final { display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; border-top: 2px solid #111; padding-top: 5px; margin-top: 5px; }
          .green { color: #16a34a; }
          .bold  { font-weight: 900; }
          .thanks { text-align: center; margin-top: 12px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
        </style></head><body>
          <div class="center">
            <img class="logo" src="${LOGO_URL}" alt="Logo"/>
            <div class="title">Estado de Cuenta</div>
            <div class="company">Gonzacars C.A.</div>
            <div class="address">RIF: J-50030426-9 | Valencia, Carabobo</div>
          </div>
          <hr class="divider-dash"/>
          <div class="meta-row"><span>FECHA:</span><span>${new Date().toLocaleString('es-VE')}</span></div>
          <div class="meta-row"><span>CLIENTE:</span><span>${currentRepair.ownerName.toUpperCase()}</span></div>
          <div class="meta-row"><span>PLACA:</span><span><strong>${currentRepair.plate.toUpperCase()}</strong></span></div>
          <div class="meta-row"><span>ORDEN:</span><span>#${orderId}</span></div>
          <hr class="divider-dash"/>
          <div class="highlight">
            <div class="label">Último Abono Registrado</div>
            <div class="amount green">${fmt(lastInstallment.amount)}</div>
            <div style="font-size:9px;color:#666;margin-top:2px;">${lastInstallment.method.toUpperCase()} — ${fmtDate(lastInstallment.date)}</div>
          </div>
          <div class="section-label">Historial Completo de Pagos</div>
          ${paymentRows}
          <hr class="divider-dash"/>
          <div class="totals">
            <div class="row"><span>PRESUPUESTO TOTAL:</span><span>${fmt(total)}</span></div>
            <div class="row green"><span>TOTAL ABONADO:</span><span>−${fmt(paid)}</span></div>
            <div class="final"><span>SALDO PENDIENTE:</span><span>${fmt(balance)}</span></div>
          </div>
          <div class="thanks">Este documento certifica el estado de cuenta actual.<br/>¡Gracias por su preferencia!</div>
        </body></html>
      `;
    }

    if (!html) return;

    // Abrir ventana dedicada y disparar impresión automáticamente
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Por favor permite ventanas emergentes para imprimir.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Esperar a que cargue el logo antes de imprimir
    win.onload = () => {
      setTimeout(() => {
        win.focus();
        win.print();
      }, 400);
    };
  };

  const handleFinishProcess = () => {
    setShowSuccessModal(false);
    setCurrentRepair(null);
    setSearchPlate('');
    setPrintMode('none');
    setTempPaymentMethod('Efectivo $');
  };

  const getStatusBadge = (status: ServiceStatus) => {
    const cfg = STATUS_STYLE[status];
    return cfg ? cfg.badge : 'bg-metal-mid text-chrome-200';
  };

  return (
    <div className="module-page max-w-7xl mx-auto h-full flex flex-col">
      {/* Los documentos PDF se generan en ventana dedicada via handlePrint() — sin DOM de impresión en la app */}

      {/* UI APLICACIÓN (NO-PRINT) */}
      <div className="print:hidden flex-1 flex flex-col animate-fade-in-up">
        {/* Premium Search Bar */}
        <div className="bg-metal-mid p-5 rounded-2xl shadow-sm border border-metal-border mb-6 flex gap-3 items-center relative z-20">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={18} />
            <input
              type="text"
              placeholder="Buscar informe por placa, cliente, marca o modelo..."
              className="w-full pl-11 pr-4 py-3.5 bg-metal-dark border-2 border-metal-border focus:border-blue-500 focus:bg-metal-mid rounded-2xl uppercase outline-none focus:ring-4 focus:ring-blue-500/15 font-bold text-sm transition-all"
              value={searchPlate}
              onChange={(e) => {
                setSearchPlate(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {/* Dropdown Menu */}
            {showDropdown && searchPlate.trim() && searchResults.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)}></div>
                <div className="absolute top-full left-0 right-0 mt-2 bg-metal-dark border border-metal-border rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  {searchResults.map(repair => (
                    <button
                      key={repair.id}
                      onClick={() => handleSelectRepair(repair)}
                      className="w-full text-left px-4 py-3 border-b border-metal-border hover:bg-metal-mid transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-black text-chrome-200 uppercase tracking-wide group-hover:text-blue-400">
                          {repair.plate} - {repair.brand} {repair.model}
                        </div>
                        <div className="text-[10px] font-bold text-chrome-500 uppercase tracking-widest mt-0.5">
                          {repair.ownerName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-chrome-400">
                          {new Date(repair.createdAt).toLocaleDateString()}
                        </div>
                        <div className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${STATUS_STYLE[repair.status]?.badge.replace('border', '').replace('bg-', 'text-').split(' ')[1]}`}>
                          {repair.status}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-600/25"
          >
            <Search size={15} /> Buscar
          </button>
        </div>

        {currentRepair ? (
          <div className="bg-metal-mid rounded-[2rem] shadow-sm border border-metal-border overflow-hidden flex-1 flex flex-col relative animate-scale-in">
            {/* Vehicle Card Header */}
            <div className={`p-6 lg:p-8 bg-gradient-to-br ${STATUS_STYLE[currentRepair.status]?.headerBg || 'from-slate-900 to-slate-950'} text-white flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 shrink-0`}>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${STATUS_STYLE[currentRepair.status]?.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[currentRepair.status]?.dot}`} />
                    {currentRepair.status}
                  </span>
                  <span className="font-mono text-sm font-black text-blue-400 tracking-[0.25em] bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-xl">
                    {currentRepair.plate?.toUpperCase()}
                  </span>
                </div>
                <h2 className="text-2xl lg:text-3xl font-black uppercase tracking-tight leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {currentRepair.ownerName}
                </h2>
                <p className="text-chrome-500 font-semibold text-sm mt-2">
                  {currentRepair.brand} {currentRepair.model} • {currentRepair.year}
                </p>
                <p className="text-chrome-400 text-xs font-medium mt-1 flex items-center gap-1.5">
                  <Clock size={11} /> Ingresado: {new Date(currentRepair.createdAt).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="bg-metal-mid/10 border border-white/10 px-5 py-4 rounded-2xl text-right backdrop-blur-sm">
                  <p className="text-[9px] font-black text-chrome-400 uppercase tracking-widest mb-1">Presupuesto Total</p>
                  <p className="text-3xl font-black tracking-tight text-blue-300 leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    ${calculateTotal().toFixed(2)}
                  </p>
                  {calculatePaid() > 0 && (
                    <p className="text-[10px] text-emerald-400 font-bold mt-1">Abonado: ${calculatePaid().toFixed(2)}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentRepair.status !== 'Entregado' && (
                    <button
                      onClick={() => setShowAbonoModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <DollarSign size={13} /> Abono
                    </button>
                  )}
                  <button
                    onClick={() => handlePrint('report')}
                    className="bg-metal-mid/10 hover:bg-metal-mid/20 border border-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                  >
                    <Printer size={13} /> Imprimir
                  </button>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-10 overflow-y-auto custom-scrollbar flex-1 bg-metal-dark/20">
              {currentRepair.status === 'Entregado' && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-2xl flex items-center gap-3">
                  <AlertCircle size={24} />
                  <div>
                    <h4 className="font-black uppercase tracking-widest text-sm">Informe Cerrado Definitivamente</h4>
                    <p className="text-xs font-medium mt-1 text-red-400/80">El vehículo ha sido entregado. No se pueden agregar más servicios, repuestos ni abonos.</p>
                  </div>
                </div>
              )}
              <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-xl font-black text-chrome-100 uppercase tracking-tighter flex items-center gap-3">
                    <Layers size={24} className="text-blue-600" /> Cargos a la Orden
                  </h3>
                  {currentRepair.status !== 'Entregado' && (
                    <div className="flex gap-2">
                      <button onClick={() => setShowInventorySearch(true)} className="px-4 py-2 btn-chrome rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700">
                        + Repuesto
                      </button>
                      <button onClick={() => setShowServiceModal(true)} className="px-4 py-2 btn-chrome rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black">
                        + Servicio Manual
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-metal-mid rounded-3xl border-2 border-metal-border shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-metal-dark border-b border-metal-border">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest">Descripción del Item</th>
                        <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-center w-32">Cantidad</th>
                        <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right w-40">Precio Unit.</th>
                        <th className="px-6 py-4 text-[10px] font-black text-chrome-400 uppercase tracking-widest text-right w-40">Importe</th>
                        <th className="px-6 py-4 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentRepair.items.map(item => (
                        <tr key={item.id} className="group hover:bg-blue-50/30 transition-colors duration-200">
                          <td className="px-6 py-4">
                            <div className="relative">
                              <input
                                type="text"
                                className="w-full bg-transparent font-bold text-chrome-200 uppercase outline-none border-b border-transparent focus:border-blue-500 focus:text-blue-600 transition-all placeholder:text-chrome-500 disabled:opacity-80"
                                value={item.description}
                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                placeholder="Descripción del servicio o repuesto"
                                disabled={currentRepair.status === 'Entregado'}
                              />
                              <span className="text-[9px] font-black text-chrome-500 uppercase tracking-widest block mt-1">{item.type}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {currentRepair.status === 'Entregado' ? (
                              <div className="text-center font-black text-chrome-200">{item.quantity}</div>
                            ) : (
                              <div className="flex items-center justify-center bg-metal-mid border border-metal-border rounded-xl p-1 shadow-sm w-fit mx-auto">
                                <button onClick={() => updateItem(item.id, 'quantity', Math.max(1, item.quantity - 1))} className="w-8 h-8 flex items-center justify-center text-chrome-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Minus size={14} /></button>
                                <input
                                  type="number"
                                  className="w-10 text-center font-black text-chrome-200 bg-transparent outline-none text-sm"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                                />
                                <button onClick={() => updateItem(item.id, 'quantity', item.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-chrome-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Plus size={14} /></button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="relative">
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-chrome-500 text-xs">$</span>
                              <input
                                type="number"
                                className="w-full text-right bg-transparent font-bold text-chrome-200 outline-none border-b border-transparent focus:border-blue-500 transition-all disabled:opacity-80"
                                value={item.price}
                                onChange={(e) => updateItem(item.id, 'price', Number(e.target.value))}
                                disabled={currentRepair.status === 'Entregado'}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-black text-chrome-100 bg-metal-mid px-3 py-1 rounded-lg">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {currentRepair.status !== 'Entregado' && (
                              <button onClick={() => removeItem(item.id)} className="w-8 h-8 flex items-center justify-center text-chrome-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── EVIDENCIAS FOTOGRÁFICAS ─────────────────────────────── */}
              <div className="border-t border-metal-border pt-8">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-xl font-black text-chrome-100 uppercase tracking-tighter flex items-center gap-3">
                    <Camera size={24} className="text-cyan-500" /> Evidencias Fotográficas
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                      (currentRepair.evidencePhotos?.length || 0) >= 5
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-metal-mid text-chrome-400'
                    }`}>
                      {currentRepair.evidencePhotos?.length || 0} / 5
                    </span>
                    {(currentRepair.evidencePhotos?.length || 0) < 5 && currentRepair.status !== 'Entregado' && (
                      <label className="cursor-pointer flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">
                        {isCompressingPhoto
                          ? <><Loader2 size={13} className="animate-spin" /> Procesando…</>
                          : <><Plus size={13} /> Agregar Foto</>
                        }
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoUpload}
                          disabled={isCompressingPhoto}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {(currentRepair.evidencePhotos?.length || 0) > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                    {(currentRepair.evidencePhotos || []).map((photo, idx) => (
                      <div key={idx} className="relative aspect-square group rounded-xl overflow-hidden border border-metal-border shadow-sm">
                        <img
                          src={photo}
                          alt={`Evidencia ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                        />
                        {/* Overlay actions */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={() => setLightboxPhoto(photo)}
                            className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white transition-all"
                            title="Ver ampliada"
                          >
                            <ZoomIn size={14} />
                          </button>
                          {currentRepair.status !== 'Entregado' && (
                            <button
                              onClick={() => removePhoto(idx)}
                              className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-white transition-all"
                              title="Eliminar foto"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] font-black px-1.5 py-0.5 rounded">
                          {idx + 1}
                        </div>
                      </div>
                    ))}
                    {/* Placeholder vacíos */}
                    {isCompressingPhoto && (
                      <div className="aspect-square border-2 border-dashed border-cyan-400/50 rounded-xl bg-cyan-500/5 flex flex-col items-center justify-center">
                        <Loader2 className="animate-spin text-cyan-500 mb-1" size={20} />
                        <span className="text-[9px] font-bold text-chrome-400">Comprimiendo…</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed border-metal-border rounded-2xl bg-metal-dark/30 flex flex-col items-center justify-center py-10 transition-all ${currentRepair.status !== 'Entregado' ? 'cursor-pointer hover:border-cyan-400/50 hover:bg-cyan-500/5' : ''}`}
                    onClick={() => currentRepair.status !== 'Entregado' && photoInputRef.current?.click()}
                  >
                    <Camera size={36} className="text-chrome-500 mb-3" />
                    <p className="text-sm font-black text-chrome-500 uppercase tracking-wide">Sin fotografías</p>
                    {currentRepair.status !== 'Entregado' && (
                      <p className="text-xs text-chrome-500 font-medium mt-1">Haz clic para agregar la primera evidencia</p>
                    )}
                  </div>
                )}
              </div>
              {/* ──────────────────────────────────────────────────────────── */}

              <div className="pt-6 border-t border-metal-border flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handlePrint('report')}
                  className="flex-1 bg-metal-mid border-2 border-metal-border hover:border-slate-900 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-metal-dark transition-all"
                >
                  <Printer size={18} /> Informe Preliminar
                </button>
                {currentRepair.status !== 'Entregado' && (
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98]"
                  >
                    <CheckCircle size={18} /> Cerrar y Entregar Vehículo
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-chrome-500 border-2 border-dashed border-metal-border rounded-[2rem] bg-metal-mid animate-fade-in">
            <div className="w-20 h-20 bg-metal-dark rounded-3xl flex items-center justify-center mb-5 border border-metal-border">
              <Car size={36} className="text-chrome-500" />
            </div>
            <h4 className="text-lg font-black text-chrome-500 uppercase tracking-wide" style={{ fontFamily: 'Outfit, sans-serif' }}>Busca un vehículo por placa</h4>
            <p className="text-sm text-chrome-500 font-medium mt-2">Escribe la placa en el campo de arriba y presiona Buscar</p>
          </div>
        )}
      </div>

      {/* LIGHTBOX */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 print:hidden"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxPhoto}
              alt="Evidencia ampliada"
              className="w-full h-full object-contain rounded-2xl shadow-2xl"
              style={{ maxHeight: '85vh' }}
            />
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-4 -right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL SERVICIO MANUAL */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 print:hidden">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-lg w-full p-10 animate-in zoom-in duration-300 border border-metal-border">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                <PenTool size={32} />
              </div>
              <h3 className="text-2xl font-black text-chrome-100 uppercase tracking-tight">Agregar Servicio Manual</h3>
              <p className="text-chrome-500 text-xs font-bold uppercase tracking-widest mt-1">Detalles del cargo personalizado</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Descripción del Servicio</label>
                <input
                  type="text"
                  placeholder="Ej: Mano de Obra, Revisión Eléctrica..."
                  className="w-full px-6 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-bold transition-all uppercase"
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Costo Unitario ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-6 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-black text-lg transition-all"
                    value={newService.price || ''}
                    onChange={(e) => setNewService({ ...newService, price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Cantidad</label>
                  <input
                    type="number"
                    placeholder="1"
                    className="w-full px-6 py-4 bg-metal-dark border border-metal-border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/15 font-black text-lg transition-all text-center"
                    value={newService.quantity}
                    onChange={(e) => setNewService({ ...newService, quantity: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowServiceModal(false)} className="flex-1 py-4 text-chrome-500 font-black uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors">
                  Cancelar
                </button>
                <button onClick={saveManualService} className="flex-[1.5] btn-chrome py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition-all">
                  Agregar Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ABONO */}
      {showAbonoModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 print:hidden">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-md w-full p-12 text-center animate-in zoom-in duration-300">
            <h3 className="text-3xl font-black text-chrome-100 mb-2 uppercase tracking-tight">Registrar Abono</h3>
            <p className="text-chrome-500 font-bold uppercase text-[10px] tracking-widest mb-10">Monto del pago parcial</p>
            <div className="space-y-8">
              <input
                type="number"
                className="w-full px-6 py-8 bg-metal-dark border-4 border-metal-border rounded-3xl font-black text-6xl text-chrome-100 text-center outline-none"
                value={abonoAmount || ''}
                onChange={(e) => setAbonoAmount(Number(e.target.value))}
                autoFocus
              />
              <select className="w-full px-6 py-4 bg-metal-dark border-2 border-metal-border rounded-2xl font-black uppercase text-xs outline-none" value={abonoMethod} onChange={(e) => setAbonoMethod(e.target.value as any)}>
                {['Efectivo $', 'Efectivo Bs', 'Pago Móvil', 'TDD', 'TDC', 'Zelle', 'TDC', 'Binance'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button onClick={registerAbono} className="w-full bg-emerald-600 text-white py-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-700 transition-all">
                Confirmar Pago
              </button>
              <button onClick={() => setShowAbonoModal(false)} className="w-full py-4 text-chrome-500 font-black uppercase text-[10px] tracking-widest">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ESTADO DE CUENTA (CONFIRMACIÓN ABONO) */}
      {showAbonoReceipt && lastInstallment && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center z-[110] p-4 print:hidden">
          <div className="bg-metal-mid rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300 flex flex-col">
            {/* Header */}
            <div className="bg-metal-dark p-6 border-b border-metal-border flex justify-between items-center">
              <h3 className="text-lg font-black text-chrome-100 uppercase tracking-tight">Estado de Cuenta</h3>
              <button onClick={() => setShowAbonoReceipt(false)} className="text-chrome-500 hover:text-chrome-200"><X size={20} /></button>
            </div>

            {/* Content "Statement" */}
            <div className="p-8 bg-metal-mid space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="text-center">
                <p className="text-[10px] font-bold text-chrome-500 uppercase tracking-widest mb-1">{new Date(lastInstallment.date).toLocaleDateString()} - {new Date(lastInstallment.date).toLocaleTimeString()}</p>
                <h2 className="text-4xl font-black text-chrome-100 tracking-tighter">${lastInstallment.amount.toFixed(2)}</h2>
                <span className="inline-block mt-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                  Abono Registrado
                </span>
              </div>

              <div className="bg-metal-dark p-4 rounded-xl border border-metal-border text-[10px] space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-metal-border">
                  <span className="text-chrome-500 font-bold uppercase flex items-center gap-2"><History size={12} /> Historial de Pagos</span>
                </div>
                {(currentRepair?.installments || []).map((inst, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-chrome-400">{new Date(inst.date).toLocaleDateString()}</span>
                    <span className="font-bold text-chrome-200 uppercase">{inst.method}</span>
                    <span className="font-black text-chrome-100">${inst.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-chrome-400 uppercase">Costo Total Servicio</span>
                  <span className="font-black text-chrome-100">${calculateTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-chrome-400 uppercase">Total Abonado</span>
                  <span className="font-black text-emerald-600">-${calculatePaid().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg pt-4 border-t-2 border-dashed border-metal-border">
                  <span className="font-black text-chrome-100 uppercase">Saldo Pendiente</span>
                  <span className="font-black text-blue-600">${calculateBalance().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-metal-dark border-t border-metal-border flex gap-3">
              <button onClick={() => { handlePrint('abono'); }} className="flex-1 btn-chrome py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg">
                <Printer size={16} /> Imprimir Estado de Cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ENTREGA FINAL */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center z-[100] p-4 print:hidden">
          <div className="bg-metal-mid rounded-[4rem] shadow-2xl max-w-xl w-full p-16 text-center border-8 border-metal-border animate-in zoom-in duration-300">
            <h3 className="text-5xl font-black mb-6 text-chrome-100 uppercase tracking-tighter">Finalizar Orden</h3>
            <p className="text-chrome-400 mb-10 font-bold text-xl leading-relaxed">
              Está a punto de cerrar la orden y entregar el vehículo. El saldo final a liquidar es de:
              <span className="text-emerald-600 font-black text-6xl tracking-tighter block mt-4 animate-pulse">${calculateBalance().toFixed(2)}</span>
            </p>
            <div className="space-y-4">
              <select
                className="w-full px-8 py-5 bg-metal-dark border-2 border-metal-border rounded-2xl font-black uppercase text-xs outline-none text-center"
                value={tempPaymentMethod}
                onChange={(e) => setTempPaymentMethod(e.target.value as PaymentMethod)}
              >
                {['Efectivo $', 'Efectivo Bs', 'Pago Móvil', 'TDD', 'TDC', 'Zelle', 'Binance'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button onClick={finalizeRepair} className="w-full py-8 btn-chrome rounded-3xl font-black uppercase text-sm tracking-[0.3em] hover:bg-black shadow-2xl shadow-metal-border transition-all active:scale-95">
                Cerrar y Emitir Documentos
              </button>
              <button onClick={() => setShowPayModal(false)} className="w-full py-4 text-chrome-500 font-black uppercase text-[11px] tracking-widest hover:text-red-500 transition-colors">Volver</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ÉXITO Y OPCIONES DE IMPRESIÓN */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center z-[120] p-4 print:hidden">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-emerald-600 p-10 text-white text-center">
              <div className="w-20 h-20 bg-metal-mid/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-xl">
                <Check size={40} className="text-white" />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tighter">¡Servicio Finalizado!</h3>
              <p className="text-emerald-100 font-bold uppercase text-xs tracking-widest mt-2">El vehículo ha sido entregado correctamente</p>
            </div>

            <div className="p-10 space-y-4">
              <p className="text-center text-chrome-400 text-xs font-bold uppercase tracking-widest mb-6">Seleccione el documento a imprimir:</p>

              <button
                onClick={() => handlePrint('report')}
                className="w-full bg-metal-mid border-2 border-metal-border hover:border-blue-600 hover:bg-blue-50 text-chrome-100 py-5 rounded-2xl flex items-center justify-between px-6 transition-all group shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <FileText size={20} />
                  </div>
                  <div className="text-left">
                    <span className="block font-black uppercase text-xs tracking-wide">Informe Técnico</span>
                    <span className="text-[10px] text-chrome-500 font-bold">Formato A4 / Carta (Garantía)</span>
                  </div>
                </div>
                <Printer size={18} className="text-chrome-500 group-hover:text-blue-600" />
              </button>

              <button
                onClick={() => handlePrint('receipt')}
                className="w-full bg-metal-mid border-2 border-metal-border hover:border-emerald-600 hover:bg-emerald-50 text-chrome-100 py-5 rounded-2xl flex items-center justify-between px-6 transition-all group shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Receipt size={20} />
                  </div>
                  <div className="text-left">
                    <span className="block font-black uppercase text-xs tracking-wide">Recibo de Cobro</span>
                    <span className="text-[10px] text-chrome-500 font-bold">Formato Ticket (Caja)</span>
                  </div>
                </div>
                <Printer size={18} className="text-chrome-500 group-hover:text-emerald-600" />
              </button>

              <button
                onClick={handleFinishProcess}
                className="w-full btn-chrome py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-black transition-all shadow-xl mt-4"
              >
                Finalizar Proceso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BÚSQUEDA INVENTARIO */}
      {showInventorySearch && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center z-[100] p-4 no-print print:hidden">
          <div className="bg-metal-mid rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[85vh] overflow-hidden border-8 border-metal-border">
            <div className="p-10 border-b border-metal-border bg-metal-dark/50">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-black text-chrome-100 uppercase tracking-tight">Seleccionar Repuesto</h3>
                <button onClick={() => setShowInventorySearch(false)} className="w-12 h-12 bg-metal-mid border-2 border-metal-border rounded-2xl text-chrome-500 hover:text-red-500 transition-all flex items-center justify-center">
                  <X size={28} />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-chrome-500" size={24} />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  className="w-full pl-14 pr-8 py-5 bg-metal-mid border-2 border-metal-border rounded-2xl outline-none focus:ring-8 focus:ring-blue-500/15 font-bold transition-all shadow-inner"
                  value={invSearchTerm}
                  onChange={(e) => setInvSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-10 space-y-4 bg-metal-mid custom-scrollbar">
              {filteredInventory.map((p: Product) => (
                <button
                  key={p.id}
                  onClick={() => addFromInventory(p)}
                  className="w-full p-8 flex items-center justify-between bg-metal-dark border-2 border-metal-border rounded-3xl hover:border-blue-600 hover:bg-blue-50 transition-all text-left group shadow-sm"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 btn-chrome rounded-2xl flex items-center justify-center font-black text-xl group-hover:bg-blue-600 transition-colors">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-chrome-100 uppercase text-xl tracking-tight">{p.name}</p>
                      <p className="text-[10px] font-black text-chrome-500 uppercase tracking-widest mt-0.5">Stock: {p.quantity} Unidades</p>
                    </div>
                  </div>
                  <p className="text-3xl font-black text-blue-600 tracking-tighter">${Number(p.price).toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepairReport;
