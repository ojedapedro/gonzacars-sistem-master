import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Sube una imagen en formato Base64 (data_url) a Firebase Storage.
 * @param base64Image La cadena Base64 (data:image/jpeg;base64,...)
 * @param path Ruta donde se guardará (ej. repairs/ID/foto1.jpg)
 * @returns La URL pública de descarga de la imagen.
 */
export const uploadBase64Image = async (base64Image: string, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64Image, 'data_url');
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error subiendo imagen a Storage:', error);
    throw error;
  }
};

/**
 * Borra una imagen de Firebase Storage a partir de su URL.
 * @param fileUrl URL pública de descarga de la imagen.
 */
export const deleteImageFromUrl = async (fileUrl: string): Promise<void> => {
  try {
    if (!fileUrl.includes('firebasestorage')) {
      // No es una URL de Firebase Storage, omitimos (quizás era un base64 antiguo o placeholder)
      return;
    }
    const storageRef = ref(storage, fileUrl);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error borrando imagen de Storage:', error);
    // Ignoramos errores 404 por si la imagen ya no existe
  }
};
