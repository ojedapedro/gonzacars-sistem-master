
import { GoogleGenAI } from "@google/genai";

// Fix: Correct initialization of GoogleGenAI with an object
export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Fix: Use 'gemini-1.5-flash' for basic text improvement and ensure response.text property access
export const improveDiagnosis = async (prompt: string) => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: `Actúa como un jefe de taller mecánico experto. Convierte la siguiente descripción informal en un diagnóstico técnico formal, profesional y breve para un informe de reparación: "${prompt}"`,
  });
  return response.text;
};

// Fix: Use 'gemini-1.5-pro' for complex auditing tasks and ensure response.text property access
export const generateFinanceAudit = async (data: any) => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-pro',
    contents: `Analiza los siguientes datos financieros de un taller mecánico y tienda de repuestos llamado Gonzacars C.A. Proporciona un análisis financiero detallado del ejercicio económico según el periodo indicado (${data.period}). Tu respuesta debe incluir recomendaciones para optimizar el ahorro y la salud financiera del negocio: 
    Ventas totales: $${data.sales}, 
    Compras totales: $${data.purchases}, 
    Gastos operativos: $${data.expenses},
    Balance neto: $${data.balance}.`,
  });
  return response.text;
};

// Fix: Use 'gemini-1.5-flash' for text-based classification and ensure response.text property access
export const suggestExpenseCategory = async (description: string) => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: `Dada la descripción de un gasto: "${description}", clasifícalo en una de estas categorías: Limpieza, Oficina, Víveres, Impuesto, Aseo Urbano, Internet. Responde SOLO con el nombre de la categoría.`,
  });
  return response.text?.trim();
};
