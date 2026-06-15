// =============================================
// APP.JS — Lógica principal de la PWA
// Plaza de la Música — Stock Manager
// =============================================

// --- Estado global ---
const STATE = {
  vistaActual: "dashboard",
  depositoSeleccionado: null,
  responsable: "",
  userRole: null,
  currentUser: null,
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
  try {
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

    if (typeof auth === 'undefined') {
      alert("Error: Firebase Auth no está definido. Revisa tu conexión a internet o los scripts en index.html.");
      return;
    }

    // Auth Listener
    auth.onAuthStateChanged(async (user) => {
      try {
        const authContainer = document.getElementById("auth-container");
        const appContainer = document.getElementById("app-container");

        if (user) {
          STATE.currentUser = user;
          
          // Verificar si está en /usuarios
          const snapshot = await db.ref(`usuarios/${user.uid}`).once("value");
          if (snapshot.exists()) {
            const userData = snapshot.val();
            STATE.userRole = userData.role;
            STATE.responsable = userData.nombre || user.displayName || user.email;
            
            authContainer.style.display = "none";
            appContainer.style.display = "block";
            
            ajustarInterfazPorRol();
            await renderDashboard();
            navegarA("dashboard");
          } else {
            // Verificar si está en pendientes
            const pendingSnap = await db.ref(`usuarios_pendientes/${user.uid}`).once("value");
            if (pendingSnap.exists()) {
              const pendingData = pendingSnap.val();
              // AUTO PROMOVER AL DUEÑO SIN IMPORTAR NADA
              if (user.email === "prof.pabloliva@gmail.com" || user.email === "profe.olivapablo@gmail.com") {
                await db.ref(`usuarios/${user.uid}`).set({
                  email: user.email,
                  nombre: user.displayName || pendingData.nombre || "",
                  role: "admin"
                });
                await db.ref(`usuarios_pendientes/${user.uid}`).remove();
                
                STATE.userRole = "admin";
                STATE.responsable = user.displayName || pendingData.nombre || user.email;
                authContainer.style.display = "none";
                appContainer.style.display = "block";
                ajustarInterfazPorRol();
                await renderDashboard();
                navegarA("dashboard");
                return;
              }
              
              mostrarAuthVista("auth-pending");
              authContainer.style.display = "flex";
              appContainer.style.display = "none";
            } else {
              // Si no está en ninguna, fue un registro con Google directo, lo agregamos a pendientes
              await db.ref(`usuarios_pendientes/${user.uid}`).set({
                nombre: user.displayName || "",
                email: user.email,
                fechaSolicitud: new Date().toISOString(),
                metodo: "google"
              });
              mostrarAuthVista("auth-pending");
              authContainer.style.display = "flex";
              appContainer.style.display = "none";
            }
          }
        } else {
          STATE.currentUser = null;
          STATE.userRole = null;
          STATE.responsable = "";
          authContainer.style.display = "flex";
          appContainer.style.display = "none";
          mostrarAuthVista("auth-login");
        }
      } catch (err) {
        alert("Error en Auth Listener: " + err.message);
        console.error(err);
      }
    });
  } catch (err) {
    alert("Error crítico al iniciar la app: " + err.message);
    console.error(err);
  }
}

// --- Auth Functions ---
function mostrarAuthVista(vistaId) {
  document.querySelectorAll(".auth-vista").forEach(v => v.style.display = "none");
  document.getElementById(vistaId).style.display = "block";
}

async function iniciarSesionEmail() {
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-password").value;
  if (!email || !pass) return mostrarToast("Ingresá email y contraseña", "error");
  
  const btn = document.getElementById("btn-login");
  const oldText = btn.innerHTML;
  btn.innerHTML = "Cargando...";
  btn.disabled = true;

  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (error) {
    mostrarToast("Error: " + error.message, "error");
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
}

async function iniciarSesionGoogle() {
  try {
    await auth.signInWithPopup(googleProvider);
  } catch (error) {
    alert("Error de Google: " + error.message);
    mostrarToast("Error al iniciar con Google: " + error.message, "error");
  }
}

async function registrarEmail() {
  const name = document.getElementById("register-name").value;
  const email = document.getElementById("register-email").value;
  const pass = document.getElementById("register-password").value;
  const passConfirm = document.getElementById("register-password-confirm").value;

  if (!name || !email || !pass) return mostrarToast("Completá todos los campos", "error");
  if (pass !== passConfirm) return mostrarToast("Las contraseñas no coinciden", "error");

  const btn = document.getElementById("btn-register");
  const oldText = btn.innerHTML;
  btn.innerHTML = "Cargando...";
  btn.disabled = true;

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    
    // Agregar a pendientes
    await db.ref(`usuarios_pendientes/${cred.user.uid}`).set({
      nombre: name,
      email: email,
      fechaSolicitud: new Date().toISOString(),
      metodo: "email"
    });
  } catch (error) {
    alert("Error de registro: " + error.message);
    mostrarToast("Error: " + error.message, "error");
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
}

async function recuperarPassword() {
  const email = document.getElementById("forgot-email").value;
  if (!email) return mostrarToast("Ingresá tu email", "error");
  try {
    await auth.sendPasswordResetEmail(email);
    mostrarToast("Enlace enviado a tu email", "ok");
    mostrarAuthVista("auth-login");
  } catch (error) {
    mostrarToast("Error: " + error.message, "error");
  }
}

async function cerrarSesion() {
  await auth.signOut();
}

function ajustarInterfazPorRol() {
  const navCargar = document.querySelector(`.nav-item[data-vista="cargar"]`);
  const navHistorial = document.querySelector(`.nav-item[data-vista="historial"]`);
  const navConfig = document.querySelector(`.nav-item[data-vista="config"]`);
  const navEntradas = document.querySelector(`.nav-item[data-vista="entradas"]`);

  if (STATE.userRole === "visualizador") {
    if(navCargar) {
      navCargar.style.display = "flex";
      navCargar.innerHTML = `<span class="nav-icon">📊</span>Ver Stock`;
    }
    if(navHistorial) navHistorial.style.display = "none";
    if(navConfig) navConfig.style.display = "none";
    if(navEntradas) navEntradas.style.display = "none";
  } else {
    if(navCargar) {
      navCargar.style.display = "flex";
      navCargar.innerHTML = `<span class="nav-icon">📦</span>Cargar`;
    }
    if (STATE.userRole === "editor") {
      if(navHistorial) navHistorial.style.display = "flex";
      if(navConfig) navConfig.style.display = "none";
      if(navEntradas) navEntradas.style.display = "flex";
    } else {
      // Admin
      if(navHistorial) navHistorial.style.display = "flex";
      if(navConfig) navConfig.style.display = "flex";
      if(navEntradas) navEntradas.style.display = "flex";
    }
  }
}

// --- Navegación ---
function navegarA(vista) {
  // Bloquear acceso a visualizadores
  if (STATE.userRole === "visualizador" && ["historial", "config", "entradas"].includes(vista)) {
    return mostrarToast("No tienes permisos para ver esta sección", "error");
  }
  // Bloquear acceso a editores a config
  if (STATE.userRole === "editor" && vista === "config") {
    return mostrarToast("No tienes permisos para ver esta sección", "error");
  }

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
    case "entradas": renderEntradas(); break;
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
      ${STATE.userRole === "visualizador" ? `
      <button class="btn btn-dorado btn-full" style="margin-bottom:10px;font-size:1rem;padding:18px" onclick="navegarA('cargar')">
        📊 Ver Stock Actual
      </button>` : `
      <button class="btn btn-dorado btn-full" style="margin-bottom:10px;font-size:1rem;padding:18px" onclick="navegarA('cargar')">
        📦 Cargar Stock
      </button>
      <button class="btn btn-secundario btn-full" onclick="navegarA('historial')">
        📋 Ver Historial
      </button>`}
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

  // Ajustar títulos para visualizador
  const mainCargar = document.getElementById("vista-cargar");
  if (mainCargar) {
    const titulo = mainCargar.querySelector(".vista-titulo");
    const subtitulo = mainCargar.querySelector(".vista-subtitulo");
    if (STATE.userRole === "visualizador") {
      if (titulo) titulo.textContent = "Ver Stock";
      if (subtitulo) subtitulo.textContent = "Consulta el stock en vivo";
    } else {
      if (titulo) titulo.textContent = "Cargar Stock";
      if (subtitulo) subtitulo.textContent = "Registrá el conteo actual";
    }
  }

  STATE.depositoSeleccionado = null;
  STATE.stockCargando = {};
  STATE.stockPorDeposito = {};
  STATE.stockPrevioCache = {};   // Limpiar caché al entrar a vista de carga

  el.innerHTML = `
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
      <div class="input-group" style="margin-bottom:16px;">
        <input type="text" class="input-field" id="input-buscador" placeholder="Buscar bebida o categoría..." oninput="filtrarProductos(this.value)">
      </div>
      <div id="lista-productos"></div>
      ${STATE.userRole !== "visualizador" ? `
      <div style="position:sticky;bottom:calc(var(--nav-height) + 12px);padding:12px 0;background:var(--gris-fondo)">
        <button class="btn btn-primario btn-full" onclick="confirmarGuardar()" id="btn-guardar">
          Guardar Stock
        </button>
      </div>` : ''}
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

    html += `<div class="categoria-section" data-cat="${cat.toLowerCase()}">`;
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
        const searchKeywords = `${cat} ${marca} ${p.nombre} ${p.variante}`.toLowerCase();

        html += `
          <div class="producto-row${tieneSueltas ? ' tiene-sueltas' : ''}" data-search="${searchKeywords}">
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
                  ${STATE.userRole === "visualizador" ? 'disabled' : ''}
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
                  ${STATE.userRole === "visualizador" ? 'disabled' : ''}
                  oninput="handleSueltasInput(this, '${p.id}', '${idSueltas}', ${packSize !== null ? packSize : 'null'})">
              </div>` : ''}
            </div>
          </div>
        `;
      });

      html += `</div>`;
    });
    html += `</div>`;
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

window.filtrarProductos = function(texto) {
  const query = texto.toLowerCase().trim();
  const secciones = document.querySelectorAll("#lista-productos .categoria-section");
  
  secciones.forEach(sec => {
    let tieneVisibles = false;
    const catName = sec.getAttribute("data-cat");
    const filas = sec.querySelectorAll(".producto-row");
    
    filas.forEach(fila => {
      const searchStr = fila.getAttribute("data-search");
      if (query === "" || searchStr.includes(query) || catName.includes(query)) {
        fila.style.display = "";
        tieneVisibles = true;
      } else {
        fila.style.display = "none";
      }
    });

    const grupos = sec.querySelectorAll(".subcategoria-grupo");
    grupos.forEach(grupo => {
      const algunVisible = Array.from(grupo.querySelectorAll(".producto-row")).some(f => f.style.display !== "none");
      grupo.style.display = algunVisible ? "" : "none";
    });

    sec.style.display = tieneVisibles ? "" : "none";
  });
};

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
      <button class="btn btn-dorado btn-sm" style="padding: 0 8px; font-size: 15px;" onclick="descargarPDF('${fecha}');cerrarModal()">
        📄 Exportar
      </button>
      <button class="btn btn-primario btn-sm" style="padding: 0 8px; font-size: 15px;" onclick="compartirPDF('${fecha}')">
        📤 Compartir
      </button>
    </div>
    <button class="btn btn-secundario btn-full" onclick="cerrarModal();navegarA('dashboard')">
      Volver al inicio
    </button>
  `;
  overlay.classList.add("visible");

  if (typeof confetti === "function" && !hayOffline) {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00A8D5', '#1E7D45', '#D500C7']
    });
  }
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
          <div class="config-label">Cuenta activa</div>
          <div class="config-desc">${STATE.currentUser ? STATE.currentUser.email : ''} (${STATE.userRole})</div>
        </div>
        <button class="btn btn-secundario btn-sm" onclick="cerrarSesion()">Cerrar sesión</button>
      </div>

      <div class="config-row">
        <div>
          <div class="config-label">Tu nombre</div>
          <div class="config-desc">${STATE.responsable || "No definido"}</div>
        </div>
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

  renderProductosExtra();

  // Si es admin, cargar sección de usuarios pendientes
  if (STATE.userRole === "admin") {
    const adminSection = document.createElement("div");
    adminSection.className = "card";
    adminSection.innerHTML = `
      <div class="card-titulo">Usuarios Pendientes</div>
      <div class="config-desc" style="margin-bottom:12px">Aprobar o rechazar nuevos registros</div>
      <div id="lista-usuarios-pendientes"><div class="estado-vacio"><div class="vacio-texto">Cargando...</div></div></div>
    `;
    el.appendChild(adminSection);
    cargarUsuariosPendientes();
  }
}

// =============================================
// VISTA: ENTRADA DE MERCADERÍA
// =============================================
function renderEntradas() {
  const el = document.getElementById("entradas-content");
  if (!el) return;

  STATE.entradaDepositoSeleccionado = null;
  STATE.entradaProductoSeleccionado = null;

  el.innerHTML = `
    <div class="card-titulo" style="margin-bottom:10px">Seleccioná el depósito</div>
    <div class="deposito-selector" id="deposito-selector-entrada">
      <button class="deposito-btn" onclick="seleccionarDepositoEntrada('plaza')" id="dep-entrada-plaza">
        <span class="dep-nombre">Depósito 1</span>
        <span class="dep-titulo">Plaza</span>
      </button>
      <button class="deposito-btn" onclick="seleccionarDepositoEntrada('larioja')" id="dep-entrada-larioja">
        <span class="dep-nombre">Depósito 2</span>
        <span class="dep-titulo">La Rioja</span>
      </button>
    </div>

    <div id="formulario-entrada" style="display:none">
      <div class="card" style="margin-bottom:12px">
        <div class="card-titulo" style="margin-bottom:12px">Registrar Ingreso</div>

        <div class="input-group" style="margin-bottom:12px">
          <label class="input-label">Buscar producto</label>
          <input type="text" class="input-field" id="entrada-buscador"
            placeholder="Buscar bebida o categoría..."
            oninput="filtrarSelectorEntrada(this.value)">
        </div>

        <div id="entrada-selector-productos" style="max-height:220px;overflow-y:auto;border:1px solid var(--gris-borde);border-radius:var(--radio-sm);margin-bottom:12px">
        </div>

        <div id="entrada-producto-seleccionado" style="display:none;padding:10px 12px;background:var(--gris-fondo);border-radius:var(--radio-sm);margin-bottom:12px;display:none;align-items:center;justify-content:space-between">
          <div>
            <div style="font-weight:700;font-size:0.95rem" id="entrada-prod-nombre"></div>
            <div style="font-size:0.78rem;color:var(--gris-medio)" id="entrada-prod-unidad"></div>
          </div>
          <button onclick="limpiarSeleccionEntrada()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--gris-medio)">✕</button>
        </div>

        <div class="input-group" style="margin-bottom:12px">
          <label class="input-label">Cantidad que ingresa</label>
          <input type="number" class="input-field" id="entrada-cantidad"
            min="1" placeholder="0" inputmode="numeric"
            style="font-size:1.6rem;font-weight:700;text-align:center;height:60px">
        </div>

        <div class="input-group" style="margin-bottom:16px">
          <label class="input-label">Fecha de vencimiento <span style="color:var(--gris-medio);font-weight:400">(opcional)</span></label>
          <input type="date" class="input-field" id="entrada-vencimiento">
        </div>

        <div style="padding:10px 12px;background:var(--gris-fondo);border-radius:var(--radio-sm);margin-bottom:16px;font-size:0.85rem;color:var(--gris-medio)">
          📅 Fecha: <strong style="color:var(--negro)" id="entrada-fecha-hoy"></strong> &nbsp;&nbsp; 👤 Responsable: <strong style="color:var(--negro)">${STATE.responsable}</strong>
        </div>

        <button class="btn btn-primario btn-full" id="btn-registrar-entrada" onclick="registrarEntrada()">
          📥 Registrar Entrada
        </button>
      </div>

      <div class="card">
        <div class="card-titulo" style="margin-bottom:12px">Historial de Entradas</div>
        <div id="historial-entradas-content">
          <div class="estado-vacio"><div class="vacio-icono">⏳</div><div class="vacio-texto">Cargando...</div></div>
        </div>
      </div>
    </div>
  `;

  // Mostrar fecha de hoy
  const hoy = document.getElementById("entrada-fecha-hoy");
  if (hoy) hoy.textContent = formatFechaDisplay(formatFecha(new Date()));
}

async function seleccionarDepositoEntrada(depositoId) {
  STATE.entradaDepositoSeleccionado = depositoId;
  STATE.entradaProductoSeleccionado = null;

  document.querySelectorAll("#deposito-selector-entrada .deposito-btn").forEach(b => b.classList.remove("seleccionado"));
  document.getElementById(`dep-entrada-${depositoId}`).classList.add("seleccionado");
  document.getElementById("formulario-entrada").style.display = "block";

  // Renderizar selector de productos
  renderSelectorProductosEntrada("");

  // Cargar historial de entradas
  await renderHistorialEntradas(depositoId);
}

function renderSelectorProductosEntrada(filtro) {
  const el = document.getElementById("entrada-selector-productos");
  if (!el) return;

  const query = filtro.toLowerCase().trim();
  const productos = getProductosFlat();
  const categorias = getCategorias();

  let html = "";
  categorias.forEach(cat => {
    const prodsCat = productos.filter(p => p.categoria === cat);
    const visibles = prodsCat.filter(p => {
      if (!query) return true;
      return (`${cat} ${p.nombre} ${p.marca} ${p.variante}`).toLowerCase().includes(query);
    });
    if (visibles.length === 0) return;

    html += `<div style="padding:6px 12px;font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gris-medio);background:var(--gris-fondo);position:sticky;top:0">${cat}</div>`;
    visibles.forEach(p => {
      const nombre = p.nombre.replace(/'/g, "&#39;");
      const unidad = p.unidad.replace(/'/g, "&#39;");
      html += `
        <div onclick="seleccionarProductoEntrada('${p.id}', '${nombre}', '${unidad}')"
          style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--gris-fondo);font-size:0.9rem;display:flex;justify-content:space-between;align-items:center"
          onmouseover="this.style.background='var(--gris-fondo)'" onmouseout="this.style.background=''">
          <span>${p.nombre}</span>
          <span style="font-size:0.75rem;color:var(--gris-medio)">${p.unidad}</span>
        </div>
      `;
    });
  });

  if (!html) {
    html = `<div style="padding:16px;text-align:center;color:var(--gris-medio);font-size:0.88rem">Sin resultados</div>`;
  }

  el.innerHTML = html;
}

window.filtrarSelectorEntrada = function(texto) {
  renderSelectorProductosEntrada(texto);
};

window.seleccionarProductoEntrada = function(prodId, nombre, unidad) {
  STATE.entradaProductoSeleccionado = { id: prodId, nombre, unidad };

  // Ocultar selector, mostrar producto elegido
  document.getElementById("entrada-selector-productos").style.display = "none";
  document.getElementById("entrada-buscador").style.display = "none";

  const selEl = document.getElementById("entrada-producto-seleccionado");
  selEl.style.display = "flex";
  document.getElementById("entrada-prod-nombre").textContent = nombre;
  document.getElementById("entrada-prod-unidad").textContent = unidad;

  document.getElementById("entrada-cantidad").focus();
};

window.limpiarSeleccionEntrada = function() {
  STATE.entradaProductoSeleccionado = null;
  document.getElementById("entrada-producto-seleccionado").style.display = "none";
  document.getElementById("entrada-selector-productos").style.display = "block";
  document.getElementById("entrada-buscador").style.display = "block";
  document.getElementById("entrada-buscador").value = "";
  renderSelectorProductosEntrada("");
};

async function registrarEntrada() {
  const depositoId = STATE.entradaDepositoSeleccionado;
  const producto = STATE.entradaProductoSeleccionado;
  const cantidadEl = document.getElementById("entrada-cantidad");
  const vencimientoEl = document.getElementById("entrada-vencimiento");

  if (!depositoId) return mostrarToast("Seleccioná un depósito", "error");
  if (!producto) return mostrarToast("Seleccioná un producto", "error");
  if (!cantidadEl.value || Number(cantidadEl.value) <= 0) return mostrarToast("Ingresá una cantidad válida", "error");

  const btn = document.getElementById("btn-registrar-entrada");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Registrando...`;

  try {
    const res = await guardarEntrada(
      depositoId,
      producto.id,
      Number(cantidadEl.value),
      vencimientoEl.value || null,
      STATE.responsable
    );

    if (res.offline) {
      mostrarToast("📥 Entrada guardada offline. Se sincronizará al reconectar.", "ok");
    } else {
      mostrarToast(`✅ +${cantidadEl.value} ${producto.unidad} de ${producto.nombre} registrados`, "ok");
    }

    // Limpiar formulario
    cantidadEl.value = "";
    vencimientoEl.value = "";
    limpiarSeleccionEntrada();

    // Recargar historial
    await renderHistorialEntradas(depositoId);

    // Actualizar dashboard en background
    renderDashboard();

  } catch (e) {
    mostrarToast("Error al registrar: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "📥 Registrar Entrada";
  }
}

async function renderHistorialEntradas(depositoId) {
  const el = document.getElementById("historial-entradas-content");
  if (!el) return;

  el.innerHTML = `<div class="estado-vacio"><div class="vacio-icono">⏳</div><div class="vacio-texto">Cargando...</div></div>`;

  try {
    const entradas = await getEntradas(depositoId);
    const productos = getProductosFlat();

    if (entradas.length === 0) {
      el.innerHTML = `<div class="estado-vacio"><div class="vacio-icono">📥</div><div class="vacio-texto">No hay entradas registradas aún.</div></div>`;
      return;
    }

    const depNombre = depositoId === "plaza" ? "Depósito 1 - Plaza" : "Depósito 2 - La Rioja";
    let html = `<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--gris-medio);margin-bottom:10px;font-weight:700">${depNombre}</div>`;

    entradas.forEach(entrada => {
      const prod = productos.find(p => p.id === entrada.productoId);
      const nombre = prod ? prod.nombre : entrada.productoId;
      const unidad = prod ? prod.unidad : "";
      const fechaDisplay = entrada.fecha ? formatFechaDisplay(entrada.fecha) : "-";
      const vencDisplay = entrada.fechaVencimiento
        ? ` · Vence: <strong>${formatFechaDisplay(entrada.fechaVencimiento)}</strong>`
        : "";

      html += `
        <div style="padding:12px 0;border-bottom:1px solid var(--gris-fondo);display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start">
          <div>
            <div style="font-weight:600;font-size:0.9rem">${nombre}</div>
            <div style="font-size:0.75rem;color:var(--gris-medio);margin-top:2px">
              ${fechaDisplay} · ${entrada.responsable}${vencDisplay}
            </div>
          </div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--verde);white-space:nowrap">+${entrada.cantidad} ${unidad}</div>
        </div>
      `;
    });

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="estado-vacio"><div class="vacio-texto">Error al cargar historial.</div></div>`;
  }
}

async function cargarUsuariosPendientes() {
  const el = document.getElementById("lista-usuarios-pendientes");
  if (!el) return;
  const snap = await db.ref("usuarios_pendientes").once("value");
  if (!snap.exists()) {
    el.innerHTML = `<div class="estado-vacio"><div class="vacio-texto">No hay usuarios pendientes.</div></div>`;
    return;
  }

  const pendientes = snap.val();
  let html = "";
  Object.keys(pendientes).forEach(uid => {
    const p = pendientes[uid];
    html += `
      <div style="border: 1px solid var(--gris-borde); border-radius: var(--radio-sm); padding: 12px; margin-bottom: 10px;">
        <div style="font-weight: 600;">${p.nombre || "Sin nombre"}</div>
        <div style="font-size: 0.8rem; color: var(--gris-medio); margin-bottom: 8px;">${p.email}</div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <select id="rol-${uid}" class="input-field" style="padding: 8px; font-size: 0.9rem;">
            <option value="editor">Editor</option>
            <option value="visualizador">Visualizador</option>
          </select>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primario btn-sm" style="flex:1" onclick="aprobarUsuario('${uid}', '${p.nombre || ""}', '${p.email}')">Aprobar</button>
          <button class="btn btn-secundario btn-sm" style="flex:1; border-color: var(--rojo-alerta); color: var(--rojo-alerta);" onclick="rechazarUsuario('${uid}')">Rechazar</button>
        </div>
      </div>
    `;
  });
  el.innerHTML = html;
}

async function aprobarUsuario(uid, nombre, email) {
  const rol = document.getElementById(`rol-${uid}`).value;
  if (!confirm(`¿Aprobar como ${rol}?`)) return;

  try {
    await db.ref(`usuarios/${uid}`).set({
      nombre,
      email,
      role: rol
    });
    await db.ref(`usuarios_pendientes/${uid}`).remove();
    mostrarToast("Usuario aprobado", "ok");
    cargarUsuariosPendientes();
  } catch (e) {
    mostrarToast("Error al aprobar: " + e.message, "error");
  }
}

async function rechazarUsuario(uid) {
  if (!confirm("¿Rechazar y eliminar esta solicitud?")) return;
  try {
    await db.ref(`usuarios_pendientes/${uid}`).remove();
    mostrarToast("Usuario rechazado", "ok");
    cargarUsuariosPendientes();
  } catch (e) {
    mostrarToast("Error al rechazar: " + e.message, "error");
  }
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
