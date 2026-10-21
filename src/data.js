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
  const col = (row, ...prefijos) => {
    for (let i = 0; i < keys.length; i++) {
      if (!prefijos.some((p) => keys[i].startsWith(p))) continue
      const value = (row[i] || '').trim()
      if (value) return value
    }
    return ''
  }
  const monto = (s) => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.')) || 0

  const grupos = new Map()
  rows.forEach((r) => {
    const nombre = col(r, 'descripcion', 'nombre').replace(/\s+/g, ' ')
    // Las filas con observación (VENDIDO, cambio/falla) no se muestran
    if (!nombre || col(r, 'observacion')) return
    const cantidad = Number(col(r, 'cantidad')) || 1
    const talle = col(r, 'talle')
    const g = grupos.get(nombre) || {
      id: grupos.size,
      nombre,
      categoria: categoriaDe(nombre),
      precio: monto(col(r, 'precio de venta')),
      efectivo: monto(col(r, 'precio efectivo')),
      imagen: '',
      descripcion: '',
      talles: [],
    }
    if (talle && !g.talles.includes(talle)) g.talles.push(talle)
    if (!g.imagen) g.imagen = urlImagen(col(r, 'foto', 'imagen'))
    g.stock = (g.stock || 0) + cantidad
    grupos.set(nombre, g)
  })
  return [...grupos.values()].map((g) => ({ ...g, talle: g.talles.join(', ') }))
}

function categoriaDe(nombre) {
  const w = nombre.split(' ')[0].toLowerCase().replace(/s$/, '')
  return w.charAt(0).toUpperCase() + w.slice(1)
}

// Convierte links de Google Drive en una URL de imagen mostrable
function urlImagen(url) {
  const m = url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/)
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : url
}

// Acepta el link de "compartir" de Google Sheets y lo convierte a CSV
function urlCSV(url) {
  const m = url.match(/\/spreadsheets\/d\/([\w-]+)/)
  if (!m || url.includes('output=csv')) return url
  const gid = url.match(/gid=(\d+)/)
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid[1]}` : ''}`
}
