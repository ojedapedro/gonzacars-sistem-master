
import React, { useState } from 'react';
import { Camera, Save, Sparkles, Loader2, X, Plus, Car, User, Wrench, FileText, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react';
import { VehicleRepair, ServiceStatus, Customer } from '../types';
import { improveDiagnosis } from '../lib/gemini';

/* ─── Status badge config ─── */
const STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; bg: string; dot: string }> = {
  'Ingresado':            { label: 'Ingresado',            color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-500' },
  'En Diagnóstico':       { label: 'En Diagnóstico',       color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
  'En Reparación':        { label: 'En Reparación',        color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  'Esperando Repuestos':  { label: 'Esperando Repuestos',  color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
  'Finalizado':           { label: 'Finalizado',           color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  'Entregado':            { label: 'Entregado',            color: 'text-chrome-200',  bg: 'bg-metal-dark border-metal-border',  dot: 'bg-metal-dark0' },
};

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const FormSection: React.FC<SectionProps> = ({ title, icon, color, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-metal-mid rounded-2xl border border-metal-border overflow-hidden shadow-sm transition-all">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-6 py-4 border-b border-metal-border transition-colors hover:bg-metal-dark/50 ${open ? '' : 'border-transparent'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 ${color} rounded-xl flex items-center justify-center text-white`}>{icon}</div>
          <span className="font-black text-chrome-100 text-sm uppercase tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>{title}</span>
        </div>
        <span className="text-chrome-500">{open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</span>
      </button>
      {open && (
        <div className="p-6 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
};

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

const Field: React.FC<FieldProps> = ({ label, required, children, hint }) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1 text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em]">
      {label}
      {required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-chrome-500 font-medium">{hint}</p>}
  </div>
);

const inputCls = "input-premium";
const selectCls = "input-premium appearance-none cursor-pointer";

const RepairRegistration: React.FC<{ store: any; toast?: any }> = ({ store, toast }) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<VehicleRepair>>({
    status: 'Ingresado',
    year: new Date().getFullYear(),
    items: [],
    evidencePhotos: [],
    createdAt: new Date().toISOString(),
    serviceType: 'Mecánica General',
  });

  const set = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

  /* AI Diagnosis */
  const handleAiImprove = async () => {
    if (!formData.diagnosis || formData.diagnosis.length < 5) return;
    setIsAiLoading(true);
    try {
      const improved = await improveDiagnosis(formData.diagnosis);
      if (improved) set('diagnosis', improved);
      toast?.success('IA aplicada', 'El diagnóstico fue mejorado con IA.');
    } catch {
      toast?.error('Error de IA', 'No se pudo mejorar el diagnóstico.');
    } finally {
      setIsAiLoading(false);
    }
  };

  /* Image compression */
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const maxW = 1024, maxH = 1024;
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = evt => {
        const img = new Image();
        img.src = evt.target?.result as string;
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > h) { if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; } }
          else        { if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; } }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(evt.target?.result as string); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const compressed = await compressImage(file);
      const photos = formData.evidencePhotos || [];
      if (photos.length < 4) set('evidencePhotos', [...photos, compressed]);
      toast?.success('Foto agregada', 'Imagen comprimida y lista.');
    } catch {
      toast?.error('Error de imagen', 'No se pudo procesar la foto. Intente con otra.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const removePhoto = (idx: number) => {
    const photos = [...(formData.evidencePhotos || [])];
    photos.splice(idx, 1);
    set('evidencePhotos', photos);
  };

  /* Submit */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      toast?.error('Cliente requerido', 'Seleccione un cliente antes de continuar.');
      return;
    }
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 500));
    const customer = store.customers.find((c: Customer) => c.id === formData.customerId);
    const newRepair: VehicleRepair = {
      ...formData as VehicleRepair,
      id: Math.random().toString(36).substr(2, 9),
      ownerName: customer?.name || '',
      createdAt: new Date().toISOString(),
    };
    store.addRepair(newRepair);
    toast?.success('Vehículo registrado', `${formData.brand || ''} ${formData.model || ''} (${formData.plate?.toUpperCase()}) ingresado al taller.`);
    setFormData({ status: 'Ingresado', year: new Date().getFullYear(), items: [], evidencePhotos: [], serviceType: 'Mecánica General' });
    setIsSubmitting(false);
  };

  const photoCount = (formData.evidencePhotos || []).length;
  const selectedStatus = formData.status ? STATUS_CONFIG[formData.status as ServiceStatus] : null;

  return (
    <div className="module-page max-w-3xl mx-auto">
      {/* Page Title */}
      <div className="mb-6 flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
          <Car size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-chrome-100 tracking-tight leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>Registro de Vehículo</h1>
          <p className="text-chrome-400 text-sm font-medium mt-1">Complete los datos del ingreso al taller</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Sección: Cliente ── */}
        <FormSection title="Datos del Cliente" icon={<User size={15}/>} color="bg-blue-600" defaultOpen={true}>
          <Field label="Cliente / Propietario" required>
            <div className="relative">
              <select
                required
                className={selectCls}
                value={formData.customerId || ''}
                onChange={e => set('customerId', e.target.value)}
              >
                <option value="">Seleccione un cliente…</option>
                {store.customers.map((c: Customer) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                ))}
              </select>
            </div>
            {store.customers.length === 0 && (
              <p className="text-xs text-amber-600 font-bold mt-1 flex items-center gap-1">
                <AlertCircle size={12}/> No hay clientes registrados aún.
              </p>
            )}
          </Field>
        </FormSection>

        {/* ── Sección: Vehículo ── */}
        <FormSection title="Datos del Vehículo" icon={<Car size={15}/>} color="bg-slate-700" defaultOpen={true}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Placa" required>
              <input
                required type="text" className={`${inputCls} uppercase font-black tracking-widest`}
                placeholder="ABC-123"
                value={formData.plate || ''}
                onChange={e => set('plate', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Marca" required>
              <input required type="text" className={inputCls} placeholder="Toyota, Ford, Chevrolet…" value={formData.brand || ''} onChange={e => set('brand', e.target.value)} />
            </Field>
            <Field label="Modelo" required>
              <input required type="text" className={inputCls} placeholder="Corolla, F-150…" value={formData.model || ''} onChange={e => set('model', e.target.value)} />
            </Field>
            <Field label="Año" required>
              <input required type="number" className={inputCls} placeholder={String(new Date().getFullYear())} min={1950} max={new Date().getFullYear() + 1} value={formData.year || ''} onChange={e => set('year', Number(e.target.value))} />
            </Field>
            <Field label="Responsable de recepción" required>
              <input required type="text" className={inputCls} placeholder="Nombre del técnico…" value={formData.responsible || ''} onChange={e => set('responsible', e.target.value)} />
            </Field>
            <Field label="Mecánico asignado" required>
              <select
                required className={selectCls}
                value={formData.mechanicId || ''}
                onChange={e => set('mechanicId', e.target.value)}
              >
                <option value="">Seleccione…</option>
                {store.employees?.filter((e: any) => e.role === 'Mecánico').map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </FormSection>

        {/* ── Sección: Servicio ── */}
        <FormSection title="Servicio y Estado" icon={<Wrench size={15}/>} color="bg-emerald-600" defaultOpen={true}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tipo de servicio" required>
              <select
                className={selectCls}
                value={formData.serviceType || ''}
                onChange={e => set('serviceType', e.target.value)}
              >
                {['Mecánica General', 'Electricidad', 'Frenos', 'Suspensión', 'Motor', 'Transmisión', 'Aire Acondicionado', 'Mantenimiento Preventivo', 'Otro'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Estado de entrada">
              <div className="relative">
                <select
                  className={selectCls}
                  value={formData.status}
                  onChange={e => set('status', e.target.value as ServiceStatus)}
                >
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              {selectedStatus && (
                <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${selectedStatus.bg} ${selectedStatus.color}`}>
                  <span className={`w-2 h-2 rounded-full ${selectedStatus.dot}`}/>
                  {selectedStatus.label}
                </div>
              )}
            </Field>
          </div>
        </FormSection>

        {/* ── Sección: Diagnóstico ── */}
        <FormSection title="Diagnóstico Inicial" icon={<FileText size={15}/>} color="bg-purple-600" defaultOpen={true}>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-chrome-400 font-medium">Describe los síntomas o la falla reportada.</p>
              <button
                type="button"
                onClick={handleAiImprove}
                disabled={isAiLoading || !formData.diagnosis || formData.diagnosis.length < 5}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-full transition-all disabled:opacity-40"
              >
                {isAiLoading
                  ? <><Loader2 size={11} className="animate-spin"/> Procesando…</>
                  : <><Sparkles size={11}/> Mejorar con IA</>
                }
              </button>
            </div>
            <textarea
              className="w-full input-premium resize-none h-28"
              value={formData.diagnosis || ''}
              onChange={e => set('diagnosis', e.target.value)}
              placeholder="Ej: El vehículo presenta ruido extraño en el motor al acelerar, vibración en el volante a altas velocidades…"
            />
            {isAiLoading && (
              <div className="flex items-center gap-2 text-purple-600 animate-pulse">
                <Sparkles size={14}/>
                <span className="text-xs font-bold">La IA está mejorando tu diagnóstico…</span>
              </div>
            )}
          </div>
        </FormSection>

        {/* ── Sección: Fotos ── */}
        <FormSection title="Evidencias Fotográficas" icon={<Camera size={15}/>} color="bg-cyan-600" defaultOpen={false}>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {(formData.evidencePhotos || []).map((photo, idx) => (
                <div key={idx} className="relative aspect-square group">
                  <img src={photo} className="w-full h-full object-cover rounded-xl border border-metal-border shadow-sm" alt={`Foto ${idx + 1}`} />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
                  >
                    <X size={10}/>
                  </button>
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] font-black px-1.5 py-0.5 rounded-lg">
                    {idx + 1}
                  </div>
                </div>
              ))}

              {photoCount < 4 && !isCompressing && (
                <label className="cursor-pointer flex flex-col items-center justify-center aspect-square border-2 border-dashed border-metal-border hover:border-cyan-400 rounded-xl hover:bg-cyan-50/50 transition-all text-chrome-500 hover:text-cyan-600 group bg-metal-mid/50">
                  <Plus size={22} className="mb-1 group-hover:scale-110 transition-transform"/>
                  <span className="text-[9px] font-black uppercase">Foto {photoCount + 1}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload}/>
                </label>
              )}

              {isCompressing && (
                <div className="flex flex-col items-center justify-center aspect-square border-2 border-metal-border rounded-xl bg-metal-dark">
                  <Loader2 className="animate-spin text-cyan-500 mb-1" size={22}/>
                  <span className="text-[9px] font-bold text-chrome-400">Comprimiendo…</span>
                </div>
              )}

              {Array.from({ length: Math.max(0, 3 - photoCount - (isCompressing ? 1 : 0)) }).map((_, i) => (
                <div key={`ph-${i}`} className="aspect-square border-2 border-dashed border-metal-border rounded-xl bg-metal-dark/50"/>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-chrome-500 font-medium">Las imágenes se comprimen automáticamente (máx. 4 fotos)</p>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${photoCount === 4 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-metal-mid text-chrome-200'}`}>
                {photoCount} / 4
              </span>
            </div>
          </div>
        </FormSection>

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={isCompressing || isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-4 rounded-2xl font-black uppercase tracking-[0.15em] text-sm flex items-center justify-center gap-3 shadow-2xl shadow-blue-600/30 transition-all active:scale-[0.98]"
        >
          {isSubmitting
            ? <><Loader2 className="animate-spin" size={20}/> Registrando…</>
            : <><Save size={20}/> Registrar Entrada al Taller</>
          }
        </button>
      </form>
    </div>
  );
};

export default RepairRegistration;
