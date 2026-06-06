import { useState, useEffect, useCallback } from 'react'

// ─── Types ──────────────────────────────────────────────────────────
interface Product {
  id: number
  name: string
  description: string
  price: number
  stockQuantity: number
  category: string
}

interface Order {
  id: number
  customerName: string
  productId: number
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  status: string
  createdAt: string
}

interface ServiceStatus {
  name: string
  url: string
  port: string
  icon: string
  type: 'product' | 'order'
}

interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  title: string
  message: string
}

// ─── Constants ──────────────────────────────────────────────────────
const PRODUCT_API = '/api/products'
const ORDER_API   = '/api/orders'
const PRODUCT_HEALTH = '/actuator/health'
const ORDER_HEALTH   = '/actuator/health'

const SERVICES: ServiceStatus[] = [
  { name: 'Product Service', url: PRODUCT_HEALTH, port: ':8081', icon: '📦', type: 'product' },
  { name: 'Order Service',   url: ORDER_HEALTH,   port: ':8082', icon: '🛒', type: 'order' },
]

// ─── Helpers ─────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

const stockClass = (q: number) =>
  q === 0 ? 'out-stock' : q <= 5 ? 'low-stock' : 'in-stock'

const stockLabel = (q: number) =>
  q === 0 ? 'Out of Stock' : q <= 5 ? `Low (${q})` : `${q} units`

// ─── App ─────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState<'dashboard' | 'products' | 'orders'>('dashboard')
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders]     = useState<Order[]>([])
  const [svcStatus, setSvcStatus] = useState<Record<string, 'online' | 'offline' | 'loading'>>({
    'Product Service': 'loading',
    'Order Service': 'loading',
  })
  const [toasts, setToasts] = useState<Toast[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)

  // ── Toast helpers ──
  const addToast = useCallback((type: Toast['type'], title: string, message: string) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500)
  }, [])

  // ── Health checks ──
  const checkHealth = useCallback(async () => {
    for (const svc of SERVICES) {
      try {
        const res = await fetch(svc.url, { signal: AbortSignal.timeout(3000) })
        setSvcStatus(s => ({ ...s, [svc.name]: res.ok ? 'online' : 'offline' }))
      } catch {
        setSvcStatus(s => ({ ...s, [svc.name]: 'offline' }))
      }
    }
  }, [])

  // ── Data fetching ──
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch(PRODUCT_API)
      if (!res.ok) throw new Error('Failed to fetch')
      setProducts(await res.json())
    } catch {
      addToast('error', 'Fetch Failed', 'Could not load products. Is Product Service running?')
    } finally {
      setLoadingProducts(false)
    }
  }, [addToast])

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const res = await fetch(ORDER_API)
      if (!res.ok) throw new Error('Failed to fetch')
      setOrders(await res.json())
    } catch {
      addToast('error', 'Fetch Failed', 'Could not load orders. Is Order Service running?')
    } finally {
      setLoadingOrders(false)
    }
  }, [addToast])

  useEffect(() => {
    checkHealth()
    fetchProducts()
    fetchOrders()
    const iv = setInterval(checkHealth, 15000)
    return () => clearInterval(iv)
  }, [checkHealth, fetchProducts, fetchOrders])

  // ─── Views ─────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-icon">🏪</div>
          <div>
            <span className="brand-name">ShopMS</span>
            <span className="brand-tag">Microservices</span>
          </div>
        </div>
        <nav className="nav-tabs" role="navigation" aria-label="Main navigation">
          {(['dashboard','products','orders'] as const).map(t => (
            <button
              key={t}
              id={`nav-${t}`}
              className={`nav-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
              aria-current={tab === t ? 'page' : undefined}
            >
              {t === 'dashboard' ? '📊' : t === 'products' ? '📦' : '🛒'}
              <span style={{ textTransform: 'capitalize' }}>{t}</span>
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <button id="btn-refresh" className="btn btn-outline btn-sm" onClick={() => { fetchProducts(); fetchOrders(); checkHealth() }}>
            🔄 Refresh
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="main-content">
        {tab === 'dashboard' && (
          <DashboardView
            products={products}
            orders={orders}
            svcStatus={svcStatus}
            onCheckHealth={checkHealth}
          />
        )}
        {tab === 'products' && (
          <ProductsView
            products={products}
            loadingProducts={loadingProducts}
            onRefresh={fetchProducts}
            addToast={addToast}
          />
        )}
        {tab === 'orders' && (
          <OrdersView
            products={products}
            orders={orders}
            loadingOrders={loadingOrders}
            onRefresh={() => { fetchOrders(); fetchProducts() }}
            addToast={addToast}
          />
        )}
      </main>

      {/* Toast layer */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`} role="alert">
            <span className="toast-icon">
              {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              <div className="toast-msg">{t.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard View ──────────────────────────────────────────────────
function DashboardView({ products, orders, svcStatus, onCheckHealth }:{
  products: Product[]
  orders: Order[]
  svcStatus: Record<string, 'online' | 'offline' | 'loading'>
  onCheckHealth: () => void
}) {
  const totalInventoryValue = products.reduce((s, p) => s + p.price * p.stockQuantity, 0)
  const totalRevenue = orders.reduce((s, o) => s + o.totalPrice, 0)
  const confirmedOrders = orders.filter(o => o.status === 'CONFIRMED').length

  return (
    <div className="section-gap">
      <div className="page-header">
        <div>
          <h1 className="page-title">System Dashboard</h1>
          <p className="page-desc">Real-time monitoring of microservices health and business metrics</p>
        </div>
        <button id="btn-health-check" className="btn btn-outline btn-sm" onClick={onCheckHealth}>⚡ Check Health</button>
      </div>

      {/* Architecture diagram */}
      <div className="arch-diagram">
        <div className="arch-box frontend">
          <span className="arch-box-icon">⚛️</span>
          <span className="arch-box-name">React App</span>
          <span className="arch-box-port">:5173</span>
        </div>
        <span className="arch-arrow">↔️</span>
        <div className="arch-box product">
          <span className="arch-box-icon">📦</span>
          <span className="arch-box-name">Product Service</span>
          <span className="arch-box-port">:8081</span>
        </div>
        <span className="arch-arrow">↔️</span>
        <div className="arch-box order">
          <span className="arch-box-icon">🛒</span>
          <span className="arch-box-name">Order Service</span>
          <span className="arch-box-port">:8082</span>
        </div>
      </div>

      {/* Service Status */}
      <div className="status-grid">
        {SERVICES.map(svc => (
          <div key={svc.name} className="status-card">
            <div className={`status-icon ${svcStatus[svc.name]}`}>{svc.icon}</div>
            <div className="status-info">
              <div className="status-label">Microservice</div>
              <div className="status-name">{svc.name}</div>
              <span className={`status-badge ${svcStatus[svc.name]}`}>
                {svcStatus[svc.name] === 'loading' ? 'Checking...' :
                 svcStatus[svc.name] === 'online'  ? 'Online' : 'Offline'}
              </span>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {svc.port}
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-number">{products.length}</div>
          <div className="stat-label">Total Products</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{orders.length}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{confirmedOrders}</div>
          <div className="stat-label">Confirmed Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(totalRevenue)}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(totalInventoryValue)}</div>
          <div className="stat-label">Inventory Value</div>
        </div>
      </div>

      {/* Recent orders mini table */}
      {orders.length > 0 && (
        <div className="card">
          <div className="card-title">📋 Recent Orders</div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...orders].reverse().slice(0, 5).map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>#{o.id}</td>
                    <td className="td-name">{o.customerName}</td>
                    <td>{o.productName}</td>
                    <td>{o.quantity}</td>
                    <td className="td-total">{fmt(o.totalPrice)}</td>
                    <td><span className={`order-status ${o.status}`}>{o.status.toLowerCase()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Products View ───────────────────────────────────────────────────
function ProductsView({ products, loadingProducts, onRefresh, addToast }:{
  products: Product[]
  loadingProducts: boolean
  onRefresh: () => void
  addToast: (type: Toast['type'], title: string, message: string) => void
}) {
  const [form, setForm] = useState({ name: '', description: '', price: '', stockQuantity: '', category: 'Electronics' })
  const [submitting, setSubmitting] = useState(false)

  const categories = ['Electronics', 'Peripherals', 'Audio', 'Furniture', 'Accessories', 'Other']

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.price || !form.stockQuantity) {
      addToast('error', 'Validation Error', 'Please fill in all required fields.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(PRODUCT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          stockQuantity: parseInt(form.stockQuantity),
          category: form.category,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      addToast('success', 'Product Added', `"${form.name}" is now in your catalog.`)
      setForm({ name: '', description: '', price: '', stockQuantity: '', category: 'Electronics' })
      onRefresh()
    } catch (err: unknown) {
      addToast('error', 'Add Failed', err instanceof Error ? err.message : 'Failed to add product')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="section-gap">
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Product Catalog</h1>
          <p className="page-desc">Manage your inventory from Product Service (port 8081)</p>
        </div>
        <button id="btn-refresh-products" className="btn btn-outline btn-sm" onClick={onRefresh}>🔄 Refresh</button>
      </div>

      <div className="two-col">
        {/* Add Product Form */}
        <div className="card">
          <div className="card-title">➕ Add New Product</div>
          <form id="form-add-product" onSubmit={handleAdd}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="p-name">Product Name *</label>
                <input id="p-name" className="form-input" placeholder="e.g. Gaming Laptop Pro" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="p-desc">Description</label>
                <textarea id="p-desc" className="form-textarea" placeholder="Product details..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="p-price">Price (USD) *</label>
                  <input id="p-price" type="number" min="0.01" step="0.01" className="form-input" placeholder="0.00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="p-stock">Stock Qty *</label>
                  <input id="p-stock" type="number" min="0" className="form-input" placeholder="0" value={form.stockQuantity} onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="p-category">Category</label>
                <select id="p-category" className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <button id="btn-add-product" type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? <><span className="spinner" /> Adding...</> : '➕ Add Product'}
            </button>
          </form>
        </div>

        {/* Products Table */}
        <div className="card">
          <div className="card-title">
            📋 Inventory ({products.length} items)
            {loadingProducts && <span className="spinner" style={{ marginLeft: 'auto' }} />}
          </div>
          {products.length === 0 && !loadingProducts ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <div className="empty-state-title">No products yet</div>
              <div className="empty-state-desc">Add your first product using the form.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td className="td-name">{p.name}</td>
                      <td><span className="category-pill">{p.category}</span></td>
                      <td className="td-price">{fmt(p.price)}</td>
                      <td>
                        <span className={`stock-badge ${stockClass(p.stockQuantity)}`}>
                          {stockLabel(p.stockQuantity)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Orders View ─────────────────────────────────────────────────────
function OrdersView({ products, orders, loadingOrders, onRefresh, addToast }:{
  products: Product[]
  orders: Order[]
  loadingOrders: boolean
  onRefresh: () => void
  addToast: (type: Toast['type'], title: string, message: string) => void
}) {
  const [form, setForm] = useState({ customerName: '', productId: '', quantity: '1' })
  const [submitting, setSubmitting] = useState(false)

  const selectedProduct = products.find(p => p.id === parseInt(form.productId))

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName || !form.productId || !form.quantity) {
      addToast('error', 'Validation Error', 'Please fill all required fields.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(ORDER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName,
          productId: parseInt(form.productId),
          quantity: parseInt(form.quantity),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Order failed')
      addToast('success', 'Order Confirmed! 🎉', `Order #${data.id} placed for ${data.customerName}. Total: ${fmt(data.totalPrice)}`)
      setForm({ customerName: '', productId: '', quantity: '1' })
      onRefresh()
    } catch (err: unknown) {
      addToast('error', 'Order Failed', err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }

  const estimatedTotal = selectedProduct && form.quantity
    ? selectedProduct.price * parseInt(form.quantity || '0')
    : 0

  return (
    <div className="section-gap">
      <div className="page-header">
        <div>
          <h1 className="page-title">🛒 Order Management</h1>
          <p className="page-desc">Place and track orders via Order Service (port 8082) — inter-service calls included</p>
        </div>
        <button id="btn-refresh-orders" className="btn btn-outline btn-sm" onClick={onRefresh}>🔄 Refresh</button>
      </div>

      <div className="two-col">
        {/* Order Form */}
        <div className="card">
          <div className="card-title">🛍️ Place New Order</div>
          <form id="form-place-order" onSubmit={handleOrder}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="o-customer">Customer Name *</label>
                <input id="o-customer" className="form-input" placeholder="e.g. John Doe" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="o-product">Select Product *</label>
                <select id="o-product" className="form-select" value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
                  <option value="">— Choose a product —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} disabled={p.stockQuantity === 0}>
                      {p.name} — {fmt(p.price)} ({p.stockQuantity} left)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="o-qty">Quantity *</label>
                <input id="o-qty" type="number" min="1" max={selectedProduct?.stockQuantity ?? 999} className="form-input" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>

              {selectedProduct && (
                <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Order Preview</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedProduct.name}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>× {form.quantity}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Estimated Total</span>
                    <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1.05rem' }}>{fmt(estimatedTotal)}</span>
                  </div>
                </div>
              )}
            </div>
            <button id="btn-place-order" type="submit" className="btn btn-success btn-full" disabled={submitting || !form.productId}>
              {submitting ? <><span className="spinner" /> Processing...</> : '✅ Place Order'}
            </button>
          </form>

          <div className="divider" />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>🔗 Inter-Service Flow:</strong><br />
            Order Service → calls Product Service → validates stock → reduces inventory → saves order
          </div>
        </div>

        {/* Orders Table */}
        <div className="card">
          <div className="card-title">
            📋 Order History ({orders.length} orders)
            {loadingOrders && <span className="spinner" style={{ marginLeft: 'auto' }} />}
          </div>
          {orders.length === 0 && !loadingOrders ? (
            <div className="empty-state">
              <div className="empty-state-icon">🛒</div>
              <div className="empty-state-title">No orders yet</div>
              <div className="empty-state-desc">Place your first order using the form.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...orders].reverse().map(o => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.78rem' }}>#{o.id}</td>
                      <td className="td-name">{o.customerName}</td>
                      <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.productName}>{o.productName}</td>
                      <td>{o.quantity}</td>
                      <td className="td-total">{fmt(o.totalPrice)}</td>
                      <td><span className={`order-status ${o.status}`}>{o.status.toLowerCase()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
