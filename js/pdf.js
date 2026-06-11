// =============================================
// EXPORTACIÓN PDF
// Usa jsPDF (cargado via CDN en index.html)
// =============================================

async function exportarPDF(fecha) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

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
    }
  });

  // --- Encabezado ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PLAZA DE LA MÚSICA", 105, 15, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${formatFechaDisplay(fecha)}`, 105, 22, { align: "center" });
  doc.text(`Generado: ${formatFechaDisplay(formatFecha(new Date()))}`, 105, 27, { align: "center" });

  // Línea separadora
  doc.setLineWidth(0.5);
  doc.line(14, 30, 196, 30);

  let y = 36;
  const colProducto = 14;
  const colPacks    = 120;
  const colSueltas  = 150;
  const colUnidad   = 178;
  const pageHeight  = 285;

  // --- Encabezado de columnas ---
  function dibujarHeaderTabla() {
    doc.setFillColor(30, 30, 30);
    doc.rect(14, y, 182, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("PRODUCTO",  colProducto + 2, y + 5);
    doc.text("CANT.",     colPacks,        y + 5);
    doc.text("SUELTAS",   colSueltas,      y + 5);
    doc.text("UNIDAD",    colUnidad,       y + 5);
    doc.setTextColor(0, 0, 0);
    y += 9;
  }

  dibujarHeaderTabla();

  categorias.forEach(categoria => {
    const productosCat = productos.filter(p => p.categoria === categoria);
    if (productosCat.length === 0) return;

    // Salto de página si hace falta
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
      dibujarHeaderTabla();
    }

    // Header de categoría
    doc.setFillColor(220, 220, 220);
    doc.rect(14, y, 182, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(categoria.toUpperCase(), colProducto + 2, y + 4.5);
    y += 7;

    let filaAlterna = false;
    productosCat.forEach(p => {
      if (y > pageHeight - 10) {
        doc.addPage();
        y = 20;
        dibujarHeaderTabla();
      }

      if (filaAlterna) {
        doc.setFillColor(248, 248, 248);
        doc.rect(14, y, 182, 6, "F");
      }
      filaAlterna = !filaAlterna;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(p.nombre, colProducto + 2, y + 4);
      doc.text(totales[p.id] !== null ? String(totales[p.id]) : "—", colPacks, y + 4);

      // Sueltas solo para pack/caja
      if (p.unidad === "pack" || p.unidad === "caja") {
        const sueltas = totalesSueltas[p.id];
        doc.text(sueltas > 0 ? String(sueltas) : "—", colSueltas, y + 4);
      } else {
        doc.text("—", colSueltas, y + 4);
      }

      doc.text(p.unidad, colUnidad, y + 4);

      // Línea inferior de fila
      doc.setLineWidth(0.1);
      doc.setDrawColor(220, 220, 220);
      doc.line(14, y + 6, 196, y + 6);

      y += 6;
    });

    y += 3;
  });

  // --- Footer ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text(`Aplicación desarrollada por Oliva González, Pablo — Stock: ${formatFechaDisplay(fecha)} — Página ${i} de ${totalPages}`, 105, 290, { align: "center" });
  }

  // Nombre del archivo
  const nombreArchivo = `Stock_Plaza_${fecha}.pdf`;

  return { doc, nombreArchivo };
}

async function descargarPDF(fecha) {
  const { doc, nombreArchivo } = await exportarPDF(fecha);
  doc.save(nombreArchivo);
}

async function compartirPDF(fecha) {
  const { doc, nombreArchivo } = await exportarPDF(fecha);
  const blob = doc.output("blob");
  const file = new File([blob], nombreArchivo, { type: "application/pdf" });

  if (navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Stock Plaza de la Música",
      text: `Stock al ${formatFechaDisplay(fecha)}`
    });
  } else {
    // Fallback: descarga directa
    doc.save(nombreArchivo);
  }
}
