
import React, { useState, useMemo, useCallback } from 'react';
import {
  CalendarDays, Plus, Search, X, ChevronRight, ChevronLeft,
  User, Car, Wrench, Clock, CheckCircle2, AlertCircle, AlertTriangle,
  Trash2, Eye, PhoneCall, ClipboardList, Calendar, Filter,
  UserPlus, ArrowRight, Check, Loader2, XCircle, Info
} from 'lucide-react';
import { Appointment, AppointmentStatus, Customer, Vehicle, VehicleRepair } from '../types';

/* ─────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────── */
const SERVICE_TYPES = [
  'Mecánica General',
  'Mantenimiento Preventivo',
  'Diagnóstico',
  'Frenos',
  'Sistema Eléctrico',
  'Suspensión y Dirección',
  'Transmisión',
  'Motor',
  'Aire Acondicionado',
  'Escape',
  'Alineación y Balanceo',
  'Cristales y Carrocería',
  'Otro',
];

const TIME_SLOTS = [
  '07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30',
  '13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00',
];

const STATUS_CONFIG: Record<AppointmentStatus, {
  label: string; badge: string; dot: string; cardBorder: string; cardGlow: string;
}> = {
  'Pendiente':   { label: 'Pendiente',   badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',    dot: 'bg-blue-400',    cardBorder: 'border-blue-500/20',   cardGlow: 'rgba(59,130,246,0.08)'  },
  'Confirmada':  { label: 'Confirmada',  badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', dot: 'bg-emerald-400', cardBorder: 'border-emerald-500/20', cardGlow: 'rgba(16,185,129,0.08)' },
  'En Proceso':  { label: 'En Proceso',  badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/30', dot: 'bg-orange-400',  cardBorder: 'border-orange-500/20',  cardGlow: 'rgba(249,115,22,0.08)'  },
  'Completada':  { label: 'Completada',  badge: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',  dot: 'bg-slate-400',   cardBorder: 'border-slate-500/20',   cardGlow: 'transparent' },
  'Cancelada':   { label: 'Cancelada',   badge: 'bg-red-500/20 text-red-300 border border-red-500/30',        dot: 'bg-red-400',     cardBorder: 'border-red-500/20',     cardGlow: 'transparent' },
};

const TODAY = new Date().toISOString().split('T')[0];

const genId = () => Math.random().toString(36).substr(2, 9);

function formatDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(date: string, time: string) {
  return `${formatDate(date)} ${time}`;
}

/* ─────────────────────────────────────────────────────
   INPUT COMPONENT
───────────────────────────────────────────────────── */
const inputCls = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-chrome-100 text-sm font-medium outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-chrome-500/60";
const selectCls = "w-full px-4 py-3 bg-[#12151f] border border-white/10 rounded-xl text-chrome-100 text-sm font-medium outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer";

/* ─────────────────────────────────────────────────────
   WIZARD STEP INDICATOR
───────────────────────────────────────────────────── */
const WizardSteps: React.FC<{ current: number }> = ({ current }) => {
  const steps = [
    { n: 1, label: 'Cliente', icon: <User size={14}/> },
    { n: 2, label: 'Vehículo', icon: <Car size={14}/> },
    { n: 3, label: 'Cita', icon: <CalendarDays size={14}/> },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <React.Fragment key={s.n}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm transition-all
                ${done    ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]' :
                  active  ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]' :
                            'bg-white/5 text-chrome-500 border border-white/10'}`}>
                {done ? <Check size={16}/> : s.icon}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${active ? 'text-blue-400' : done ? 'text-emerald-400' : 'text-chrome-500'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-5 transition-colors ${done ? 'bg-emerald-500/40' : 'bg-white/8'}`} style={{ width: 48 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   APPOINTMENT CARD
───────────────────────────────────────────────────── */
const AppointmentCard: React.FC<{
  appt: Appointment;
  onViewRepair: (repairId: string) => void;
  onCancel: (id: string) => void;
  onConfirm: (appt: Appointment) => void;
  onDelete: (id: string) => void;
}> = ({ appt, onViewRepair, onCancel, onConfirm, onDelete }) => {
  const cfg = STATUS_CONFIG[appt.status];
  const isActive = appt.status === 'Pendiente' || appt.status === 'Confirmada';
  const isPast = appt.scheduledDate < TODAY && isActive;

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:scale-[1.01] relative overflow-hidden`}
      style={{ background: `linear-gradient(135deg, #12151f, #0e1017)`, borderColor: cfg.cardBorder.replace('border-','').replace('/20',''), boxShadow: `0 4px 24px ${cfg.cardGlow}, 0 1px 4px rgba(0,0,0,0.4)` }}
    >
      {/* glow strip top */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${cfg.dot} opacity-60`} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>
              {cfg.label}
            </span>
            {isPast && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <AlertTriangle size={9}/> Vencida
              </span>
            )}
          </div>
          <p className="font-black text-chrome-100 text-base mt-2 truncate" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {appt.customerName}
          </p>
          <p className="text-chrome-400 text-xs font-semibold flex items-center gap-1.5 mt-0.5">
            <PhoneCall size={11}/>{appt.customerPhone}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-blue-400 font-black text-sm">{formatDate(appt.scheduledDate)}</p>
          <p className="text-chrome-300 font-bold text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>{appt.scheduledTime}</p>
        </div>
      </div>

      {/* Vehicle row */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Car size={14} className="text-chrome-400 flex-shrink-0"/>
        <span className="text-chrome-100 font-bold text-sm">{appt.vehiclePlate}</span>
        <span className="text-chrome-500 text-xs">—</span>
        <span className="text-chrome-400 text-xs font-semibold truncate">{appt.vehicleBrand} {appt.vehicleModel} {appt.vehicleYear}</span>
      </div>

      {/* Service row */}
      <div className="flex items-start gap-2">
        <Wrench size={13} className="text-chrome-500 flex-shrink-0 mt-0.5"/>
        <div className="flex-1 min-w-0">
          <p className="text-chrome-300 text-xs font-black uppercase tracking-wider">{appt.serviceType}</p>
          {appt.description && <p className="text-chrome-500 text-xs font-medium mt-0.5 line-clamp-2">{appt.description}</p>}
        </div>
      </div>

      {/* Mechanic */}
      {appt.mechanicName && (
        <div className="flex items-center gap-2">
          <User size={11} className="text-chrome-500"/>
          <span className="text-chrome-500 text-xs font-semibold">Mecánico: <span className="text-chrome-300">{appt.mechanicName}</span></span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        {appt.repairId && (
          <button
            onClick={() => onViewRepair(appt.repairId!)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <ClipboardList size={13}/> Ver Informe
          </button>
        )}
        {appt.status === 'Pendiente' && (
          <button
            onClick={() => onConfirm({ ...appt, status: 'Confirmada' })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <CheckCircle2 size={13}/> Confirmar
          </button>
        )}
        {isActive && (
          <button
            onClick={() => onCancel(appt.id)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <XCircle size={13}/> Cancelar
          </button>
        )}
        {!isActive && (
          <button
            onClick={() => onDelete(appt.id)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-chrome-500 hover:bg-white/5 transition-colors ml-auto"
          >
            <Trash2 size={12}/>
          </button>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   MAIN MODULE
───────────────────────────────────────────────────── */
const AppointmentsModule: React.FC<{ store: any; toast?: any; onGoToRepairs?: () => void }> = ({ store, toast, onGoToRepairs }) => {
  // ─── List state ───
  const [filterTab, setFilterTab] = useState<'hoy' | 'semana' | 'todas' | 'pendientes'>('hoy');
  const [searchQ, setSearchQ] = useState('');

  // ─── Modal state ───
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // ─── Step 1: Customer ───
  const [custSearch, setCustSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustData, setNewCustData] = useState({ name: '', phone: '', email: '' });
  const [custSearchFocused, setCustSearchFocused] = useState(false);

  // ─── Step 2: Vehicle ───
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isNewVehicle, setIsNewVehicle] = useState(false);
  const [newVehicleData, setNewVehicleData] = useState({ plate: '', brand: '', model: '', year: new Date().getFullYear(), color: '', mileage: 0 });
  const [activeRepairWarning, setActiveRepairWarning] = useState<VehicleRepair | null>(null);

  // ─── Step 3: Appointment ───
  const [apptData, setApptData] = useState({
    serviceType: 'Mecánica General',
    description: '',
    scheduledDate: '',
    scheduledTime: '08:00',
    mechanicId: '',
    notes: '',
  });

  // ─────────────────────────────
  // Filtered list
  // ─────────────────────────────
  const appointments: Appointment[] = store.appointments || [];

  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    return mon.toISOString().split('T')[0];
  }, []);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  }, [weekStart]);

  const filtered = useMemo(() => {
    let list = [...appointments];
    if (filterTab === 'hoy')       list = list.filter(a => a.scheduledDate === TODAY);
    if (filterTab === 'semana')    list = list.filter(a => a.scheduledDate >= weekStart && a.scheduledDate <= weekEnd);
    if (filterTab === 'pendientes') list = list.filter(a => a.status === 'Pendiente' || a.status === 'Confirmada');
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(a =>
        a.customerName.toLowerCase().includes(q) ||
        a.vehiclePlate.toLowerCase().includes(q) ||
        a.serviceType.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      const da = a.scheduledDate + ' ' + a.scheduledTime;
      const db2 = b.scheduledDate + ' ' + b.scheduledTime;
      return da.localeCompare(db2);
    });
  }, [appointments, filterTab, searchQ, weekStart, weekEnd]);

  // ─────────────────────────────
  // Customer search suggestions
  // ─────────────────────────────
  const customerSuggestions = useMemo(() => {
    if (!custSearch.trim() || custSearch.length < 2) return [];
    const q = custSearch.toLowerCase();
    return (store.customers as Customer[]).filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [custSearch, store.customers]);

  // ─────────────────────────────
  // Customer vehicles
  // ─────────────────────────────
  const customerVehicles: Vehicle[] = useMemo(() => {
    if (!selectedCustomer) return [];
    return (store.vehicles as Vehicle[]).filter(v => v.customerId === selectedCustomer.id);
  }, [selectedCustomer, store.vehicles]);

  // ─────────────────────────────
  // Check active repair for plate
  // ─────────────────────────────
  const checkActiveRepair = useCallback((plate: string): VehicleRepair | null => {
    const ACTIVE_STATUSES = ['Ingresado', 'En Diagnóstico', 'En Reparación', 'Esperando Repuestos', 'Finalizado'];
    return (store.repairs as VehicleRepair[]).find(
      r => r.plate.toUpperCase() === plate.toUpperCase() && ACTIVE_STATUSES.includes(r.status)
    ) || null;
  }, [store.repairs]);

  // ─────────────────────────────
  // Wizard reset
  // ─────────────────────────────
  const resetWizard = () => {
    setWizardStep(1);
    setCustSearch('');
    setSelectedCustomer(null);
    setIsNewCustomer(false);
    setNewCustData({ name: '', phone: '', email: '' });
    setSelectedVehicle(null);
    setIsNewVehicle(false);
    setNewVehicleData({ plate: '', brand: '', model: '', year: new Date().getFullYear(), color: '', mileage: 0 });
    setActiveRepairWarning(null);
    setApptData({ serviceType: 'Mecánica General', description: '', scheduledDate: '', scheduledTime: '08:00', mechanicId: '', notes: '' });
    setIsSaving(false);
  };

  const openWizard = () => { resetWizard(); setShowWizard(true); };
  const closeWizard = () => { setShowWizard(false); resetWizard(); };

  // ─────────────────────────────
  // Step 1 → Step 2
  // ─────────────────────────────
  const handleStep1Next = () => {
    if (isNewCustomer) {
      if (!newCustData.name.trim() || !newCustData.phone.trim()) {
        toast?.warning('Campos requeridos', 'Nombre y teléfono son obligatorios.');
        return;
      }
    } else if (!selectedCustomer) {
      toast?.warning('Selecciona un cliente', 'Busca o elige un cliente existente, o marca "Cliente nuevo".');
      return;
    }
    setWizardStep(2);
  };

  // ─────────────────────────────
  // Step 2 → Step 3 (with active repair check)
  // ─────────────────────────────
  const handleStep2Next = () => {
    let plate = '';
    if (isNewVehicle) {
      if (!newVehicleData.plate.trim() || !newVehicleData.brand.trim() || !newVehicleData.model.trim()) {
        toast?.warning('Campos requeridos', 'Placa, marca y modelo son obligatorios.');
        return;
      }
      plate = newVehicleData.plate.toUpperCase();
    } else if (selectedVehicle) {
      plate = selectedVehicle.plate.toUpperCase();
    } else {
      toast?.warning('Selecciona un vehículo', 'Elige un vehículo registrado o ingresa uno nuevo.');
      return;
    }

    const activeRepair = checkActiveRepair(plate);
    if (activeRepair) {
      setActiveRepairWarning(activeRepair);
      return;
    }

    setActiveRepairWarning(null);
    setWizardStep(3);
  };

  // ─────────────────────────────
  // Submit (Step 3)
  // ─────────────────────────────
  const handleSubmit = async () => {
    if (!apptData.scheduledDate) {
      toast?.warning('Fecha requerida', 'Por favor selecciona la fecha de la cita.');
      return;
    }
    if (!apptData.description.trim()) {
      toast?.warning('Descripción requerida', 'Describe brevemente el problema o servicio requerido.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Create customer if new
      let customerId = selectedCustomer?.id || '';
      let customerName = selectedCustomer?.name || newCustData.name;

      if (isNewCustomer) {
        const newCust: any = {
          id: genId(),
          name: newCustData.name.trim(),
          phone: newCustData.phone.trim(),
          email: newCustData.email.trim(),
          address: '',
          createdAt: new Date().toISOString(),
        };
        await store.addCustomer(newCust);
        customerId = newCust.id;
        customerName = newCust.name;
      }

      // 2. Create vehicle if new
      let vehiclePlate = '';
      let vehicleBrand = '';
      let vehicleModel = '';
      let vehicleYear = 0;
      let vehicleColor = '';

      if (isNewVehicle || !selectedVehicle) {
        const vd = newVehicleData;
        vehiclePlate = vd.plate.toUpperCase();
        vehicleBrand = vd.brand;
        vehicleModel = vd.model;
        vehicleYear = vd.year;
        vehicleColor = vd.color;

        if (isNewVehicle && customerId) {
          const newVeh: any = {
            id: genId(),
            customerId,
            plate: vehiclePlate,
            brand: vehicleBrand,
            model: vehicleModel,
            year: vehicleYear,
            color: vehicleColor,
            mileage: vd.mileage || 0,
          };
          await store.addVehicle(newVeh);
        }
      } else {
        vehiclePlate = selectedVehicle.plate.toUpperCase();
        vehicleBrand = selectedVehicle.brand;
        vehicleModel = selectedVehicle.model;
        vehicleYear = selectedVehicle.year;
        vehicleColor = selectedVehicle.color || '';
      }

      // 3. Create VehicleRepair (status: Ingresado)
      const mechanic = store.employees?.find((e: any) => e.id === apptData.mechanicId);
      const repairId = genId();
      const newRepair: VehicleRepair = {
        id: repairId,
        customerId,
        plate: vehiclePlate,
        brand: vehicleBrand,
        model: vehicleModel,
        year: vehicleYear,
        ownerName: customerName,
        responsible: mechanic?.name || store.currentUser?.name || 'Taller',
        status: 'Ingresado',
        diagnosis: apptData.description,
        serviceType: apptData.serviceType,
        mechanicId: apptData.mechanicId || '',
        items: [],
        installments: [],
        createdAt: new Date().toISOString(),
        mileage: newVehicleData.mileage || selectedVehicle?.mileage || 0,
      };
      await store.addRepair(newRepair);

      // 4. Create Appointment
      const mechName = mechanic?.name || '';
      const newAppt: Appointment = {
        id: genId(),
        customerId,
        customerName,
        customerPhone: isNewCustomer ? newCustData.phone : (selectedCustomer?.phone || ''),
        customerEmail: isNewCustomer ? newCustData.email : (selectedCustomer?.email || ''),
        vehiclePlate,
        vehicleBrand,
        vehicleModel,
        vehicleYear,
        vehicleColor,
        serviceType: apptData.serviceType,
        description: apptData.description,
        scheduledDate: apptData.scheduledDate,
        scheduledTime: apptData.scheduledTime,
        mechanicId: apptData.mechanicId,
        mechanicName: mechName,
        status: 'Confirmada',
        repairId,
        notes: apptData.notes,
        createdAt: new Date().toISOString(),
        isNewCustomer,
        isNewVehicle,
      };
      await store.addAppointment(newAppt);

      toast?.success('¡Cita registrada!', `Cita de ${customerName} agendada para el ${formatDate(apptData.scheduledDate)} a las ${apptData.scheduledTime}. Informe de taller creado automáticamente.`);
      closeWizard();
    } catch (err: any) {
      console.error(err);
      toast?.error('Error al guardar', err.message || 'No se pudo registrar la cita.');
    } finally {
      setIsSaving(false);
    }
  };

  // ─────────────────────────────
  // Actions on existing appointments
  // ─────────────────────────────
  const handleCancelAppointment = async (id: string) => {
    const appt = appointments.find(a => a.id === id);
    if (!appt) return;
    await store.updateAppointment({ ...appt, status: 'Cancelada' });
    toast?.info('Cita cancelada', `La cita de ${appt.customerName} fue cancelada.`);
  };

  const handleConfirmAppointment = async (appt: Appointment) => {
    await store.updateAppointment(appt);
    toast?.success('Cita confirmada', `La cita de ${appt.customerName} fue confirmada.`);
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!window.confirm('¿Eliminar esta cita del historial?')) return;
    await store.deleteAppointment(id);
    toast?.info('Cita eliminada', 'La cita fue eliminada del sistema.');
  };

  const handleViewRepair = (repairId: string) => {
    if (onGoToRepairs) onGoToRepairs();
    else toast?.info('Ver informe', `Informe ID: ${repairId} — Ve a "Informes de Taller" para verlo.`);
  };

  // ─────────────────────────────
  // Badge counts
  // ─────────────────────────────
  const todayCount = appointments.filter(a => a.scheduledDate === TODAY && (a.status === 'Pendiente' || a.status === 'Confirmada')).length;
  const pendingCount = appointments.filter(a => a.status === 'Pendiente').length;

  const mechanics = (store.employees || []).filter((e: any) => e.role === 'Mecánico' || e.role === 'Ayudante de Mecánica');

  /* ─────────────────────────────────────────────────────
     RENDER WIZARD STEPS
  ───────────────────────────────────────────────────── */

  // ── Step 1: Customer ──
  const renderStep1 = () => (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-chrome-400 text-xs font-semibold mb-4 text-center">Busca si el cliente ya está registrado en el sistema.</p>

        {/* Toggle new customer */}
        <label className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer select-none mb-4"
          style={{ background: isNewCustomer ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isNewCustomer ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
          <div
            onClick={() => { setIsNewCustomer(v => !v); setSelectedCustomer(null); setCustSearch(''); }}
            className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${isNewCustomer ? 'bg-blue-500' : 'bg-white/15'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${isNewCustomer ? 'left-[18px]' : 'left-0.5'}`}/>
          </div>
          <div>
            <p className={`text-xs font-black uppercase tracking-wider ${isNewCustomer ? 'text-blue-400' : 'text-chrome-400'}`}>
              <UserPlus size={12} className="inline mr-1"/> Cliente nuevo
            </p>
            <p className="text-[10px] text-chrome-500 font-medium">Activa esto si el cliente viene por primera vez</p>
          </div>
        </label>

        {isNewCustomer ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Nombre Completo <span className="text-red-400">*</span></label>
              <input className={inputCls} placeholder="Ej: Juan Carlos Pérez" value={newCustData.name}
                onChange={e => setNewCustData(p => ({ ...p, name: e.target.value }))}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Teléfono <span className="text-red-400">*</span></label>
                <input className={inputCls} placeholder="0414-0000000" value={newCustData.phone}
                  onChange={e => setNewCustData(p => ({ ...p, phone: e.target.value }))}/>
              </div>
              <div>
                <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Correo</label>
                <input className={inputCls} type="email" placeholder="email@correo.com" value={newCustData.email}
                  onChange={e => setNewCustData(p => ({ ...p, email: e.target.value }))}/>
              </div>
            </div>
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5"/>
              <p className="text-[10px] text-blue-300 font-medium">El cliente será creado en el sistema al confirmar la cita.</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">
              Buscar Cliente Existente
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chrome-500"/>
              <input
                className={`${inputCls} pl-10`}
                placeholder="Nombre, teléfono o correo..."
                value={custSearch}
                onFocus={() => setCustSearchFocused(true)}
                onBlur={() => setTimeout(() => setCustSearchFocused(false), 180)}
                onChange={e => { setCustSearch(e.target.value); setSelectedCustomer(null); }}
              />
            </div>

            {/* Suggestions dropdown */}
            {custSearchFocused && customerSuggestions.length > 0 && (
              <div className="absolute z-30 top-full mt-1 left-0 right-0 rounded-xl border border-white/10 overflow-hidden shadow-2xl animate-fade-in"
                style={{ background: '#12151f' }}>
                {customerSuggestions.map(c => (
                  <button key={c.id}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    onMouseDown={() => { setSelectedCustomer(c); setCustSearch(c.name); }}>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center font-black text-sm flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-chrome-100 font-bold text-sm">{c.name}</p>
                      <p className="text-chrome-500 text-xs font-medium">{c.phone}</p>
                    </div>
                    <Check size={14} className="text-emerald-400 ml-auto flex-shrink-0"/>
                  </button>
                ))}
              </div>
            )}

            {/* Selected customer pill */}
            {selectedCustomer && (
              <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl animate-fade-in"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-black text-sm flex-shrink-0">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-chrome-100 font-black text-sm truncate">{selectedCustomer.name}</p>
                  <p className="text-chrome-500 text-xs font-semibold">{selectedCustomer.phone}</p>
                </div>
                <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0"/>
              </div>
            )}

            {custSearch.length >= 2 && customerSuggestions.length === 0 && !selectedCustomer && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <AlertCircle size={13} className="text-amber-400 flex-shrink-0"/>
                <p className="text-amber-300 text-xs font-medium">No se encontró ningún cliente. Activa "Cliente nuevo" si es primera vez.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Step 2: Vehicle ──
  const renderStep2 = () => (
    <div className="space-y-5 animate-fade-in">
      <p className="text-chrome-400 text-xs font-semibold text-center">
        {selectedCustomer ? `Vehículos registrados de ${selectedCustomer.name}` : 'Ingresa los datos del vehículo.'}
      </p>

      {/* Active repair warning */}
      {activeRepairWarning && (
        <div className="rounded-2xl border border-red-500/30 p-4 animate-fade-in" style={{ background: 'rgba(239,68,68,0.06)' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-red-300 font-black text-sm uppercase tracking-wider">Informe Activo Existente</p>
              <p className="text-red-400/80 text-xs font-medium mt-1">
                La placa <strong>{activeRepairWarning.plate}</strong> ya tiene un informe activo con estado <strong>"{activeRepairWarning.status}"</strong>. No se puede crear una nueva cita hasta que se entregue el vehículo.
              </p>
              <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-red-300 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <ClipboardList size={12}/> Informe #{activeRepairWarning.id.slice(0,6).toUpperCase()} — {activeRepairWarning.serviceType}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle selection (existing) */}
      {!isNewVehicle && customerVehicles.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] block">Vehículos Registrados</label>
          {customerVehicles.map(v => {
            const active = checkActiveRepair(v.plate);
            const sel = selectedVehicle?.id === v.id;
            return (
              <button key={v.id}
                onClick={() => { setSelectedVehicle(v); setActiveRepairWarning(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all
                  ${active ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/5'}
                  ${sel ? 'border border-blue-500/40' : 'border border-white/8'}`}
                style={{ background: sel ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)' }}
                disabled={!!active}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${sel ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-chrome-400'}`}>
                  <Car size={15}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-chrome-100 font-bold text-sm">{v.plate}</p>
                  <p className="text-chrome-500 text-xs font-semibold">{v.brand} {v.model} {v.year}</p>
                </div>
                {active && <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">EN TALLER</span>}
                {sel && !active && <CheckCircle2 size={16} className="text-blue-400 flex-shrink-0"/>}
              </button>
            );
          })}
          <button
            onClick={() => { setIsNewVehicle(true); setSelectedVehicle(null); setActiveRepairWarning(null); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-chrome-400 hover:text-chrome-200 hover:bg-white/5 transition-colors border border-dashed border-white/10"
          >
            <Plus size={13}/> Agregar otro vehículo
          </button>
        </div>
      )}

      {/* New vehicle form */}
      {(isNewVehicle || customerVehicles.length === 0) && (
        <div className="space-y-3">
          {isNewVehicle && customerVehicles.length > 0 && (
            <button onClick={() => setIsNewVehicle(false)} className="flex items-center gap-1.5 text-[10px] font-black text-chrome-400 hover:text-chrome-200 uppercase tracking-wider transition-colors">
              <ChevronLeft size={13}/> Volver a vehículos registrados
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Placa <span className="text-red-400">*</span></label>
              <input className={inputCls} placeholder="ABC-123" value={newVehicleData.plate}
                onChange={e => { setNewVehicleData(p => ({ ...p, plate: e.target.value.toUpperCase() })); setActiveRepairWarning(null); }}/>
            </div>
            <div>
              <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Marca <span className="text-red-400">*</span></label>
              <input className={inputCls} placeholder="Toyota" value={newVehicleData.brand}
                onChange={e => setNewVehicleData(p => ({ ...p, brand: e.target.value }))}/>
            </div>
            <div>
              <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Modelo <span className="text-red-400">*</span></label>
              <input className={inputCls} placeholder="Corolla" value={newVehicleData.model}
                onChange={e => setNewVehicleData(p => ({ ...p, model: e.target.value }))}/>
            </div>
            <div>
              <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Año</label>
              <input className={inputCls} type="number" min={1970} max={new Date().getFullYear()+2} value={newVehicleData.year}
                onChange={e => setNewVehicleData(p => ({ ...p, year: Number(e.target.value) }))}/>
            </div>
            <div>
              <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Color</label>
              <input className={inputCls} placeholder="Blanco" value={newVehicleData.color}
                onChange={e => setNewVehicleData(p => ({ ...p, color: e.target.value }))}/>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Kilometraje</label>
              <input className={inputCls} type="number" min={0} placeholder="0" value={newVehicleData.mileage || ''}
                onChange={e => setNewVehicleData(p => ({ ...p, mileage: Number(e.target.value) }))}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Step 3: Appointment Data ──
  const renderStep3 = () => {
    const plate = isNewVehicle ? newVehicleData.plate : (selectedVehicle?.plate || '');
    const custName = isNewCustomer ? newCustData.name : (selectedCustomer?.name || '');
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Summary */}
        <div className="px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-blue-300 font-black text-sm truncate">{custName}</p>
            <p className="text-chrome-500 text-xs font-semibold">{plate} {isNewVehicle ? `${newVehicleData.brand} ${newVehicleData.model}` : `${selectedVehicle?.brand} ${selectedVehicle?.model}`}</p>
          </div>
          <Car size={18} className="text-blue-400/60 flex-shrink-0"/>
        </div>

        {/* Service type */}
        <div>
          <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Tipo de Servicio <span className="text-red-400">*</span></label>
          <div className="relative">
            <select className={selectCls} value={apptData.serviceType}
              onChange={e => setApptData(p => ({ ...p, serviceType: e.target.value }))}>
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-chrome-500 rotate-90 pointer-events-none"/>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Descripción del Problema <span className="text-red-400">*</span></label>
          <textarea className={`${inputCls} resize-none`} rows={3}
            placeholder="Describe el problema o servicio que necesita el vehículo..."
            value={apptData.description}
            onChange={e => setApptData(p => ({ ...p, description: e.target.value }))}/>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Fecha <span className="text-red-400">*</span></label>
            <input className={inputCls} type="date" min={TODAY} value={apptData.scheduledDate}
              onChange={e => setApptData(p => ({ ...p, scheduledDate: e.target.value }))}/>
          </div>
          <div>
            <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Hora <span className="text-red-400">*</span></label>
            <div className="relative">
              <select className={selectCls} value={apptData.scheduledTime}
                onChange={e => setApptData(p => ({ ...p, scheduledTime: e.target.value }))}>
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Clock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none"/>
            </div>
          </div>
        </div>

        {/* Mechanic */}
        {mechanics.length > 0 && (
          <div>
            <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Mecánico Asignado</label>
            <div className="relative">
              <select className={selectCls} value={apptData.mechanicId}
                onChange={e => setApptData(p => ({ ...p, mechanicId: e.target.value }))}>
                <option value="">Sin asignar</option>
                {mechanics.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <User size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-chrome-500 pointer-events-none"/>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-[10px] font-black text-chrome-400 uppercase tracking-[0.15em] mb-1.5 block">Notas Adicionales</label>
          <textarea className={`${inputCls} resize-none`} rows={2}
            placeholder="Observaciones especiales para el taller..."
            value={apptData.notes}
            onChange={e => setApptData(p => ({ ...p, notes: e.target.value }))}/>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5"/>
          <p className="text-[10px] text-emerald-300/80 font-medium">Al confirmar, se creará automáticamente un informe de taller en estado <strong>Ingresado</strong>.</p>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────
     MAIN RENDER
  ───────────────────────────────────────────────────── */
  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-chrome-100 uppercase tracking-tight leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Citas del Taller
          </h1>
          <p className="text-chrome-500 text-xs font-semibold mt-1">
            Gestión de citas para mantenimiento y reparación de vehículos
          </p>
        </div>
        <button
          onClick={openWizard}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-all hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 20px rgba(59,130,246,0.35)' }}
        >
          <Plus size={16}/> Nueva Cita
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Citas Hoy', value: appointments.filter(a => a.scheduledDate === TODAY).length, icon: <Calendar size={16}/>, color: 'text-blue-400', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
          { label: 'Pendientes', value: pendingCount, icon: <Clock size={16}/>, color: 'text-amber-400', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
          { label: 'Confirmadas', value: appointments.filter(a => a.status === 'Confirmada').length, icon: <CheckCircle2 size={16}/>, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
          { label: 'Este Mes', value: appointments.filter(a => a.scheduledDate.startsWith(TODAY.substring(0,7))).length, icon: <CalendarDays size={16}/>, color: 'text-purple-400', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>
            <div className={`${kpi.color}`}>{kpi.icon}</div>
            <div>
              <p className="text-2xl font-black text-chrome-100 leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>{kpi.value}</p>
              <p className="text-[10px] font-bold text-chrome-500 uppercase tracking-wider mt-0.5">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {([
          { id: 'hoy', label: `Hoy${todayCount > 0 ? ` (${todayCount})` : ''}` },
          { id: 'semana', label: 'Esta Semana' },
          { id: 'pendientes', label: `Pendientes${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { id: 'todas', label: 'Todas' },
        ] as const).map(tab => (
          <button key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all
              ${filterTab === tab.id
                ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                : 'text-chrome-400 hover:text-chrome-200 hover:bg-white/5'}`}
            style={filterTab !== tab.id ? { border: '1px solid rgba(255,255,255,0.08)' } : {}}>
            {tab.label}
          </button>
        ))}
        <div className="ml-auto relative flex-shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500"/>
          <input
            className="pl-8 pr-4 py-2 rounded-xl text-xs font-semibold text-chrome-100 placeholder:text-chrome-500/60 outline-none focus:border-blue-500/50"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minWidth: 180 }}
            placeholder="Buscar cita..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
      </div>

      {/* ── Appointment Grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
            <CalendarDays size={28} className="text-chrome-500"/>
          </div>
          <div className="text-center">
            <p className="text-chrome-300 font-black uppercase tracking-wider">Sin citas {filterTab === 'hoy' ? 'para hoy' : filterTab === 'semana' ? 'esta semana' : filterTab === 'pendientes' ? 'pendientes' : ''}</p>
            <p className="text-chrome-500 text-xs font-semibold mt-1">Crea una nueva cita usando el botón "Nueva Cita"</p>
          </div>
          <button onClick={openWizard} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-blue-400 hover:bg-blue-500/10 transition-colors" style={{ border: '1px solid rgba(59,130,246,0.2)' }}>
            <Plus size={14}/> Agendar Cita
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(appt => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              onViewRepair={handleViewRepair}
              onCancel={handleCancelAppointment}
              onConfirm={handleConfirmAppointment}
              onDelete={handleDeleteAppointment}
            />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════
           WIZARD MODAL
      ═══════════════════════════════ */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div
            className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in"
            style={{ background: '#0e1017', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 flex-shrink-0">
              <div>
                <h2 className="text-base font-black text-chrome-100 uppercase tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Nueva Cita
                </h2>
                <p className="text-chrome-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                  Paso {wizardStep} de 3
                </p>
              </div>
              <button onClick={closeWizard} className="p-2 rounded-xl text-chrome-500 hover:text-chrome-200 hover:bg-white/5 transition-colors">
                <X size={18}/>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <WizardSteps current={wizardStep}/>
              {wizardStep === 1 && renderStep1()}
              {wizardStep === 2 && renderStep2()}
              {wizardStep === 3 && renderStep3()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/8 flex items-center gap-3 flex-shrink-0">
              {wizardStep > 1 && (
                <button
                  onClick={() => { setWizardStep(s => s - 1); setActiveRepairWarning(null); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-chrome-400 hover:text-chrome-200 transition-colors"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <ChevronLeft size={14}/> Atrás
                </button>
              )}
              <div className="flex-1"/>
              {wizardStep < 3 ? (
                <button
                  onClick={wizardStep === 1 ? handleStep1Next : handleStep2Next}
                  disabled={wizardStep === 2 && !!activeRepairWarning}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 16px rgba(59,130,246,0.3)' }}
                >
                  Siguiente <ChevronRight size={14}/>
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}
                >
                  {isSaving ? <><Loader2 size={14} className="animate-spin"/> Guardando…</> : <><CheckCircle2 size={14}/> Confirmar Cita</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsModule;
