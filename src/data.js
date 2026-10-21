import { SHEET_CSV_URL } from './config'

const ejemplo = [
  ['Body algodón pack x3', 'Bebés', 18500, '', 'Bodies de algodón suave, manga corta.', '0-3m, 3-6m, 6-9m', 'si'],
  ['Osito de peluche', 'Juguetes', 12900, '', 'Peluche hipoalergénico de 30 cm.', 'Único', 'si'],
  ['Enterito polar', 'Bebés', 24900, '', 'Abrigado y con cierre frontal.', '3-6m, 6-12m', 'si'],
  ['Zapatillas con luces', 'Calzado', 32000, '', 'Suela flexible, cierre de abrojo.', '24 al 31', 'si'],
  ['Remera estampada', 'Niños', 9800, '', 'Algodón peinado, estampas divertidas.', '2, 4, 6, 8', 'si'],
  ['Jardinero de jean', 'Niños', 27500, '', 'Clásico y resistente.', '2, 4, 6', 'si'],
  ['Mordillo de silicona', 'Accesorios', 5200, '', 'Libre de BPA.', 'Único', 'si'],
  ['Mochila dinosaurio', 'Accesorios', 21000, '', 'Ideal para jardín.', 'Único', 'si'],
].map(([nombre, categoria, precio, imagen, descripcion, talle, stock], i) => ({
  id: i, nombre, categoria, precio, imagen, descripcion, talle, stock,
}))

function parseCSV(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

export async function cargarProductos() {
  if (!SHEET_CSV_URL) return ejemplo
  const res = await fetch(urlCSV(SHEET_CSV_URL))
  if (!res.ok) throw new Error('No se pudo leer la hoja')
  const [head, ...rows] = parseCSV(await res.text())
  const keys = head.map((h) => h.trim().toLowerCase())
  const col = (o, ...prefijos) => {
    const k = keys.find((x) => prefijos.some((p) => x.startsWith(p)))
    return k ? o[k] : ''
  }
  const monto = (s) => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.')) || 0

  const ahora = Date.now()
  const grupos = new Map()
  rows.forEach((r) => {
    const o = Object.fromEntries(keys.map((k, j) => [k, (r[j] || '').trim()]))
    const nombre = col(o, 'descripcion', 'nombre').replace(/\s+/g, ' ')
    // Las filas con observación (VENDIDO, cambio/falla) no se muestran
    if (!nombre || col(o, 'observacion')) return
    const cantidad = Number(col(o, 'cantidad')) || 1
    const talle = col(o, 'talle')
    const g = grupos.get(nombre) || {
      id: grupos.size,
      nombre,
      categoria: categoriaDe(nombre),
      precio: monto(col(o, 'precio de venta')),
      efectivo: monto(col(o, 'precio efectivo')),
      imagen: '',
      descripcion: '',
      talles: [],
    }
    if (talle && !g.talles.includes(talle)) g.talles.push(talle)
    if (!g.imagen) g.imagen = urlImagen(col(o, 'foto', 'imagen'), col(o, 'actualiz') || ahora)
    g.stock = (g.stock || 0) + cantidad
    grupos.set(nombre, g)
  })
  return [...grupos.values()].map((g) => ({ ...g, talle: g.talles.join(', ') }))
}

function categoriaDe(nombre) {
  const w = nombre.split(' ')[0].toLowerCase().replace(/s$/, '')
  return w.charAt(0).toUpperCase() + w.slice(1)
}

// Convierte links de Google Drive (/file/d/ID/view, open?id=ID, uc?id=ID, thumbnail?id=ID)
// en una URL directa de imagen, con cache-busting (v=). Otros orígenes no se tocan.
// `version` puede ser la fecha de actualización (columna opcional) o, si no hay, el momento de carga.
export function urlImagen(url, version = Date.now()) {
  if (!url) return ''
  if (!/^https?:\/\/(drive|docs)\.google\.com\//i.test(url)) return url
  const m = url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/)
  if (!m) return url
  const v = encodeURIComponent(String(version).trim() || Date.now())
  return `https://drive.google.com/uc?export=view&id=${m[1]}&v=${v}`
}

// Acepta el link de "compartir" de Google Sheets y lo convierte a CSV
function urlCSV(url) {
  const m = url.match(/\/spreadsheets\/d\/([\w-]+)/)
  if (!m || url.includes('output=csv')) return url
  const gid = url.match(/gid=(\d+)/)
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid[1]}` : ''}`
}
