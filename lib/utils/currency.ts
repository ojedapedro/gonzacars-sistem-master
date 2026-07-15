export type Currency = 'USD' | 'Bs';

export const usdToBs = (amount: number, rate: number): number => {
  return amount * rate;
};

export const bsToUsd = (amount: number, rate: number): number => {
  if (rate <= 0) return 0;
  return amount / rate;
};

export const formatUSD = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatBs = (amount: number, rate: number): string => {
  const converted = usdToBs(amount, rate);
  return `${converted.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
};

export const formatDual = (amount: number, rate: number): string => {
  return `${formatUSD(amount)} | ${formatBs(amount, rate)}`;
};
