const PRODUCTOS = [
  {
    categoria: "Cervezas",
    marca: "Quilmes",
    items: ["Común", "Cero", "IPA", "Stout"]
  },
  {
    categoria: "Cervezas",
    marca: "Stella Artois",
    items: ["Común", "Cero", "Noir"]
  },
  {
    categoria: "Cervezas",
    marca: "Corona",
    items: ["Común", "Cero"]
  },
  {
    categoria: "Cervezas",
    marca: "Michelob",
    items: ["Común"]
  },
  {
    categoria: "Gaseosas",
    marca: "Coca Cola",
    items: ["Común", "Zero"]
  },
  {
    categoria: "Gaseosas",
    marca: "Pepsi",
    items: ["Común", "Black"]
  },
  {
    categoria: "Gaseosas",
    marca: "Sprite",
    items: ["Común"]
  },
  {
    categoria: "Gaseosas",
    marca: "Seven Up",
    items: ["Común"]
  },
  {
    categoria: "Gaseosas",
    marca: "Fanta",
    items: ["Común", "Limón"]
  },
  {
    categoria: "Gaseosas",
    marca: "Mirinda",
    items: ["Común"]
  },
  {
    categoria: "Aguas",
    marca: "Agua Mineral",
    items: ["500cc", "2lts"]
  },
  {
    categoria: "Aguas",
    marca: "Agua Tónica",
    items: ["Común"]
  },
  {
    categoria: "Aguas",
    marca: "Soda",
    items: ["500ml"]
  },
  {
    categoria: "Jugos",
    marca: "Jugo",
    items: ["Durazno", "Naranja", "Limón"]
  },
  {
    categoria: "Energizantes",
    marca: "Red Bull",
    items: ["Común"]
  },
  {
    categoria: "Vodkas",
    marca: "Wego",
    items: ["Común", "Manzana Verde", "Frutos Rojos", "Sandía", "Maracuyá", "Citric", "Melón", "Mango"]
  },
  {
    categoria: "Vodkas",
    marca: "Absolut",
    items: ["Común", "Frutos Rojos", "Durazno", "Vainilla", "Manzana Verde"]
  },
  {
    categoria: "Vodkas",
    marca: "Smirnoff",
    items: ["Común", "Citric", "Manzana Verde", "Frutos Rojos", "Maracuyá", "Sandía"]
  },
  {
    categoria: "Vodkas",
    marca: "Skyy",
    items: ["Común"]
  },
  {
    categoria: "Vodkas",
    marca: "Sernova",
    items: ["Común"]
  },
  {
    categoria: "Whisky",
    marca: "Blenders",
    items: ["Común"]
  },
  {
    categoria: "Whisky",
    marca: "Whisky Común",
    items: ["Común"]
  },
  {
    categoria: "Whisky",
    marca: "J&B",
    items: ["Común"]
  },
  {
    categoria: "Whisky",
    marca: "Mezcla",
    items: ["Común"]
  },
  {
    categoria: "Whisky",
    marca: "Johnny Walker",
    items: ["Común"]
  },
  {
    categoria: "Gin",
    marca: "Herederos",
    items: ["Común"]
  },
  {
    categoria: "Gin",
    marca: "Gin Común",
    items: ["Común"]
  },
  {
    categoria: "Gin",
    marca: "Bombay",
    items: ["Común"]
  },
  {
    categoria: "Fernet",
    marca: "Fernet Branca",
    items: ["720ml", "1ltr"]
  },
  {
    categoria: "Aperitivos y Licores",
    marca: "Aperol",
    items: ["Común"]
  },
  {
    categoria: "Aperitivos y Licores",
    marca: "Campari",
    items: ["Común"]
  },
  {
    categoria: "Aperitivos y Licores",
    marca: "Gancia",
    items: ["Común"]
  },
  {
    categoria: "Aperitivos y Licores",
    marca: "Cynar",
    items: ["Común"]
  },
  {
    categoria: "Aperitivos y Licores",
    marca: "Granadina",
    items: ["Común"]
  },
  {
    categoria: "Aperitivos y Licores",
    marca: "Piña Colada",
    items: ["Común"]
  },
  {
    categoria: "Aperitivos y Licores",
    marca: "Licor",
    items: ["Menta", "Frutilla", "Melón", "Kiwi", "Triple Sec", "Blue Curaçao"]
  },
  {
    categoria: "Vinos",
    marca: "Toro",
    items: ["Tinto", "Blanco"]
  },
  {
    categoria: "Vinos",
    marca: "Dilema",
    items: ["Tinto", "Blanco"]
  },
  {
    categoria: "Champagne",
    marca: "Du",
    items: ["Común"]
  },
  {
    categoria: "Champagne",
    marca: "Renacer",
    items: ["Común"]
  },
  {
    categoria: "Champagne",
    marca: "Mum",
    items: ["Común"]
  },
  {
    categoria: "Champagne",
    marca: "Barón B",
    items: ["Común"]
  },
  {
    categoria: "Champagne",
    marca: "Chandon",
    items: ["Mer", "Délice"]
  },
  {
    categoria: "Espumantes",
    marca: "New Age",
    items: ["Común"]
  },
  {
    categoria: "Espumantes",
    marca: "Frizze Azul",
    items: ["Común"]
  },
  {
    categoria: "Alimentos",
    marca: "Alimentos",
    items: ["Papa", "Salchicha", "Pan", "Mayonesa", "Ketchup", "Mostaza"]
  },
  {
    categoria: "Descartables",
    marca: "Vasos",
    items: ["180cc", "500cc", "800cc", "Cosquín"]
  }
];

// Genera ID único para cada producto
function generarId(categoria, marca, item) {
  return `${categoria}__${marca}__${item}`
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/[ñ]/g, "n")
    .replace(/[^a-z0-9_]/g, "");
}

// Lista plana de todos los productos con ID
function getProductosFlat() {
  const lista = [];
  PRODUCTOS.forEach(({ categoria, marca, items }) => {
    items.forEach(item => {
      const nombre = items.length === 1 && item === "Común" ? marca : `${marca} ${item}`;
      lista.push({
        id: generarId(categoria, marca, item),
        categoria,
        marca,
        variante: item,
        nombre,
        unidad: getUnidad(categoria)
      });
    });
  });
  return lista;
}

function getUnidad(categoria) {
  const map = {
    "Cervezas":            "pack",
    "Gaseosas":            "pack",
    "Aguas":               "pack",
    "Jugos":               "bot",
    "Energizantes":        "pack",
    "Vodkas":              "bot",
    "Whisky":              "bot",
    "Gin":                 "bot",
    "Fernet":              "caja",
    "Aperitivos y Licores":"bot",
    "Vinos":               "caja",
    "Champagne":           "caja",
    "Espumantes":          "caja",
    "Alimentos":           "ud",
    "Descartables":        "ud"
  };
  return map[categoria] || "ud";
}

// =============================================
// TAMAÑOS DE PACK / CAJA POR MARCA Y VARIANTE
// =============================================
const PACK_SIZES = {
  // Cervezas
  "Corona":        { default: 12 },
  // Gaseosas
  "Coca Cola":     { default: 6 },
  "Sprite":        { default: 6 },
  "Fanta":         { default: 6 },
  "Pepsi":         { default: 8 },
  "Seven Up":      { default: 8 },
  "Mirinda":       { default: 8 },
  // Aguas
  "Agua Mineral":  { "500cc": 12, "2lts": 6 },
  "Agua Tónica":   { default: 6 },
  // Energizantes
  "Red Bull":      { default: 24 },
  // Fernet (ahora caja)
  "Fernet Branca": { "720ml": 12, "1ltr": 6 },
  // Vinos
  "Toro":          { default: 12 },
  "Dilema":        { default: 6 },
  // Champagne
  "Du":            { default: 6 },
  "Renacer":       { default: 6 },
  "Mum":           { default: 6 },
  "Barón B":       { default: 6 },
  "Chandon":       { default: 6 },
  // Espumantes
  "New Age":       { default: 6 },
  "Frizze Azul":   { default: 6 }
};

function getPackSize(marca, variante) {
  const entry = PACK_SIZES[marca];
  if (!entry) return null;
  return entry[variante] ?? entry.default ?? null;
}

// Categorías únicas
function getCategorias() {
  return [...new Set(PRODUCTOS.map(p => p.categoria))];
}
