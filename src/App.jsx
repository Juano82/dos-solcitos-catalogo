import { useEffect, useMemo, useState } from 'react'
import { NEGOCIO, WHATSAPP } from './config'
import { cargarProductos } from './data'

const peso = (n) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const COLORES = ['#ff6b6b', '#ffb703', '#4cc9f0', '#80ed99', '#b388ff', '#ff8fab']
const EMOJIS = { Bebés: '🍼', Niños: '👕', Calzado: '👟', Accesorios: '🎒',
  Body: '🍼', Remera: '👕', Conjunto: '👚', Pantalon: '👖', Chomba: '👔' }

function Card({ p, onAdd, onZoom }) {
  const color = COLORES[p.id % COLORES.length]
  return (
    <article className="card">
      <div
        className={`thumb ${p.imagen ? 'zoomable' : ''}`}
        style={{ background: `${color}33` }}
        onClick={() => p.imagen && onZoom(p)}
      >
        {p.imagen ? <img src={p.imagen} alt={p.nombre} loading="lazy" /> : <span>{EMOJIS[p.categoria] || '⭐'}</span>}
        <em style={{ background: color }}>{p.categoria}</em>
        {p.imagen && <i className="lupa">🔍</i>}
      </div>
      <div className="info">
        <h3>{p.nombre}</h3>
        <p>{p.descripcion}</p>
        {p.talle && <small>Talles: {p.talle}</small>}
        <div className="precio">
          <strong>{peso(p.precio)}</strong>
          <span className="cuotas">3 cuotas sin interés de <b>{peso(p.precio / 3)}</b></span>
          {p.efectivo > 0 && <small>{peso(p.efectivo)} efectivo/transf.</small>}
        </div>
        <button className="add" onClick={() => onAdd(p)}>+ Agregar</button>
      </div>
    </article>
  )
}

export default function App() {
  const [productos, setProductos] = useState([])
  const [estado, setEstado] = useState('cargando')
  const [cat, setCat] = useState('Todos')
  const [q, setQ] = useState('')
  const [carrito, setCarrito] = useState({})
  const [abierto, setAbierto] = useState(false)
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && setZoom(null)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  useEffect(() => {
    cargarProductos().then((d) => { setProductos(d); setEstado('ok') }).catch(() => setEstado('error'))
  }, [])

  const categorias = useMemo(() => ['Todos', ...new Set(productos.map((p) => p.categoria))], [productos])
  const visibles = productos.filter(
    (p) => (cat === 'Todos' || p.categoria === cat) && p.nombre.toLowerCase().includes(q.toLowerCase()),
  )
  const items = Object.values(carrito)
  const total = items.reduce((s, i) => s + i.p.precio * i.n, 0)
  const cantidad = items.reduce((s, i) => s + i.n, 0)

  const cambiar = (p, d) =>
    setCarrito((c) => {
      const n = (c[p.id]?.n || 0) + d
      const { [p.id]: _, ...resto } = c
      return n > 0 ? { ...resto, [p.id]: { p, n } } : resto
    })

  const pedir = () => {
    const lineas = items.map((i) => `• ${i.n} x ${i.p.nombre} - ${peso(i.p.precio * i.n)}`)
    const msg = `Hola ${NEGOCIO}! Quiero hacer este pedido:\n${lineas.join('\n')}\n\nTotal: ${peso(total)}`
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <>
      <header className="top">
        <div className="logo">☀️ {NEGOCIO}</div>
        <button className="cartbtn" onClick={() => setAbierto(true)}>🛒 <b>{cantidad}</b></button>
      </header>

      <section className="hero">
        <h1>Ropa para <span>bebés y niños</span></h1>
        <p>Elegí tus favoritos y hacé tu pedido por WhatsApp en un minuto.</p>
        <input type="search" placeholder="🔍 Buscar productos..." value={q} onChange={(e) => setQ(e.target.value)} />
      </section>

      <nav className="chips">
        {categorias.map((c) => (
          <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>
            {EMOJIS[c] || '✨'} {c}
          </button>
        ))}
      </nav>

      <main className="grid">
        {estado === 'cargando' && <p className="msg">Cargando productos...</p>}
        {estado === 'error' && <p className="msg">No pudimos cargar el catálogo. Intentá de nuevo más tarde.</p>}
        {estado === 'ok' && !visibles.length && <p className="msg">No encontramos productos 😢</p>}
        {visibles.map((p) => <Card key={p.id} p={p} onAdd={(x) => cambiar(x, 1)} onZoom={setZoom} />)}
      </main>

      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)}>
          <button className="lbclose" aria-label="Cerrar">✕</button>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={zoom.imagen.replace('sz=w800', 'sz=w1600')} alt={zoom.nombre} />
            <figcaption>{zoom.nombre} · {peso(zoom.precio)}</figcaption>
          </figure>
        </div>
      )}

      <footer>© {new Date().getFullYear()} {NEGOCIO}</footer>

      {cantidad > 0 && !abierto && (
        <button className="fab" onClick={() => setAbierto(true)}>Ver pedido · {peso(total)}</button>
      )}

      {abierto && <div className="overlay" onClick={() => setAbierto(false)} />}
      <aside className={`drawer ${abierto ? 'open' : ''}`}>
        <div className="dh"><h2>Tu pedido</h2><button onClick={() => setAbierto(false)}>✕</button></div>
        <div className="dl">
          {!items.length && <p className="msg">Todavía no agregaste nada.</p>}
          {items.map(({ p, n }) => (
            <div className="li" key={p.id}>
              <div><b>{p.nombre}</b><small>{peso(p.precio)}</small></div>
              <div className="qty">
                <button onClick={() => cambiar(p, -1)}>−</button><span>{n}</span><button onClick={() => cambiar(p, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className="df">
          <div className="row"><span>Total</span><strong>{peso(total)}</strong></div>
          <button className="wa" disabled={!items.length} onClick={pedir}>Enviar pedido por WhatsApp</button>
          <button className="clear" disabled={!items.length} onClick={() => setCarrito({})}>🗑️ Vaciar carrito</button>
        </div>
      </aside>
    </>
  )
}
