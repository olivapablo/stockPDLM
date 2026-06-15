// =============================================
// CONFIGURACIÓN FIREBASE
// Reemplazá estos valores con los de tu proyecto
// en Firebase Console > Configuración del proyecto
// =============================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCoQ_gzFCgREGPQKTbokFu4qqkxwTa9HX4",
  authDomain: "stock-plaza.firebaseapp.com",
  databaseURL: "https://stock-plaza-default-rtdb.firebaseio.com",
  projectId: "stock-plaza",
  storageBucket: "stock-plaza.firebasestorage.app",
  messagingSenderId: "1055032939567",
  appId: "1:1055032939567:web:24a3ac2ff9b23cdc8322da",
  measurementId: "G-6ZP4BN6EP8"
};

// Inicializar Firebase
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// =============================================
// DEPÓSITOS
// =============================================
const DEPOSITOS = {
  plaza: { id: "plaza", nombre: "Depósito 1 — Plaza" },
  larioja: { id: "larioja", nombre: "Depósito 2 — La Rioja" }
};

// =============================================
// CONFIGURACIÓN DE ALERTAS
// =============================================
const CONFIG_KEY = "plaza_stock_config";

function getConfig() {
  const saved = localStorage.getItem(CONFIG_KEY);
  return saved ? JSON.parse(saved) : { umbralAlerta: 10 };
}

function setConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// =============================================
// COLA OFFLINE
// =============================================
const OFFLINE_QUEUE_KEY = "plaza_stock_offline_queue";

function getOfflineQueue() {
  const q = localStorage.getItem(OFFLINE_QUEUE_KEY);
  return q ? JSON.parse(q) : [];
}

function addToOfflineQueue(entry) {
  const queue = getOfflineQueue();
  queue.push(entry);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  for (const entry of queue) {
    try {
      if (entry.tipo === "entrada") {
        // Procesar entrada offline: leer stock actual y sumar
        const snap = await db.ref(`stock_actual/${entry.depositoId}/${entry.productoId}`).get();
        const cantActual = snap.exists() ? (snap.val().cantidad || 0) : 0;
        const cantNueva = cantActual + Number(entry.cantidad);

        await db.ref(`stock_actual/${entry.depositoId}/${entry.productoId}`).set({
          cantidad: cantNueva,
          ultimaActualizacion: new Date().toISOString()
        });

        const registroEntrada = {
          productoId: entry.productoId,
          cantidad: Number(entry.cantidad),
          fechaVencimiento: entry.fechaVencimiento || null,
          fecha: entry.fecha,
          responsable: entry.responsable,
          timestamp: entry.timestamp
        };
        await db.ref(`entradas/${entry.depositoId}`).push(registroEntrada);

        if (entry.fechaVencimiento) {
          await db.ref(`vencimientos/${entry.depositoId}`).push({
            ...registroEntrada,
            fechaRegistro: entry.fecha,
            origen: "entrada"
          });
        }
      } else {
        // Conteo semanal normal
        await db.ref(`stock/${entry.depositoId}/${entry.fecha}/${entry.productoId}`).set(entry);
        // También actualiza stock_actual
        await db.ref(`stock_actual/${entry.depositoId}/${entry.productoId}`).set({
          cantidad: Number(entry.cantidad),
          ultimaActualizacion: entry.timestamp
        });
      }
    } catch (e) {
      console.error("Error sincronizando:", e);
      return;
    }
  }
  clearOfflineQueue();
  console.log(`Sincronizados ${queue.length} registros offline`);
}

// Escuchar cuando vuelve la conexión
db.ref(".info/connected").on("value", snapshot => {
  if (snapshot.val() === true) {
    syncOfflineQueue();
  }
});

// =============================================
// OPERACIONES DE STOCK
// =============================================

async function guardarStock(depositoId, productoId, cantidad, responsable) {
  const ahora = new Date();
  const fecha = formatFecha(ahora);
  const timestamp = ahora.toISOString();

  const entry = {
    depositoId,
    productoId,
    cantidad: Number(cantidad),
    responsable,
    fecha,
    timestamp
  };

  if (!navigator.onLine) {
    addToOfflineQueue(entry);
    return { offline: true };
  }

  // Guardar snapshot semanal (inmutable)
  await db.ref(`stock/${depositoId}/${fecha}/${productoId}`).set(entry);

  // Sobreescribir stock_actual con el conteo físico real
  await db.ref(`stock_actual/${depositoId}/${productoId}`).set({
    cantidad: Number(cantidad),
    ultimaActualizacion: timestamp
  });

  return { offline: false };
}

// Nueva función: Registrar Entrada de Mercadería
async function guardarEntrada(depositoId, productoId, cantidad, fechaVencimiento, responsable) {
  const ahora = new Date();
  const fecha = formatFecha(ahora);
  const timestamp = ahora.toISOString();

  if (!navigator.onLine) {
    addToOfflineQueue({
      tipo: "entrada",
      depositoId,
      productoId,
      cantidad: Number(cantidad),
      fechaVencimiento: fechaVencimiento || null,
      responsable,
      fecha,
      timestamp
    });
    return { offline: true };
  }

  // Leer stock actual y sumar
  const snap = await db.ref(`stock_actual/${depositoId}/${productoId}`).get();
  const cantActual = snap.exists() ? (snap.val().cantidad || 0) : 0;
  const cantNueva = cantActual + Number(cantidad);

  // Actualizar stock_actual sumando
  await db.ref(`stock_actual/${depositoId}/${productoId}`).set({
    cantidad: cantNueva,
    ultimaActualizacion: timestamp
  });

  // Registro en /entradas
  const registroEntrada = {
    productoId,
    cantidad: Number(cantidad),
    fechaVencimiento: fechaVencimiento || null,
    fecha,
    responsable,
    timestamp
  };
  await db.ref(`entradas/${depositoId}`).push(registroEntrada);

  // Si tiene fecha de vencimiento, registrar en /vencimientos
  if (fechaVencimiento) {
    await db.ref(`vencimientos/${depositoId}`).push({
      ...registroEntrada,
      fechaRegistro: fecha,
      origen: "entrada"
    });
  }

  return { offline: false };
}

async function getEntradas(depositoId) {
  const snap = await db.ref(`entradas/${depositoId}`).get();
  if (!snap.exists()) return [];
  const obj = snap.val();
  return Object.entries(obj)
    .map(([id, val]) => ({ id, ...val }))
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
}

async function getStockPorFecha(depositoId, fecha) {
  const snap = await db.ref(`stock/${depositoId}/${fecha}`).get();
  return snap.exists() ? snap.val() : {};
}

async function getFechasDisponibles(depositoId) {
  const snap = await db.ref(`stock/${depositoId}`).get();
  if (!snap.exists()) return [];
  return Object.keys(snap.val()).sort().reverse();
}

// Lee de /stock_actual. Si no existe, cae al último snapshot de /stock (retrocompatibilidad)
async function getStockActual(depositoId) {
  const snap = await db.ref(`stock_actual/${depositoId}`).get();
  if (snap.exists()) {
    // Convertir formato {cantidad, ultimaActualizacion} al formato esperado {productoId: {cantidad}}
    const raw = snap.val();
    const result = {};
    Object.entries(raw).forEach(([prodId, data]) => {
      result[prodId] = { cantidad: data.cantidad };
    });
    return result;
  }
  // Fallback: leer del último snapshot semanal (datos existentes antes de esta versión)
  const fechas = await getFechasDisponibles(depositoId);
  if (fechas.length === 0) return {};
  return await getStockPorFecha(depositoId, fechas[0]);
}

// =============================================
// UTILIDADES DE FECHA
// =============================================
function formatFecha(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function formatFechaDisplay(fechaStr) {
  const [yyyy, mm, dd] = fechaStr.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

// =============================================
// RESET DE FÁBRICA
// =============================================
async function resetAppFabrica() {
  await db.ref("stock").remove();
  await db.ref("stock_actual").remove();
  await db.ref("entradas").remove();
  await db.ref("vencimientos").remove();
}

