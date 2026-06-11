// =============================================
// APP.JS — Lógica principal de la PWA
// Plaza de la Música — Stock Manager
// =============================================

// --- Estado global ---
const STATE = {
  vistaActual: "dashboard",
  depositoSeleccionado: null,
  responsable: localStorage.getItem("plaza_responsable") || "",
  stockCargando: {},
  stockPorDeposito: {},
  stockPrevioCache: {},
  alertasVistas: false,  // Oculta el badge si ya se visitó la pestaña
  historialFechas: { plaza: [], larioja: [] },
  fechaComparacion: { a: null, b: null },
  config: getConfig()
};

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  await initApp();
});

async function initApp() {
  // Fuentes
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);

  // Navegación
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => navegarA(btn.dataset.vista));
  });

  // Indicador offline
  window.addEventListener("online", () => {
    document.getElementById("offline-bar").classList.remove("visible");
    mostrarToast("Conexión restaurada. Sincronizando...", "ok");
  });
  window.addEventListener("offline", () => {
    document.getElementById("offline-bar").classList.add("visible");
    mostrarToast("Sin conexión. Los datos se guardarán localmente.", "offline");
  });
  if (!navigator.onLine) {
    document.getElementById("offline-bar").classList.add("visible");
  }

  // Responsable
  if (!STATE.responsable) {
    mostrarModalResponsable();
  }

  // Render inicial
  await renderDashboard();
  navegarA("dashboard");
}

// --- Navegación ---
function navegarA(vista) {
  STATE.vistaActual = vista;

  document.querySelectorAll(".vista").forEach(v => v.classList.remove("activa"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("activo"));

  document.getElementById(`vista-${vista}`)?.classList.add("activa");
  document.querySelector(`.nav-item[data-vista="${vista}"]`)?.classList.add("activo");

  // Limpiar el contador de alertas al visitar la pestaña
  if (vista === "alertas") {
    STATE.alertasVistas = true;
    const badge = document.getElementById("alerta-badge-count");
    if (badge) badge.style.display = "none";
  }

  // Cargar datos de la vista
  switch (vista) {
    case "dashboard": renderDashboard(); break;
    case "cargar": renderCargar(); break;
    case "alertas": renderAlertas(); break;
    case "historial": renderHistorial(); break;
    case "config": renderConfig(); break;
  }
}

// =============================================
// VISTA: DASHBOARD
// =============================================
async function renderDashboard() {
  const el = document.getElementById("dashboard-content");
  if (!el) return;

  el.innerHTML = `<div class="estado-vacio"><div class="vacio-icono">⏳</div><div class="vacio-texto">Cargando...</div></div>`;

  try {
    const [stockPlaza, stockLarioja] = await Promise.all([
      getStockActual("plaza"),
      getStockActual("larioja")
    ]);

    const productos = getProductosFlat();
    const config = getConfig();
    const umbral = config.umbralAlerta;

    // Calcular alertas globales
    const alertas = [];
    productos.forEach(p => {
      const cantPlaza = stockPlaza[p.id]?.cantidad ?? null;
      const cantLarioja = stockLarioja[p.id]?.cantidad ?? null;
      const totalGlobal = (cantPlaza || 0) + (cantLarioja || 0);

      if ((cantPlaza !== null && cantPlaza < umbral) || (cantLarioja !== null && cantLarioja < umbral)) {
        alertas.push({ producto: p, cantPlaza, cantLarioja, totalGlobal });
      }
    });

    // Actualizar badge
    const badge = document.getElementById("alerta-badge-count");
    if (badge) {
      badge.textContent = alertas.length;
      badge.style.display = (!STATE.alertasVistas && alertas.length > 0) ? "flex" : "none";
    }

    // Banner de alertas
    const bannerHTML = alertas.length > 0 ? `
      <div class="banner-alerta" onclick="navegarA('alertas')" style="cursor:pointer">
        <span class="alerta-icono">⚠️</span>
        <div>
          <div class="alerta-texto">${alertas.length} producto${alertas.length > 1 ? "s" : ""} con stock bajo</div>
          <div style="font-size:0.78rem;color:var(--rojo-alerta);opacity:0.8">Tocá para ver el detalle</div>
        </div>
      </div>
    ` : `
      <div style="background:var(--verde-bg);border:1px solid var(--verde);border-radius:var(--radio);padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <span style="font-size:1.3rem">✅</span>
        <span style="font-size:0.88rem;color:var(--verde);font-weight:600">Todo el stock en orden</span>
      </div>
    `;

    // Resumen por depósito
    const fechasPlaza = await getFechasDisponibles("plaza");
    const fechasLarioja = await getFechasDisponibles("larioja");
    const ultimaPlaza = fechasPlaza[0] ? formatFechaDisplay(fechasPlaza[0]) : "Sin registros";
    const ultimaLarioja = fechasLarioja[0] ? formatFechaDisplay(fechasLarioja[0]) : "Sin registros";

    el.innerHTML = `
      ${bannerHTML}
      <div class="card">
        <div class="card-titulo">Último conteo</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="padding:12px;background:var(--gris-fondo);border-radius:var(--radio-sm);text-align:center">
            <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--gris-medio);margin-bottom:4px">Plaza</div>
            <div style="font-size:0.9rem;font-weight:700;color:var(--negro)">${ultimaPlaza}</div>
          </div>
          <div style="padding:12px;background:var(--gris-fondo);border-radius:var(--radio-sm);text-align:center">
            <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--gris-medio);margin-bottom:4px">La Rioja</div>
            <div style="font-size:0.9rem;font-weight:700;color:var(--negro)">${ultimaLarioja}</div>
          </div>
        </div>
      </div>
      <button class="btn btn-dorado btn-full" style="margin-bottom:10px;font-size:1rem;padding:18px" onclick="navegarA('cargar')">
        📦 Cargar Stock
      </button>
      <button class="btn btn-secundario btn-full" onclick="navegarA('historial')">
        📋 Ver Historial
      </button>
    `;
  } catch (e) {
    el.innerHTML = `<div class="estado-vacio"><div class="vacio-icono">❌</div><div class="vacio-texto">Error al cargar datos.<br>Verificá la conexión.</div></div>`;
  }
}

// =============================================
// VISTA: CARGAR STOCK
// =============================================
function renderCargar() {
  const el = document.getElementById("cargar-content");
  if (!el) return;

  STATE.depositoSeleccionado = null;
  STATE.stockCargando = {};
  STATE.stockPorDeposito = {};
  STATE.stockPrevioCache = {};   // Limpiar caché al entrar a vista de carga

  el.innerHTML = `
    <div class="input-group">
      <label class="input-label">¿Quién está cargando?</label>
      <input type="text" class="input-field" id="input-responsable"
        placeholder="Tu nombre"
        value="${STATE.responsable}"
        oninput="STATE.responsable = this.value; localStorage.setItem('plaza_responsable', this.value)">
    </div>

    <div class="card-titulo" style="margin-bottom:10px">Seleccioná el depósito</div>
    <div class="deposito-selector" id="deposito-selector">
      <button class="deposito-btn" onclick="seleccionarDeposito('plaza')" id="dep-plaza">
        <span class="dep-nombre">Depósito 1</span>
        <span class="dep-titulo">Plaza</span>
      </button>
      <button class="deposito-btn" onclick="seleccionarDeposito('larioja')" id="dep-larioja">
        <span class="dep-nombre">Depósito 2</span>
        <span class="dep-titulo">La Rioja</span>
      </button>
    </div>

    <div id="formulario-stock" style="display:none">
      <div id="lista-productos"></div>
      <div style="position:sticky;bottom:calc(var(--nav-height) + 12px);padding:12px 0;background:var(--gris-fondo)">
        <button class="btn btn-primario btn-full" onclick="confirmarGuardar()" id="btn-guardar">
          Guardar Stock
        </button>
      </div>
    </div>
  `;
}

async function seleccionarDeposito(depositoId) {
  // Guardar los valores actualmente ingresados antes de cambiar depósito
  if (STATE.depositoSeleccionado && STATE.depositoSeleccionado !== depositoId) {
    STATE.stockPorDeposito[STATE.depositoSeleccionado] = { ...STATE.stockCargando };
  }

  STATE.depositoSeleccionado = depositoId;

  // UI del selector
  document.querySelectorAll(".deposito-btn").forEach(b => b.classList.remove("seleccionado"));
  document.getElementById(`dep-${depositoId}`).classList.add("seleccionado");

  // Usar caché si ya se descargó antes; si no, buscar en Firebase
  let stockPrevio;
  if (STATE.stockPrevioCache[depositoId]) {
    stockPrevio = STATE.stockPrevioCache[depositoId];
  } else {
    // Mostrar spinner mientras carga la primera vez
    const lista = document.getElementById("lista-productos");
    if (lista) lista.innerHTML = `<div class="estado-vacio"><div class="vacio-icono">⏳</div><div class="vacio-texto">Cargando...</div></div>`;
    document.getElementById("formulario-stock").style.display = "block";

    stockPrevio = await getStockActual(depositoId);
    STATE.stockPrevioCache[depositoId] = stockPrevio;
  }

  // Recuperar valores sin guardar para este depósito (si los hay)
  const valoresGuardados = STATE.stockPorDeposito[depositoId] || null;

  document.getElementById("formulario-stock").style.display = "block";
  renderListaProductos(stockPrevio, valoresGuardados);
}

// valoresGuardados: datos ingresados pero no guardados (al cambiar depósito y volver)
function renderListaProductos(stockPrevio, valoresGuardados = null) {
  const el = document.getElementById("lista-productos");
  const productos = getProductosFlat();
  const categorias = getCategorias();

  // Si hay valores guardados (por cambio de depósito), usarlos como base del state
  STATE.stockCargando = valoresGuardados ? { ...valoresGuardados } : {};

  let html = "";

  categorias.forEach(cat => {
    const prodsCat = productos.filter(p => p.categoria === cat);
    if (prodsCat.length === 0) return;

    // Agrupar por marca
    const marcas = [...new Set(prodsCat.map(p => p.marca))];

    html += `<div class="categoria-header"><span>📁</span>${cat}</div>`;

    marcas.forEach(marca => {
      const prodsMarca = prodsCat.filter(p => p.marca === marca);
      const mostrarMarca = prodsMarca.length > 1 || prodsMarca[0].variante !== "Común";

      html += `<div class="subcategoria-grupo">`;

      if (mostrarMarca && marcas.length > 1) {
        html += `<div class="marca-header">${marca}</div>`;
      }

      prodsMarca.forEach(p => {
        // Prioridad: 1) valor ingresado sin guardar, 2) stock guardado en Firebase
        const valorPrevio = valoresGuardados?.[p.id] ?? stockPrevio[p.id]?.cantidad ?? "";
        const tieneSueltas = p.unidad === "pack" || p.unidad === "caja";
        const idSueltas = `${p.id}__sueltas`;
        const sueltasPrevio = valoresGuardados?.[idSueltas] ?? stockPrevio[idSueltas]?.cantidad ?? "";
        const packSize = tieneSueltas ? getPackSize(p.marca, p.variante) : null;
        const nombreMostrado = prodsMarca.length === 1 ? p.nombre :
          (p.variante === "Común" ? marca : p.variante);

        html += `
          <div class="producto-row${tieneSueltas ? ' tiene-sueltas' : ''}">
            <div class="producto-info">
              <div class="producto-nombre">${nombreMostrado}</div>
              <div class="producto-unidad">${p.unidad}${packSize ? ` ×${packSize}` : ''}</div>
            </div>
            <div class="producto-inputs">
              <div class="producto-input-grupo">
                ${tieneSueltas ? `<span class="input-sublabel">${p.unidad === 'caja' ? 'Cajas' : 'Packs'}</span>` : ''}
                <input type="number"
                  class="producto-input"
                  id="prod-${p.id}"
                  min="0"
                  placeholder="0"
                  value="${valorPrevio}"
                  inputmode="numeric"
                  oninput="STATE.stockCargando['${p.id}'] = this.value">
              </div>
              ${tieneSueltas ? `
              <div class="producto-input-grupo">
                <span class="input-sublabel">Sueltas</span>
                <input type="number"
                  class="producto-input producto-input-sueltas"
                  id="prod-${idSueltas}"
                  min="0"
                  placeholder="0"
                  value="${sueltasPrevio}"
                  inputmode="numeric"
                  oninput="handleSueltasInput(this, '${p.id}', '${idSueltas}', ${packSize !== null ? packSize : 'null'})">
              </div>` : ''}
            </div>
          </div>
        `;
      });

      html += `</div>`;
    });
  });

  el.innerHTML = html;

  // Pre-cargar valores previos en state (incluye sueltas)
  // Solo si NO hay valoresGuardados (que ya se cargaron al inicio)
  if (!valoresGuardados) {
    Object.keys(stockPrevio).forEach(id => {
      STATE.stockCargando[id] = stockPrevio[id].cantidad;
    });
  }
}


// Muestra el modal de confirmación antes de guardar
function confirmarGuardar() {
  const responsable = STATE.responsable.trim();
  if (!responsable) {
    mostrarToast("Ingresá tu nombre antes de guardar", "error");
    document.getElementById("input-responsable")?.focus();
    return;
  }
  if (!STATE.depositoSeleccionado) {
    mostrarToast("Seleccioná un depósito", "error");
    return;
  }

  const depositosAGuardar = [];
  if (STATE.stockPorDeposito.plaza || STATE.depositoSeleccionado === "plaza") depositosAGuardar.push("Plaza");
  if (STATE.stockPorDeposito.larioja || STATE.depositoSeleccionado === "larioja") depositosAGuardar.push("La Rioja");
  
  const depositoText = depositosAGuardar.join(" y ");
  const fecha = formatFechaDisplay(formatFecha(new Date()));
  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("modal-content");

  modal.innerHTML = `
    <div style="text-align:center;margin-bottom:20px;font-size:2.8rem">📦</div>
    <div class="modal-titulo" style="text-align:center">¿Guardamos el stock?</div>
    <div style="font-size:0.9rem;color:var(--gris-medio);text-align:center;margin-bottom:24px;line-height:1.6">
      <strong style="color:var(--negro)">${depositoText}</strong> · ${fecha}<br>
      Responsable: <strong style="color:var(--negro)">${responsable}</strong>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button class="btn btn-secundario" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-primario" onclick="guardarStockActual()">Sí, guardar</button>
    </div>
  `;
  overlay.classList.add("visible");
}

async function guardarStockActual() {
  cerrarModal();

  const responsable = STATE.responsable.trim();
  const btn = document.getElementById("btn-guardar");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Guardando...`;
  }

  let guardados = 0;
  const promesas = [];
  const fechaGuardado = formatFecha(new Date());

  // Asegurar que el depósito actual esté guardado en memoria
  STATE.stockPorDeposito[STATE.depositoSeleccionado] = { ...STATE.stockCargando };

  // Iterar y guardar TODOS los depósitos que se hayan visitado/modificado
  Object.entries(STATE.stockPorDeposito).forEach(([depId, stockData]) => {
    Object.entries(stockData).forEach(([productoId, cantidad]) => {
      if (cantidad !== "" && cantidad !== null && cantidad !== undefined) {
        promesas.push(
          guardarStock(depId, productoId, cantidad, responsable)
            .then(res => {
              guardados++;
              return res;
            })
        );
      }
    });
  });

  try {
    const resultados = await Promise.all(promesas);
    const hayOffline = resultados.some(r => r?.offline);

    if (btn) {
      btn.style.background = "var(--verde)";
      btn.style.borderColor = "var(--verde)";
      btn.innerHTML = "✅ Guardado";
    }

    // Reiniciar flag para que las alertas vuelvan a aparecer si corresponde
    STATE.alertasVistas = false;

    // Mostrar modal de éxito con opciones PDF
    mostrarModalExito(fechaGuardado, guardados, hayOffline);

    // Actualizar dashboard en background
    renderDashboard();

  } catch (e) {
    mostrarToast("Error al guardar. Intentá de nuevo.", "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "Guardar Stock";
    }
  }
}

function mostrarModalExito(fecha, guardados, hayOffline) {
  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("modal-content");

  const mensajeGuardado = hayOffline
    ? `${guardados} productos guardados localmente. Se sincronizarán al volver la conexión.`
    : `${guardados} productos guardados correctamente.`;

  modal.innerHTML = `
    <div style="text-align:center;margin-bottom:16px;font-size:3rem">${hayOffline ? '📵' : '✅'}</div>
    <div class="modal-titulo" style="text-align:center">¡Stock guardado!</div>
    <div style="font-size:0.88rem;color:var(--gris-medio);text-align:center;margin-bottom:24px;line-height:1.6">
      ${mensajeGuardado}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <button class="btn btn-dorado" onclick="descargarPDF('${fecha}');cerrarModal()">
        📄 Exportar PDF
      </button>
      <button class="btn btn-primario" onclick="compartirPDF('${fecha}')">
        📤 Compartir
      </button>
    </div>
    <button class="btn btn-secundario btn-full" onclick="cerrarModal();navegarA('dashboard')">
      Volver al inicio
    </button>
  `;
  overlay.classList.add("visible");
}

// =============================================
// VISTA: ALERTAS
// =============================================
async function renderAlertas() {
  const el = document.getElementById("alertas-content");
  if (!el) return;

  el.innerHTML = `<div class="estado-vacio"><div class="vacio-icono">⏳</div><div class="vacio-texto">Cargando alertas...</div></div>`;

  const productos = getProductosFlat();
  const config = getConfig();
  const umbral = config.umbralAlerta;

  const [stockPlaza, stockLarioja] = await Promise.all([
    getStockActual("plaza"),
    getStockActual("larioja")
  ]);

  const alertas = [];
  productos.forEach(p => {
    const cantPlaza = stockPlaza[p.id]?.cantidad ?? null;
    const cantLarioja = stockLarioja[p.id]?.cantidad ?? null;

    if (cantPlaza !== null && cantPlaza < umbral) {
      alertas.push({ producto: p, deposito: "Plaza", cantidad: cantPlaza });
    }
    if (cantLarioja !== null && cantLarioja < umbral) {
      alertas.push({ producto: p, deposito: "La Rioja", cantidad: cantLarioja });
    }
  });

  if (alertas.length === 0) {
    el.innerHTML = `
      <div class="estado-vacio">
        <div class="vacio-icono">✅</div>
        <div class="vacio-texto">No hay productos con stock bajo.<br>Umbral actual: ${umbral} unidades.</div>
      </div>
    `;
    return;
  }

  let html = `
    <div class="banner-alerta">
      <span class="alerta-icono">⚠️</span>
      <div>
        <div class="alerta-texto">${alertas.length} alerta${alertas.length > 1 ? "s" : ""} activa${alertas.length > 1 ? "s" : ""}</div>
        <div style="font-size:0.75rem;color:var(--rojo-alerta);opacity:0.8">Umbral: menos de ${umbral} unidades</div>
      </div>
    </div>
  `;

  alertas.forEach(a => {
    html += `
      <div class="alerta-item">
        <div>
          <div class="alerta-producto">${a.producto.nombre}</div>
          <div class="alerta-deposito">${a.deposito} · ${a.producto.unidad}</div>
        </div>
        <div class="alerta-cantidad">${a.cantidad} ${a.producto.unidad}</div>
      </div>
    `;
  });

  el.innerHTML = html;
}

// =============================================
// VISTA: HISTORIAL
// =============================================
async function renderHistorial() {
  const el = document.getElementById("historial-content");
  if (!el) return;

  el.innerHTML = `<div class="estado-vacio"><div class="vacio-icono">⏳</div><div class="vacio-texto">Cargando historial...</div></div>`;

  const [fechasPlaza, fechasLarioja] = await Promise.all([
    getFechasDisponibles("plaza"),
    getFechasDisponibles("larioja")
  ]);

  // Unir fechas únicas
  const todasFechas = [...new Set([...fechasPlaza, ...fechasLarioja])].sort().reverse();

  if (todasFechas.length === 0) {
    el.innerHTML = `<div class="estado-vacio"><div class="vacio-icono">📋</div><div class="vacio-texto">No hay registros todavía.<br>Cargá el primer stock.</div></div>`;
    return;
  }

  STATE.historialFechas = todasFechas;
  STATE.fechaComparacion = { a: null, b: null };

  let html = `
    <div class="card-titulo" style="margin-bottom:10px">Seleccioná hasta 2 fechas para comparar</div>
    <div id="lista-fechas">
  `;

  todasFechas.forEach(f => {
    html += `
      <div class="fecha-item" onclick="toggleFechaComparacion('${f}')" id="fecha-${f}">
        <div>
          <div class="fecha-display">${formatFechaDisplay(f)}</div>
        </div>
        <div style="font-size:1.2rem;color:var(--gris-borde)">›</div>
      </div>
    `;
  });

  html += `</div>
    <div id="comparacion-panel" style="margin-top:16px;display:none"></div>
  `;

  el.innerHTML = html;
}

async function toggleFechaComparacion(fecha) {
  if (STATE.fechaComparacion.a === fecha) {
    STATE.fechaComparacion.a = STATE.fechaComparacion.b;
    STATE.fechaComparacion.b = null;
  } else if (STATE.fechaComparacion.b === fecha) {
    STATE.fechaComparacion.b = null;
  } else if (!STATE.fechaComparacion.a) {
    STATE.fechaComparacion.a = fecha;
  } else if (!STATE.fechaComparacion.b) {
    STATE.fechaComparacion.b = fecha;
  } else {
    STATE.fechaComparacion.a = fecha;
    STATE.fechaComparacion.b = null;
  }

  // Actualizar UI de fechas
  document.querySelectorAll(".fecha-item").forEach(el => el.classList.remove("seleccionada"));
  if (STATE.fechaComparacion.a) document.getElementById(`fecha-${STATE.fechaComparacion.a}`)?.classList.add("seleccionada");
  if (STATE.fechaComparacion.b) document.getElementById(`fecha-${STATE.fechaComparacion.b}`)?.classList.add("seleccionada");

  await renderComparacion();
}

async function renderComparacion() {
  const panel = document.getElementById("comparacion-panel");
  if (!panel) return;

  const { a, b } = STATE.fechaComparacion;
  if (!a) { panel.style.display = "none"; return; }

  panel.style.display = "block";
  panel.innerHTML = `<div class="estado-vacio"><div class="vacio-icono">⏳</div></div>`;

  const fechas = b ? [a, b] : [a];
  const stocks = await Promise.all(fechas.map(async f => ({
    fecha: f,
    plaza: await getStockPorFecha("plaza", f),
    larioja: await getStockPorFecha("larioja", f)
  })));

  const productos = getProductosFlat();
  const categorias = getCategorias();
  const config = getConfig();
  const umbral = config.umbralAlerta;

  let html = `
    <div class="card">
      <div style="display:grid;grid-template-columns:${b ? "1fr 1fr 1fr" : "1fr 1fr"};gap:8px;margin-bottom:16px">
        <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris-medio)">Producto</div>
        ${fechas.map(f => `<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris-medio);text-align:right">${formatFechaDisplay(f)}</div>`).join("")}
      </div>
  `;

  categorias.forEach(cat => {
    const prodsCat = productos.filter(p => p.categoria === cat);
    if (prodsCat.length === 0) return;

    // Solo mostrar si hay datos en alguna fecha
    const tieneData = prodsCat.some(p =>
      fechas.some(f => {
        const stock = stocks.find(s => s.fecha === f);
        return (stock?.plaza[p.id]?.cantidad ?? null) !== null ||
               (stock?.larioja[p.id]?.cantidad ?? null) !== null;
      })
    );
    if (!tieneData) return;

    html += `<div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gris-medio);padding:10px 0 4px;border-bottom:1px solid var(--gris-borde);margin-bottom:4px">${cat}</div>`;

    prodsCat.forEach(p => {
      const cantidades = fechas.map(f => {
        const stock = stocks.find(s => s.fecha === f);
        const cp = stock?.plaza[p.id]?.cantidad ?? 0;
        const cl = stock?.larioja[p.id]?.cantidad ?? 0;
        return cp + cl;
      });

      const tieneValor = cantidades.some(c => c > 0);
      if (!tieneValor) return;

      html += `
        <div style="display:grid;grid-template-columns:${b ? "1fr 1fr 1fr" : "1fr 1fr"};gap:8px;padding:8px 0;border-bottom:1px solid var(--gris-fondo);align-items:center">
          <div style="font-size:0.85rem;color:var(--negro)">${p.nombre}</div>
          ${cantidades.map(c => `
            <div style="text-align:right;font-size:1rem;font-weight:700;color:${c < umbral ? "var(--rojo-alerta)" : "var(--negro)"}">${c}</div>
          `).join("")}
        </div>
      `;
    });
  });

  html += `</div>`;

  // Botones de exportación
  html += `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
      <button class="btn btn-secundario btn-sm" onclick="descargarPDF('${a}')">
        ⬇️ Descargar PDF
      </button>
      <button class="btn btn-dorado btn-sm" onclick="compartirPDF('${a}')">
        📤 Compartir
      </button>
    </div>
  `;

  panel.innerHTML = html;
}

// =============================================
// VISTA: CONFIGURACIÓN
// =============================================
async function renderConfig() {
  const el = document.getElementById("config-content");
  if (!el) return;

  const config = getConfig();
  const productos = getProductosFlat();

  el.innerHTML = `
    <div class="card">
      <div class="card-titulo">General</div>

      <div class="config-row">
        <div>
          <div class="config-label">Tu nombre</div>
          <div class="config-desc">Se registra en cada carga de stock</div>
        </div>
        <input type="text" class="config-input-sm" style="width:120px;text-align:left"
          id="config-responsable"
          value="${STATE.responsable}"
          placeholder="Nombre"
          oninput="STATE.responsable = this.value; localStorage.setItem('plaza_responsable', this.value)">
      </div>

      <div class="config-row">
        <div>
          <div class="config-label">Umbral de alerta</div>
          <div class="config-desc">Alerta cuando el stock es menor a este número</div>
        </div>
        <input type="number" class="config-input-sm"
          id="config-umbral"
          min="1" max="999"
          value="${config.umbralAlerta}"
          onchange="actualizarUmbral(this.value)">
      </div>
    </div>

    <div class="card">
      <div class="card-titulo">Productos</div>
      <div class="config-desc" style="margin-bottom:12px">Agregá nuevos productos o variantes a las categorías existentes</div>
      <button class="btn btn-secundario btn-full btn-sm" onclick="mostrarModalAgregarProducto()">
        ➕ Agregar producto
      </button>
      <div id="productos-extra" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <div class="card-titulo">Datos</div>
      <div class="config-row">
        <div>
          <div class="config-label">Sincronización offline</div>
          <div class="config-desc" id="sync-status">Verificando...</div>
        </div>
        <button class="btn btn-secundario btn-sm" onclick="forzarSync()">Sincronizar</button>
      </div>
      <div class="config-row" style="border-top:1px solid var(--gris-borde);border-bottom:none">
        <div>
          <div class="config-label" style="color:var(--rojo-alerta)">Reset de fábrica</div>
          <div class="config-desc">Borrar todo el historial y stock</div>
        </div>
        <button class="btn btn-sm" style="background:var(--rojo-alerta-bg);color:var(--rojo-alerta);border:1.5px solid var(--rojo-alerta);font-weight:700" onclick="solicitarResetFabrica()">Resetear</button>
      </div>
    </div>
  `;

  // Estado de cola offline
  const queue = getOfflineQueue();
  document.getElementById("sync-status").textContent =
    queue.length > 0 ? `${queue.length} registro${queue.length > 1 ? "s" : ""} pendiente${queue.length > 1 ? "s" : ""} de sincronizar` : "Todo sincronizado";

  // Mostrar productos agregados manualmente
  renderProductosExtra();
}

function actualizarUmbral(valor) {
  const n = parseInt(valor);
  if (isNaN(n) || n < 1) return;
  const config = getConfig();
  config.umbralAlerta = n;
  setConfig(config);
  STATE.config = config;
  mostrarToast(`Umbral actualizado a ${n} unidades`, "ok");
}

async function forzarSync() {
  if (!navigator.onLine) {
    mostrarToast("Sin conexión. No se puede sincronizar ahora.", "error");
    return;
  }
  await syncOfflineQueue();
  mostrarToast("Sincronización completada", "ok");
  renderConfig();
}

// =============================================
// PRODUCTOS EXTRA (agregados manualmente)
// =============================================
const EXTRA_PRODUCTOS_KEY = "plaza_productos_extra";

function getProductosExtra() {
  const saved = localStorage.getItem(EXTRA_PRODUCTOS_KEY);
  return saved ? JSON.parse(saved) : [];
}

function renderProductosExtra() {
  const el = document.getElementById("productos-extra");
  if (!el) return;
  const extra = getProductosExtra();
  if (extra.length === 0) { el.innerHTML = ""; return; }

  el.innerHTML = extra.map((p, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gris-fondo)">
      <div>
        <div style="font-size:0.88rem;font-weight:600">${p.nombre}</div>
        <div style="font-size:0.72rem;color:var(--gris-medio)">${p.categoria} · ${p.unidad}</div>
      </div>
      <button onclick="eliminarProductoExtra(${i})" style="background:none;border:none;cursor:pointer;color:var(--rojo-alerta);font-size:1.1rem">✕</button>
    </div>
  `).join("");
}

function eliminarProductoExtra(index) {
  const extra = getProductosExtra();
  extra.splice(index, 1);
  localStorage.setItem(EXTRA_PRODUCTOS_KEY, JSON.stringify(extra));
  renderProductosExtra();
  mostrarToast("Producto eliminado", "ok");
}

// =============================================
// MODAL: AGREGAR PRODUCTO
// =============================================
function mostrarModalAgregarProducto() {
  const categorias = getCategorias();
  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("modal-content");

  modal.innerHTML = `
    <div class="modal-titulo">Agregar producto</div>
    <div class="input-group">
      <label class="input-label">Categoría</label>
      <select class="input-field" id="nuevo-cat">
        ${categorias.map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
    </div>
    <div class="input-group">
      <label class="input-label">Nombre del producto</label>
      <input type="text" class="input-field" id="nuevo-nombre" placeholder="Ej: Vodka Wego Frambuesa">
    </div>
    <div class="input-group">
      <label class="input-label">Unidad</label>
      <select class="input-field" id="nuevo-unidad">
        <option value="bot">Botella (bot)</option>
        <option value="pack">Pack</option>
        <option value="caja">Caja</option>
        <option value="ud">Unidad (ud)</option>
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
      <button class="btn btn-secundario" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-primario" onclick="confirmarAgregarProducto()">Agregar</button>
    </div>
  `;

  overlay.classList.add("visible");
}

function confirmarAgregarProducto() {
  const cat = document.getElementById("nuevo-cat").value;
  const nombre = document.getElementById("nuevo-nombre").value.trim();
  const unidad = document.getElementById("nuevo-unidad").value;

  if (!nombre) {
    mostrarToast("Ingresá un nombre", "error");
    return;
  }

  const extra = getProductosExtra();
  const id = `extra__${nombre.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}__${Date.now()}`;
  extra.push({ id, nombre, categoria: cat, marca: nombre, variante: "Común", unidad });
  localStorage.setItem(EXTRA_PRODUCTOS_KEY, JSON.stringify(extra));

  cerrarModal();
  mostrarToast(`"${nombre}" agregado`, "ok");
  renderProductosExtra();
}

// =============================================
// MODAL: RESPONSABLE
// =============================================
function mostrarModalResponsable() {
  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("modal-content");

  modal.innerHTML = `
    <div class="modal-titulo">¡Bienvenido!</div>
    <div style="font-size:0.88rem;color:var(--gris-medio);margin-bottom:16px">
      Ingresá tu nombre. Se va a registrar cada vez que cargues stock.
    </div>
    <div class="input-group">
      <label class="input-label">Tu nombre</label>
      <input type="text" class="input-field" id="modal-responsable-input" placeholder="Ej: María">
    </div>
    <button class="btn btn-primario btn-full" onclick="confirmarResponsable()">Continuar</button>
  `;

  overlay.classList.add("visible");
  setTimeout(() => document.getElementById("modal-responsable-input")?.focus(), 300);
}

function confirmarResponsable() {
  const nombre = document.getElementById("modal-responsable-input")?.value.trim();
  if (!nombre) {
    mostrarToast("Ingresá tu nombre para continuar", "error");
    return;
  }
  STATE.responsable = nombre;
  localStorage.setItem("plaza_responsable", nombre);
  cerrarModal();
  mostrarToast(`Bienvenido, ${nombre}`, "ok");
}

function cerrarModal() {
  document.getElementById("modal-overlay").classList.remove("visible");
}

// =============================================
// TOAST
// =============================================
let toastTimeout;
function mostrarToast(mensaje, tipo = "") {
  const toast = document.getElementById("toast");
  toast.textContent = mensaje;
  toast.className = `toast ${tipo ? `toast-${tipo}` : ""} visible`;

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3000);
}

// Sobreescribir getProductosFlat para incluir extras
const _getProductosFlat = getProductosFlat;
window.getProductosFlat = function() {
  return [..._getProductosFlat(), ...getProductosExtra()];
};

// =============================================
// LÓGICA DE LA CALCULADORA
// =============================================
let calcExpression = "";
let calcResetOnNext = false;

function updateCalcScreen(val) {
  const screen = document.getElementById("calc-screen");
  if (screen) {
    screen.textContent = val || "0";
  }
}

function pressCalcNum(num) {
  if (calcResetOnNext) {
    calcExpression = "";
    calcResetOnNext = false;
  }
  if (num === ".") {
    const parts = calcExpression.split(/[\+\-\*\/]/);
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes(".")) return;
  }
  calcExpression += num;
  updateCalcScreen(calcExpression);
}

function pressCalcOp(op) {
  calcResetOnNext = false;
  if (calcExpression === "" && op !== "-") return;
  const lastChar = calcExpression.slice(-1);
  if (["+", "-", "*", "/"].includes(lastChar)) {
    calcExpression = calcExpression.slice(0, -1) + op;
  } else {
    calcExpression += op;
  }
  updateCalcScreen(calcExpression);
}

function pressCalcClear() {
  calcExpression = "";
  calcResetOnNext = false;
  updateCalcScreen("0");
}

function pressCalcEquals() {
  if (!calcExpression) return;
  try {
    const result = Function(`"use strict"; return (${calcExpression})`)();
    const formattedResult = Number(result.toFixed(4)).toString();
    updateCalcScreen(formattedResult);
    calcExpression = formattedResult;
    calcResetOnNext = true;
  } catch (e) {
    updateCalcScreen("Error");
    calcExpression = "";
    calcResetOnNext = false;
  }
}

function toggleCalcPanel() {
  const overlay = document.getElementById("calc-overlay");
  const btn = document.getElementById("header-calc-btn");
  if (!overlay) return;
  const isOpen = overlay.classList.toggle("visible");
  if (btn) btn.classList.toggle("activo", isOpen);
}

// =============================================
// CONVERSIÓN AUTOMÁTICA: SUELTAS → PACKS
// =============================================
function handleSueltasInput(input, productoId, sueltasId, packSize) {
  // Siempre actualizar state con el valor actual
  STATE.stockCargando[sueltasId] = input.value;

  // Solo convertir si hay un tamaño definido
  if (!packSize || packSize <= 0) return;

  const sueltas = parseInt(input.value) || 0;
  if (sueltas < packSize) return; // No llega al mínimo, nada que hacer

  const packsNuevos = Math.floor(sueltas / packSize);
  const resto = sueltas % packSize;

  const packsInput = document.getElementById(`prod-${productoId}`);
  if (!packsInput) return;

  const packsActuales = parseInt(packsInput.value) || 0;
  const totalPacks = packsActuales + packsNuevos;

  // Actualizar inputs
  packsInput.value = totalPacks;
  input.value = resto;

  // Actualizar state
  STATE.stockCargando[productoId] = totalPacks;
  STATE.stockCargando[sueltasId] = resto;

  // Animación visual en el input de packs
  packsInput.classList.add("input-convertido");
  setTimeout(() => packsInput.classList.remove("input-convertido"), 800);

  mostrarToast(
    `➕ ${packsNuevos} pack${packsNuevos > 1 ? 's' : ''} sumado${packsNuevos > 1 ? 's' : ''} — quedan ${resto} sueltas`,
    "ok"
  );
}

// =============================================
// RESET DE FÁBRICA
// =============================================
function solicitarResetFabrica() {
  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("modal-content");

  modal.innerHTML = `
    <div style="text-align:center;margin-bottom:16px;font-size:3rem">⚠️</div>
    <div class="modal-titulo" style="text-align:center;color:var(--rojo-alerta)">Borrar Historial y Stock</div>
    <div style="font-size:0.88rem;color:var(--gris-medio);text-align:center;margin-bottom:20px;line-height:1.6">
      Esta acción vaciará por completo el stock y el historial de fechas de la base de datos.<br>
      <strong style="color:var(--negro)">Tus productos y configuraciones se mantendrán intactos.</strong>
    </div>
    <div style="margin-bottom:20px; text-align:left">
      <label style="font-size:0.85rem;font-weight:700;color:var(--negro);display:block;margin-bottom:8px">Ingresá la contraseña para confirmar:</label>
      <div style="position:relative">
        <input type="password" id="input-reset-password" style="width:100%;text-align:left;font-size:16px;font-family:var(--font-body);padding:0 40px 0 14px;height:48px;border:1.5px solid var(--borde-input);border-radius:var(--radio-sm)" placeholder="Contraseña">
        <button type="button" onclick="togglePasswordVisibility()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--gris-medio);padding:4px">👁️</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button class="btn btn-secundario" onclick="cerrarModal()">Cancelar</button>
      <button class="btn" style="background:var(--rojo-alerta);color:var(--blanco);border:none" onclick="ejecutarResetFabrica()">Borrar Historial</button>
    </div>
  `;
  overlay.classList.add("visible");
}

function togglePasswordVisibility() {
  const input = document.getElementById("input-reset-password");
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }
}

async function ejecutarResetFabrica() {
  const pass = document.getElementById("input-reset-password").value;
  if (pass !== "Ochoa28@76Mundial") {
    mostrarToast("Contraseña incorrecta", "error");
    return;
  }

  try {
    const btnReset = document.querySelector("#modal-content .btn[onclick='ejecutarResetFabrica()']");
    if (btnReset) btnReset.innerHTML = `<span class="spinner"></span> Borrando...`;
    
    await resetAppFabrica(); // Borra solo la carpeta de stock en Firebase
    clearOfflineQueue();     // Limpia solo la cola offline local
    
    // Limpiar memoria
    STATE.stockCargando = {};
    STATE.stockPorDeposito = {};
    STATE.stockPrevioCache = {};
    STATE.historialFechas = { plaza: [], larioja: [] };
    
    mostrarToast("Historial borrado exitosamente", "ok");
    setTimeout(() => location.reload(), 1500);
  } catch (e) {
    console.error("Error al resetear:", e);
    mostrarToast("Error al borrar la base de datos", "error");
    cerrarModal();
  }
}
