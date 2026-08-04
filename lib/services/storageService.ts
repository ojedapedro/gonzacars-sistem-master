/**
 * storageService.ts — Modo Base64 local (sin Firebase Storage)
 *
 * Las imágenes se guardan como strings Base64 comprimidos directamente
 * en el documento Firestore de cada reparación (campo evidencePhotos[]).
 * La compresión previa (600×600px, calidad 0.30) garantiza ≤ 80 KB por foto,
 * con un máximo de 5 fotos → ≤ 400 KB, dentro del límite de 1 MB de Firestore.
 *
 * Cuando Firebase Storage esté disponible, reemplazar estas funciones
 * por la implementación original con uploadString/getDownloadURL.
 */

/**
 * "Sube" una imagen — en este modo simplemente devuelve el Base64 tal cual.
 * @param base64Image La cadena Base64 ya comprimida (data:image/jpeg;base64,...)
 * @param _path       Ruta de destino (reservado para futura migración a Storage)
 * @returns           El mismo Base64 para guardar en Firestore.
 */
export const uploadBase64Image = async (base64Image: string, _path: string): Promise<string> => {
  // Validación de seguridad: asegurar que es un data URL válido
  if (!base64Image || !base64Image.startsWith('data:')) {
    throw new Error('La imagen no tiene un formato Base64 válido.');
  }
  return base64Image;
};

/**
 * "Borra" una imagen — en modo Base64 no hay nada que borrar en Storage.
 * Si la URL es un data URL (Base64), simplemente se omite.
 * @param fileUrl URL de la imagen o cadena Base64.
 */
export const deleteImageFromUrl = async (fileUrl: string): Promise<void> => {
  if (!fileUrl || fileUrl.startsWith('data:')) {
    // Es un Base64 local — no hay recurso externo que eliminar
    return;
  }
  // Si en el futuro se migra a Firebase Storage, el código de borrado iría aquí:
  // const storageRef = ref(storage, fileUrl);
  // await deleteObject(storageRef);
};
