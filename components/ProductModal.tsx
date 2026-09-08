import React, { useState, useEffect } from 'react';
import { X, Save, Package, DollarSign, Tag, Briefcase, Wrench, AlertCircle } from 'lucide-react';
import { Product } from '../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Partial<Product>) => Promise<void>;
  initialData?: Partial<Product>;
  isConsignmentMode?: boolean;
}

const PREDEFINED_CATEGORIES = [
  'Lubricantes',
  'Filtros',
  'Frenos',
  'Eléctrico',
  'Suspensión',
  'Refrigeración',
  'Transmisión',
  'Carrocería',
  'Neumáticos',
  'Herramientas',
  'Accesorios',
  'Consumibles',
  'Repuestos Generales',
  'Servicio',
];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  isConsignmentMode = false,
}) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: '',
    brand: '',
    barcode: '',
    quantity: 0,
    cost: 0,
    profitMargin: 30,
    price: 0,
    consignmentProvider: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);

  const isServicio = formData.category === 'Servicio';

  // Sync initialData
  useEffect(() => {
    if (isOpen) {
      const cat = initialData?.category || '';
      const isKnown = PREDEFINED_CATEGORIES.includes(cat) || cat === '';
      setUseCustomCategory(!isKnown && cat !== '');
      setCustomCategory(isKnown ? '' : cat);

      setFormData({
        name: initialData?.name || '',
        category: isKnown ? cat : 'Otro',
        brand: initialData?.brand || '',
        barcode: initialData?.barcode || '',
        quantity: initialData?.quantity || 0,
        cost: initialData?.cost || 0,
        profitMargin: initialData?.profitMargin ?? 30,
        price: initialData?.price || 0,
        consignmentProvider: initialData?.consignmentProvider || '',
      });
    }
  }, [isOpen, initialData]);

  // Auto-calculate price when cost or profitMargin changes (only for regular products)
  useEffect(() => {
    if (isServicio) return;
    const cost = Number(formData.cost) || 0;
    const margin = Number(formData.profitMargin) || 0;
    const calculatedPrice = Math.ceil(cost / (1 - (margin / 100)));

    if (calculatedPrice !== formData.price) {
      setFormData((prev) => ({
        ...prev,
        price: calculatedPrice,
      }));
    }
  }, [formData.cost, formData.profitMargin, isServicio]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrice = parseFloat(e.target.value) || 0;
    const cost = Number(formData.cost) || 0;

    let newMargin = formData.profitMargin;
    if (cost > 0) {
      newMargin = ((newPrice / cost) - 1) * 100;
    }

    setFormData({
      ...formData,
      price: newPrice,
      profitMargin: Number(newMargin?.toFixed(2)),
    });
  };

  const handleCategoryChange = (val: string) => {
    if (val === '__custom__') {
      setUseCustomCategory(true);
      setFormData({ ...formData, category: customCategory });
    } else {
      setUseCustomCategory(false);
      setFormData({ ...formData, category: val });
    }
  };

  const getEffectiveCategory = () => {
    if (useCustomCategory) return customCategory;
    return formData.category || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dataToSave = { ...formData };

      // Resolve final category
      dataToSave.category = getEffectiveCategory();

      // Force calculated price only for products, for Services keep user entered price
      if (dataToSave.category !== 'Servicio') {
        const cost = Number(dataToSave.cost) || 0;
        const margin = Number(dataToSave.profitMargin) || 0;
        dataToSave.price = cost * (1 + margin / 100);
      } else {
        dataToSave.price = Number(dataToSave.price) || 0;
        dataToSave.quantity = 9999;
      }

      if (isConsignmentMode) {
        dataToSave.isConsignment = true;
      }

      await onSave(dataToSave);
      onClose();
    } catch (error) {
      console.error(error);
      alert('Error guardando el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectValue = useCustomCategory ? '__custom__' : (formData.category || '');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 lg:p-8">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 lg:p-8 border-b border-slate-800">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            {isServicio ? <Wrench className="text-amber-500" size={28} /> : <Package className="text-blue-500" size={28} />}
            {initialData?.id ? 'Editar Producto' : 'Nuevo Producto'}
            {isConsignmentMode && <span className="ml-2 text-sm bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">Consignación</span>}
            {isServicio && <span className="ml-2 text-sm bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full border border-amber-500/30">⚙️ Servicio</span>}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 lg:p-8 overflow-y-auto custom-scrollbar">
          <form id="productForm" onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Información Básica */}
              <div className="space-y-4 md:col-span-2 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Tag size={16} /> Información Principal
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nombre / Descripción *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder={isServicio ? 'Ej: Cambio de Aceite, Diagnóstico...' : 'Ej: Aceite Motor 20W50'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Código de Barras</label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder={isServicio ? 'No requerido para servicios' : 'Opcional'}
                    />
                  </div>

                  {/* Categoría — Select con opciones predefinidas */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Categoría</label>
                    <div className="flex gap-2">
                      <select
                        value={selectValue}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className={`flex-1 border rounded-lg px-4 py-2.5 text-white outline-none transition-all appearance-none ${isServicio
                          ? 'bg-amber-900/20 border-amber-500/40 focus:ring-2 focus:ring-amber-500'
                          : 'bg-slate-800 border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                          }`}
                      >
                        <option value="">— Seleccionar categoría —</option>
                        {PREDEFINED_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat === 'Servicio' ? '⚙️ Servicio (Estático)' : cat}</option>
                        ))}
                        <option value="__custom__">✏️ Otra (escribir manualmente)</option>
                      </select>

                      {useCustomCategory && (
                        <input
                          type="text"
                          placeholder="Escriba la categoría..."
                          value={customCategory}
                          onChange={(e) => {
                            setCustomCategory(e.target.value);
                            setFormData({ ...formData, category: e.target.value });
                          }}
                          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        />
                      )}
                    </div>

                    {/* Banner especial para Servicio */}
                    {isServicio && (
                      <div className="mt-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                        <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-300 leading-relaxed">
                          <span className="font-bold">Categoría Servicio:</span> Este ítem es <strong>estático</strong> y <strong>nunca descuenta del inventario</strong>, independientemente de si la cotización es aprobada o no. Úsalo para mano de obra, diagnósticos, inspecciones, etc.
                        </p>
                      </div>
                    )}
                  </div>

                  {!isServicio && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Marca</label>
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="Ej: Toyota, Castrol"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Proveedor de Consignación */}
              {isConsignmentMode && (
                <div className="space-y-4 md:col-span-2 bg-purple-900/10 p-6 rounded-xl border border-purple-500/30">
                  <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Briefcase size={16} /> Detalles de Consignación
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Proveedor / Dueño *</label>
                    <input
                      type="text"
                      required
                      value={formData.consignmentProvider}
                      onChange={(e) => setFormData({ ...formData, consignmentProvider: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                </div>
              )}

              {/* Rentabilidad */}
              <div className={`space-y-4 md:col-span-2 p-6 rounded-xl border ${isServicio ? 'bg-amber-900/10 border-amber-500/20' : 'bg-emerald-900/10 border-emerald-500/30'
                }`}>
                <h3 className={`text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-2 ${isServicio ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                  <DollarSign size={16} /> Estructura de Precios
                  {isServicio && <span className="text-xs font-normal text-amber-500/70 ml-1">(Precio del servicio)</span>}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {!isServicio && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Costo ($)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0"
                          value={formData.cost}
                          onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-8 pr-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {!isServicio && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Margen de Ganancia (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          step="0.01"
                          value={formData.profitMargin}
                          onChange={(e) => setFormData({ ...formData, profitMargin: parseFloat(e.target.value) })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg pr-8 pl-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                      </div>
                    </div>
                  )}

                  <div className={isServicio ? 'md:col-span-3' : ''}>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      {isServicio ? 'Precio del Servicio ($)' : 'Precio Final Auto-Calculado ($)'}
                    </label>
                    <div className="relative">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold ${isServicio ? 'text-amber-400' : 'text-emerald-400'
                        }`}>$</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.price !== undefined && formData.price !== null ? formData.price : ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setFormData(prev => ({ ...prev, price: isNaN(val) ? 0 : val }));
                        }}
                        className={`w-full rounded-lg pl-8 pr-4 py-2.5 font-bold outline-none transition-all focus:ring-2 ${isServicio
                          ? 'bg-amber-900/30 border border-amber-500/50 text-amber-300 focus:ring-amber-500'
                          : 'bg-emerald-900/30 border border-emerald-500/50 text-emerald-300 focus:ring-emerald-500'
                          }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock — Oculto para Servicios */}
              {!isServicio && (
                <div className="space-y-4 md:col-span-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Cantidad Inicial en Stock</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                      disabled={!!initialData?.id}
                      className="w-full md:w-1/3 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {!!initialData?.id && (
                      <p className="text-xs text-slate-500 mt-1">La cantidad no se puede editar aquí. Usa las herramientas de stock de la tabla.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Para Servicios: indicador de disponibilidad ilimitada */}
              {isServicio && (
                <div className="md:col-span-2 flex items-center gap-3 bg-slate-800/40 border border-slate-700 rounded-xl px-5 py-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                    <Wrench size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Disponibilidad Ilimitada</p>
                    <p className="text-xs text-slate-400 mt-0.5">Los servicios no tienen stock físico. No se descuentan del inventario al ser cotizados o aprobados.</p>
                  </div>
                </div>
              )}

            </div>
          </form>
        </div>

        <div className="p-6 lg:p-8 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="productForm"
            disabled={isSubmitting}
            className={`px-6 py-2.5 rounded-lg font-medium text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isServicio
              ? 'bg-amber-600 hover:bg-amber-500'
              : 'bg-blue-600 hover:bg-blue-500'
              }`}
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {initialData?.id ? 'Guardar Cambios' : (isServicio ? 'Registrar Servicio' : 'Registrar Producto')}
          </button>
        </div>
      </div>
    </div>
  );
};
