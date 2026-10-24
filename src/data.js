import { SHEET_CSV_URL } from './config'

const ejemplo = [
  ['Body algodón pack x3', 'Bebés', 18500, '', 'Bodies de algodón suave, manga corta.', '0-3m, 3-6m, 6-9m', 1],
  ['Osito de peluche', 'Juguetes', 12900, '', 'Peluche hipoalergénico de 30 cm.', 'Único', 1],
  ['Enterito polar', 'Bebés', 24900, '', 'Abrigado y con cierre frontal.', '3-6m, 6-12m', 1],
  ['Zapatillas con luces', 'Calzado', 32000, '', 'Suela flexible, cierre de abrojo.', '24 al 31', 1],
  ['Remera estampada', 'Niños', 9800, '', 'Algodón peinado, estampas divertidas.', '2, 4, 6, 8', 1],
  ['Jardinero de jean', 'Niños', 27500, '', 'Clásico y resistente.', '2, 4, 6', 1],
  ['Mordillo de silicona', 'Accesorios', 5200, '', 'Libre de BPA.', 'Único', 1],
  ['Mochila dinosaurio', 'Accesorios', 21000, '', 'Ideal para jardín.', 'Único', 1],
].map(([nombre, categoria, precio, imagen, descripcion, talle, cantidad], id) => {
  const talles = talle.split(',').map((value) => value.trim())
  return {
    id,
    key: `ejemplo-${id}`,
    nombre,
    categoria,
    precio,
    efectivo: precio,
    imagen,
    imagenes: [],
    descripcion,
    talles,
    talle: talles.join(', '),
    stock: cantidad * talles.length,
    stockPorTalle: Object.fromEntries(talles.map((size) => [size, cantidad])),
  }
})

function parseCSV(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (char === '\n') {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell || row.length) {
    row.push(cell.trim())
    rows.push(row)
  }

  return rows
}

function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function categoriaDe(nombre) {
  const texto = normalizar(nombre)
  if (/remera|remeron|chomba/.test(texto)) return 'Remeras'
  if (/body|ranita|bebe|babero|panalero/.test(texto)) return 'Bodies'
  if (/conjunto|enterito|plush|jumper/.test(texto)) return 'Conjuntos'
  if (/pantalon|jogger|calza|short|bermuda/.test(texto)) return 'Pantalones'
  if (/vestido/.test(texto)) return 'Vestidos'
  if (/campera|buzo|abrigo|polar/.test(texto)) return 'Abrigos'
  if (/zapatilla|zapato|sandalia/.test(texto)) return 'Calzado'
  return 'Prendas'
}

function parseMonto(valor) {
  const limpio = String(valor || '').replace(/[^\d,.-]/g, '')
  if (!limpio) return 0

  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio.replace(/\.(?=\d{3}(?:\D|$))/g, '')

  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : 0
}

function parseCantidad(valor) {
  const limpio = String(valor || '').trim()
  if (!limpio) return 1
  if (/^(no|false|agotado)$/i.test(limpio)) return 0
  if (/^(si|sí|true|disponible)$/i.test(limpio)) return 1

  const numero = parseMonto(limpio)
  return Number.isFinite(numero) ? Math.max(0, numero) : 1
}

function urlImagen(url) {
  const match = url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/)
  return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800` : url
}

function urlCSV(url) {
  const match = url.match(/\/spreadsheets\/d\/([\w-]+)/)
  if (!match || url.includes('output=csv')) return url
  const gid = url.match(/[?&]gid=(\d+)/)
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv${gid ? `&gid=${gid[1]}` : ''}`
}

export async function cargarProductos() {
  if (!SHEET_CSV_URL) return ejemplo

  const response = await fetch(urlCSV(SHEET_CSV_URL))
  if (!response.ok) throw new Error(`No se pudo leer la hoja (${response.status})`)

  const rows = parseCSV(await response.text())
  if (rows.length < 2) throw new Error('La hoja no tiene productos para mostrar')

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase())
  const indice = (...aliases) => headers.findIndex((header) =>
    aliases.some((alias) => header.startsWith(alias)),
  )
  const colDescripcion = indice('descripcion', 'nombre', 'articulo')
  const colTalle = indice('talle')
  const colCodigo = indice('codigo', 'cod')
  const colPrecio = indice('precio de venta', 'precio lista')
  const colEfectivo = indice('precio efectivo', 'efectivo', 'transferencia')
  const colCantidad = indice('cantidad', 'stock')
  const colObservacion = indice('observacion')
  const columnasImagen = headers
    .map((header, index) => (/^(foto|imagen)/.test(header) ? index : -1))
    .filter((index) => index !== -1)

  if (colDescripcion === -1) {
    throw new Error('No se encontró una columna de nombre o descripción en la hoja')
  }

  const grupos = new Map()

  rows.slice(1).forEach((fila) => {
    const nombre = (fila[colDescripcion] || '').replace(/\s+/g, ' ').trim()
    const observacion = colObservacion === -1 ? '' : (fila[colObservacion] || '').trim()
    if (!nombre || /\b(vendido|baja|falla|cambio)\b/i.test(observacion)) return

    const key = normalizar(nombre)
    const talle = colTalle === -1 ? 'Único' : (fila[colTalle] || '').trim() || 'Único'
    const cantidad = colCantidad === -1 ? 1 : parseCantidad(fila[colCantidad])
    const precio = colPrecio === -1 ? 0 : parseMonto(fila[colPrecio])
    const efectivo = colEfectivo === -1 ? 0 : parseMonto(fila[colEfectivo])

    let producto = grupos.get(key)
    if (!producto) {
      producto = {
        id: grupos.size,
        key,
        codigo: colCodigo === -1 ? '' : (fila[colCodigo] || '').trim(),
        nombre,
        categoria: categoriaDe(nombre),
        precio,
        efectivo: efectivo || precio,
        imagen: '',
        imagenes: [],
        descripcion: '',
        talles: [],
        stock: 0,
        stockPorTalle: {},
      }
    }

    if (!producto.talles.includes(talle)) producto.talles.push(talle)
    producto.stockPorTalle[talle] = (producto.stockPorTalle[talle] || 0) + cantidad
    producto.stock += cantidad

    columnasImagen.forEach((column) => {
      const rawUrl = (fila[column] || '').trim()
      if (!rawUrl.startsWith('http')) return
      const image = urlImagen(rawUrl)
      if (!producto.imagenes.includes(image)) producto.imagenes.push(image)
    })

    producto.imagen = producto.imagenes[0] || ''
    grupos.set(key, producto)
  })

  return [...grupos.values()].map((producto) => ({
    ...producto,
    talles: producto.talles,
    talle: producto.talles.join(', '),
  }))
}
