import React, { useState, useEffect, useMemo } from 'react';

// ==========================================
// CONFIGURACIÓN DE TU NEGOCIO DOS SOLCITOS
// ==========================================
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1H09L_d_OKheqK42e8p-d4s7yclIXy6OVt5bcdq37Ev4/export?format=csv';
const WHATSAPP_PHONE = '5491123504802';
const BRAND_NAME = 'Dos Solcitos';

const CATEGORY_EMOJIS = {
  Remeras: '👕',
  Bodies: '👶',
  Conjuntos: '🧸',
  Pantalones: '👖',
  Vestidos: '👗',
  Abrigos: '🧥',
  Calzado: '👟',
  Prendas: '✨',
  Todos: '🌟',
};

// Formato de moneda argentina
const formatARS = (n) =>
  n ? n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) : '$0';

// Convertidor de URL de Google Drive
const formatDriveImg = (url) => {
  if (!url) return '';
  const match = url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  return match && match[1] ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800` : url;
};

// Parser CSV seguro para Google Sheets
function parseCSV(text) {
  const rows = [];
  let row = [];
  let val = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { val += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { val += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(val.trim()); val = ''; }
      else if (c === '\n') { row.push(val.trim()); rows.push(row); row = []; val = ''; }
      else if (c !== '\r') val += c;
    }
  }
  if (val || row.length) { row.push(val.trim()); rows.push(row); }
  return rows;
}

// Clasificador de categorías
function getCategory(name) {
  const n = name.toLowerCase();
  if (n.includes('remera') || n.includes('remeron')) return 'Remeras';
  if (n.includes('body') || n.includes('ranita') || n.includes('bebe')) return 'Bodies';
  if (n.includes('conjunto') || n.includes('enterito') || n.includes('plush')) return 'Conjuntos';
  if (n.includes('pantalon') || n.includes('jogger') || n.includes('calza')) return 'Pantalones';
  if (n.includes('vestido')) return 'Vestidos';
  if (n.includes('zapatilla') || n.includes('zapato')) return 'Calzado';
  return 'Prendas';
}

// Curvas de talles estándar para ropa de niños y bebés
const BABY_SIZES_CURVE = ['RN', '3M', '6M', '9M', '12M'];
const KIDS_SIZES_CURVE = ['2T', '3T', '4T', '6T', '8T', '10T'];

// Determina talles disponibles vs sin stock (tachados)
function getProductSizes(product) {
  const available = product.talles && product.talles.length ? product.talles : ['Único'];
  if (available.length === 1 && available[0].toLowerCase().includes('único')) {
    return { allSizes: ['Único'], availableSizes: ['Único'] };
  }
  const isBaby = available.some(s => {
    const u = String(s).toUpperCase();
    return u === 'RN' || u.endsWith('M') || u.includes('-');
  }) || ['Bodies', 'Ranita', 'Ajuar'].includes(product.categoria) || product.nombre.toLowerCase().includes('body');

  const baseCurve = isBaby ? BABY_SIZES_CURVE : KIDS_SIZES_CURVE;
  const set = new Set([...baseCurve, ...available]);
  return { allSizes: Array.from(set), availableSizes: available };
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('cargando');
  const [selectedCat, setSelectedCat] = useState('Todos');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState('all');
  const [search, setSearch] = useState('');
  
  // Carrito persistido en localStorage
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('dos_solcitos_cart');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [zoomProduct, setZoomProduct] = useState(null);
  const [zoomPhotoIdx, setZoomPhotoIdx] = useState(0);
  const [zoomSelectedSize, setZoomSelectedSize] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Datos para el checkout de WhatsApp
  const [checkoutData, setCheckoutData] = useState({
    nombre: '',
    metodoPago: 'transferencia', // 'transferencia' | 'cuotas'
    entrega: 'retiro', // 'retiro' | 'envio'
    direccion: '',
  });

  // Guardar carrito en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('dos_solcitos_cart', JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  // Cerrar zoom con tecla Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setZoomProduct(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Cargar productos de Google Sheet
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(SHEET_URL);
        if (!res.ok) throw new Error('Error al conectar con la hoja');
        const csv = await res.text();
        const [headers, ...rows] = parseCSV(csv);
        const lowerH = headers.map(h => h.toLowerCase());

        const getIdx = (...k) => lowerH.findIndex(h => k.some(w => h.includes(w)));
        const descIdx = getIdx('descripcion', 'nombre');
        const codeIdx = getIdx('codigo', 'cod');
        const talleIdx = getIdx('talle');
        const pListIdx = getIdx('precio de venta', 'precio lista');
        const pCashIdx = getIdx('precio efectivo', 'efectivo', 'transferencia');
        const qtyIdx = getIdx('cantidad', 'stock');
        const obsIdx = getIdx('observacion');

        const imgIndices = [];
        lowerH.forEach((h, i) => { if (h.includes('foto') || h.includes('imagen')) imgIndices.push(i); });

        const parseNum = (v) => Number(String(v || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        const prodMap = new Map();

        rows.forEach((row) => {
          const desc = descIdx !== -1 && row[descIdx] ? row[descIdx].replace(/\s+/g, ' ').trim() : '';
          const obs = obsIdx !== -1 && row[obsIdx] ? row[obsIdx].trim().toLowerCase() : '';
          if (!desc || obs.includes('pausar') || obs.includes('no mostrar')) return;

          const code = codeIdx !== -1 ? (row[codeIdx] || '').trim() : '';
          const talle = talleIdx !== -1 ? (row[talleIdx] || '').trim() : '';
          const pList = pListIdx !== -1 ? parseNum(row[pListIdx]) : 0;
          const pCash = pCashIdx !== -1 ? parseNum(row[pCashIdx]) : pList;
          const qty = qtyIdx !== -1 ? parseNum(row[qtyIdx]) : 1;

          const imgs = [];
          imgIndices.forEach(idx => {
            const val = row[idx];
            if (val && val.trim().startsWith('http')) {
              const url = formatDriveImg(val.trim());
              if (!imgs.includes(url)) imgs.push(url);
            }
          });

          if (prodMap.has(desc)) {
            const existing = prodMap.get(desc);
            if (talle && !existing.talles.includes(talle)) existing.talles.push(talle);
            imgs.forEach(img => { if (!existing.imagenes.includes(img)) existing.imagenes.push(img); });
            existing.stock += qty;
          } else {
            prodMap.set(desc, {
              id: prodMap.size + 1,
              codigo: code,
              nombre: desc,
              categoria: getCategory(desc),
              precioLista: pList,
              precioTransferencia: pCash,
              cuotas3: Math.round(pList / 3),
              talles: talle ? [talle] : ['Único'],
              imagenes: imgs,
              imagen: imgs[0] || '',
              stock: qty,
            });
          }
        });

        const list = Array.from(prodMap.values());
        setProducts(list);
        setStatus(list.length ? 'ok' : 'vacio');
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    }
    loadData();
  }, []);

  const categories = useMemo(() => ['Todos', ...new Set(products.map(p => p.categoria))], [products]);
  const allSizes = useMemo(() => {
    const s = new Set();
    products.forEach(p => p.talles.forEach(t => { if (t && t !== 'Único') s.add(t); }));
    return Array.from(s).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCat !== 'Todos' && p.categoria !== selectedCat) return false;
      if (selectedSizeFilter !== 'all' && !p.talles.includes(selectedSizeFilter)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches = p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) || p.talles.some(t => t.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [products, selectedCat, selectedSizeFilter, search]);

  const addToCart = (product, size) => {
    const key = `${product.id}_${size}`;
    setCart((prev) => {
      const current = prev[key] || { product, size, quantity: 0 };
      return { ...prev, [key]: { ...current, quantity: current.quantity + 1 } };
    });
    setToastMsg(`¡Agregado! ${product.nombre} (Talle ${size})`);
    setTimeout(() => setToastMsg(''), 2200);
  };

  const updateCartQty = (key, delta) => {
    setCart((prev) => {
      const copy = { ...prev };
      if (!copy[key]) return copy;
      const newQty = copy[key].quantity + delta;
      if (newQty <= 0) delete copy[key];
      else copy[key].quantity = newQty;
      return copy;
    });
  };

  const cartList = Object.entries(cart).map(([k, item]) => ({
    key: k,
    p: item.product,
    size: item.size,
    qty: item.quantity,
  }));

  const totalItemsCount = cartList.reduce((acc, i) => acc + i.qty, 0);
  const totalCashPrice = cartList.reduce((acc, i) => acc + i.p.precioTransferencia * i.qty, 0);
  const totalListPrice = cartList.reduce((acc, i) => acc + i.p.precioLista * i.qty, 0);
  const isCash = checkoutData.metodoPago === 'transferencia';
  const finalTotal = isCash ? totalCashPrice : totalListPrice;
  const savings = totalListPrice - totalCashPrice;

  const sendWhatsAppOrder = () => {
    if (!cartList.length) return;
    const paymentText = isCash
      ? `💵 Transferencia / Efectivo (Total: ${formatARS(totalCashPrice)} - ¡Ahorro: ${formatARS(savings)}!)`
      : `💳 Tarjeta en 3 Cuotas de ${formatARS(Math.round(totalListPrice / 3))} (Total: ${formatARS(totalListPrice)})`;

    const deliveryText = checkoutData.entrega === 'retiro'
      ? '📍 Retiro en Glew'
      : `🚚 Envío a Domicilio (${checkoutData.direccion || 'a coordinar'})`;

    const itemsText = cartList
      .map(i => `• ${i.qty}x ${i.p.nombre} (Talle: ${i.size}) - ${formatARS((isCash ? i.p.precioTransferencia : i.p.precioLista) * i.qty)}`)
      .join('\n');

    let msg = `☀️ *¡Hola ${BRAND_NAME}! Quiero realizar este pedido:*\n\n`;
    if (checkoutData.nombre) msg += `👤 *Cliente:* ${checkoutData.nombre}\n`;
    msg += `📦 *Prendas:*\n${itemsText}\n\n`;
    msg += `💳 *Pago:* ${paymentText}\n`;
    msg += `🚚 *Entrega:* ${deliveryText}\n\n`;
    msg += `💰 *TOTAL A ABONAR:* ${formatARS(finalTotal)}\n\n¿Me confirman si hay stock disponible para transferir? ¡Muchas gracias!`;

    window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#fffaf0', minHeight: '100vh', color: '#2b2d42', paddingBottom: '90px' }}>
      
      {/* HEADER / HERO */}
      <header style={{ background: 'linear-gradient(135deg, #ffe5ec, #fff3c4 50%, #d8f3ff)', padding: '36px 16px 28px', textAlign: 'center', borderBottom: '1px solid #fed7aa' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '32px', fontWeight: 900, color: '#2b2d42' }}>
          Dos Solcitos <span style={{ color: '#ff6b6b' }}>Indumentaria</span>
        </h1>
        <p style={{ margin: '0 auto 16px', maxWidth: '520px', fontSize: '14px', color: '#555' }}>
          Ropa para bebés, niños y niñas. Hacé tu pedido por WhatsApp en 1 minuto.
        </p>

        {/* Buscador */}
        <div style={{ maxWidth: '460px', margin: '0 auto 16px' }}>
          <input
            type="search"
            placeholder="🔍 Buscar prendas por nombre, código o talle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '12px 18px', borderRadius: '999px', border: '2px solid #fed7aa', fontSize: '14px', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        {/* Píldoras de beneficios */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', fontSize: '12px', fontWeight: 800 }}>
          <span style={{ background: '#fff', padding: '6px 14px', borderRadius: '99px', border: '1px solid #fed7aa' }}>💳 3 Cuotas</span>
          <span style={{ background: '#fff', padding: '6px 14px', borderRadius: '99px', border: '1px solid #fed7aa' }}>💵 Descuento en Efectivo/Transferencia</span>
          <span style={{ background: '#fff', padding: '6px 14px', borderRadius: '99px', border: '1px solid #fed7aa' }}>🚚 Retiro en Glew y Envíos</span>
        </div>
      </header>

      {/* FILTROS POR CATEGORÍA Y TALLE */}
      <section style={{ maxWidth: '1100px', margin: '16px auto 0', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              style={{ whiteSpace: 'nowrap', border: '1px solid #fed7aa', background: selectedCat === cat ? '#2b2d42' : '#fff', color: selectedCat === cat ? '#fff' : '#2b2d42', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              {CATEGORY_EMOJIS[cat] || '✨'} {cat}
            </button>
          ))}
        </div>

        {allSizes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '4px 0', fontSize: '12px' }}>
            <span style={{ fontWeight: 800, color: '#78716c', whiteSpace: 'nowrap' }}>📏 Talles:</span>
            <button
              onClick={() => setSelectedSizeFilter('all')}
              style={{ border: 'none', background: selectedSizeFilter === 'all' ? '#ffb703' : '#f5f5f4', color: selectedSizeFilter === 'all' ? '#fff' : '#2b2d42', padding: '4px 10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
            >
              Todos
            </button>
            {allSizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSizeFilter(size)}
                style={{ border: 'none', background: selectedSizeFilter === size ? '#ffb703' : '#f5f5f4', color: selectedSizeFilter === size ? '#fff' : '#2b2d42', padding: '4px 10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* GRILLA DE PRODUCTOS */}
      <main style={{ maxWidth: '1100px', margin: '20px auto', padding: '0 16px' }}>
        {status === 'cargando' ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#78716c' }}>
            <p style={{ fontSize: '16px', fontWeight: 700 }}>Cargando prendas desde Google Sheets...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#78716c' }}>
            <p style={{ fontSize: '16px', fontWeight: 700 }}>No encontramos productos con ese filtro.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            {filteredProducts.map((p) => (
              <CardItem
                key={p.id}
                product={p}
                onAdd={addToCart}
                onZoom={(prod) => {
                  setZoomProduct(prod);
                  setZoomPhotoIdx(0);
                  const cfg = getProductSizes(prod);
                  setZoomSelectedSize(cfg.availableSizes[0] || 'Único');
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* BOTÓN FLOTANTE DEL CARRITO */}
      {totalItemsCount > 0 && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 40 }}>
          <button
            onClick={() => setIsDrawerOpen(true)}
            style={{ padding: '14px 22px', borderRadius: '999px', background: '#25d366', color: '#fff', border: 'none', fontWeight: 900, fontSize: '14px', cursor: 'pointer', boxShadow: '0 6px 20px rgba(37,211,102,0.4)', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <span>🛒 Ver pedido ({totalItemsCount})</span>
            <span style={{ borderLeft: '1px solid rgba(255,255,255,0.4)', paddingLeft: '10px' }}>{formatARS(finalTotal)}</span>
          </button>
        </div>
      )}

      {/* MODAL ZOOM */}
      {zoomProduct && (
        <div onClick={() => setZoomProduct(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px', maxWidth: '480px', width: '100%', overflow: 'hidden', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px' }}>{zoomProduct.codigo}</span>
              <button onClick={() => setZoomProduct(null)} style={{ border: 'none', background: '#f5f5f4', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>
            
            <div style={{ aspectRatio: '1', width: '100%', background: '#f5f5f4', borderRadius: '16px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {zoomProduct.imagenes[zoomPhotoIdx] ? (
                <img src={zoomProduct.imagenes[zoomPhotoIdx]} alt={zoomProduct.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '48px' }}>{CATEGORY_EMOJIS[zoomProduct.categoria] || '✨'}</span>
              )}
            </div>

            <h3 style={{ margin: '14px 0 6px', fontSize: '16px', fontWeight: 800 }}>{zoomProduct.nombre}</h3>
            
            {/* Talles en modal */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '10px 0' }}>
              {getProductSizes(zoomProduct).allSizes.map((size) => {
                const isAvail = getProductSizes(zoomProduct).availableSizes.includes(size);
                const isSel = zoomSelectedSize === size;
                if (isAvail) {
                  return (
                    <button
                      key={size}
                      onClick={() => setZoomSelectedSize(size)}
                      style={{ border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', background: isSel ? '#2b2d42' : '#f5f5f4', color: isSel ? '#fff' : '#2b2d42' }}
                    >
                      Talle {size}
                    </button>
                  );
                }
                return (
                  <button key={size} disabled style={{ border: '1px dashed #d6d3d1', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'not-allowed', background: '#fafaf9', color: '#a8a29e', textDecoration: 'line-through', opacity: 0.5 }}>
                    {size}
                  </button>
                );
              })}
            </div>

            <div style={{ borderTop: '1px solid #f5f5f4', paddingTop: '10px', marginTop: '10px' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#16a34a' }}>{formatARS(zoomProduct.precioTransferencia)}</span>
              <span style={{ fontSize: '11px', color: '#57534e', display: 'block', marginTop: '2px', fontWeight: 700 }}>Efectivo / Transferencia</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '6px' }}>
                <span style={{ color: '#a8a29e' }}>Lista: {formatARS(zoomProduct.precioLista)}</span>
                <span style={{ color: '#0284c7', fontWeight: 900 }}>3 cuotas de {formatARS(zoomProduct.cuotas3)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                addToCart(zoomProduct, zoomSelectedSize || getProductSizes(zoomProduct).availableSizes[0]);
                setZoomProduct(null);
              }}
              style={{ width: '100%', marginTop: '14px', padding: '12px', borderRadius: '12px', background: '#ff6b6b', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
            >
              + Agregar al pedido · Talle {zoomSelectedSize}
            </button>
          </div>
        </div>
      )}

      {/* DRAWER DEL CARRITO */}
      {isDrawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <div onClick={() => setIsDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '400px', background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #fed7aa', background: '#fffaf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Tu Pedido para WhatsApp</h2>
              <button onClick={() => setIsDrawerOpen(false)} style={{ border: 'none', background: '#f5f5f4', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {cartList.map(({ key, p, size, qty }) => (
                <div key={key} style={{ display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid #f5f5f4', paddingBottom: '10px', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: '12px', display: 'block' }}>{p.nombre}</b>
                    <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>Talle: {size}</span>
                    <div style={{ fontSize: '12px', fontWeight: 800, marginTop: '4px' }}>
                      {formatARS((isCash ? p.precioTransferencia : p.precioLista) * qty)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => updateCartQty(key, -1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #e7e5e4', background: '#fff', cursor: 'pointer', fontWeight: 800 }}>-</button>
                    <span style={{ fontSize: '12px', fontWeight: 800 }}>{qty}</span>
                    <button onClick={() => updateCartQty(key, 1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #e7e5e4', background: '#fff', cursor: 'pointer', fontWeight: 800 }}>+</button>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: '16px', borderTop: '1px dashed #fed7aa', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <b style={{ fontSize: '12px' }}>Datos para WhatsApp:</b>
                <input
                  type="text"
                  placeholder="Tu Nombre / Apodo"
                  value={checkoutData.nombre}
                  onChange={(e) => setCheckoutData({ ...checkoutData, nombre: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d6d3d1', fontSize: '12px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setCheckoutData({ ...checkoutData, metodoPago: 'transferencia' })} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #16a34a', background: isCash ? '#f0fdf4' : '#fff', color: '#16a34a', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>💵 Transferencia</button>
                  <button onClick={() => setCheckoutData({ ...checkoutData, metodoPago: 'cuotas' })} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #2b2d42', background: !isCash ? '#f5f5f4' : '#fff', color: '#2b2d42', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>💳 3 Cuotas</button>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid #fed7aa', background: '#fffaf0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 900, marginBottom: '12px' }}>
                <span>Total:</span>
                <span style={{ color: isCash ? '#16a34a' : '#2b2d42' }}>{formatARS(finalTotal)}</span>
              </div>
              <button
                onClick={sendWhatsAppOrder}
                style={{ width: '100%', padding: '14px', borderRadius: '14px', background: '#25d366', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,211,102,0.3)' }}
              >
                💬 Enviar Pedido a WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: '24px', right: '16px', zIndex: 70, background: '#2b2d42', color: '#fff', padding: '10px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}

// ==========================================
// TARJETA DE PRODUCTO (CON EL DISEÑO EXACTO ELEGIDO)
// ==========================================
function CardItem({ product, onAdd, onZoom }) {
  const { allSizes, availableSizes } = getProductSizes(product);
  const [selectedSize, setSelectedSize] = useState(availableSizes[0] || 'Único');
  const [imgErr, setImgErr] = useState(false);

  return (
    <article style={{ background: '#fff', borderRadius: '16px', border: '1px solid #fed7aa', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px' }}>
      <div>
        {/* Imagen */}
        <div
          onClick={() => onZoom(product)}
          style={{ aspectRatio: '1', borderRadius: '12px', background: '#f5f5f4', overflow: 'hidden', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {product.imagen && !imgErr ? (
            <img src={product.imagen} alt={product.nombre} onError={() => setImgErr(true)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '40px' }}>{CATEGORY_EMOJIS[product.categoria] || '👕'}</span>
          )}
          <span style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(255,255,255,0.9)', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 800 }}>
            {product.categoria}
          </span>
        </div>

        {/* Título */}
        <h4 onClick={() => onZoom(product)} style={{ margin: '10px 0 4px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', lineHeight: 1.3 }}>
          {product.nombre}
        </h4>

        {/* Selector de talles (disponibles vs sin stock) */}
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginBottom: '3px' }}>
            <span style={{ fontWeight: 800, color: '#78716c' }}>Elegí el talle:</span>
            <span style={{ color: '#16a34a', fontWeight: 800, background: '#dcfce7', padding: '1px 6px', borderRadius: '99px' }}>
              ✓ Talle {selectedSize}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {allSizes.map((size) => {
              const isAvailable = availableSizes.includes(size);
              const isSelected = selectedSize === size;

              if (isAvailable) {
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    style={{
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: isSelected ? '#2b2d42' : '#f5f5f4',
                      color: isSelected ? '#fff' : '#2b2d42',
                    }}
                  >
                    {size}
                  </button>
                );
              }

              return (
                <button
                  key={size}
                  type="button"
                  disabled
                  title={'Talle ' + size + ' (Sin stock)'}
                  style={{
                    border: '1px dashed #d6d3d1',
                    padding: '3px 7px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'not-allowed',
                    background: '#fafaf9',
                    color: '#a8a29e',
                    textDecoration: 'line-through',
                    opacity: 0.5,
                  }}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* BLOQUE DE PRECIOS EXACTO SEGÚN TU DISEÑO */}
      <div style={{ marginTop: '10px' }}>
        <div style={{ padding: '2px 0 6px' }}>
          <div>
            <span style={{ fontSize: '24px', fontWeight: 900, color: '#16a34a', display: 'block', lineHeight: 1 }}>
              {formatARS(product.precioTransferencia)}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#57534e', display: 'block', marginTop: '4px' }}>
              Efectivo / Transferencia
            </span>
          </div>
          <div style={{ borderTop: '1px solid #f5f5f4', marginTop: '8px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
            <span style={{ color: '#a8a29e', fontWeight: 500 }}>Lista: {formatARS(product.precioLista)}</span>
            <span style={{ color: '#0284c7', fontWeight: 900, fontSize: '13px' }}>3 cuotas de {formatARS(product.cuotas3)}</span>
          </div>
        </div>

        <button
          onClick={() => onAdd(product, selectedSize)}
          style={{ width: '100%', marginTop: '8px', padding: '10px', borderRadius: '12px', background: '#ff6b6b', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
        >
          + Agregar al pedido · Talle {selectedSize}
        </button>
      </div>
    </article>
  );
}
  )
}
