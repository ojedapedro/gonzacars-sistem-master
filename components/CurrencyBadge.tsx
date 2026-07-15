import React from 'react';
import { useGonzacarsStore } from '../store';
import { formatUSD, formatBs } from '../lib/utils/currency';

interface CurrencyBadgeProps {
  amountUsd: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showBsOnly?: boolean;
}

const CurrencyBadge: React.FC<CurrencyBadgeProps> = ({ 
  amountUsd, 
  className = '',
  size = 'md',
  showBsOnly = false
}) => {
  const { exchangeRate } = useGonzacarsStore();
  
  const sizeClasses = {
    sm: { usd: 'text-sm', bs: 'text-[10px]' },
    md: { usd: 'text-base', bs: 'text-xs' },
    lg: { usd: 'text-2xl', bs: 'text-sm' }
  };

  if (showBsOnly) {
    return (
      <span className={`font-black ${sizeClasses[size].usd} ${className}`}>
        {formatBs(amountUsd, exchangeRate)}
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-end leading-tight ${className}`}>
      <span className={`font-black ${sizeClasses[size].usd}`}>
        {formatUSD(amountUsd)}
      </span>
      <span className={`font-bold text-chrome-500 uppercase ${sizeClasses[size].bs}`}>
        {formatBs(amountUsd, exchangeRate)}
      </span>
    </div>
  );
};

export default CurrencyBadge;
