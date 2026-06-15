// =============================================
// EXPORTACIÓN EXCEL CON ESTILOS
// Usa xlsx-js-style (cargado via CDN en index.html)
// =============================================

async function exportarExcel(fecha) {
  if (typeof XLSX === "undefined") {
    return mostrarToast("Error: No se ha podido cargar la librería Excel.", "error");
  }

  const productos = getProductosFlat();
  const categorias = getCategorias();

  // Obtener stock de ambos depósitos para la fecha
  const stockPlaza = await getStockPorFecha("plaza", fecha);
  const stockLarioja = await getStockPorFecha("larioja", fecha);

  // Combinar totales (packs + sueltas por separado)
  const totales = {};
  const totalesSueltas = {};
  productos.forEach(p => {
    const cantPlaza = stockPlaza[p.id]?.cantidad;
    const cantLarioja = stockLarioja[p.id]?.cantidad;
    
    if (cantPlaza == null && cantLarioja == null) {
      totales[p.id] = null;
    } else {
      totales[p.id] = (cantPlaza || 0) + (cantLarioja || 0);
    }

    if (p.unidad === "pack" || p.unidad === "caja") {
      const idS = `${p.id}__sueltas`;
      const sueltasPlaza = stockPlaza[idS]?.cantidad;
      const sueltasLarioja = stockLarioja[idS]?.cantidad;
      
      if (sueltasPlaza == null && sueltasLarioja == null) {
        totalesSueltas[p.id] = null;
      } else {
        totalesSueltas[p.id] = (sueltasPlaza || 0) + (sueltasLarioja || 0);
      }
    } else {
      totalesSueltas[p.id] = null;
    }
  });

  // Construir matriz de datos (AOA - Array of Arrays)
  const data = [];
  const categoryRows = new Set();
  const merges = [];

  // 1. Encabezado principal (Fila 0)
  data.push(["CONTROL DE STOCK - PLAZA DE LA MÚSICA", "", "", ""]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }); // Combinar A1:D1

  // 2. Metadatos (Filas 1 y 2)
  data.push([`Fecha de stock: ${formatFechaDisplay(fecha)}`, "", "", ""]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 3 } });
  
  data.push([`Generado: ${formatFechaDisplay(formatFecha(new Date()))}`, "", "", ""]);
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 3 } });

  data.push([]); // fila 3 vacía de separación

  // 3. Encabezado de columnas de la tabla (Fila 4)
  data.push(["PRODUCTO", "CANT.", "SUELTAS", "UNIDAD"]);

  // 4. Poblar datos por Categoría
  categorias.forEach(categoria => {
    const productosCat = productos.filter(p => p.categoria === categoria);
    if (productosCat.length === 0) return;

    // Fila de Categoría
    const catRowIdx = data.length;
    categoryRows.add(catRowIdx);
    data.push([categoria.toUpperCase(), "", "", ""]);
    merges.push({ s: { r: catRowIdx, c: 0 }, e: { r: catRowIdx, c: 3 } }); // Combinar fila de categoría

    productosCat.forEach(p => {
      const cantVal = totales[p.id];
      const cant = cantVal !== null ? Number(cantVal) : "—";
      
      let sueltas = "—";
      if (p.unidad === "pack" || p.unidad === "caja") {
        const sueltasVal = totalesSueltas[p.id];
        sueltas = sueltasVal !== null ? Number(sueltasVal) : "—";
      }

      data.push([p.nombre, cant, sueltas, p.unidad]);
    });
  });

  // Fila de pie de página al final
  data.push([]);
  const footerRowIdx = data.length;
  data.push(["Aplicación desarrollada por Oliva González, Pablo — Stock Manager v4.2", "", "", ""]);
  merges.push({ s: { r: footerRowIdx, c: 0 }, e: { r: footerRowIdx, c: 3 } });

  // Crear la hoja de cálculo
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stock");

  // Asignar combinaciones de celdas
  ws['!merges'] = merges;

  // Asegurar que todas las celdas en el rango útil tengan un objeto de celda
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < 4; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
      if (!ws[cellRef]) {
        ws[cellRef] = { v: "", t: "s" };
      }
    }
  }

  // Aplicar estilos a cada celda
  for (let cellKey in ws) {
    if (cellKey.startsWith("!")) continue;
    const cell = ws[cellKey];
    const address = XLSX.utils.decode_cell(cellKey);
    const row = address.r;
    const col = address.c;

    // Inicializar estilos de celda
    cell.s = {
      font: { name: "Arial", sz: 9, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FFFFFF" } },
      alignment: { vertical: "center" },
      border: {}
    };

    // 1. Título principal (Fila 0)
    if (row === 0) {
      cell.s.font = { name: "Arial", sz: 13, bold: true, color: { rgb: "000000" } };
      cell.s.alignment.horizontal = "left";
      cell.s.fill.fgColor = { rgb: "F2F2F2" }; // fondo gris sutil
      cell.s.border = {
        top: { style: "thin", color: { rgb: "D3D3D3" } },
        left: { style: "thin", color: { rgb: "D3D3D3" } },
        right: { style: "thin", color: { rgb: "D3D3D3" } }
      };
    }
    // 2. Metadatos (Filas 1 y 2)
    else if (row === 1 || row === 2) {
      cell.s.font = { name: "Arial", sz: 9, italic: true, color: { rgb: "555555" } };
      cell.s.alignment.horizontal = "left";
      cell.s.fill.fgColor = { rgb: "F2F2F2" };
      cell.s.border = {
        left: { style: "thin", color: { rgb: "D3D3D3" } },
        right: { style: "thin", color: { rgb: "D3D3D3" } }
      };
      if (row === 2) {
        cell.s.border.bottom = { style: "thin", color: { rgb: "D3D3D3" } };
      }
    }
    // 3. Fila de Encabezado de la Tabla (Fila 4)
    else if (row === 4) {
      cell.s.fill.fgColor = { rgb: "1E1E1E" }; // fondo negro/gris oscuro
      cell.s.font = { name: "Arial", sz: 9.5, bold: true, color: { rgb: "FFFFFF" } }; // texto blanco
      cell.s.alignment.horizontal = col === 0 ? "left" : "center"; // Producto a la izq, otros centrados
      cell.s.border = {
        top: { style: "medium", color: { rgb: "1E1E1E" } },
        bottom: { style: "medium", color: { rgb: "1E1E1E" } }
      };
    }
    // 4. Filas de Categoría (Separadores)
    else if (categoryRows.has(row)) {
      cell.s.fill.fgColor = { rgb: "DCDCDC" }; // fondo gris claro (PDF)
      cell.s.font = { name: "Arial", sz: 9.5, bold: true, color: { rgb: "000000" } };
      cell.s.alignment.horizontal = "left";
      cell.s.border = {
        top: { style: "thin", color: { rgb: "B0B0B0" } },
        bottom: { style: "thin", color: { rgb: "B0B0B0" } },
        left: { style: "thin", color: { rgb: "B0B0B0" } },
        right: { style: "thin", color: { rgb: "B0B0B0" } }
      };
    }
    // 5. Filas de Productos normales
    else if (row > 4 && row < footerRowIdx - 1) {
      // Alternancia de colores en filas de datos
      const dataRowIndex = row - 5;
      if (dataRowIndex % 2 === 1) {
        cell.s.fill.fgColor = { rgb: "F9F9F9" }; // fondo alterno sutil
      }

      cell.s.font = { name: "Arial", sz: 9, color: { rgb: "1A1A1A" } };
      cell.s.alignment.horizontal = col === 0 ? "left" : "center"; // centrados valores y unidad

      cell.s.border = {
        bottom: { style: "thin", color: { rgb: "E8E0D5" } },
        left: { style: "thin", color: { rgb: "E8E0D5" } },
        right: { style: "thin", color: { rgb: "E8E0D5" } }
      };
    }
    // 6. Pie de página
    else if (row === footerRowIdx) {
      cell.s.font = { name: "Arial", sz: 8.5, italic: true, color: { rgb: "777777" } };
      cell.s.alignment.horizontal = "center";
      cell.s.fill.fgColor = { rgb: "FFFFFF" };
    }
  }

  // Configurar ancho de columnas
  const wscols = [
    { wch: 38 }, // PRODUCTO
    { wch: 12 }, // CANT.
    { wch: 12 }, // SUELTAS
    { wch: 10 }  // UNIDAD
  ];
  ws['!cols'] = wscols;

  // Guardar archivo Excel
  const nombreArchivo = `Stock_Plaza_${fecha}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
}
