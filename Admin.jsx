import { Component, useEffect, useMemo, useState } from "react";

/* ============================================================
   EVER STYLE ADMIN
   Deep forest green + champagne + cream + white (matches the store)
   NOTE: front-end demo. Data and passcodes live in this browser only (localStorage).
   Change ADMIN_PASS below, and move sign-in + data to a real backend before real use.
============================================================ */

const KEY = "es_admin_v2";
const OK = "es_admin_ok";
const ADMIN_EMAIL = "owner@everstyle.store";
const ADMIN_PASS = "mohonchura-admin";
const LOW = 5;
const STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
const OWNER = { id: "U1", name: "Owner", email: ADMIN_EMAIL, role: "Owner", pass: ADMIN_PASS, active: true };
const NAV = [
  ["dashboard", "Dashboard", "⌂", "Overview"], ["orders", "Orders", "▣", "Commerce"], ["products", "Products", "◇", "Commerce"],
  ["inventory", "Inventory", "▤", "Commerce"], ["categories", "Categories", "⌘", "Commerce"], ["customers", "Customers", "◎", "Customers"],
  ["reviews", "Reviews", "★", "Customers"], ["hero", "Hero & Banners", "▧", "Marketing"], ["coupons", "Coupons", "%", "Marketing"],
  ["team", "Team Access", "♙", "System"], ["audit", "Audit Log", "◷", "System"],
];
const PERMISSIONS = {
  Owner: NAV.map((x) => x[0]),
  Manager: ["dashboard", "orders", "products", "inventory", "categories", "customers", "reviews", "hero", "coupons", "audit"],
  Editor: ["dashboard", "products", "inventory", "categories", "reviews", "hero"],
  Support: ["dashboard", "orders", "customers", "reviews"],
};
const DEFAULT_COUPONS = [{ id: "CP-1", code: "WELCOME10", type: "percent", value: 10, min: 0, expires: "", limit: 0, used: 0, active: true }];

/* ---------- helpers ---------- */
const uid = (p = "ID") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const money = (n = 0) => `৳${Number(n || 0).toLocaleString("en-IN")}`;
const dateText = (v) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return v; }
};
const todayISO = () => new Date().toISOString();
const logItem = (action, detail, who = "System") => ({ id: uid("LOG"), action, detail, who, time: todayISO() });
const safeParse = (v, fb = null) => { try { return JSON.parse(v); } catch { return fb; } };
const getStored = () => { try { return typeof window === "undefined" ? null : safeParse(localStorage.getItem(KEY), null); } catch { return null; } };
const saveStored = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } };

function imageToDataURL(file, maxSize = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- data ---------- */
function normalizeProduct(p, i = 0) {
  const images = Array.isArray(p.images) && p.images.length ? p.images : p.image ? [p.image] : [];
  return {
    id: p.id ?? uid("P"), name: p.name || "Untitled product", sku: p.sku || `ES-${String(i + 1).padStart(4, "0")}`,
    category: p.category || p.cat || "", subcategory: p.subcategory || "", price: Number(p.price || 0),
    stock: Number(p.stock ?? 10), low: Number(p.low ?? LOW), tag: p.tag || "", active: p.active !== false, images, img: p.img || "",
  };
}

function seed(products = [], cats = [], slides = []) {
  return {
    products: products.map(normalizeProduct),
    categories: cats.filter((x) => x && x !== "All").map((name, i) => ({ id: `CAT-${i + 1}`, name, subs: [] })),
    orders: [], reviews: [],
    hero: slides.map((s, i) => ({ id: `HERO-${i + 1}`, image: s.image || "", title: s.l1 || "", title2: s.l2 || "", description: s.text || "", cta: s.cta || "Shop now", category: s.cat || "All", active: true })),
    coupons: DEFAULT_COUPONS.map((c) => ({ ...c })),
    team: [{ ...OWNER }],
    logs: [logItem("Admin initialized", "Ever Style admin panel initialized.", "System")],
  };
}

function repairOwner(data) {
  const team = Array.isArray(data.team) ? [...data.team] : [];
  const i = team.findIndex((u) => u.id === OWNER.id || String(u.email || "").toLowerCase() === ADMIN_EMAIL);
  if (i === -1) team.unshift({ ...OWNER });
  else team[i] = { ...team[i], id: OWNER.id, name: team[i].name || "Owner", email: ADMIN_EMAIL, role: "Owner", pass: ADMIN_PASS, active: true };
  return { ...data, team };
}

function readData(products, cats, slides) {
  const fresh = seed(products, cats, slides);
  const saved = getStored();
  if (!saved) { const d = repairOwner(fresh); saveStored(d); return d; }
  const arr = (v, fb) => (Array.isArray(v) ? v : fb);
  const merged = {
    ...fresh, ...saved,
    products: Array.isArray(saved.products) ? saved.products.map(normalizeProduct) : fresh.products,
    categories: arr(saved.categories, fresh.categories), orders: arr(saved.orders, []), reviews: arr(saved.reviews, []),
    hero: arr(saved.hero, fresh.hero), coupons: arr(saved.coupons, fresh.coupons), team: arr(saved.team, fresh.team), logs: arr(saved.logs, fresh.logs),
  };
  const repaired = repairOwner(merged);
  saveStored(repaired);
  return repaired;
}

/* ============================================================
   STOREFRONT HELPERS (used by App.jsx)
============================================================ */
export function saveOrder(order) {
  const data = getStored() || { orders: [], logs: [] };
  const o = {
    ...order,
    id: order.id || `ES-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: order.status || "Pending",
    time: order.time || order.ts || new Date().toISOString(),
    payment: order.payment || order.pay || "Cash on delivery",
  };
  data.orders = [o, ...(Array.isArray(data.orders) ? data.orders : [])];
  if (order.coupon && Array.isArray(data.coupons)) data.coupons = data.coupons.map((c) => (c.code === order.coupon ? { ...c, used: Number(c.used || 0) + 1 } : c));
  data.logs = [logItem("New order", `${o.id} · ${money(o.total)}`, "Customer"), ...(data.logs || [])].slice(0, 500);
  saveStored(data);
  return o;
}

export function findCoupon(code, subtotal = 0) {
  const list = getStored()?.coupons || DEFAULT_COUPONS;
  const c = list.find((x) => String(x.code || "").toUpperCase() === String(code || "").trim().toUpperCase());
  if (!c || c.active === false) return null;
  if (c.expires && new Date(`${c.expires}T23:59:59`) < new Date()) return null;
  if (Number(c.limit || 0) > 0 && Number(c.used || 0) >= Number(c.limit)) return null;
  if (Number(subtotal) < Number(c.min || 0)) return null;
  return c;
}

export function couponValue(c, subtotal = 0) {
  if (!c) return 0;
  const s = Number(subtotal);
  if (c.type === "percent" || c.type === "pct") return Math.min(s, Math.round((s * Number(c.value || 0)) / 100));
  return Math.min(s, Number(c.value || 0));
}

// Call order: (products, cats, slides)
export function applyAdminCatalog(products, cats, slides) {
  try {
    const data = getStored();
    if (!data) return;
    if (Array.isArray(products) && Array.isArray(data.products)) {
      const next = data.products.filter((x) => x.active !== false).map((it) => {
        const o = products.find((x) => String(x.id) === String(it.id)) || {};
        return {
          ...o, id: it.id, name: it.name, cat: it.category, price: Number(it.price || 0), stock: Number(it.stock || 0),
          rating: o.rating ?? 4.5, tag: it.tag || undefined, image: it.images?.[0] || o.image, images: it.images || [], img: it.img || o.img || "product",
        };
      });
      products.splice(0, products.length, ...next);
    }
    if (Array.isArray(cats) && Array.isArray(data.categories) && data.categories.length) cats.splice(0, cats.length, "All", ...data.categories.map((x) => x.name));
    if (Array.isArray(slides) && Array.isArray(data.hero)) {
      const next = data.hero.filter((x) => x.active !== false && x.image).map((x) => ({ image: x.image, l1: x.title || "", l2: x.title2 || "", text: x.description || "", cta: x.cta || "Shop now", cat: x.category || "All" }));
      if (next.length) slides.splice(0, slides.length, ...next);
    }
  } catch (e) { console.error("Admin catalog error:", e); }
}

/* ============================================================
   REUSABLE UI
============================================================ */
const Status = ({ value }) => <span className={`ad-status ad-${String(value || "").toLowerCase().replace(/\s+/g, "-")}`}><i />{value}</span>;
const Field = ({ label, children }) => <label className="ad-field"><span>{label}</span>{children}</label>;
const Empty = ({ icon = "◇", title, text }) => <div className="ad-empty"><div>{icon}</div><h3>{title}</h3>{text && <p>{text}</p>}</div>;
const Toggle = ({ value, onChange }) => <button type="button" className={`ad-toggle ${value ? "on" : ""}`} onClick={() => onChange(!value)}><span /></button>;
const Search = ({ value, onChange, placeholder }) => <div className="ad-search"><span>⌕</span><input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} /></div>;

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="ad-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`ad-modal ${wide ? "ad-modal-wide" : ""}`}>
        <header className="ad-modal-head">
          <div><span>EVER STYLE ADMIN</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="ad-modal-content">{children}</div>
      </section>
    </div>
  );
}

function buildCustomers(orders) {
  const map = {};
  (orders || []).forEach((o) => {
    const k = o.phone || o.email || `${o.name}-${o.address}`;
    if (!map[k]) map[k] = { id: k, name: o.name || "Customer", phone: o.phone || "", email: o.email || "", address: o.address || "", spent: 0, orders: [] };
    map[k].orders.push(o);
    if (o.status !== "Cancelled") map[k].spent += Number(o.total || 0);
  });
  return Object.values(map).sort((a, b) => b.spent - a.spent);
}

const stockLabel = (p) => (p.stock <= 0 ? "Out of stock" : p.stock <= (p.low || LOW) ? "Low stock" : "In stock");

/* ============================================================
   DASHBOARD
============================================================ */
function Dashboard({ data, go }) {
  const customers = useMemo(() => buildCustomers(data.orders), [data.orders]);
  const live = data.orders.filter((x) => x.status !== "Cancelled");
  const revenue = live.reduce((s, x) => s + Number(x.total || 0), 0);
  const pending = data.orders.filter((x) => x.status === "Pending").length;
  const low = data.products.filter((x) => Number(x.stock || 0) <= Number(x.low ?? LOW));
  const stats = [
    { label: "Total Revenue", value: money(revenue), note: "From active orders", icon: "৳", target: "orders" },
    { label: "Orders", value: data.orders.length, note: `${pending} pending`, icon: "▣", target: "orders" },
    { label: "Customers", value: customers.length, note: "Unique customers", icon: "◎", target: "customers" },
    { label: "Low Stock", value: low.length, note: "Needs attention", icon: "!", target: "inventory" },
  ];
  const chart = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const amount = live.filter((o) => new Date(o.time || o.ts).toDateString() === d.toDateString()).reduce((s, x) => s + Number(x.total || 0), 0);
    return { label: d.toLocaleDateString("en-GB", { weekday: "short" }), amount };
  });
  const max = Math.max(...chart.map((x) => x.amount), 1);
  const rows = [["products", "◇", "Products", data.products.length], ["reviews", "★", "Approved reviews", data.reviews.filter((x) => x.status === "Approved").length], ["coupons", "%", "Active coupons", data.coupons.filter((x) => x.active).length], ["hero", "▧", "Hero banners", data.hero.length]];
  return (
    <div className="ad-stack">
      <section className="ad-stats">
        {stats.map((s) => (
          <button key={s.label} className="ad-stat" onClick={() => go(s.target)}>
            <div className="ad-stat-top"><span className="ad-stat-icon">{s.icon}</span><span className="ad-stat-arrow">↗</span></div>
            <strong>{s.value}</strong><h3>{s.label}</h3><p>{s.note}</p>
          </button>
        ))}
      </section>
      <section className="ad-dashboard-grid">
        <article className="ad-card">
          <div className="ad-card-head"><div><span className="ad-kicker">PERFORMANCE</span><h2>Sales overview</h2></div><span className="ad-pill">Last 7 days</span></div>
          <div className="ad-chart">
            {chart.map((x) => (
              <div className="ad-chart-item" key={x.label}>
                <div className="ad-chart-space"><div className="ad-chart-bar" style={{ height: `${Math.max(4, (x.amount / max) * 100)}%` }} title={money(x.amount)} /></div>
                <span>{x.label}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="ad-card">
          <div className="ad-card-head"><div><span className="ad-kicker">ACTIVITY</span><h2>Store overview</h2></div></div>
          <div className="ad-overview-list">
            {rows.map(([t, ic, label, n]) => <button key={t} onClick={() => go(t)}><span><i>{ic}</i>{label}</span><b>{n}</b></button>)}
          </div>
        </article>
      </section>
      <section className="ad-card">
        <div className="ad-card-head"><div><span className="ad-kicker">RECENT</span><h2>Latest orders</h2></div><button className="ad-link" onClick={() => go("orders")}>View all →</button></div>
        {data.orders.length ? (
          <div className="ad-table-wrap"><table className="ad-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>{data.orders.slice(0, 6).map((o) => (
              <tr key={o.id}><td><b>{o.id}</b></td><td><b>{o.name || "Customer"}</b><small>{o.phone || o.email}</small></td><td><b>{money(o.total)}</b></td><td><Status value={o.status} /></td><td>{dateText(o.time || o.ts)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty icon="▣" title="No orders yet" text="New customer orders will appear here." />}
      </section>
      <section className="ad-card">
        <div className="ad-card-head"><div><span className="ad-kicker">INVENTORY</span><h2>Stock attention</h2></div><button className="ad-link" onClick={() => go("inventory")}>Manage stock →</button></div>
        {low.length ? (
          <div className="ad-table-wrap"><table className="ad-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Stock</th><th>Status</th></tr></thead>
            <tbody>{low.slice(0, 7).map((p) => <tr key={p.id}><td><b>{p.name}</b></td><td>{p.sku}</td><td>{p.category || "—"}</td><td>{p.stock}</td><td><Status value={stockLabel(p)} /></td></tr>)}</tbody>
          </table></div>
        ) : <Empty title="Inventory looks good" text="No low-stock products right now." />}
      </section>
    </div>
  );
}

/* ============================================================
   ORDERS
============================================================ */
function OrderThumb({ it, products }) {
  const [step, setStep] = useState(0);
  const p = products.find((x) => String(x.id) === String(it.id)) || products.find((x) => x.name === it.name);
  const key = it.img || p?.img;
  const list = [p?.images?.[0], it.image, key ? `/products/${key}.jpg` : "", key ? `https://loremflickr.com/120/120/${key}?lock=${it.id || 1}` : ""].filter(Boolean);
  const src = list[step];
  return src ? <img className="ad-thumb" src={src} alt="" onError={() => setStep((s) => s + 1)} /> : <span className="ad-thumb">◇</span>;
}

function Orders({ data, update }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sel, setSel] = useState(null);
  const orders = useMemo(() => data.orders.filter((o) => (filter === "All" || o.status === filter) && `${o.id} ${o.name || ""} ${o.phone || ""} ${o.email || ""}`.toLowerCase().includes(search.trim().toLowerCase())), [data.orders, search, filter]);
  const setStatus = (o, status) => {
    update((s) => ({ orders: s.orders.map((x) => (x.id === o.id ? { ...x, status } : x)) }), "Order updated", `${o.id}: ${o.status} → ${status}`);
    setSel((c) => (c?.id === o.id ? { ...c, status } : c));
  };
  return (
    <>
      <div className="ad-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Search order, customer or phone..." />
        <select className="ad-select" value={filter} onChange={(e) => setFilter(e.target.value)}><option>All</option>{STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      <section className="ad-card ad-no-padding">
        {orders.length ? (
          <div className="ad-table-wrap"><table className="ad-table">
            <thead><tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Payment</th><th>Total</th><th>Status</th><th /></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id}>
                <td><b>{o.id}</b></td><td><b>{o.name || "Customer"}</b><small>{o.phone || o.email || "—"}</small></td>
                <td>{dateText(o.time || o.ts)}</td><td>{o.payment || o.pay || "—"}</td><td><b>{money(o.total)}</b></td><td><Status value={o.status} /></td>
                <td><button className="ad-round-btn" onClick={() => setSel(o)}>→</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty icon="▣" title="No orders found" text="Orders placed on the store will appear here." />}
      </section>
      {sel && (
        <Modal wide title={`Order ${sel.id}`} subtitle="Order details and fulfilment" onClose={() => setSel(null)}>
          <div className="ad-summary-grid">
            <div><span>Customer</span><b>{sel.name || "Customer"}</b></div><div><span>Total</span><b>{money(sel.total)}</b></div>
            <div><span>Payment</span><b>{sel.payment || sel.pay || "—"}</b></div><div><span>Placed</span><b>{dateText(sel.time || sel.ts)}</b></div>
          </div>
          <div className="ad-two-col">
            <section className="ad-inner-card">
              <h3>Order items</h3>
              {(sel.items || []).length ? sel.items.map((it, i) => (
                <div className="ad-line ad-item-line" key={i}><OrderThumb it={it} products={data.products} /><div><b>{it.name}</b><span>Qty: {it.qty || 1}</span></div><b>{money(Number(it.price || 0) * Number(it.qty || 1))}</b></div>
              )) : <p className="ad-muted">No item details available.</p>}
              {sel.coupon && <div className="ad-line"><div><b>Coupon</b><span>{sel.coupon}</span></div><b>−{money(sel.discount || 0)}</b></div>}
            </section>
            <section className="ad-inner-card">
              <h3>Customer details</h3>
              <div className="ad-info-row"><span>Phone</span><b>{sel.phone || "—"}</b></div>
              <div className="ad-info-row"><span>Email</span><b>{sel.email || "—"}</b></div>
              <div className="ad-info-row"><span>Address</span><b>{sel.address || "—"}</b></div>
              <Field label="Order status"><select className="ad-input" value={sel.status} onChange={(e) => setStatus(sel, e.target.value)}>{STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
            </section>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ============================================================
   PRODUCTS
============================================================ */
const TAGS = ["New", "Sale", "Best seller", "Top rated"];

const Sec = ({ n, t, d, children }) => (
  <div className="ad-form-section">
    <div className="ad-form-section-title"><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></div>
    {children}
  </div>
);

function ProductEditor({ product, categories, onSave, onClose }) {
  const [form, setForm] = useState(product ? { ...product, images: product.images || [] } : { name: "", sku: "", category: categories[0]?.name || "", subcategory: "", price: "", stock: 10, low: LOW, tag: "", active: true, images: [], img: "" });
  const [uploading, setUploading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const subs = categories.find((x) => x.name === form.category)?.subs || [];
  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all([...files].slice(0, 4 - (form.images?.length || 0)).map((f) => imageToDataURL(f, 900, 0.72)));
      setForm((o) => ({ ...o, images: [...(o.images || []), ...urls.filter(Boolean)].slice(0, 4) }));
    } finally { setUploading(false); }
  };
  const removeImage = (i) => setForm((o) => ({ ...o, images: o.images.filter((_, j) => j !== i) }));
  const mainImage = (i) => setForm((o) => { const a = [...o.images]; a.unshift(a.splice(i, 1)[0]); return { ...o, images: a }; });
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("Please enter product name.");
    onSave({ ...form, name: form.name.trim(), sku: (form.sku || "").trim() || `ES-${Date.now().toString().slice(-6)}`, price: Number(form.price || 0), stock: Number(form.stock || 0), low: Number(form.low || LOW) });
  };
  return (
    <form onSubmit={submit}>
      <div className="ad-product-editor">
        <Sec n="01" t="Product information" d="Basic product details and pricing.">
          <div className="ad-form-grid">
            <Field label="Product name"><input className="ad-input" value={form.name} onChange={set("name")} /></Field>
            <Field label="SKU"><input className="ad-input" placeholder="Auto generated" value={form.sku || ""} onChange={set("sku")} /></Field>
            <Field label="Price (৳)"><input className="ad-input" type="number" min="0" value={form.price} onChange={set("price")} /></Field>
            <Field label="Stock quantity"><input className="ad-input" type="number" min="0" value={form.stock} onChange={set("stock")} /></Field>
            <Field label="Low stock warning"><input className="ad-input" type="number" min="0" value={form.low} onChange={set("low")} /></Field>
            <Field label="Product label"><select className="ad-input" value={form.tag || ""} onChange={set("tag")}><option value="">None</option>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></Field>
          </div>
        </Sec>
        <Sec n="02" t="Category" d="Organize this product in your catalog.">
          <div className="ad-form-grid">
            <Field label="Category"><select className="ad-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: "" })}><option value="">Select category</option>{categories.map((c) => <option key={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Sub-category"><select className="ad-input" value={form.subcategory || ""} onChange={set("subcategory")}><option value="">None</option>{subs.map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div>
          <div className="ad-visibility">
            <div><b>Product visibility</b><span>Show this product on your storefront.</span></div>
            <Toggle value={form.active !== false} onChange={(active) => setForm({ ...form, active })} />
          </div>
        </Sec>
        <Sec n="03" t="Product images" d="Add up to 4 images. The first image is the main photo.">
          <div className="ad-image-grid">
            {(form.images || []).map((src, i) => (
              <div className="ad-product-image" key={i}>
                <img src={src} alt="" />
                {i === 0 && <span className="ad-main-image">Main</span>}
                <button type="button" className="ad-remove-image" onClick={() => removeImage(i)}>×</button>
                {i > 0 && <button type="button" className="ad-make-main" onClick={() => mainImage(i)}>★</button>}
              </div>
            ))}
            {(form.images || []).length < 4 && (
              <label className="ad-image-upload"><div>＋</div><b>{uploading ? "Processing..." : "Add image"}</b><span>JPG, PNG or WEBP</span>
                <input hidden multiple type="file" accept="image/*" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </Sec>
      </div>
      <div className="ad-modal-actions">
        <button type="button" className="ad-btn ad-btn-light" onClick={onClose}>Cancel</button>
        <button type="submit" className="ad-btn ad-btn-primary">Save product</button>
      </div>
    </form>
  );
}

function Products({ data, update }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [editor, setEditor] = useState(null);
  const products = useMemo(() => data.products.filter((p) => (category === "All" || p.category === category) && `${p.name} ${p.sku || ""}`.toLowerCase().includes(search.trim().toLowerCase())), [data.products, category, search]);
  const save = (product) => {
    if (editor?.product) update((s) => ({ products: s.products.map((x) => (x.id === editor.product.id ? { ...x, ...product } : x)) }), "Product updated", product.name);
    else { const np = { ...product, id: uid("PRODUCT") }; update((s) => ({ products: [np, ...s.products] }), "Product added", np.name); }
    setEditor(null);
  };
  const remove = (p) => { if (confirm(`Delete "${p.name}"?`)) update((s) => ({ products: s.products.filter((x) => x.id !== p.id) }), "Product deleted", p.name); };
  const toggle = (p) => update((s) => ({ products: s.products.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)) }), p.active ? "Product hidden" : "Product published", p.name);
  return (
    <>
      <div className="ad-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Search products or SKU..." />
        <select className="ad-select" value={category} onChange={(e) => setCategory(e.target.value)}><option>All</option>{data.categories.map((c) => <option key={c.id}>{c.name}</option>)}</select>
        <button className="ad-btn ad-btn-primary" onClick={() => setEditor({ product: null })}>＋ Add product</button>
      </div>
      {products.length ? (
        <div className="ad-product-grid">
          {products.map((p) => (
            <article className="ad-product-card" key={p.id}>
              <div className="ad-product-photo">
                {p.images?.[0] ? <img src={p.images[0]} alt={p.name} /> : <div className="ad-photo-placeholder">◇</div>}
                <span className={`ad-live ${p.active ? "" : "hidden"}`}>{p.active ? "Live" : "Hidden"}</span>
                {p.tag && <span className="ad-product-tag">{p.tag}</span>}
              </div>
              <div className="ad-product-info">
                <span className="ad-product-category">{p.category || "Uncategorized"}</span>
                <h3>{p.name}</h3><p>{p.sku}</p>
                <div className="ad-product-data">
                  <div><span>Price</span><b>{money(p.price)}</b></div><div><span>Stock</span><b>{p.stock}</b></div>
                  <div><span>Status</span><Status value={stockLabel(p)} /></div>
                </div>
                <div className="ad-product-buttons">
                  <button className="ad-btn ad-btn-light" onClick={() => setEditor({ product: p })}>Edit</button>
                  <button className="ad-icon-action" title={p.active ? "Hide" : "Publish"} onClick={() => toggle(p)}>{p.active ? "◉" : "○"}</button>
                  <button className="ad-icon-action danger" onClick={() => remove(p)}>×</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : <section className="ad-card"><Empty title="No products found" text="Create a new product or change your filters." /></section>}
      {editor && (
        <Modal wide title={editor.product ? "Edit product" : "Add new product"} subtitle="Manage product information, images and inventory." onClose={() => setEditor(null)}>
          <ProductEditor product={editor.product} categories={data.categories} onSave={save} onClose={() => setEditor(null)} />
        </Modal>
      )}
    </>
  );
}

/* ============================================================
   INVENTORY
============================================================ */
function Inventory({ data, update }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const products = useMemo(() => data.products.filter((p) => {
    if (!`${p.name} ${p.sku || ""}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filter === "Low stock") return p.stock > 0 && p.stock <= (p.low || LOW);
    if (filter === "Out of stock") return p.stock <= 0;
    return true;
  }), [data.products, search, filter]);
  const changeStock = (p, v) => {
    const stock = Math.max(0, Number(v || 0));
    if (stock === p.stock) return;
    update((s) => ({ products: s.products.map((x) => (x.id === p.id ? { ...x, stock } : x)) }), "Inventory updated", `${p.name}: ${p.stock} → ${stock}`);
  };
  const changeLow = (p, v) => {
    const low = Math.max(0, Number(v || 0));
    if (low === (p.low || LOW)) return;
    update((s) => ({ products: s.products.map((x) => (x.id === p.id ? { ...x, low } : x)) }), "Low-stock alert updated", `${p.name}: ${low}`);
  };
  const units = data.products.reduce((s, x) => s + Number(x.stock || 0), 0);
  const lowCount = data.products.filter((x) => x.stock <= (x.low || LOW)).length;
  return (
    <>
      <section className="ad-mini-stats">
        <div><span>Total products</span><b>{data.products.length}</b></div><div><span>Units in stock</span><b>{units}</b></div><div><span>Low / out of stock</span><b>{lowCount}</b></div>
      </section>
      <div className="ad-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Search inventory..." />
        <select className="ad-select" value={filter} onChange={(e) => setFilter(e.target.value)}><option>All</option><option>Low stock</option><option>Out of stock</option></select>
      </div>
      <section className="ad-card ad-no-padding">
        {products.length ? (
          <div className="ad-table-wrap"><table className="ad-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Status</th><th>Quick stock</th><th>Exact stock</th><th>Low alert</th></tr></thead>
            <tbody>{products.map((p) => (
              <tr key={p.id}>
                <td><div className="ad-table-product">{p.images?.[0] ? <img src={p.images[0]} alt="" /> : <span>◇</span>}<div><b>{p.name}</b><small>{p.category || "—"}</small></div></div></td>
                <td>{p.sku}</td><td><Status value={stockLabel(p)} /></td>
                <td><div className="ad-stepper"><button onClick={() => changeStock(p, p.stock - 1)}>−</button><b>{p.stock}</b><button onClick={() => changeStock(p, p.stock + 1)}>+</button></div></td>
                <td><input key={`s-${p.id}-${p.stock}`} className="ad-number" type="number" min="0" defaultValue={p.stock} onBlur={(e) => changeStock(p, e.target.value)} /></td>
                <td><input key={`l-${p.id}-${p.low}`} className="ad-number" type="number" min="0" defaultValue={p.low || LOW} onBlur={(e) => changeLow(p, e.target.value)} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty title="No inventory found" text="Try another filter." />}
      </section>
    </>
  );
}

/* ============================================================
   CATEGORIES
============================================================ */
function Categories({ data, update }) {
  const [name, setName] = useState("");
  const [subs, setSubs] = useState({});
  const addCategory = (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    if (data.categories.some((x) => x.name.toLowerCase() === v.toLowerCase())) return alert("Category already exists.");
    update((s) => ({ categories: [...s.categories, { id: uid("CAT"), name: v, subs: [] }] }), "Category added", v);
    setName("");
  };
  const addSub = (c) => {
    const v = String(subs[c.id] || "").trim();
    if (!v) return;
    if ((c.subs || []).some((x) => x.toLowerCase() === v.toLowerCase())) return alert("Sub-category already exists.");
    update((s) => ({ categories: s.categories.map((x) => (x.id === c.id ? { ...x, subs: [...(x.subs || []), v] } : x)) }), "Sub-category added", `${c.name} → ${v}`);
    setSubs((o) => ({ ...o, [c.id]: "" }));
  };
  const removeSub = (c, sub) => update((s) => ({
    categories: s.categories.map((x) => (x.id === c.id ? { ...x, subs: (x.subs || []).filter((y) => y !== sub) } : x)),
    products: s.products.map((p) => (p.category === c.name && p.subcategory === sub ? { ...p, subcategory: "" } : p)),
  }), "Sub-category deleted", `${c.name} → ${sub}`);
  const removeCategory = (c) => {
    if (data.products.some((x) => x.category === c.name)) return alert("This category has products. Move or delete those products first.");
    if (confirm(`Delete category "${c.name}"?`)) update((s) => ({ categories: s.categories.filter((x) => x.id !== c.id) }), "Category deleted", c.name);
  };
  return (
    <>
      <form className="ad-create-category" onSubmit={addCategory}>
        <div><span className="ad-kicker">CATALOG</span><h2>Create a category</h2><p>Add a new product category to your store.</p></div>
        <input className="ad-input" placeholder="e.g. Fashion" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="ad-btn ad-btn-primary">＋ Add category</button>
      </form>
      {data.categories.length ? (
        <div className="ad-category-grid">
          {data.categories.map((c) => {
            const n = data.products.filter((x) => x.category === c.name).length;
            return (
              <article className="ad-card" key={c.id}>
                <div className="ad-card-head">
                  <div><span className="ad-kicker">CATEGORY</span><h2>{c.name}</h2><p>{n} product{n === 1 ? "" : "s"}</p></div>
                  <button className="ad-round-btn danger" onClick={() => removeCategory(c)}>×</button>
                </div>
                <div className="ad-subcategories">
                  {(c.subs || []).map((s) => <span key={s}>{s}<button onClick={() => removeSub(c, s)}>×</button></span>)}
                  {!c.subs?.length && <p className="ad-muted">No sub-categories yet.</p>}
                </div>
                <div className="ad-inline-form">
                  <input className="ad-input" placeholder="Add sub-category" value={subs[c.id] || ""} onChange={(e) => setSubs((o) => ({ ...o, [c.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(c); } }} />
                  <button className="ad-btn ad-btn-light" onClick={() => addSub(c)}>Add</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : <section className="ad-card"><Empty title="No categories" text="Create your first category." /></section>}
    </>
  );
}

/* ============================================================
   CUSTOMERS
============================================================ */
function Customers({ data }) {
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(null);
  const customers = useMemo(() => buildCustomers(data.orders).filter((c) => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(search.trim().toLowerCase())), [data.orders, search]);
  return (
    <>
      <div className="ad-toolbar"><Search value={search} onChange={setSearch} placeholder="Search customers..." /></div>
      {customers.length ? (
        <div className="ad-customer-grid">
          {customers.map((c) => (
            <button className="ad-customer" key={c.id} onClick={() => setSel(c)}>
              <div className="ad-customer-avatar">{c.name?.charAt(0).toUpperCase() || "C"}</div>
              <div className="ad-customer-main"><h3>{c.name}</h3><span>{c.phone || c.email || "No contact"}</span></div>
              <div className="ad-customer-stats"><div><b>{c.orders.length}</b><span>Orders</span></div><div><b>{money(c.spent)}</b><span>Spent</span></div></div>
              <span className="ad-customer-arrow">→</span>
            </button>
          ))}
        </div>
      ) : <section className="ad-card"><Empty icon="◎" title="No customers found" text="Customers are created automatically from orders." /></section>}
      {sel && (
        <Modal wide title={sel.name} subtitle="Customer profile and order history" onClose={() => setSel(null)}>
          <div className="ad-summary-grid">
            <div><span>Phone</span><b>{sel.phone || "—"}</b></div><div><span>Email</span><b>{sel.email || "—"}</b></div>
            <div><span>Orders</span><b>{sel.orders.length}</b></div><div><span>Total spent</span><b>{money(sel.spent)}</b></div>
          </div>
          <section className="ad-inner-card"><h3>Shipping address</h3><p className="ad-muted">{sel.address || "No address available."}</p></section>
          <section className="ad-inner-card">
            <h3>Order history</h3>
            {sel.orders.map((o) => (
              <div className="ad-line" key={o.id}><div><b>{o.id}</b><span>{dateText(o.time || o.ts)}</span></div><div className="ad-line-right"><b>{money(o.total)}</b><Status value={o.status} /></div></div>
            ))}
          </section>
        </Modal>
      )}
    </>
  );
}

/* ============================================================
   REVIEWS
============================================================ */
function Reviews({ data, update }) {
  const [filter, setFilter] = useState("All");
  const reviews = data.reviews.filter((x) => filter === "All" || x.status === filter);
  const setStatus = (r, status) => update((s) => ({ reviews: s.reviews.map((x) => (x.id === r.id ? { ...x, status } : x)) }), `Review ${status.toLowerCase()}`, `${r.author || "Customer"} · ${r.product}`);
  const remove = (r) => { if (confirm("Delete this review?")) update((s) => ({ reviews: s.reviews.filter((x) => x.id !== r.id) }), "Review deleted", r.product); };
  return (
    <>
      <div className="ad-tabs">{["All", "Pending", "Approved", "Rejected"].map((x) => <button key={x} className={filter === x ? "active" : ""} onClick={() => setFilter(x)}>{x}</button>)}</div>
      {reviews.length ? (
        <div className="ad-review-grid">
          {reviews.map((r) => (
            <article className="ad-review-card" key={r.id}>
              <div className="ad-review-head">
                <div className="ad-review-avatar">{(r.author || "C").charAt(0).toUpperCase()}</div>
                <div><h3>{r.author || "Customer"}</h3><span>{dateText(r.time || r.ts)}</span></div>
                <Status value={r.status} />
              </div>
              <div className="ad-stars"><b>{"★".repeat(Number(r.rating || 0))}</b><span>{"★".repeat(Math.max(0, 5 - Number(r.rating || 0)))}</span></div>
              <span className="ad-review-product">{r.product}</span>
              <p>{r.text}</p>
              <div className="ad-review-actions">
                {r.status !== "Approved" && <button className="ad-btn ad-btn-primary" onClick={() => setStatus(r, "Approved")}>Approve</button>}
                {r.status !== "Rejected" && <button className="ad-btn ad-btn-light" onClick={() => setStatus(r, "Rejected")}>Reject</button>}
                <button className="ad-btn ad-btn-danger" onClick={() => remove(r)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : <section className="ad-card"><Empty icon="★" title="No reviews" text="Customer reviews will appear here." /></section>}
    </>
  );
}

/* ============================================================
   HERO / BANNERS
============================================================ */
function Hero({ data, update }) {
  const addBanner = () => {
    const b = { id: uid("HERO"), image: "", title: "New collection", title2: "Discover your style", description: "Explore our latest products.", cta: "Shop now", category: "All", active: true };
    update((s) => ({ hero: [...s.hero, b] }), "Hero banner added", b.title);
  };
  const patch = (b, ch) => {
    if (Object.keys(ch).every((k) => b[k] === ch[k])) return;
    update((s) => ({ hero: s.hero.map((x) => (x.id === b.id ? { ...x, ...ch } : x)) }), "Hero banner updated", b.title || "Banner");
  };
  const upload = async (b, file) => { if (!file) return; const image = await imageToDataURL(file, 1400, 0.7); patch(b, { image }); };
  const remove = (b) => { if (confirm("Delete this banner?")) update((s) => ({ hero: s.hero.filter((x) => x.id !== b.id) }), "Hero banner deleted", b.title); };
  const move = (i, dir) => {
    const t = i + dir;
    if (t < 0 || t >= data.hero.length) return;
    update((s) => { const h = [...s.hero]; [h[i], h[t]] = [h[t], h[i]]; return { hero: h }; }, "Hero order changed", `Banner ${i + 1}`);
  };
  const text = (b, k, label) => <Field label={label}><input className="ad-input" defaultValue={b[k]} onBlur={(e) => patch(b, { [k]: e.target.value })} /></Field>;
  return (
    <>
      <div className="ad-section-intro">
        <div><span className="ad-kicker">STOREFRONT</span><h2>Hero slider management</h2><p>Upload promotional images for the homepage slider. Banners without an image are not shown on the store.</p></div>
        <button className="ad-btn ad-btn-primary" onClick={addBanner}>＋ Add banner</button>
      </div>
      {data.hero.length ? (
        <div className="ad-hero-list">
          {data.hero.map((b, i) => (
            <article className="ad-hero-card" key={b.id}>
              <div className="ad-hero-preview">
                {b.image ? <img src={b.image} alt="" /> : <div className="ad-hero-placeholder"><span>▧</span><b>Banner image</b><small>Recommended 1600 × 900</small></div>}
                <label className="ad-upload-banner">{b.image ? "Change image" : "Upload image"}
                  <input hidden type="file" accept="image/*" onChange={(e) => { upload(b, e.target.files[0]); e.target.value = ""; }} />
                </label>
                <div className="ad-banner-number">{String(i + 1).padStart(2, "0")}</div>
              </div>
              <div className="ad-hero-form">
                <div className="ad-card-head">
                  <div><span className="ad-kicker">BANNER {i + 1}</span><h2>{b.title || "Untitled banner"}</h2></div>
                  <div className="ad-small-actions">
                    <button disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button disabled={i === data.hero.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button className="danger" onClick={() => remove(b)}>×</button>
                  </div>
                </div>
                <div className="ad-form-grid">
                  {text(b, "title", "Main headline")}
                  {text(b, "title2", "Second headline")}
                  {text(b, "cta", "Button text")}
                  <Field label="Button opens category">
                    <select className="ad-input" value={b.category || "All"} onChange={(e) => patch(b, { category: e.target.value })}>
                      <option>All</option>{data.categories.map((c) => <option key={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Description"><textarea className="ad-input" rows="3" defaultValue={b.description} onBlur={(e) => patch(b, { description: e.target.value })} /></Field>
                <div className="ad-visibility">
                  <div><b>Banner active</b><span>Show this banner on the storefront.</span></div>
                  <Toggle value={b.active !== false} onChange={(active) => patch(b, { active })} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : <section className="ad-card"><Empty icon="▧" title="No hero banners" text="Add your first homepage banner." /></section>}
    </>
  );
}

/* ============================================================
   COUPONS
============================================================ */
function Coupons({ data, update }) {
  const blank = { code: "", type: "percent", value: "", min: "", expires: "", limit: "" };
  const [form, setForm] = useState(blank);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const create = (e) => {
    e.preventDefault();
    const code = form.code.trim().toUpperCase().replace(/\s+/g, "");
    const value = Number(form.value || 0);
    if (!code || value <= 0) return alert("Enter a coupon code and discount value.");
    if (data.coupons.some((x) => x.code.toUpperCase() === code)) return alert("Coupon already exists.");
    if (form.type === "percent" && value > 100) return alert("Percentage cannot be over 100.");
    const c = { id: uid("CP"), code, type: form.type, value, min: Number(form.min || 0), expires: form.expires || "", limit: Number(form.limit || 0), used: 0, active: true };
    update((s) => ({ coupons: [c, ...s.coupons] }), "Coupon created", c.code);
    setForm(blank);
  };
  const toggle = (c) => update((s) => ({ coupons: s.coupons.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)) }), c.active ? "Coupon paused" : "Coupon activated", c.code);
  const remove = (c) => { if (confirm(`Delete coupon ${c.code}?`)) update((s) => ({ coupons: s.coupons.filter((x) => x.id !== c.id) }), "Coupon deleted", c.code); };
  const isPct = (c) => c.type === "percent" || c.type === "pct";
  return (
    <>
      <form className="ad-card" onSubmit={create}>
        <div className="ad-card-head"><div><span className="ad-kicker">PROMOTIONS</span><h2>Create coupon</h2><p>Create percentage or fixed discounts for customers.</p></div></div>
        <div className="ad-coupon-form">
          <Field label="Coupon code"><input className="ad-input uppercase" placeholder="SAVE20" value={form.code} onChange={set("code")} /></Field>
          <Field label="Discount type"><select className="ad-input" value={form.type} onChange={set("type")}><option value="percent">Percentage</option><option value="fixed">Fixed amount</option></select></Field>
          <Field label={form.type === "percent" ? "Discount %" : "Discount ৳"}><input className="ad-input" type="number" min="0" value={form.value} onChange={set("value")} /></Field>
          <Field label="Minimum order"><input className="ad-input" type="number" min="0" value={form.min} onChange={set("min")} /></Field>
          <Field label="Expiry date"><input className="ad-input" type="date" value={form.expires} onChange={set("expires")} /></Field>
          <Field label="Usage limit"><input className="ad-input" type="number" min="0" placeholder="0 = unlimited" value={form.limit} onChange={set("limit")} /></Field>
        </div>
        <button className="ad-btn ad-btn-primary">Create coupon</button>
      </form>
      {data.coupons.length ? (
        <div className="ad-coupon-grid">
          {data.coupons.map((c) => (
            <article className="ad-coupon" key={c.id}>
              <div className="ad-coupon-strip"><span>EVER STYLE</span><b>%</b></div>
              <div className="ad-coupon-main">
                <div className="ad-card-head"><div><span className="ad-kicker">COUPON</span><h2>{c.code}</h2></div><Status value={c.active ? "Active" : "Paused"} /></div>
                <strong className="ad-discount">{isPct(c) ? `${c.value}% OFF` : `${money(c.value)} OFF`}</strong>
                <div className="ad-coupon-details">
                  <span>Minimum: {c.min ? money(c.min) : "None"}</span>
                  <span>Used: {c.used || 0}{c.limit ? ` / ${c.limit}` : ""}</span>
                  <span>Expiry: {c.expires || "No expiry"}</span>
                </div>
                <div className="ad-row-actions">
                  <button className="ad-btn ad-btn-light" onClick={() => toggle(c)}>{c.active ? "Pause" : "Activate"}</button>
                  <button className="ad-btn ad-btn-danger" onClick={() => remove(c)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : <section className="ad-card"><Empty title="No coupons" text="Create your first discount coupon." /></section>}
    </>
  );
}

/* ============================================================
   TEAM
============================================================ */
function Team({ data, update, currentUser }) {
  const blank = { name: "", email: "", role: "Support", pass: "" };
  const [form, setForm] = useState(blank);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const roles = Object.keys(PERMISSIONS);
  const add = (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !email.includes("@") || form.pass.length < 6) return alert("Enter name, valid email and at least 6 character passcode.");
    if (data.team.some((x) => String(x.email || "").toLowerCase() === email)) return alert("This email already has access.");
    const m = { id: uid("USER"), name: form.name.trim(), email, role: form.role, pass: form.pass, active: true };
    update((s) => ({ team: [...s.team, m] }), "Team member added", `${m.name} · ${m.role}`);
    setForm(blank);
  };
  const patch = (m, ch, action) => update((s) => ({ team: s.team.map((x) => (x.id === m.id ? { ...x, ...ch } : x)) }), action, m.name);
  const remove = (m) => {
    if (m.id === OWNER.id) return alert("Primary Owner cannot be removed.");
    if (m.id === currentUser.id) return alert("You cannot remove yourself.");
    if (confirm(`Remove ${m.name}?`)) update((s) => ({ team: s.team.filter((x) => x.id !== m.id) }), "Team member removed", m.name);
  };
  return (
    <>
      <form className="ad-card" onSubmit={add}>
        <div className="ad-card-head"><div><span className="ad-kicker">ACCESS CONTROL</span><h2>Add team member</h2><p>Give staff access with role-based permissions.</p></div></div>
        <div className="ad-form-grid">
          <Field label="Full name"><input className="ad-input" value={form.name} onChange={set("name")} /></Field>
          <Field label="Email"><input className="ad-input" type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label="Role"><select className="ad-input" value={form.role} onChange={set("role")}>{roles.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Passcode"><input className="ad-input" type="password" value={form.pass} onChange={set("pass")} /></Field>
        </div>
        <button className="ad-btn ad-btn-primary">＋ Add member</button>
      </form>
      <div className="ad-team-list">
        {data.team.map((m) => (
          <article className="ad-team-member" key={m.id}>
            <div className="ad-team-avatar">{m.name?.charAt(0).toUpperCase() || "U"}</div>
            <div className="ad-team-info"><h3>{m.name}{m.id === currentUser.id && <small> You</small>}</h3><span>{m.email}</span></div>
            <Status value={m.active ? "Active" : "Paused"} />
            <div className="ad-team-actions">
              <select className="ad-select" value={m.role} disabled={m.id === OWNER.id} onChange={(e) => patch(m, { role: e.target.value }, "Team role updated")}>{roles.map((r) => <option key={r}>{r}</option>)}</select>
              {m.id !== OWNER.id && <button className="ad-btn ad-btn-light" onClick={() => patch(m, { active: !m.active }, m.active ? "Team access paused" : "Team access restored")}>{m.active ? "Pause" : "Restore"}</button>}
              {m.id !== OWNER.id && <button className="ad-btn ad-btn-danger" onClick={() => remove(m)}>Remove</button>}
            </div>
          </article>
        ))}
      </div>
      <section className="ad-card">
        <div className="ad-card-head"><div><span className="ad-kicker">PERMISSIONS</span><h2>Role permissions</h2></div></div>
        {Object.entries(PERMISSIONS).map(([role, pages]) => (
          <div className="ad-permission-row" key={role}><b>{role}</b><span>{pages.map((p) => NAV.find((x) => x[0] === p)?.[1]).filter(Boolean).join(" · ")}</span></div>
        ))}
      </section>
    </>
  );
}

/* ============================================================
   AUDIT LOG
============================================================ */
function Audit({ data }) {
  const [search, setSearch] = useState("");
  const logs = data.logs.filter((l) => `${l.action} ${l.detail} ${l.who}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <>
      <div className="ad-toolbar"><Search value={search} onChange={setSearch} placeholder="Search activity..." /></div>
      <section className="ad-card">
        {logs.length ? (
          <div className="ad-timeline">
            {logs.map((l) => (
              <div className="ad-log" key={l.id}>
                <div className="ad-log-line"><span /></div>
                <div className="ad-log-content"><div><h3>{l.action}</h3><time>{dateText(l.time)}</time></div><p>{l.detail}</p><small>By {l.who}</small></div>
              </div>
            ))}
          </div>
        ) : <Empty icon="◷" title="No activity found" />}
      </section>
    </>
  );
}

/* ============================================================
   MAIN PANEL
============================================================ */
const TITLES = {
  dashboard: ["Dashboard", "A complete overview of your Ever Style store."],
  orders: ["Orders", "Manage customer orders, payments and fulfilment."],
  products: ["Products", "Manage your product catalog, pricing and images."],
  inventory: ["Inventory", "Track stock quantities and low-stock alerts."],
  categories: ["Categories", "Organize products into categories and sub-categories."],
  customers: ["Customers", "View customer profiles, spending and order history."],
  reviews: ["Reviews", "Moderate and manage customer product reviews."],
  hero: ["Hero & Banners", "Control the promotional content on your storefront."],
  coupons: ["Coupons", "Create and manage promotional discount codes."],
  team: ["Team Access", "Manage staff accounts, roles and permissions."],
  audit: ["Audit Log", "Track important changes made inside the admin panel."],
};
const GROUPS = ["Overview", "Commerce", "Customers", "Marketing", "System"];

function Panel({ products, cats, slides, meId, onBack, logout }) {
  const [data, setData] = useState(() => readData(products, cats, slides));
  const [page, setPage] = useState("dashboard");
  const [menu, setMenu] = useState(false);
  const [warn, setWarn] = useState(false);
  const team = Array.isArray(data?.team) ? data.team : [];
  const me = team.find((x) => String(x.id) === String(meId));
  const allowed = PERMISSIONS[me?.role] || [];

  useEffect(() => {
    if (!me || !me.active) { try { sessionStorage.removeItem(OK); } catch {} logout(); }
  }, [me?.id, me?.active]);
  useEffect(() => { setWarn(!saveStored(data)); }, [data]);

  if (!me || !me.active) return <div className="ad-session-repair"><div className="ad-session-repair-card"><span className="ad-session-spinner" /><b>Restoring admin session...</b></div></div>;

  const cur = allowed.includes(page) ? page : "dashboard";
  const go = (id) => { if (allowed.includes(id)) { setPage(id); setMenu(false); window.scrollTo(0, 0); } };
  const update = (cb, action, detail) => setData((old) => ({ ...old, ...(cb(old) || {}), logs: [logItem(action, detail, me.name), ...(old.logs || [])].slice(0, 500) }));
  const pending = data.orders.filter((x) => x.status === "Pending").length;
  const [title, text] = TITLES[cur];
  const props = { data, update };
  const initial = me.name?.charAt(0).toUpperCase();

  return (
    <div className="ad-shell">
      {menu && <button className="ad-mobile-overlay" onClick={() => setMenu(false)} aria-label="Close menu" />}
      <aside className={`ad-sidebar ${menu ? "ad-sidebar-open" : ""}`}>
        <div className="ad-brand"><div className="ad-brand-mark">ES</div><div><strong>EVER STYLE</strong><span>ADMIN CONSOLE</span></div></div>
        <nav className="ad-nav">
          {GROUPS.map((g) => {
            const items = NAV.filter((x) => x[3] === g && allowed.includes(x[0]));
            if (!items.length) return null;
            return (
              <div className="ad-nav-group" key={g}>
                <span className="ad-nav-title">{g}</span>
                {items.map(([id, label, icon]) => (
                  <button key={id} className={cur === id ? "active" : ""} onClick={() => go(id)}>
                    <span className="ad-nav-icon">{icon}</span><span>{label}</span>
                    {id === "orders" && pending > 0 && <em>{pending}</em>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="ad-sidebar-footer">
          <button className="ad-view-store" onClick={onBack}><span className="ad-view-icon">↗</span><div><b>View storefront</b><small>Open Ever Style</small></div></button>
          <div className="ad-admin-user">
            <div className="ad-admin-avatar">{initial}</div>
            <div><b>{me.name}</b><span>{me.role}</span></div>
            <button title="Sign out" onClick={logout}>↪</button>
          </div>
        </div>
      </aside>
      <main className="ad-main">
        <header className="ad-header">
          <div className="ad-header-left">
            <button className="ad-menu-button" onClick={() => setMenu(true)} aria-label="Open menu">☰</button>
            <div><span className="ad-header-kicker">EVER STYLE / ADMIN</span><h1>{title}</h1><p>{text}</p></div>
          </div>
          <div className="ad-header-right">
            <button className="ad-store-button" onClick={onBack}>View store<span>↗</span></button>
            <div className="ad-header-profile"><div>{initial}</div><span><b>{me.name}</b><small>{me.role}</small></span></div>
          </div>
        </header>
        <div className="ad-content">
          {warn && <div className="ad-warning">Browser storage is full, so your latest change is not saved. Remove some uploaded images.</div>}
          {cur === "dashboard" && <Dashboard data={data} go={go} />}
          {cur === "orders" && <Orders {...props} />}
          {cur === "products" && <Products {...props} />}
          {cur === "inventory" && <Inventory {...props} />}
          {cur === "categories" && <Categories {...props} />}
          {cur === "customers" && <Customers data={data} />}
          {cur === "reviews" && <Reviews {...props} />}
          {cur === "hero" && <Hero {...props} />}
          {cur === "coupons" && <Coupons {...props} />}
          {cur === "team" && <Team {...props} currentUser={me} />}
          {cur === "audit" && <Audit data={data} />}
        </div>
      </main>
    </div>
  );
}

class AdminErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Ever Style admin render error:", error, info); }
  resetAdmin = () => {
    try { sessionStorage.removeItem(OK); localStorage.removeItem(KEY); } catch {}
    window.location.reload();
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="ad-session-repair"><div className="ad-session-repair-card">
        <b>Admin panel needs a reset</b>
        <small>{String(this.state.error?.message || "Unknown admin error")}</small>
        <button type="button" className="ad-btn ad-btn-primary" onClick={this.resetAdmin}>Reset admin & reload</button>
      </div></div>
    );
  }
}

/* ============================================================
   ADMIN (login + shell)
============================================================ */
export default function Admin({ products = [], cats = [], slides = [], onBack = () => {} }) {
  const [meId, setMeId] = useState("");
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const data = repairOwner(readData(products, cats, slides));
    saveStored(data);
    let saved = "";
    try { saved = sessionStorage.getItem(OK) || ""; } catch {}
    const u = data.team.find((x) => String(x.id) === String(saved) && x.active !== false);
    if (u) setMeId(u.id);
    else { try { sessionStorage.removeItem(OK); } catch {} setMeId(""); }
    setReady(true);
  }, []);

  const login = (e) => {
    e.preventDefault();
    const data = repairOwner(readData(products, cats, slides));
    const em = email.trim().toLowerCase();
    const user = em ? data.team.find((x) => String(x.email || "").toLowerCase() === em && x.active) : data.team.find((x) => x.role === "Owner" && x.active);
    if (user && pass === user.pass) {
      try { sessionStorage.setItem(OK, user.id); } catch {}
      data.logs = [logItem("Signed in", "Admin panel opened.", user.name), ...(data.logs || [])].slice(0, 500);
      saveStored(data);
      setMeId(user.id); setPass(""); setError(false);
      return;
    }
    data.logs = [logItem("Failed sign-in", `Attempt for ${em || "owner"}`, "Unknown"), ...(data.logs || [])].slice(0, 500);
    saveStored(data);
    setError(true);
  };
  const logout = () => { try { sessionStorage.removeItem(OK); } catch {} setMeId(""); setEmail(""); setPass(""); };

  return (
    <>
      <style>{ADMIN_CSS}</style>
      {!ready ? (
        <div className="ad-session-repair"><div className="ad-session-repair-card"><span className="ad-session-spinner" /><b>Loading admin...</b></div></div>
      ) : meId ? (
        <AdminErrorBoundary><Panel products={products} cats={cats} slides={slides} meId={meId} onBack={onBack} logout={logout} /></AdminErrorBoundary>
      ) : (
        <div className="ad-login">
          <div className="ad-login-decoration ad-dec-1" /><div className="ad-login-decoration ad-dec-2" />
          <button className="ad-login-back" onClick={onBack}>← Back to store</button>
          <section className="ad-login-panel">
            <div className="ad-login-brand"><div className="ad-login-logo">ES</div><div><strong>EVER STYLE</strong><span>ADMIN CONSOLE</span></div></div>
            <div className="ad-login-copy">
              <span>STORE MANAGEMENT</span>
              <h1>Welcome<br />back.</h1>
              <p>Manage your products, orders, customers and storefront from one beautifully organized workspace.</p>
            </div>
            <div className="ad-login-feature"><div>01</div><span><b>Complete control</b>Products, inventory, orders and marketing.</span></div>
            <div className="ad-login-feature"><div>02</div><span><b>Role-based access</b>Give your team only the pages they need.</span></div>
          </section>
          <section className="ad-login-form-side">
            <form className="ad-login-form" onSubmit={login}>
              <div className="ad-login-form-head"><span>ADMIN ACCESS</span><h2>Sign in to your account</h2><p>Enter your admin credentials to continue.</p></div>
              <Field label="Email address"><input className="ad-input ad-login-input" type="email" placeholder="owner@everstyle.store" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setError(false); }} /></Field>
              <Field label="Passcode">
                <div className="ad-password">
                  <input className={`ad-input ad-login-input ${error ? "error" : ""}`} type={show ? "text" : "password"} placeholder="Enter passcode" autoComplete="current-password" value={pass} onChange={(e) => { setPass(e.target.value); setError(false); }} />
                  <button type="button" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
                </div>
              </Field>
              {error && <div className="ad-login-error">Incorrect email or passcode, or access is paused.</div>}
              <button className="ad-signin"><span>Sign in to admin</span><b>→</b></button>
              <div className="ad-login-hint"><span>Owner access</span><p>Leave the email empty and use the Owner passcode.</p></div>
            </form>
          </section>
          <div className="ad-login-footer">© 2026 Ever Style</div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   CSS — store matched theme
============================================================ */
const ADMIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap');
.ad-shell,.ad-login{--green:#17392B;--green-2:#1F4A38;--green-soft:#E8EFEA;--cream:#F7F3E8;--cream-2:#F5EBD2;--champagne:#E8D4A5;--ink:#17201B;--muted:#758078;--border:#E3E8E3;--danger:#B94B47;font-family:"DM Sans","Hind Siliguri",sans-serif;color:var(--ink);box-sizing:border-box}
.ad-shell *,.ad-login *{box-sizing:border-box}
.ad-shell button,.ad-shell input,.ad-shell select,.ad-shell textarea,.ad-login button,.ad-login input{font:inherit}
.ad-shell h1,.ad-shell h2,.ad-shell h3,.ad-login h1,.ad-login h2,.ad-login h3{font-family:"Bricolage Grotesque","Hind Siliguri",sans-serif}
.ad-shell{min-height:100vh;display:flex;background:#F7F8F5}
.ad-sidebar{width:270px;position:fixed;z-index:60;left:0;top:0;bottom:0;background:var(--green);color:#fff;display:flex;flex-direction:column;overflow:auto;padding:22px 15px 15px}
.ad-brand{min-height:65px;display:flex;align-items:center;gap:12px;padding:0 8px 20px;border-bottom:1px solid rgba(255,255,255,.11)}
.ad-brand-mark{width:43px;height:43px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--cream-2);color:var(--green);font-family:"Bricolage Grotesque",sans-serif;font-size:14px;font-weight:800}
.ad-brand>div:last-child{display:grid;gap:2px}
.ad-brand strong{font-family:"Bricolage Grotesque",sans-serif;font-size:16px;letter-spacing:.12em}
.ad-brand span{font-size:10px;color:#AFC0B7;letter-spacing:.17em}
.ad-nav{flex:1;padding:21px 0}
.ad-nav-group{margin-bottom:22px}
.ad-nav-title{display:block;padding:0 12px 8px;color:#779285;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase}
.ad-nav button{width:100%;min-height:44px;border:0;padding:0 12px;border-radius:12px;display:flex;align-items:center;gap:11px;background:transparent;color:#B9C8C0;cursor:pointer;text-align:left;font-size:14px;transition:.2s}
.ad-nav button:hover{background:rgba(255,255,255,.06);color:#fff}
.ad-nav button.active{background:var(--cream-2);color:var(--green);font-weight:700}
.ad-nav-icon{width:21px;text-align:center;font-size:16px}
.ad-nav button em{margin-left:auto;min-width:22px;height:22px;padding:0 6px;border-radius:20px;display:grid;place-items:center;background:#D96D60;color:#fff;font-size:11px;font-style:normal}
.ad-sidebar-footer{padding-top:13px;border-top:1px solid rgba(255,255,255,.1)}
.ad-view-store{width:100%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;border-radius:13px;padding:11px;display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left}
.ad-view-icon{width:35px;height:35px;border-radius:10px;background:var(--cream-2);color:var(--green);display:grid;place-items:center;font-size:15px}
.ad-view-store div{display:grid;gap:2px}
.ad-view-store b{font-size:13px}
.ad-view-store small{font-size:11px;color:#91A79B}
.ad-admin-user{display:flex;align-items:center;gap:9px;padding:13px 7px 2px}
.ad-admin-avatar{width:38px;height:38px;flex:none;border-radius:50%;display:grid;place-items:center;background:#285342;color:var(--cream-2);border:1px solid rgba(255,255,255,.12);font-weight:700;font-size:13px}
.ad-admin-user>div:nth-child(2){min-width:0;flex:1;display:grid}
.ad-admin-user b{font-size:13px}
.ad-admin-user span{color:#8EA598;font-size:11px}
.ad-admin-user>button{border:0;background:transparent;color:#9BAFA4;font-size:18px;cursor:pointer}
.ad-main{min-height:100vh;width:calc(100% - 270px);margin-left:270px;min-width:0}
.ad-header{min-height:92px;padding:17px 30px;display:flex;justify-content:space-between;align-items:center;gap:20px;background:rgba(255,255,255,.96);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:30;backdrop-filter:blur(15px)}
.ad-header-left{display:flex;align-items:center;gap:13px}
.ad-header-kicker{display:block;margin-bottom:2px;color:#9AA39C;font-size:10px;font-weight:700;letter-spacing:.14em}
.ad-header h1{margin:0;color:var(--green);font-size:24px;line-height:1.1;letter-spacing:-.035em}
.ad-header p{margin:5px 0 0;color:#89928C;font-size:13px}
.ad-header-right{display:flex;align-items:center;gap:13px}
.ad-store-button{min-height:40px;padding:0 14px;border:1px solid #DCE3DD;border-radius:10px;display:flex;align-items:center;gap:10px;background:#fff;color:var(--green);cursor:pointer;font-size:13px;font-weight:700}
.ad-header-profile{padding-left:13px;border-left:1px solid var(--border);display:flex;align-items:center;gap:8px}
.ad-header-profile>div{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--green);color:var(--cream-2);font-size:12px;font-weight:700}
.ad-header-profile>span{display:grid}
.ad-header-profile b{font-size:13px}
.ad-header-profile small{color:#939C96;font-size:11px}
.ad-menu-button{display:none;width:42px;height:42px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--green);cursor:pointer;font-size:18px}
.ad-content{width:min(1500px,100%);margin:auto;padding:28px}
.ad-stack{display:grid;gap:18px}
.ad-card{margin:0 0 18px;padding:20px;background:#fff;border:1px solid var(--border);border-radius:18px;box-shadow:0 3px 15px rgba(23,57,43,.025)}
.ad-stack .ad-card{margin:0}
.ad-no-padding{padding:0;overflow:hidden}
.ad-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:18px}
.ad-card-head h2{margin:3px 0 0;color:var(--green);font-size:18px;letter-spacing:-.02em}
.ad-card-head p{margin:4px 0 0;color:var(--muted);font-size:13px}
.ad-kicker{color:#9B8B64;font-size:10px;font-weight:700;letter-spacing:.14em}
.ad-pill{padding:6px 11px;border-radius:30px;background:var(--cream);color:#88774F;font-size:12px}
.ad-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}
.ad-stat{min-height:160px;padding:18px;border:1px solid var(--border);border-radius:17px;background:#fff;text-align:left;cursor:pointer;transition:.2s}
.ad-stat:hover{transform:translateY(-3px);border-color:#CAD7CE;box-shadow:0 13px 35px rgba(23,57,43,.07)}
.ad-stat-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.ad-stat-icon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--green-soft);color:var(--green);font-size:16px;font-weight:700}
.ad-stat-arrow{color:#A8B1AB}
.ad-stat strong{display:block;color:var(--green);font-family:"Bricolage Grotesque",sans-serif;font-size:26px;letter-spacing:-.04em}
.ad-stat h3{margin:6px 0 3px;color:#344239;font-size:14px}
.ad-stat p{margin:0;color:#9AA29D;font-size:12px}
.ad-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,.75fr);gap:18px}
.ad-chart{height:240px;display:flex;align-items:flex-end;gap:14px;padding-top:15px}
.ad-chart-item{flex:1;height:100%;display:flex;flex-direction:column;align-items:center;gap:8px}
.ad-chart-space{width:100%;flex:1;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #EBEFEB}
.ad-chart-bar{width:min(42px,72%);min-height:4px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#285A45,#17392B)}
.ad-chart-item>span{color:#969F99;font-size:11px}
.ad-overview-list{display:grid}
.ad-overview-list button{min-height:56px;border:0;border-bottom:1px solid #EEF1EE;background:transparent;display:flex;align-items:center;justify-content:space-between;cursor:pointer;color:var(--green)}
.ad-overview-list button:last-child{border:0}
.ad-overview-list button>span{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600}
.ad-overview-list i{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--cream);color:#8E7B4D;font-style:normal}
.ad-overview-list b{font-size:15px}
.ad-table-wrap{width:100%;overflow:auto}
.ad-table{width:100%;min-width:720px;border-collapse:collapse}
.ad-table th{padding:12px 16px;background:#FAFBF8;border-bottom:1px solid var(--border);color:#929C95;text-align:left;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.ad-table td{padding:14px 16px;border-bottom:1px solid #EEF1EE;color:#647068;font-size:13px}
.ad-table tbody tr:last-child td{border-bottom:0}
.ad-table tbody tr:hover{background:#FCFDFB}
.ad-table td b{color:#28372E;font-size:13px}
.ad-table td small{display:block;margin-top:3px;color:#9BA39E;font-size:11px}
.ad-status{width:max-content;padding:5px 9px;border-radius:30px;display:inline-flex;align-items:center;gap:5px;background:#F0F2F0;color:#69736C;font-size:11px;font-weight:700;white-space:nowrap}
.ad-status i{width:6px;height:6px;border-radius:50%;background:currentColor}
.ad-active,.ad-approved,.ad-delivered,.ad-in-stock{color:#397459;background:#EAF4ED}
.ad-pending,.ad-low-stock{color:#9A6A24;background:#FFF5E3}
.ad-processing{color:#47709A;background:#EDF4FA}
.ad-shipped{color:#765F9A;background:#F2EEFA}
.ad-cancelled,.ad-rejected,.ad-out-of-stock{color:#A94A47;background:#FBEDEC}
.ad-paused{color:#7E7663;background:#F3F0E8}
.ad-toolbar{margin-bottom:15px;display:flex;align-items:center;gap:9px}
.ad-search{position:relative;flex:1;max-width:480px}
.ad-search>span{position:absolute;z-index:2;left:13px;top:50%;transform:translateY(-50%);color:#909B94;font-size:16px}
.ad-search input{width:100%;min-height:44px;padding:0 13px 0 38px;border:1px solid var(--border);border-radius:11px;outline:0;background:#fff;color:var(--ink);font-size:14px}
.ad-input,.ad-select{min-height:44px;width:100%;padding:9px 12px;border:1px solid #DDE4DE;border-radius:10px;outline:0;background:#fff;color:#25352B;font-size:14px}
.ad-select{width:auto;min-width:135px}
.ad-input:focus,.ad-select:focus,.ad-search input:focus{border-color:#8AA193;box-shadow:0 0 0 3px rgba(23,57,43,.06)}
textarea.ad-input{resize:vertical}
.ad-field{display:grid;gap:6px}
.ad-field>span{color:#58675E;font-size:12px;font-weight:600}
.ad-btn{min-height:42px;padding:0 15px;border:1px solid transparent;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;white-space:nowrap}
.ad-btn-primary{background:var(--green);color:var(--cream-2);box-shadow:0 6px 15px rgba(23,57,43,.12)}
.ad-btn-primary:hover{background:var(--green-2)}
.ad-btn-light{background:#fff;color:var(--green);border-color:#DDE4DE}
.ad-btn-danger{background:#fff;color:var(--danger);border-color:#EED9D7}
.ad-link{border:0;background:transparent;color:#6B796F;font-size:13px;font-weight:700;cursor:pointer}
.ad-round-btn{width:36px;height:36px;border:1px solid var(--border);border-radius:9px;background:#fff;color:var(--green);cursor:pointer}
.ad-round-btn.danger{color:var(--danger)}
.ad-modal-backdrop{position:fixed;z-index:150;inset:0;padding:20px;display:grid;place-items:center;background:rgba(9,28,20,.58);backdrop-filter:blur(6px)}
.ad-modal{width:min(580px,100%);max-height:92vh;overflow:auto;background:#FAFBF8;border-radius:20px;box-shadow:0 30px 100px rgba(0,0,0,.25);color:var(--ink);font-family:"DM Sans","Hind Siliguri",sans-serif}
.ad-modal *{box-sizing:border-box}
.ad-modal-wide{width:min(960px,100%)}
.ad-modal-head{position:sticky;z-index:5;top:0;padding:19px 22px;background:rgba(255,255,255,.96);border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:15px;backdrop-filter:blur(15px)}
.ad-modal-head>div>span{color:#9B8B64;font-size:10px;font-weight:700;letter-spacing:.13em}
.ad-modal-head h2{margin:4px 0 0;color:var(--green);font-size:20px;font-family:"Bricolage Grotesque","Hind Siliguri",sans-serif}
.ad-modal-head p{margin:4px 0 0;color:#8B958E;font-size:13px}
.ad-modal-head>button{width:38px;height:38px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--green);cursor:pointer;font-size:20px}
.ad-modal-content{padding:22px}
.ad-modal-actions{padding-top:18px;margin-top:20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px}
.ad-summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:17px}
.ad-summary-grid>div{min-height:72px;padding:12px;border:1px solid var(--border);border-radius:12px;background:#fff;display:grid;align-content:center;gap:4px}
.ad-summary-grid span{color:#929C95;font-size:11px}
.ad-summary-grid b{color:var(--green);font-size:13px}
.ad-two-col{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.ad-inner-card{padding:15px;margin-bottom:12px;border:1px solid var(--border);border-radius:14px;background:#fff}
.ad-inner-card h3{margin:0 0 12px;color:var(--green);font-size:15px}
.ad-line{min-height:48px;border-bottom:1px solid #EEF1EE;display:flex;align-items:center;justify-content:space-between;gap:12px}
.ad-line:last-child{border-bottom:0}
.ad-line>div{display:grid;gap:2px}
.ad-line b{color:#314038;font-size:13px}
.ad-line span{color:#929B95;font-size:11px}
.ad-line-right{justify-items:end}
.ad-item-line>div{flex:1;min-width:0}
.ad-thumb{width:54px;height:54px;border-radius:10px;object-fit:cover;background:var(--cream);flex:none;display:grid;place-items:center;color:#9A8B65;overflow:hidden}
.ad-info-row{padding:8px 0;display:grid;gap:3px}
.ad-info-row span{color:#909A93;font-size:11px}
.ad-info-row b{color:#35433B;font-size:13px}
.ad-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.ad-product-card{overflow:hidden;background:#fff;border:1px solid var(--border);border-radius:17px;transition:.2s}
.ad-product-card:hover{transform:translateY(-2px);box-shadow:0 13px 35px rgba(23,57,43,.07)}
.ad-product-photo{position:relative;aspect-ratio:4/3;overflow:hidden;background:var(--cream)}
.ad-product-photo img{width:100%;height:100%;object-fit:cover;display:block}
.ad-photo-placeholder{width:100%;height:100%;display:grid;place-items:center;color:#A59C84;font-size:35px}
.ad-live,.ad-product-tag{position:absolute;top:10px;padding:5px 9px;border-radius:30px;background:rgba(255,255,255,.94);box-shadow:0 3px 13px rgba(0,0,0,.08);font-size:11px;font-weight:700}
.ad-live{left:10px;color:#397459}
.ad-live.hidden{color:#A34D49}
.ad-product-tag{right:10px;color:#816E42}
.ad-product-info{padding:15px}
.ad-product-category{color:#98875D;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em}
.ad-product-info h3{margin:5px 0 2px;color:var(--green);font-size:16px}
.ad-product-info>p{margin:0;color:#9BA39D;font-size:11px}
.ad-product-data{margin:14px 0;padding:11px 0;border-top:1px solid #EEF1EE;border-bottom:1px solid #EEF1EE;display:grid;grid-template-columns:1fr .7fr 1.3fr;gap:8px}
.ad-product-data>div{min-width:0;display:grid;gap:3px}
.ad-product-data>div>span{color:#9AA29D;font-size:10px}
.ad-product-data b{color:#35443A;font-size:13px}
.ad-product-buttons{display:flex;gap:6px}
.ad-product-buttons .ad-btn{flex:1}
.ad-icon-action{width:42px;min-height:42px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--green);cursor:pointer}
.ad-icon-action.danger{color:var(--danger)}
.ad-product-editor{display:grid;gap:14px}
.ad-form-section{padding:17px;border:1px solid var(--border);border-radius:15px;background:#fff}
.ad-form-section-title{margin-bottom:16px;display:flex;align-items:flex-start;gap:10px}
.ad-form-section-title>span{width:32px;height:32px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--cream-2);color:var(--green);font-size:11px;font-weight:700}
.ad-form-section-title h3{margin:0;color:var(--green);font-size:15px}
.ad-form-section-title p{margin:3px 0 0;color:#929C95;font-size:12px}
.ad-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px}
.ad-visibility{min-height:64px;margin-top:13px;padding:11px 13px;border-radius:12px;background:#F7F8F5;display:flex;align-items:center;justify-content:space-between;gap:15px}
.ad-visibility>div{display:grid;gap:3px}
.ad-visibility b{color:#35443A;font-size:13px}
.ad-visibility span{color:#929B95;font-size:11px}
.ad-toggle{width:44px;height:24px;padding:3px;border:0;border-radius:30px;background:#CCD4CF;cursor:pointer;transition:.2s;flex:none}
.ad-toggle span{display:block;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s}
.ad-toggle.on{background:var(--green)}
.ad-toggle.on span{transform:translateX(20px)}
.ad-image-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.ad-product-image,.ad-image-upload{position:relative;aspect-ratio:1;overflow:hidden;border-radius:12px}
.ad-product-image{border:1px solid var(--border)}
.ad-product-image img{width:100%;height:100%;object-fit:cover}
.ad-image-upload{border:1px dashed #B9C8BE;background:#F9FAF7;color:#75857B;display:grid;place-items:center;align-content:center;gap:3px;cursor:pointer}
.ad-image-upload>div{color:var(--green);font-size:22px}
.ad-image-upload b{font-size:12px}
.ad-image-upload span{font-size:10px;color:#A0A8A2}
.ad-main-image{position:absolute;left:6px;bottom:6px;padding:4px 8px;border-radius:20px;background:var(--green);color:var(--cream-2);font-size:10px}
.ad-remove-image,.ad-make-main{position:absolute;width:26px;height:26px;border:0;border-radius:50%;background:rgba(23,57,43,.9);color:#fff;cursor:pointer}
.ad-remove-image{top:6px;right:6px}
.ad-make-main{bottom:6px;left:6px}
.ad-mini-stats{margin-bottom:15px;display:grid;grid-template-columns:repeat(3,1fr);gap:11px}
.ad-mini-stats>div{min-height:90px;padding:15px;border:1px solid var(--border);border-radius:15px;background:#fff;display:grid;align-content:center;gap:5px}
.ad-mini-stats span{color:#909A93;font-size:12px}
.ad-mini-stats b{color:var(--green);font-family:"Bricolage Grotesque",sans-serif;font-size:22px}
.ad-stepper{width:max-content;padding:3px;border:1px solid var(--border);border-radius:9px;display:flex;align-items:center;gap:6px}
.ad-stepper button{width:30px;height:30px;border:0;border-radius:6px;background:var(--green-soft);color:var(--green);cursor:pointer}
.ad-stepper b{min-width:25px;text-align:center}
.ad-number{width:76px;height:36px;padding:0 8px;border:1px solid var(--border);border-radius:8px;outline:0;font-size:13px}
.ad-table-product{display:flex;align-items:center;gap:9px}
.ad-table-product img,.ad-table-product>span{width:40px;height:40px;flex:none;border-radius:9px}
.ad-table-product img{object-fit:cover}
.ad-table-product>span{background:var(--cream);color:#9A8B65;display:grid;place-items:center}
.ad-table-product>div{display:grid}
.ad-create-category{margin-bottom:15px;padding:18px;border:1px solid var(--border);border-radius:17px;background:#fff;display:grid;grid-template-columns:1fr minmax(220px,360px) auto;align-items:end;gap:12px}
.ad-create-category h2{margin:4px 0 2px;color:var(--green);font-size:17px}
.ad-create-category p{margin:0;color:#909A93;font-size:12px}
.ad-category-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.ad-subcategories{min-height:55px;display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px;margin-bottom:12px}
.ad-subcategories>span{padding:5px 6px 5px 10px;border:1px solid var(--border);border-radius:30px;display:flex;align-items:center;gap:6px;color:#5F6D64;font-size:12px}
.ad-subcategories button{width:20px;height:20px;border:0;border-radius:50%;background:#EEF1EE;color:#6F7A73;cursor:pointer}
.ad-inline-form{display:flex;gap:7px}
.ad-customer-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}
.ad-customer{position:relative;padding:16px;border:1px solid var(--border);border-radius:16px;background:#fff;cursor:pointer;text-align:left;transition:.2s}
.ad-customer:hover{transform:translateY(-2px);border-color:#CAD7CE}
.ad-customer-avatar{width:44px;height:44px;margin-bottom:11px;border-radius:14px;background:var(--green);color:var(--cream-2);display:grid;place-items:center;font-family:"Bricolage Grotesque",sans-serif;font-weight:700}
.ad-customer-main h3{margin:0;color:var(--green);font-size:15px}
.ad-customer-main span{display:block;margin-top:3px;color:#949D97;font-size:12px}
.ad-customer-stats{margin-top:13px;padding-top:11px;border-top:1px solid #EEF1EE;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ad-customer-stats>div{display:grid;gap:2px}
.ad-customer-stats b{color:#3C4A41;font-size:13px}
.ad-customer-stats span{color:#9BA39E;font-size:10px}
.ad-customer-arrow{position:absolute;right:15px;top:15px;color:#9BA69F}
.ad-tabs{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px}
.ad-tabs button{min-height:38px;padding:0 14px;border:1px solid var(--border);border-radius:9px;background:#fff;color:#748078;cursor:pointer;font-size:12px}
.ad-tabs button.active{border-color:var(--green);background:var(--green);color:var(--cream-2)}
.ad-review-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px}
.ad-review-card{padding:17px;border:1px solid var(--border);border-radius:16px;background:#fff}
.ad-review-head{display:flex;align-items:center;gap:9px}
.ad-review-avatar{width:38px;height:38px;flex:none;border-radius:50%;background:var(--green-soft);color:var(--green);display:grid;place-items:center;font-size:13px;font-weight:700}
.ad-review-head>div:nth-child(2){flex:1;display:grid;gap:2px}
.ad-review-head h3{margin:0;color:#35433B;font-size:14px}
.ad-review-head span{color:#9BA39E;font-size:11px}
.ad-stars{margin:13px 0 8px;font-size:14px;letter-spacing:1px}
.ad-stars b{color:#C6A45B}
.ad-stars span{color:#E3E6E3}
.ad-review-product{color:#6D796F;font-size:12px;font-weight:700}
.ad-review-card>p{min-height:42px;color:#657168;font-size:13px;line-height:1.6}
.ad-review-actions{display:flex;gap:6px;flex-wrap:wrap}
.ad-section-intro{margin-bottom:15px;padding:18px 20px;border-radius:17px;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:20px}
.ad-section-intro h2{margin:4px 0 2px;color:var(--cream-2);font-size:19px}
.ad-section-intro p{margin:0;color:#A9BBB0;font-size:12px}
.ad-section-intro .ad-btn-primary{background:var(--cream-2);color:var(--green)}
.ad-hero-card{margin-bottom:14px;overflow:hidden;border:1px solid var(--border);border-radius:18px;background:#fff;display:grid;grid-template-columns:minmax(300px,.85fr) 1.15fr}
.ad-hero-preview{position:relative;min-height:310px;background:var(--cream)}
.ad-hero-preview>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ad-hero-placeholder{width:100%;height:100%;min-height:310px;display:grid;place-items:center;align-content:center;gap:3px;color:#8E8264}
.ad-hero-placeholder>span{font-size:30px}
.ad-hero-placeholder b{font-size:13px}
.ad-hero-placeholder small{font-size:11px}
.ad-upload-banner{position:absolute;left:13px;bottom:13px;padding:9px 12px;border-radius:9px;background:rgba(255,255,255,.95);color:var(--green);box-shadow:0 5px 18px rgba(0,0,0,.1);font-size:12px;font-weight:700;cursor:pointer}
.ad-banner-number{position:absolute;right:13px;top:13px;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(23,57,43,.9);color:var(--cream-2);font-size:11px;font-weight:700}
.ad-hero-form{padding:20px}
.ad-small-actions{display:flex;gap:5px}
.ad-small-actions button{width:34px;height:34px;border:1px solid var(--border);border-radius:8px;background:#fff;color:var(--green);cursor:pointer}
.ad-small-actions button.danger{color:var(--danger)}
.ad-small-actions button:disabled{opacity:.35;cursor:not-allowed}
.ad-coupon-form{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
.uppercase{text-transform:uppercase}
.ad-coupon-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px}
.ad-coupon{min-height:220px;overflow:hidden;display:flex;border:1px solid var(--border);border-radius:17px;background:#fff}
.ad-coupon-strip{width:73px;padding:14px 6px;background:var(--green);color:var(--cream-2);display:flex;flex-direction:column;justify-content:space-between;align-items:center}
.ad-coupon-strip span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;letter-spacing:.17em}
.ad-coupon-strip b{font-size:25px}
.ad-coupon-main{flex:1;padding:17px;min-width:0}
.ad-discount{display:block;margin:15px 0;color:var(--green);font-family:"Bricolage Grotesque",sans-serif;font-size:26px;letter-spacing:-.04em}
.ad-coupon-details{margin-bottom:13px;display:grid;gap:4px;color:#8C968F;font-size:12px}
.ad-row-actions{display:flex;gap:6px}
.ad-team-list{display:grid;gap:9px;margin-bottom:17px}
.ad-team-member{padding:13px;border:1px solid var(--border);border-radius:15px;background:#fff;display:flex;align-items:center;gap:11px}
.ad-team-avatar{width:44px;height:44px;flex:none;border-radius:13px;display:grid;place-items:center;background:var(--green);color:var(--cream-2);font-weight:700}
.ad-team-info{flex:1;display:grid;gap:2px;min-width:0}
.ad-team-info h3{margin:0;color:#35443A;font-size:14px}
.ad-team-info h3 small{color:#A0A8A2;font-size:11px;font-weight:400}
.ad-team-info span{color:#929C95;font-size:12px}
.ad-team-actions{display:flex;align-items:center;gap:6px}
.ad-permission-row{padding:10px 0;border-bottom:1px solid #EEF1EE;display:grid;grid-template-columns:100px 1fr;gap:12px}
.ad-permission-row:last-child{border:0}
.ad-permission-row b{color:var(--green);font-size:13px}
.ad-permission-row span{color:#88938C;font-size:12px}
.ad-log{min-height:72px;display:grid;grid-template-columns:18px 1fr;gap:8px}
.ad-log-line{position:relative;display:flex;justify-content:center}
.ad-log-line:after{content:"";position:absolute;top:15px;bottom:0;width:1px;background:#E0E6E1}
.ad-log:last-child .ad-log-line:after{display:none}
.ad-log-line span{position:relative;z-index:2;width:10px;height:10px;margin-top:4px;border:3px solid var(--green);border-radius:50%;background:#fff}
.ad-log-content{padding-bottom:17px}
.ad-log-content>div{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap}
.ad-log-content h3{margin:0;color:#35443A;font-size:14px}
.ad-log-content time{color:#9CA49F;font-size:11px}
.ad-log-content p{margin:4px 0;color:#69756D;font-size:13px}
.ad-log-content small{color:#A0A7A2;font-size:11px}
.ad-empty{min-height:210px;padding:30px 15px;display:grid;justify-items:center;align-content:center;text-align:center}
.ad-empty>div{width:50px;height:50px;border-radius:50%;display:grid;place-items:center;background:var(--cream);color:#9B8B65;font-size:20px}
.ad-empty h3{margin:10px 0 3px;color:var(--green);font-size:15px}
.ad-empty p,.ad-muted{margin:0;color:#929C95;font-size:13px}
.ad-warning{margin-bottom:14px;padding:11px 13px;border:1px solid #E8CFC9;border-radius:11px;background:#FFF3EF;color:#9A5148;font-size:13px}
.ad-login{position:relative;min-height:100vh;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;background:#F8F7F1}
.ad-login-decoration{position:absolute;pointer-events:none;border-radius:50%}
.ad-dec-1{width:420px;height:420px;left:-170px;bottom:-180px;border:1px solid rgba(232,212,165,.15)}
.ad-dec-2{width:260px;height:260px;left:31%;top:-150px;border:1px solid rgba(232,212,165,.12)}
.ad-login-back{position:absolute;z-index:5;top:25px;right:28px;border:0;background:transparent;color:#718077;cursor:pointer;font-size:13px;font-weight:600}
.ad-login-panel{position:relative;padding:55px clamp(35px,6vw,90px);background:var(--green);color:#fff;display:flex;flex-direction:column;justify-content:center}
.ad-login-brand{position:absolute;left:clamp(35px,6vw,90px);top:35px;display:flex;align-items:center;gap:11px}
.ad-login-logo{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:var(--cream-2);color:var(--green);font-family:"Bricolage Grotesque",sans-serif;font-size:13px;font-weight:800}
.ad-login-brand>div:last-child{display:grid}
.ad-login-brand strong{font-family:"Bricolage Grotesque",sans-serif;font-size:15px;letter-spacing:.12em}
.ad-login-brand span{color:#91A79B;font-size:10px;letter-spacing:.15em}
.ad-login-copy{max-width:500px;margin-bottom:38px}
.ad-login-copy>span{color:var(--champagne);font-size:11px;font-weight:700;letter-spacing:.18em}
.ad-login-copy h1{margin:12px 0 14px;color:var(--cream-2);font-size:clamp(50px,6vw,82px);line-height:.88;letter-spacing:-.065em}
.ad-login-copy p{max-width:420px;margin:0;color:#AFC0B7;font-size:14px;line-height:1.7}
.ad-login-feature{max-width:430px;min-height:63px;border-top:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:13px}
.ad-login-feature>div{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.06);color:var(--champagne);font-size:10px}
.ad-login-feature>span{display:grid;color:#91A79B;font-size:12px}
.ad-login-feature b{margin-bottom:2px;color:#E8EFEA;font-size:13px}
.ad-login-form-side{display:grid;place-items:center;padding:70px 30px}
.ad-login-form{width:min(410px,100%)}
.ad-login-form-head{margin-bottom:28px}
.ad-login-form-head>span{color:#9B8B64;font-size:11px;font-weight:700;letter-spacing:.16em}
.ad-login-form-head h2{margin:8px 0 6px;color:var(--green);font-size:30px;line-height:1.05;letter-spacing:-.04em}
.ad-login-form-head p{margin:0;color:#8B968F;font-size:13px}
.ad-login-form .ad-field{margin-bottom:14px}
.ad-login-input{min-height:50px;background:#fff}
.ad-password{position:relative}
.ad-password .ad-input{padding-right:64px}
.ad-password button{position:absolute;right:10px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#718077;font-size:12px;font-weight:700;cursor:pointer}
.ad-login-input.error{border-color:#C96C63}
.ad-login-error{margin:-3px 0 13px;padding:10px 12px;border-radius:9px;background:#FBECEA;color:#A64E47;font-size:12px}
.ad-signin{width:100%;min-height:52px;margin-top:4px;padding:0 17px;border:0;border-radius:11px;background:var(--green);color:var(--cream-2);display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-size:14px;font-weight:700;box-shadow:0 10px 25px rgba(23,57,43,.13)}
.ad-signin b{font-size:17px}
.ad-login-hint{margin-top:20px;padding-top:16px;border-top:1px solid #E3E7E2}
.ad-login-hint span{color:#718078;font-size:12px;font-weight:700}
.ad-login-hint p{margin:3px 0 0;color:#9AA39D;font-size:12px;line-height:1.5}
.ad-login-footer{position:absolute;right:28px;bottom:20px;color:#A1A9A4;font-size:11px}
.ad-session-repair{min-height:100vh;display:grid;place-items:center;padding:24px;background:#F8F7F1}
.ad-session-repair-card{min-width:260px;padding:28px;border:1px solid var(--border);border-radius:18px;background:#fff;display:grid;justify-items:center;gap:8px;color:var(--green);box-shadow:0 18px 50px rgba(23,57,43,.08);font-family:"DM Sans",sans-serif}
.ad-session-repair-card small{color:#929C95;font-size:12px;text-align:center}
.ad-session-spinner{width:34px;height:34px;margin-bottom:5px;border:3px solid #E6ECE8;border-top-color:var(--green);border-radius:50%;animation:adSpin .75s linear infinite}
@keyframes adSpin{to{transform:rotate(360deg)}}
.ad-mobile-overlay{display:none}
@media(max-width:1200px){.ad-stats{grid-template-columns:repeat(2,1fr)}.ad-dashboard-grid{grid-template-columns:1fr}.ad-product-grid,.ad-customer-grid{grid-template-columns:repeat(2,1fr)}.ad-coupon-grid{grid-template-columns:1fr}}
@media(max-width:950px){.ad-sidebar{transform:translateX(-105%);transition:.25s ease;box-shadow:25px 0 60px rgba(0,0,0,.22)}.ad-sidebar.ad-sidebar-open{transform:translateX(0)}.ad-mobile-overlay{display:block;position:fixed;z-index:55;inset:0;border:0;background:rgba(9,28,20,.5)}.ad-main{width:100%;margin-left:0}.ad-menu-button{display:block}.ad-hero-card{grid-template-columns:1fr}.ad-hero-preview{min-height:280px}.ad-summary-grid{grid-template-columns:repeat(2,1fr)}.ad-login-copy h1{font-size:55px}}
@media(max-width:760px){.ad-content{padding:16px}.ad-header{min-height:76px;padding:13px 16px}.ad-header-kicker,.ad-header p{display:none}.ad-header h1{font-size:20px}.ad-header-profile,.ad-store-button{display:none}.ad-toolbar{align-items:stretch;flex-direction:column}.ad-search{max-width:none}.ad-select{width:100%}.ad-product-grid,.ad-customer-grid,.ad-review-grid,.ad-category-grid,.ad-mini-stats,.ad-form-grid,.ad-coupon-form,.ad-two-col,.ad-create-category{grid-template-columns:1fr}.ad-team-member{flex-wrap:wrap}.ad-team-info{min-width:calc(100% - 60px)}.ad-team-actions{width:100%;flex-wrap:wrap}.ad-team-actions .ad-select{width:100%}.ad-image-grid{grid-template-columns:repeat(2,1fr)}.ad-modal-backdrop{padding:7px}.ad-modal{max-height:96vh;border-radius:15px}.ad-modal-content{padding:15px}.ad-login{display:block}.ad-login-panel{min-height:380px;padding:100px 25px 35px}.ad-login-brand{left:25px;top:25px}.ad-login-copy{margin-bottom:20px}.ad-login-copy h1{font-size:52px}.ad-login-feature{display:none}.ad-login-form-side{padding:35px 20px 60px}.ad-login-back{top:28px;right:20px;color:#C7D2CC}.ad-login-footer{right:20px;bottom:18px}.ad-section-intro{align-items:flex-start;flex-direction:column}}
@media(max-width:480px){.ad-stats{gap:8px}.ad-stat{min-height:140px;padding:13px}.ad-stat strong{font-size:21px}.ad-summary-grid{grid-template-columns:1fr}.ad-product-data{grid-template-columns:1fr 1fr}.ad-coupon-strip{width:55px}}
`;
