import { useEffect, useMemo, useState } from 'react'
import { NEGOCIO, WHATSAPP } from './config'
import { cargarProductos } from './data'

const CART_STORAGE_KEY = 'dos-solcitos-cart-v3'
const COLORES = ['#ff6b6b', '#ffb703', '#4cc9f0', '#80ed99', '#b388ff', '#ff8fab']
const TALLES_BEBE = ['RN', '3M', '6M', '9M', '12M']
const TALLES_NINOS = ['2T', '3T', '4T', '6T', '8T', '10T']
const EMOJIS = {
  Bebés: '🍼',
  Bodies: '🍼',
  Niños: '👕',
  Calzado: '👟',
  Accesorios: '🎒',
  Juguetes: '🧸',
  Remeras: '👕',
  Conjuntos: '👚',
  Pantalones: '👖',
  Abrigos: '🧥',
  Vestidos: '👗',
}

const peso = (valor) =>
  Number(valor || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  })

function leerCarrito() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
    if (!Array.isArray(guardado)) return []

    return guardado
      .filter((item) =>
        item &&
        typeof item.key === 'string' &&
        typeof item.talle === 'string' &&
        Number.isInteger(item.cantidad) &&
        item.cantidad > 0,
      )
      .map(({ key, talle, cantidad }) => ({ key, talle, cantidad }))
  } catch (error) {
    console.warn('No se pudo recuperar el carrito guardado:', error)
    return []
  }
}

function stockDe(producto, talle) {
  return Math.max(0, Number(producto.stockPorTalle?.[talle] || 0))
}

function tallesProducto(producto) {
  const disponibles = producto.talles.filter((talle) => stockDe(producto, talle) > 0)
  if (disponibles.length === 1 && disponibles[0].toLowerCase().includes('único')) {
    return { todos: disponibles, disponibles }
  }

  const esBebe = producto.talles.some((talle) => {
    const normalizado = talle.toUpperCase().trim()
    return normalizado === 'RN' || normalizado.endsWith('M') || normalizado.includes('-')
  }) || /body|beb[eé]|ranita|pañalero|ajuar/i.test(producto.nombre)
  const todos = [...new Set([...(esBebe ? TALLES_BEBE : TALLES_NINOS), ...producto.talles])]
  return { todos, disponibles }
}

function TarjetaProducto({ producto, onAgregar, onZoom }) {
  const { todos: todosLosTalles, disponibles: tallesDisponibles } = useMemo(
    () => tallesProducto(producto),
    [producto],
  )
  const [talleSeleccionado, setTalleSeleccionado] = useState(tallesDisponibles[0] || '')
  const [fotoActiva, setFotoActiva] = useState(0)
  const [fotosRotas, setFotosRotas] = useState({})
  const [agregado, setAgregado] = useState(false)
  const color = COLORES[Math.abs(producto.id) % COLORES.length]
  const imagenes = producto.imagenes?.length ? producto.imagenes : (producto.imagen ? [producto.imagen] : [])
  const imagen = imagenes[fotoActiva]
  const imagenRota = Boolean(fotosRotas[fotoActiva])

  useEffect(() => {
    if (!tallesDisponibles.includes(talleSeleccionado)) {
      setTalleSeleccionado(tallesDisponibles[0] || '')
    }
  }, [producto.key, tallesDisponibles, talleSeleccionado])

  const agregar = () => {
    if (!talleSeleccionado) return
    onAgregar(producto, talleSeleccionado)
    setAgregado(true)
    window.setTimeout(() => setAgregado(false), 1200)
  }

  return (
    <article className="product-card">
      <div
        className={`product-image ${imagen && !imagenRota ? 'is-zoomable' : ''}`}
        onClick={() => imagen && !imagenRota && onZoom(producto)}
        style={{ backgroundColor: `${color}20` }}
      >
        {imagen && !imagenRota ? (
          <img
            src={imagen}
            alt={producto.nombre}
            loading="lazy"
            onError={() => setFotosRotas((actuales) => ({ ...actuales, [fotoActiva]: true }))}
          />
        ) : (
          <div className="image-placeholder">
            <span>{EMOJIS[producto.categoria] || '🧸'}</span>
            <b>Dos Solcitos</b>
            <small>Foto no disponible</small>
          </div>
        )}
        <div className="product-image-tags">
          <span className="category-label">{EMOJIS[producto.categoria] || '✨'} {producto.categoria}</span>
          {producto.codigo && <span className="product-code">{producto.codigo}</span>}
        </div>
        {imagenes.length > 1 && (
          <div className="photo-dots" aria-label="Fotos del producto">
            {imagenes.map((foto, index) => (
              <button
                key={`${foto}-${index}`}
                type="button"
                className={index === fotoActiva ? 'active' : ''}
                aria-label={`Mostrar foto ${index + 1}`}
                aria-pressed={index === fotoActiva}
                onClick={(event) => {
                  event.stopPropagation()
                  setFotoActiva(index)
                }}
              />
            ))}
          </div>
        )}
        {imagen && !imagenRota && (
          <button
            className="zoom-label"
            type="button"
            aria-label={`Ampliar fotos de ${producto.nombre}`}
            onClick={(event) => {
              event.stopPropagation()
              onZoom(producto)
            }}
          >
            ⌕
          </button>
        )}
      </div>

      <div className="product-details">
        <h2 className="product-name">{producto.nombre}</h2>
        {producto.descripcion && <p className="product-description">{producto.descripcion}</p>}

        <div className="size-picker">
          <div className="size-heading">
            <b>Elegí el talle:</b>
            {talleSeleccionado && <span className="selected-size-label">✓ Talle {talleSeleccionado}</span>}
          </div>
          <div className="size-options">
            {todosLosTalles.map((talle) => {
              const disponible = stockDe(producto, talle) > 0
              return (
                <button
                  key={talle}
                  type="button"
                  disabled={!disponible}
                  aria-pressed={talleSeleccionado === talle}
                  title={disponible ? `Elegir talle ${talle}` : `Talle ${talle} agotado`}
                  className={`size-option ${talleSeleccionado === talle ? 'selected' : ''} ${!disponible ? 'unavailable' : ''}`}
                  onClick={() => setTalleSeleccionado(talle)}
                >
                  {talle}
                </button>
              )
            })}
            {producto.talles.length === 0 && <span className="out-of-stock">Sin talles cargados</span>}
          </div>
          <div className="size-legend">
            <span><i /> Disponibles</span>
            <span><s>Tachado</s> = Sin stock</span>
          </div>
        </div>

        <div className="product-price">
          <div>
            <strong>{peso(producto.efectivo || producto.precio)}</strong>
            <span>Efectivo / Transferencia</span>
          </div>
          <div className="list-price">
            Lista: <b>{peso(producto.precio)}</b>
          </div>
          <p className="installments">
            3 cuotas de <b>{peso(producto.cuotas3 || Math.round(producto.precio / 3))}</b>
          </p>
        </div>

        <button
          className={`add-button ${agregado ? 'added' : ''}`}
          type="button"
          disabled={!talleSeleccionado}
          onClick={agregar}
        >
          {talleSeleccionado
            ? agregado ? `✓ Agregado · ${talleSeleccionado}` : `＋ Agregar · talle ${talleSeleccionado}`
            : 'Agotado'}
        </button>
      </div>
    </article>
  )
}

export default function App() {
  const [productos, setProductos] = useState([])
  const [estado, setEstado] = useState('cargando')
  const [intentos, setIntentos] = useState(0)
  const [categoria, setCategoria] = useState('Todos')
  const [talleFiltro, setTalleFiltro] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('recomendados')
  const [carrito, setCarrito] = useState(leerCarrito)
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [zoom, setZoom] = useState(null)
  const [fotoIdx, setFotoIdx] = useState(0)
  const [nombreCliente, setNombreCliente] = useState('')
  const [entrega, setEntrega] = useState('domicilio')
  const [direccion, setDireccion] = useState('')
  const [pago, setPago] = useState('transferencia')
  const [nota, setNota] = useState('')
  const [aviso, setAviso] = useState('')
  const [mensajeCopiado, setMensajeCopiado] = useState(false)

  useEffect(() => {
    let activo = true
    setEstado('cargando')
    cargarProductos()
      .then((datos) => {
        if (!activo) return
        setProductos(datos)
        setEstado('ok')
      })
      .catch((error) => {
        console.error('No se pudo cargar el catálogo:', error)
        if (activo) setEstado('error')
      })

    return () => {
      activo = false
    }
  }, [intentos])

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carrito))
    } catch (error) {
      console.warn('No se pudo guardar el carrito:', error)
    }
  }, [carrito])

  useEffect(() => {
    if (estado !== 'ok') return

    setCarrito((actual) => actual.reduce((nuevo, linea) => {
      const producto = productos.find((item) => item.key === linea.key)
      if (!producto) return nuevo
      const cantidadDisponible = stockDe(producto, linea.talle)
      const cantidad = Math.min(linea.cantidad, cantidadDisponible)
      if (!cantidad) return nuevo
      nuevo.push({ ...linea, cantidad })
      return nuevo
    }, []))
  }, [productos, estado])

  useEffect(() => {
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') {
        setZoom(null)
        setCarritoAbierto(false)
      }
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('no-scroll', Boolean(zoom || carritoAbierto))
    return () => document.body.classList.remove('no-scroll')
  }, [zoom, carritoAbierto])

  useEffect(() => {
    if (!aviso) return undefined
    const timeout = window.setTimeout(() => setAviso(''), 2400)
    return () => window.clearTimeout(timeout)
  }, [aviso])

  const categorias = useMemo(
    () => ['Todos', ...new Set(productos.map((producto) => producto.categoria))],
    [productos],
  )
  const talles = useMemo(
    () => [
      'Todos',
      ...Array.from(new Set(productos.flatMap((producto) =>
        producto.talles.filter((talle) => talle !== 'Único' && stockDe(producto, talle) > 0),
      ))).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
    ],
    [productos],
  )

  const productosVisibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es-AR')
    const filtrados = productos.filter((producto) => {
      const coincideCategoria = categoria === 'Todos' || producto.categoria === categoria
      const coincideTalle = talleFiltro === 'Todos' || stockDe(producto, talleFiltro) > 0
      const texto = `${producto.nombre} ${producto.descripcion || ''} ${producto.categoria} ${producto.talles.join(' ')}`
        .toLocaleLowerCase('es-AR')
      return coincideCategoria && coincideTalle && texto.includes(termino)
    })

    if (orden === 'precio-menor') return filtrados.sort((a, b) => a.efectivo - b.efectivo)
    if (orden === 'precio-mayor') return filtrados.sort((a, b) => b.efectivo - a.efectivo)
    return filtrados
  }, [productos, categoria, talleFiltro, busqueda, orden])

  const items = useMemo(() => carrito.flatMap((linea) => {
    const producto = productos.find((item) => item.key === linea.key)
    return producto ? [{ ...linea, producto }] : []
  }), [carrito, productos])

  const cantidadEnCarrito = items.reduce((total, item) => total + item.cantidad, 0)
  const totalLista = items.reduce((total, item) => total + item.producto.precio * item.cantidad, 0)
  const totalTransferencia = items.reduce(
    (total, item) => total + (item.producto.efectivo || item.producto.precio) * item.cantidad,
    0,
  )
  const totalPedido = pago === 'transferencia' ? totalTransferencia : totalLista
  const ahorro = Math.max(0, totalLista - totalTransferencia)
  const fotos = zoom ? (zoom.imagenes?.length ? zoom.imagenes : [zoom.imagen]).filter(Boolean) : []
  const abrirZoom = (producto) => {
    setFotoIdx(0)
    setZoom(producto)
  }
  const moverFoto = (delta) => {
    setFotoIdx((actual) => (actual + delta + fotos.length) % fotos.length)
  }

  const actualizarCantidad = (producto, talle, delta) => {
    const limite = stockDe(producto, talle)
    const key = `${producto.key}::${talle}`
    const actual = carrito.find((linea) => `${linea.key}::${linea.talle}` === key)?.cantidad || 0
    if (delta > 0 && actual >= limite) {
      setAviso(`No hay más stock del talle ${talle}.`)
      return
    }

    setCarrito((lineas) => {
      const cantidad = (lineas.find((linea) => `${linea.key}::${linea.talle}` === key)?.cantidad || 0) + delta
      const restantes = lineas.filter((linea) => `${linea.key}::${linea.talle}` !== key)
      return cantidad > 0 && cantidad <= limite
        ? [...restantes, { key: producto.key, talle, cantidad }]
        : restantes
    })
    if (delta > 0) setAviso(`${producto.nombre} (talle ${talle}) agregado al pedido.`)
  }

  const cambiarTalle = (linea, talleNuevo) => {
    if (linea.talle === talleNuevo || stockDe(linea.producto, talleNuevo) <= 0) return
    const destinoActual = carrito.find((item) => item.key === linea.key && item.talle === talleNuevo)
    const maximo = stockDe(linea.producto, talleNuevo)
    if (destinoActual && destinoActual.cantidad + linea.cantidad > maximo) {
      setAviso(`Ajustamos la cantidad al stock disponible del talle ${talleNuevo}.`)
    }
    setCarrito((lineas) => {
      const origenId = `${linea.key}::${linea.talle}`
      const destinoId = `${linea.key}::${talleNuevo}`
      const origen = lineas.find((item) => `${item.key}::${item.talle}` === origenId)
      if (!origen) return lineas
      const destino = lineas.find((item) => `${item.key}::${item.talle}` === destinoId)
      const cantidad = Math.min(
        origen.cantidad + (destino?.cantidad || 0),
        stockDe(linea.producto, talleNuevo),
      )
      return [
        ...lineas.filter((item) => {
          const id = `${item.key}::${item.talle}`
          return id !== origenId && id !== destinoId
        }),
        { key: linea.key, talle: talleNuevo, cantidad },
      ]
    })
  }

  const quitarDelCarrito = (key, talle) => {
    setCarrito((lineas) => lineas.filter((linea) => linea.key !== key || linea.talle !== talle))
  }

  const validarEntrega = () => {
    if (!direccion.trim()) {
      setAviso('Agregá la dirección o localidad y código postal para coordinar el envío.')
      return false
    }
    return true
  }

  const construirMensajePedido = () => {
    const detalle = items.map((item) => {
      const precio = pago === 'transferencia'
        ? item.producto.efectivo || item.producto.precio
        : item.producto.precio
      return `• ${item.cantidad} x ${item.producto.nombre} — talle ${item.talle}: ${peso(precio * item.cantidad)}`
    }).join('\n')
    const pagoTexto = pago === 'transferencia'
      ? `Efectivo/transferencia (${peso(totalTransferencia)}${ahorro ? `; ahorrás ${peso(ahorro)}` : ''})`
      : `Tarjeta: 3 cuotas sin interés de ${peso(Math.round(totalLista / 3))} (total ${peso(totalLista)})`
    const entregaTexto = entrega === 'domicilio'
      ? `Envío a domicilio: ${direccion.trim()}`
      : `Envío por correo: ${direccion.trim()}`
    const mensaje = [
      `Hola ${NEGOCIO}! Quiero hacer este pedido:`,
      nombreCliente.trim() ? `Nombre: ${nombreCliente.trim()}` : '',
      '',
      detalle,
      '',
      `Forma de pago: ${pagoTexto}`,
      `Forma de entrega: ${entregaTexto}`,
      nota.trim() ? `Aclaraciones: ${nota.trim()}` : '',
      '',
      `Total: ${peso(totalPedido)}`,
    ].filter((linea) => linea !== '').join('\n')
    return mensaje
  }

  const enviarPedido = () => {
    if (!items.length || !validarEntrega()) return
    window.open(
      `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(construirMensajePedido())}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const copiarPedido = async () => {
    if (!items.length || !validarEntrega()) return
    try {
      await navigator.clipboard.writeText(construirMensajePedido())
      setMensajeCopiado(true)
      setAviso('Texto del pedido copiado.')
      window.setTimeout(() => setMensajeCopiado(false), 2000)
    } catch (error) {
      console.error('No se pudo copiar el pedido:', error)
      setAviso('No pudimos copiar el pedido. Revisá los permisos del navegador.')
    }
  }

  return (
    <div className="storefront">
      <section className="hero">
        <div className="hero-actions">
          <button className="cart-button" type="button" onClick={() => setCarritoAbierto(true)}>
            <span aria-hidden="true">🛒</span>
            <span>Pedido</span>
            <b>{cantidadEnCarrito}</b>
          </button>
        </div>
        <img className="hero-logo" src="./logo.png" alt={`${NEGOCIO} Indumentaria`} />
        <h1>Ropa para <span>bebés, niños y niñas</span></h1>
        <p>Elegí tus favoritos y hacé tu pedido por WhatsApp en un minuto.</p>
        <label className="search-box">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="Buscar productos..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            aria-label="Buscar productos"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda">×</button>
          )}
        </label>
        <div className="benefit-pills" id="beneficios">
          <span><i>💳</i> 3 Cuotas</span>
          <span><i>💵</i> Descuento en Efectivo o Transferencia</span>
          <span><i>🚚</i> Envíos a domicilio o por correo</span>
        </div>
      </section>

      <main>
        <section className="catalog-controls" aria-label="Filtros del catálogo">
          <div className="catalog-filter-card">
            <div className="filter-top-row">
              <div className="filter-chips" aria-label="Filtrar por categoría">
                {categorias.map((item) => (
                  <button
                    key={item}
                    className={categoria === item ? 'filter-chip active' : 'filter-chip'}
                    type="button"
                    aria-pressed={categoria === item}
                    onClick={() => setCategoria(item)}
                  >
                    <span>{item === 'Todos' ? '🌟' : EMOJIS[item] || '✨'}</span>
                    {item}
                  </button>
                ))}
              </div>
              <div className="payment-badges" aria-label="Medios de pago">
                <span className="transfer-badge">💵 <b>Descuento Transferencia</b></span>
                <span className="badge-divider">•</span>
                <span className="installment-badge">💳 <b>3 Cuotas</b></span>
              </div>
            </div>

            <div className="filter-row">
              <div className="size-filter">
                <b>📏 Talle de tu peque:</b>
                <div className="size-filter-options">
                  {talles.map((talle) => (
                    <button
                      key={talle}
                      type="button"
                      className={talleFiltro === talle ? 'filter-size active' : 'filter-size'}
                      aria-pressed={talleFiltro === talle}
                      onClick={() => setTalleFiltro(talle)}
                    >
                      {talle}
                    </button>
                  ))}
                </div>
              </div>
              <label className="sort-filter">
                <span>Ordenar:</span>
                <select value={orden} onChange={(event) => setOrden(event.target.value)}>
                  <option value="recomendados">Recomendados</option>
                  <option value="precio-menor">Menor precio</option>
                  <option value="precio-mayor">Mayor precio</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="product-grid" aria-live="polite">
          {estado === 'cargando' && Array.from({ length: 6 }, (_, index) => (
            <div className="product-skeleton" key={index}>
              <div />
              <span />
              <span />
              <span />
            </div>
          ))}
          {estado === 'error' && (
            <div className="message error-message">
              <p>No pudimos cargar los productos. Revisá tu conexión e intentá de nuevo.</p>
              <button type="button" className="secondary-button" onClick={() => setIntentos((n) => n + 1)}>
                Reintentar
              </button>
            </div>
          )}
          {estado === 'ok' && productosVisibles.length === 0 && (
            <div className="empty-results">
              <span>🔍</span>
              <h2>No encontramos productos con esos filtros</h2>
              <p>Probá limpiando el buscador o eligiendo otro talle.</p>
              <button
                className="reset-filters"
                type="button"
                onClick={() => {
                  setBusqueda('')
                  setCategoria('Todos')
                  setTalleFiltro('Todos')
                }}
              >
                Ver todos los productos
              </button>
            </div>
          )}
          {estado === 'ok' && productosVisibles.map((producto) => (
            <TarjetaProducto
              key={producto.key}
              producto={producto}
              onAgregar={(item, talle) => actualizarCantidad(item, talle, 1)}
              onZoom={abrirZoom}
            />
          ))}
        </section>
      </main>

      <footer className="site-footer">
        <img src="./logo.png" alt="" />
        <p><b>{NEGOCIO}</b> · Ropa para bebés, niños y niñas</p>
        <span>© {new Date().getFullYear()} · Hecho con cariño en Glew</span>
      </footer>

      {aviso && <div className="toast" role="status">{aviso}</div>}

      {carritoAbierto && (
        <div className="drawer-layer">
          <button
            className="drawer-backdrop"
            type="button"
            aria-label="Cerrar pedido"
            onClick={() => setCarritoAbierto(false)}
          />
          <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <div className="drawer-header">
              <div>
                <h2 id="cart-title">Tu Pedido para WhatsApp</h2>
                <p>{cantidadEnCarrito} {cantidadEnCarrito === 1 ? 'prenda seleccionada' : 'prendas seleccionadas'}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setCarritoAbierto(false)} aria-label="Cerrar">
                ×
              </button>
            </div>

            <div className="drawer-content">
              {items.length === 0 ? (
                <div className="empty-cart">
                  <span aria-hidden="true">🧺</span>
                  <h3>Tu pedido está vacío</h3>
                  <p>Elegí tus prendas favoritas y acá vas a poder revisar talles y cantidades.</p>
                  <button type="button" className="secondary-button" onClick={() => setCarritoAbierto(false)}>
                    Volver al catálogo
                  </button>
                </div>
              ) : (
                <>
                  <div className="cart-lines">
                    {items.map((item) => {
                      const stock = stockDe(item.producto, item.talle)
                      const precio = pago === 'transferencia'
                        ? item.producto.efectivo || item.producto.precio
                        : item.producto.precio
                      const imagenCarrito = item.producto.imagenes?.[0] || item.producto.imagen
                      return (
                        <article className="cart-line" key={`${item.key}::${item.talle}`}>
                          <div className="cart-line-image">
                            {imagenCarrito
                              ? <img src={imagenCarrito} alt="" />
                              : <span>{EMOJIS[item.producto.categoria] || '✨'}</span>}
                          </div>
                          <div className="cart-line-content">
                            <div className="cart-line-top">
                              <b>{item.producto.nombre}</b>
                              <button
                                className="remove-line"
                                type="button"
                                aria-label={`Quitar ${item.producto.nombre} talle ${item.talle}`}
                                onClick={() => quitarDelCarrito(item.key, item.talle)}
                              >
                                ×
                              </button>
                            </div>
                            <label className="cart-size">
                              Talle:
                              <select
                                value={item.talle}
                                onChange={(event) => cambiarTalle(item, event.target.value)}
                              >
                                {item.producto.talles
                                  .filter((talle) => stockDe(item.producto, talle) > 0)
                                  .map((talle) => <option key={talle} value={talle}>{talle}</option>)}
                              </select>
                            </label>
                            <div className="cart-line-bottom">
                              <strong>{peso(precio * item.cantidad)}</strong>
                              <div className="quantity-control" aria-label={`Cantidad de ${item.producto.nombre}`}>
                                <button
                                  type="button"
                                  aria-label="Restar una unidad"
                                  onClick={() => actualizarCantidad(item.producto, item.talle, -1)}
                                >
                                  −
                                </button>
                                <span>{item.cantidad}</span>
                                <button
                                  type="button"
                                  aria-label="Sumar una unidad"
                                  disabled={item.cantidad >= stock}
                                  onClick={() => actualizarCantidad(item.producto, item.talle, 1)}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>

                  <section className="checkout-section">
                    <h3>Datos para coordinar</h3>
                    <label className="form-field">
                      Tu nombre <span>(opcional)</span>
                      <input
                        value={nombreCliente}
                        onChange={(event) => setNombreCliente(event.target.value)}
                        placeholder="¿Cómo te llamás?"
                      />
                    </label>
                    <fieldset className="choice-group">
                      <legend>Forma de pago</legend>
                      <button
                        type="button"
                        className={pago === 'transferencia' ? 'choice-card selected' : 'choice-card'}
                        onClick={() => setPago('transferencia')}
                      >
                        <b>💵 Efectivo / transferencia</b>
                        <span>{ahorro ? `Ahorrás ${peso(ahorro)}` : 'Precio promocional'}</span>
                      </button>
                      <button
                        type="button"
                        className={pago === 'cuotas' ? 'choice-card selected' : 'choice-card'}
                        onClick={() => setPago('cuotas')}
                      >
                        <b>💳 Tarjeta en 3 cuotas</b>
                        <span>{peso(Math.round(totalLista / 3))} por cuota</span>
                      </button>
                    </fieldset>
                    <fieldset className="choice-group">
                      <legend>Forma de entrega</legend>
                      <div className="delivery-options">
                        <button type="button" className={entrega === 'domicilio' ? 'delivery-option selected' : 'delivery-option'} onClick={() => setEntrega('domicilio')}>
                          🚚 A domicilio
                        </button>
                        <button type="button" className={entrega === 'correo' ? 'delivery-option selected' : 'delivery-option'} onClick={() => setEntrega('correo')}>
                          📦 Por correo
                        </button>
                      </div>
                      <input
                        className="form-input"
                        value={direccion}
                        onChange={(event) => setDireccion(event.target.value)}
                        placeholder={entrega === 'domicilio'
                          ? 'Dirección completa para el envío'
                          : 'Localidad y código postal del envío'}
                      />
                    </fieldset>
                    <label className="form-field">
                      Aclaraciones <span>(opcional)</span>
                      <textarea
                        value={nota}
                        onChange={(event) => setNota(event.target.value)}
                        placeholder="Dejanos un comentario"
                        rows="2"
                      />
                    </label>
                  </section>
                </>
              )}
            </div>

            {items.length > 0 && (
              <div className="drawer-footer">
                {pago === 'transferencia' && ahorro > 0 && (
                  <div className="price-summary">
                    <span>Precio de lista</span><s>{peso(totalLista)}</s>
                    <span>Descuento</span><b>−{peso(ahorro)}</b>
                  </div>
                )}
                <div className="total-row"><span>Total del pedido</span><strong>{peso(totalPedido)}</strong></div>
                <button className="whatsapp-button" type="button" onClick={enviarPedido}>
                  Enviar pedido por WhatsApp <span aria-hidden="true">↗</span>
                </button>
                <button className="copy-button" type="button" onClick={copiarPedido}>
                  {mensajeCopiado ? '✓ Texto copiado al portapapeles' : 'Copiar texto del pedido'}
                </button>
                <button className="clear-button" type="button" onClick={() => setCarrito([])}>
                  Vaciar pedido
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {zoom && fotos.length > 0 && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Fotos de ${zoom.nombre}`} onClick={() => setZoom(null)}>
          <button className="lightbox-close" type="button" aria-label="Cerrar imagen" onClick={() => setZoom(null)}>×</button>
          <figure onClick={(event) => event.stopPropagation()}>
            <div className="lightbox-image">
              {fotos.length > 1 && (
                <button className="lightbox-nav previous" type="button" aria-label="Foto anterior" onClick={() => moverFoto(-1)}>
                  ‹
                </button>
              )}
              <img src={fotos[fotoIdx]} alt={`${zoom.nombre}, foto ${fotoIdx + 1}`} />
              {fotos.length > 1 && (
                <button className="lightbox-nav next" type="button" aria-label="Foto siguiente" onClick={() => moverFoto(1)}>
                  ›
                </button>
              )}
            </div>
            {fotos.length > 1 && (
              <div className="lightbox-thumbnails" aria-label="Seleccionar foto">
                {fotos.map((foto, index) => (
                  <button
                    key={`${foto}-${index}`}
                    type="button"
                    className={index === fotoIdx ? 'active' : ''}
                    aria-label={`Ver foto ${index + 1}`}
                    aria-pressed={index === fotoIdx}
                    onClick={() => setFotoIdx(index)}
                  >
                    <img src={foto} alt="" />
                  </button>
                ))}
              </div>
            )}
            <figcaption>{zoom.nombre} · {peso(zoom.precio)}</figcaption>
          </figure>
        </div>
      )}
    </div>
  )
}
