import React, { useState, useEffect } from 'react';
import { X, Save, Package, DollarSign, Tag, Briefcase } from 'lucide-react';
import { Product } from '../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Partial<Product>) => Promise<void>;
  initialData?: Partial<Product>;
  isConsignmentMode?: boolean;
}

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
    profitMargin: 30, // Default 30%
    price: 0,
    consignmentProvider: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initialData
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialData?.name || '',
        category: initialData?.category || '',
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

  // Auto-calculate price when cost or profitMargin changes
  useEffect(() => {
    const cost = Number(formData.cost) || 0;
    const margin = Number(formData.profitMargin) || 0;
    const calculatedPrice = cost * (1 + margin / 100);
    
    // Only update if different to avoid loops
    if (calculatedPrice !== formData.price) {
      setFormData((prev) => ({
        ...prev,
        price: calculatedPrice,
      }));
    }
  }, [formData.cost, formData.profitMargin]);

  // If user edits price manually, auto-calculate margin (Reversible Logic as discussed)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dataToSave = { ...formData };
      
      // Force calculated price to be sure
      const cost = Number(dataToSave.cost) || 0;
      const margin = Number(dataToSave.profitMargin) || 0;
      dataToSave.price = cost * (1 + margin / 100);

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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="text-blue-500" />
            {initialData?.id ? 'Editar Producto' : 'Nuevo Producto'}
            {isConsignmentMode && <span className="ml-2 text-sm bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">Consignación</span>}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form id="productForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Información Básica */}
              <div className="space-y-4 md:col-span-2 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
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
                      placeholder="Ej: Aceite Motor 20W50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Código de Barras</label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="Opcional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Categoría</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="Ej: Lubricantes"
                    />
                  </div>

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
                </div>
              </div>

              {/* Proveedor de Consignación */}
              {isConsignmentMode && (
                <div className="space-y-4 md:col-span-2 bg-purple-900/10 p-4 rounded-lg border border-purple-500/30">
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
              <div className="space-y-4 md:col-span-2 bg-emerald-900/10 p-4 rounded-lg border border-emerald-500/30">
                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <DollarSign size={16} /> Estructura de Precios
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Precio Final Auto-Calculado ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">$</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={formData.price?.toFixed(2)}
                        onChange={handlePriceChange}
                        className="w-full bg-emerald-900/30 border border-emerald-500/50 rounded-lg pl-8 pr-4 py-2.5 text-emerald-300 font-bold focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Inventario (Only visible if not editing, as stock is handled differently or via direct edit, but we can allow initial stock) */}
              <div className="space-y-4 md:col-span-2">
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Cantidad Inicial en Stock</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                      disabled={!!initialData?.id} // Disable if editing, use bulk stock update instead
                      className="w-full md:w-1/3 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {!!initialData?.id && (
                      <p className="text-xs text-slate-500 mt-1">La cantidad no se puede editar aquí. Usa las herramientas de stock de la tabla.</p>
                    )}
                 </div>
              </div>

            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
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
            className="px-6 py-2.5 rounded-lg font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {initialData?.id ? 'Guardar Cambios' : 'Registrar Producto'}
          </button>
        </div>
      </div>
    </div>
  );
};
