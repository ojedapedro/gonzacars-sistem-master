
/**
 * GOOGLE SHEETS DATABASE SCRIPT - GONZACARS C.A.
 * ID: 1L-Fmfey-8ZR6vgF5DVR6B5fiSLbVYo7YDs7pIuBxmEU
 * RIF: J-50030426-9
 * 
 * UPDATE: Added 'batch_purchase' and 'audit_inventory' actions.
 */

const SPREADSHEET_ID = '1L-Fmfey-8ZR6vgF5DVR6B5fiSLbVYo7YDs7pIuBxmEU';

function setupDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = [
    { name: 'Users', headers: ['id', 'username', 'password', 'name', 'role'] },
    { name: 'Customers', headers: ['id', 'name', 'phone', 'email', 'address', 'createdAt'] },
    { name: 'Inventory', headers: ['id', 'barcode', 'name', 'category', 'quantity', 'cost', 'price', 'lastEntry'] },
    { name: 'Repairs', headers: ['id', 'customerId', 'plate', 'brand', 'model', 'year', 'ownerName', 'responsible', 'status', 'diagnosis', 'serviceType', 'mechanicId', 'evidencePhotos', 'items', 'installments', 'createdAt', 'finishedAt', 'paymentMethod'] },
    { name: 'Sales', headers: ['id', 'customerId', 'date', 'customerName', 'items', 'total', 'iva', 'paymentMethod'] },
    { name: 'Purchases', headers: ['id', 'date', 'provider', 'invoiceNumber', 'productId', 'productName', 'category', 'price', 'quantity', 'total', 'type', 'status'] },
    { name: 'Expenses', headers: ['id', 'date', 'category', 'description', 'amount'] },
    { name: 'Employees', headers: ['id', 'name', 'role', 'baseSalary', 'commissionRate'] },
    { name: 'Payroll', headers: ['id', 'employeeId', 'date', 'baseSalary', 'commission', 'total', 'status'] },
    { name: 'Settings', headers: ['key', 'value'] }
  ];

  sheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
    }
    // Check if headers exist, if not set them
    if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers]).setFontWeight('bold');
        sheet.setFrozenRows(1);
    }
  });
  
  return "Base de datos verificada.";
}

function doGet(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({error: "Server busy"})).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const data = {};
    
    ss.getSheets().forEach(sheet => {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const values = sheet.getDataRange().getValues();
        const headers = values.shift(); // Remove header
        data[sheet.getName()] = values.map(row => {
          const obj = {};
          headers.forEach((h, i) => {
            let val = row[i];
            // Safe JSON parse for complex fields
            if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
              try { val = JSON.parse(val); } catch (e) {}
            }
            obj[h] = val;
          });
          return obj;
        });
      } else {
        data[sheet.getName()] = [];
      }
    });
    
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(60000); // Wait up to 60s for heavy ops
  } catch (e) {
    return ContentService.createTextOutput("Error: Server busy, lock timeout").setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // --- ACCIÓN: AUDITORÍA Y RECONCILIACIÓN DE INVENTARIO ---
    if (action === 'audit_inventory') {
       const invSheet = ss.getSheetByName('Inventory');
       const purSheet = ss.getSheetByName('Purchases');
       const saleSheet = ss.getSheetByName('Sales');
       
       // 1. Obtener Datos
       const rawPurchases = purSheet.getDataRange().getValues();
       const purHeaders = rawPurchases.shift();
       const rawSales = saleSheet.getDataRange().getValues();
       const saleHeaders = rawSales.shift();
       
       // Índices Compras
       const pIdIdx = purHeaders.indexOf('productId');
       const pNameIdx = purHeaders.indexOf('productName');
       const pCatIdx = purHeaders.indexOf('category');
       const pPriceIdx = purHeaders.indexOf('price');
       const pQtyIdx = purHeaders.indexOf('quantity');
       const pDateIdx = purHeaders.indexOf('date');

       // Índices Ventas
       const sItemsIdx = saleHeaders.indexOf('items');

       // Mapa maestro de cálculo: { productId: { qty: 0, cost: 0, name: '', cat: '', lastEntry: '' } }
       const stockMap = {};

       // 2. Sumar Compras (Entradas)
       rawPurchases.forEach(row => {
          const pid = String(row[pIdIdx]).trim();
          if (!pid) return;

          if (!stockMap[pid]) {
             stockMap[pid] = { 
               qty: 0, 
               cost: 0, 
               name: row[pNameIdx], 
               cat: row[pCatIdx], 
               lastEntry: row[pDateIdx],
               barcode: Math.floor(100000000000 + Math.random() * 900000000000).toString() // Fallback barcode
             };
          }
          
          stockMap[pid].qty += Number(row[pQtyIdx] || 0);
          stockMap[pid].cost = Number(row[pPriceIdx] || 0); // Último costo
          if (row[pDateIdx] > stockMap[pid].lastEntry) {
             stockMap[pid].lastEntry = row[pDateIdx];
          }
          if (row[pNameIdx]) stockMap[pid].name = row[pNameIdx]; // Actualizar nombre si cambió
       });

       // 3. Restar Ventas (Salidas)
       rawSales.forEach(row => {
          let items = [];
          try {
             items = JSON.parse(row[sItemsIdx]);
          } catch (e) { return; }
          
          if (Array.isArray(items)) {
             items.forEach(item => {
                if (item.productId && stockMap[item.productId]) {
                   stockMap[item.productId].qty -= Number(item.quantity || 0);
                }
             });
          }
       });

       // 4. Actualizar Hoja de Inventario
       const invData = invSheet.getDataRange().getValues();
       const invHeaders = invData.shift();
       const invIdIdx = invHeaders.indexOf('id');
       
       // Mapa de filas existentes en inventario para actualización rápida
       const existingInvMap = {};
       invData.forEach((row, idx) => {
          const pid = String(row[invIdIdx]).trim();
          existingInvMap[pid] = idx + 2; // Row number (1-based, +header)
       });

       // Iterar sobre el Stock Calculado (La Verdad Matemática)
       Object.keys(stockMap).forEach(pid => {
          const data = stockMap[pid];
          const finalQty = Math.max(0, data.qty); // No permitir negativos
          
          if (existingInvMap[pid]) {
             // UPDATE: Si existe, forzar la cantidad y costo real
             const rowNum = existingInvMap[pid];
             invSheet.getRange(rowNum, invHeaders.indexOf('quantity') + 1).setValue(finalQty);
             invSheet.getRange(rowNum, invHeaders.indexOf('cost') + 1).setValue(data.cost);
             invSheet.getRange(rowNum, invHeaders.indexOf('lastEntry') + 1).setValue(data.lastEntry);
          } else {
             // INSERT: Si falta (estaba en compras pero no en inventario), crearlo
             const newRow = invHeaders.map(h => {
                if (h === 'id') return pid;
                if (h === 'barcode') return data.barcode;
                if (h === 'name') return data.name;
                if (h === 'category') return data.cat;
                if (h === 'quantity') return finalQty;
                if (h === 'cost') return data.cost;
                if (h === 'price') return Number(data.cost) * 1.35; // Precio sugerido
                if (h === 'lastEntry') return data.lastEntry;
                return '';
             });
             invSheet.appendRow(newRow);
          }
       });

       return ContentService.createTextOutput("Audit Completed: Inventory Reconciled").setMimeType(ContentService.MimeType.TEXT);
    }

    // --- ACCIÓN ESPECIAL: CARGA DE COMPRAS POR LOTE (BLINDADA) ---
    if (action === 'batch_purchase') {
       const purchaseItems = payload.data; 
       const invSheet = ss.getSheetByName('Inventory');
       const purSheet = ss.getSheetByName('Purchases');
       
       const invData = invSheet.getDataRange().getValues();
       const invHeaders = invData[0];
       
       const idxId = invHeaders.indexOf('id');
       const idxQty = invHeaders.indexOf('quantity');
       const idxCost = invHeaders.indexOf('cost');
       const idxLastEntry = invHeaders.indexOf('lastEntry');
       const idxName = invHeaders.indexOf('name'); 

       purchaseItems.forEach(item => {
          let foundRowIndex = -1;
          for (let i = 1; i < invData.length; i++) {
             if (invData[i][idxId] == item.productId) {
                foundRowIndex = i + 1; 
                break;
             }
          }
          if (foundRowIndex === -1) {
             const searchName = String(item.productName).trim().toLowerCase();
             for (let i = 1; i < invData.length; i++) {
                 if (String(invData[i][idxName]).trim().toLowerCase() === searchName) {
                    foundRowIndex = i + 1;
                    item.productId = invData[i][idxId]; 
                    break;
                 }
             }
          }

          if (foundRowIndex !== -1) {
             const currentQty = invSheet.getRange(foundRowIndex, idxQty + 1).getValue();
             const newQty = Number(currentQty) + Number(item.quantity);
             invSheet.getRange(foundRowIndex, idxQty + 1).setValue(newQty);
             invSheet.getRange(foundRowIndex, idxCost + 1).setValue(item.price);
             invSheet.getRange(foundRowIndex, idxLastEntry + 1).setValue(item.date);
          } else {
             if (!item.productId) item.productId = Utilities.getUuid();
             const newInvRow = invHeaders.map(h => {
                if (h === 'id') return item.productId;
                if (h === 'name') return item.productName;
                if (h === 'category') return item.category;
                if (h === 'quantity') return item.quantity;
                if (h === 'cost') return item.price;
                if (h === 'price') return Number(item.price) * 1.35; 
                if (h === 'lastEntry') return item.date;
                if (h === 'barcode') return Math.floor(100000000000 + Math.random() * 900000000000).toString();
                return '';
             });
             invSheet.appendRow(newInvRow);
          }
       });

       const purHeaders = purSheet.getRange(1, 1, 1, purSheet.getLastColumn()).getValues()[0];
       const purchaseRows = purchaseItems.map(p => {
          return purHeaders.map(h => {
             if (h === 'id') return p.id || Utilities.getUuid();
             if (h === 'status') return p.status || 'Pagada';
             return (p[h] !== undefined) ? p[h] : '';
          });
       });
       
       if (purchaseRows.length > 0) {
         purSheet.getRange(purSheet.getLastRow() + 1, 1, purchaseRows.length, purHeaders.length).setValues(purchaseRows);
       }

       return ContentService.createTextOutput("Batch Success").setMimeType(ContentService.MimeType.TEXT);
    }
    
    // --- ACCIONES ESTÁNDAR (ADD, UPDATE, DELETE) ---
    const sheet = ss.getSheetByName(payload.sheet);
    if (!sheet) return ContentService.createTextOutput("Error: Sheet not found").setMimeType(ContentService.MimeType.TEXT);

    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    
    if (action === 'add') {
      const newRow = headers.map(h => {
        let val = payload.data[h];
        return (typeof val === 'object') ? JSON.stringify(val) : val;
      });
      sheet.appendRow(newRow);
    } 
    else if (action === 'update') {
      const idIndex = headers.indexOf('id');
      const keyIndex = headers.indexOf('key');
      const matchIndex = idIndex !== -1 ? idIndex : keyIndex;
      
      for (let i = 1; i < values.length; i++) {
        if (values[i][matchIndex] === (payload.data.id || payload.data.key)) {
          const updatedRow = headers.map(h => {
            let val = payload.data[h];
            return (typeof val === 'object') ? JSON.stringify(val) : val;
          });
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([updatedRow]);
          break;
        }
      }
    }
    else if (action === 'delete') {
      const idIndex = headers.indexOf('id');
      for (let i = 1; i < values.length; i++) {
        if (values[i][idIndex] === payload.data.id) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    }

    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.toString()).setMimeType(ContentService.MimeType.TEXT);
  } finally {
    lock.releaseLock();
  }
}
