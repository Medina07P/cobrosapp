// db.js — Base de datos liviana sobre JSON
// Guarda los datos en data/db.json. Simple y sin dependencias nativas.

const fs   = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "db.json");

const DEFAULT = {
  clientes: [],
  suscripciones: [],
  historial: [],
  _seq: { clientes: 1, suscripciones: 1, historial: 1 }
};

// ── Lectura / escritura ────────────────────────────────────────────────

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    save(DEFAULT);
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

function nextId(data, table) {
  const id = data._seq[table]++;
  save(data);
  return id;
}

// ── Clientes ───────────────────────────────────────────────────────────

const clientes = {
  all() {
    return load().clientes;
  },
  find(id) {
    return load().clientes.find(c => c.id === id) || null;
  },
  create({ nombre, correo }) {
    const data = load();
    const rec = { id: nextId(data, "clientes"), nombre, correo, creado_en: new Date().toISOString() };
    data.clientes.push(rec);
    save(data);
    return rec;
  },
  update(id, campos) {
    const data = load();
    const idx  = data.clientes.findIndex(c => c.id === id);
    if (idx === -1) return null;
    data.clientes[idx] = { ...data.clientes[idx], ...campos };
    save(data);
    return data.clientes[idx];
  },
  delete(id) {
    const data = load();
    data.clientes = data.clientes.filter(c => c.id !== id);
    save(data);
  }
};

// ── Suscripciones ──────────────────────────────────────────────────────

const suscripciones = {
  all() {
    return load().suscripciones;
  },
  activas() {
    return load().suscripciones.filter(s => s.activa);
  },
  find(id) {
    return load().suscripciones.find(s => s.id === id) || null;
  },
  create({ cliente_id, tipo, monto, dia_cobro, descripcion = "" }) {
    const data = load();
    const rec  = {
      id: nextId(data, "suscripciones"),
      cliente_id, tipo,
      monto: Number(monto),
      dia_cobro: Number(dia_cobro),
      descripcion,
      activa: true,
      creado_en: new Date().toISOString()
    };
    data.suscripciones.push(rec);
    save(data);
    return rec;
  },
  update(id, campos) {
    const data = load();
    const idx  = data.suscripciones.findIndex(s => s.id === id);
    if (idx === -1) return null;
    data.suscripciones[idx] = { ...data.suscripciones[idx], ...campos };
    save(data);
    return data.suscripciones[idx];
  }
};

// ── Historial ──────────────────────────────────────────────────────────

const historial = {
  all() {
    return load().historial.sort((a, b) => new Date(b.fecha_envio) - new Date(a.fecha_envio));
  },
  create({ suscripcion_id, estado, monto, error = null }) {
    const data = load();
    const rec  = {
      id: nextId(data, "historial"),
      suscripcion_id,
      fecha_envio: new Date().toISOString(),
      estado,
      monto,
      error
    };
    data.historial.push(rec);
    save(data);
    return rec;
  }
};

module.exports = { clientes, suscripciones, historial };
