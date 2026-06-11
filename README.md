# Plaza de la Música — Stock Manager

PWA de gestión de stock para Plaza de la Música.

---

## Configuración inicial

### 1. Firebase

1. Ingresá a [Firebase Console](https://console.firebase.google.com/)
2. Seleccioná tu proyecto (o creá uno nuevo)
3. Andá a **Configuración del proyecto** > **Tus apps** > **Web**
4. Copiá los valores de configuración
5. Abrí `js/firebase.js` y reemplazá los valores en `FIREBASE_CONFIG`:

```js
const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT.firebaseapp.com",
  databaseURL: "https://TU_PROJECT-default-rtdb.firebaseio.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
```

### 2. Reglas de Firebase Realtime Database

En Firebase Console > Realtime Database > Reglas, pegá esto:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> ⚠️ Esto permite acceso libre. Cuando quieras agregar autenticación, las reglas van a cambiar.

### 3. Íconos

Reemplazá los archivos en la carpeta `icons/`:
- `icon-192.png` (192x192 px)
- `icon-512.png` (512x512 px)

Si no tenés íconos por ahora, podés usar cualquier imagen PNG renombrada.

---

## Estructura del proyecto

```
plaza-stock/
├── index.html          # App principal
├── manifest.json       # Config PWA
├── sw.js               # Service Worker (offline)
├── css/
│   └── styles.css      # Estilos
├── js/
│   ├── productos.js    # Lista de productos
│   ├── firebase.js     # Conexión Firebase + operaciones
│   ├── pdf.js          # Exportación PDF
│   └── app.js          # Lógica UI principal
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Deploy en GitHub Pages

1. Subí todo el contenido a un repositorio de GitHub
2. Andá a **Settings** > **Pages**
3. Source: `main` branch, carpeta `/root`
4. La app va a estar disponible en `https://tuusuario.github.io/nombre-repo/`

---

## Agregar productos nuevos

Los productos están en `js/productos.js` en el array `PRODUCTOS`.
Cada entrada tiene esta estructura:

```js
{
  categoria: "Vodkas",
  marca: "NuevaMarca",
  items: ["Sabor1", "Sabor2"]
}
```

También podés agregar productos desde la app en **Configuración > Agregar producto**.

---

## Depósitos

| ID       | Nombre               |
|----------|----------------------|
| plaza    | Depósito 1 — Plaza   |
| larioja  | Depósito 2 — La Rioja|

---

## Notas técnicas

- **Offline**: los datos se guardan en localStorage y se sincronizan automáticamente al volver la conexión
- **PDF**: se genera con jsPDF, muestra el total combinado de ambos depósitos
- **Historial**: inmutable — no se puede editar una vez guardado
- **Alertas**: umbral configurable desde la app (default: 10 unidades)
