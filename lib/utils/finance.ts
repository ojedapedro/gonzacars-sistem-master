/**
 * Utility functions for financial precision to avoid floating-point math issues.
 */

/**
 * Rounds a number to a specified number of decimal places (default 4).
 * Handles the floating point precision issues during rounding.
 */
export const roundTo = (value: number | string, decimals: number = 4): number => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 0;
  
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
};

/**
 * Formats a number to currency layout with 2 or 4 decimal places.
 */
export const formatFinance = (value: number, decimals: number = 2): string => {
  return roundTo(value, decimals).toFixed(decimals);
};

/**
 * Formats a number to a currency string.
 */
export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

/**
 * Formats an ISO date string to a localized date string.
 */
export const formatDate = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return isoString;
  }
};
