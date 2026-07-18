export const normalizeText = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompose diacritics
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric to ignore spacing/dashes etc.
};

export const fuzzyMatch = (query: string, text: string | null | undefined): boolean => {
  if (!query) return true;
  const normalizedQuery = normalizeText(query);
  const normalizedText = normalizeText(text);
  return normalizedText.includes(normalizedQuery);
};

export const fuzzySearch = <T>(
  items: T[],
  query: string,
  fields: (keyof T | ((item: T) => string))[]
): T[] => {
  if (!query) return items;
  
  return items.filter(item => {
    return fields.some(field => {
      const value = typeof field === 'function' ? field(item) : String(item[field] || '');
      return fuzzyMatch(query, value);
    });
  });
};
