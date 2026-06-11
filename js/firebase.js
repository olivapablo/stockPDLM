// =============================================
// CONFIGURACIÓN FIREBASE
// Reemplazá estos valores con los de tu proyecto
// en Firebase Console > Configuración del proyecto
// =============================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCoQ_gzfCgREGPQKTbokFu4qqkxwTa9HX4",
  authDomain: "stock-plaza.firebaseapp.com",
  databaseURL: "https://stock-plaza-default-rtdb.firebaseio.com",
  projectId: "stock-plaza",
  storageBucket: "stock-plaza.firebasestorage.app",
  messagingSenderId: "1055032939567",
  appId: "1:1055032939567:web:24a3ac2ff9b23cdc8322da"
};

// Inicializar Firebase
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();

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
      await db.ref(`stock/${entry.depositoId}/${entry.fecha}/${entry.productoId}`).set(entry);
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

  await db.ref(`stock/${depositoId}/${fecha}/${productoId}`).set(entry);
  return { offline: false };
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

async function getStockActual(depositoId) {
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
}
