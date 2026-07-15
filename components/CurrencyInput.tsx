import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowRightLeft } from 'lucide-react';
import { useGonzacarsStore } from '../store';
import { Currency, bsToUsd, usdToBs } from '../lib/utils/currency';

interface CurrencyInputProps {
  valueUsd: number;
  onChangeUsd: (val: number) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  hideLabel?: boolean;
  required?: boolean;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ 
  valueUsd, 
  onChangeUsd, 
  label, 
  disabled = false, 
  className = '', 
  hideLabel = false,
  required = false
}) => {
  const { exchangeRate } = useGonzacarsStore();
  const [activeCurrency, setActiveCurrency] = useState<Currency>('USD');
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  // Sync external changes (when not focused)
  useEffect(() => {
    if (!isFocused) {
      if (activeCurrency === 'USD') {
        setDisplayValue(valueUsd ? valueUsd.toString() : '');
      } else {
        const bsValue = usdToBs(valueUsd || 0, exchangeRate);
        setDisplayValue(bsValue ? bsValue.toFixed(2) : '');
      }
    }
  }, [valueUsd, activeCurrency, exchangeRate, isFocused]);

  const handleToggleCurrency = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveCurrency(prev => prev === 'USD' ? 'Bs' : 'USD');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setDisplayValue(rawValue);

    const numValue = parseFloat(rawValue);
    if (isNaN(numValue)) {
      onChangeUsd(0);
      return;
    }

    if (activeCurrency === 'USD') {
      onChangeUsd(numValue);
    } else {
      onChangeUsd(bsToUsd(numValue, exchangeRate));
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {!hideLabel && (
        <div className="flex justify-between items-center px-1">
          <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest">
            {label || 'Monto'}
          </label>
          {activeCurrency === 'Bs' && (
            <span className="text-[9px] font-bold text-chrome-600 bg-metal-dark px-2 py-0.5 rounded-full border border-metal-border">
              Ref: ${valueUsd.toFixed(2)}
            </span>
          )}
        </div>
      )}
      
      <div className={`relative flex items-center bg-metal-dark border rounded-2xl overflow-hidden transition-all group ${isFocused ? 'border-blue-500/50 ring-4 ring-blue-500/15' : 'border-metal-border hover:border-metal-border/80'}`}>
        {/* Toggle Button */}
        <button 
          type="button"
          onClick={handleToggleCurrency}
          disabled={disabled}
          className="px-4 py-3 bg-metal-mid border-r border-metal-border text-chrome-400 hover:text-chrome-100 hover:bg-slate-700 transition-colors flex items-center gap-1.5 min-w-[70px] justify-center"
          title="Cambiar moneda"
        >
          <span className="font-black text-sm">{activeCurrency === 'USD' ? '$' : 'Bs'}</span>
          <ArrowRightLeft size={12} className="opacity-50" />
        </button>

        <input 
          type="number"
          min={0}
          step="0.01"
          required={required}
          disabled={disabled}
          className={`w-full px-4 py-3 bg-transparent font-bold text-lg outline-none text-white ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          placeholder="0.00"
          value={displayValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </div>
    </div>
  );
};

export default CurrencyInput;
