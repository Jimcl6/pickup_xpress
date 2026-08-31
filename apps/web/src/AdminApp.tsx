import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarClock,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  History,
  LogOut,
  Menu as MenuIcon,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  TrendingUp,
  X
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { adminApi, type InventoryInput, type PickupSlotInput, type ProductInput } from "./admin-api";
import type {
  AdminDashboard,
  AdminOrder,
  AdminPickupSlot,
  AdminSession,
  CatalogCategory,
  CatalogProduct,
  InventoryItem,
  OrderStatus
} from "./admin-types";
import "./admin.css";

type AdminView = "dashboard" | "orders" | "catalog" | "inventory" | "slots";

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 });
const unitMoney = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 4 });
const number = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 3 });
const dateTime = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function ErrorBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  if (!message) return null;
  return <div className="admin-error" role="alert"><AlertTriangle size={17} /><span>{message}</span>{onClose && <button type="button" onClick={onClose} aria-label="Dismiss"><X size={16} /></button>}</div>;
}

function LoadingBlock() {
  return <div className="admin-loading"><RefreshCw className="spin" size={22} /> Loading store data</div>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`admin-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
      {children}
    </section>
  </div>;
}

function Login({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [email, setEmail] = useState("merchant@cafestellaire.test");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { onLogin(await adminApi.login(email, password)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Sign in failed."); }
    finally { setBusy(false); }
  };

  return <main className="admin-login">
    <section className="login-panel">
      <div className="admin-brand"><span>PX</span><div><strong>Pickup Xpress</strong><small>Merchant operations</small></div></div>
      <div className="login-heading"><p>Store admin</p><h1>Welcome back</h1><span>Sign in to manage today’s pickup service.</span></div>
      <form onSubmit={submit}>
        <label><span>Email address</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <ErrorBanner message={error} />
        <button className="admin-primary" type="submit" disabled={busy}>{busy ? <RefreshCw className="spin" size={18} /> : <ArrowRight size={18} />}{busy ? "Signing in" : "Sign in"}</button>
      </form>
      <a className="storefront-link" href="/"><Store size={16} /> View customer storefront</a>
    </section>
    <aside className="login-scene"><div><p>Today at a glance</p><strong>Orders, stock, and pickup timing in one place.</strong></div></aside>
  </main>;
}

function DashboardView() {
  const [data, setData] = useState<AdminDashboard>();
  const [error, setError] = useState("");
  const load = useCallback(() => adminApi.dashboard().then(setData).catch((problem) => setError(problem.message)), []);
  useEffect(() => { void load(); }, [load]);
  if (!data) return error ? <ErrorBanner message={error} /> : <LoadingBlock />;
  const maxSales = Math.max(...data.salesByDay.map((day) => day.salesCents), 1);

  return <>
    <PageHeading kicker="Live overview" title="Good day, Cafe Stellaire" action={<button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh dashboard"><RefreshCw size={18} /></button>} />
    <div className="metric-grid">
      <Metric icon={<CircleDollarSign />} label="Sales today" value={money.format(data.today.salesCents / 100)} detail={`${data.today.orderCount} completed ${data.today.orderCount === 1 ? "order" : "orders"}`} tone="gold" />
      <Metric icon={<ShoppingBag />} label="Active orders" value={String((data.statusCounts.pending ?? 0) + (data.statusCounts.accepted ?? 0) + (data.statusCounts.preparing ?? 0) + (data.statusCounts.ready ?? 0))} detail={`${data.statusCounts.ready ?? 0} ready for pickup`} tone="green" />
      <Metric icon={<TrendingUp />} label="7-day gross profit" value={money.format(data.week.grossProfitCents / 100)} detail={`${money.format(data.week.salesCents / 100)} in sales`} tone="ink" />
      <Metric icon={<AlertTriangle />} label="Low stock" value={String(data.lowStock.length)} detail={data.lowStock.length ? "Needs attention" : "Stock levels healthy"} tone="red" />
    </div>
    <div className="dashboard-grid">
      <section className="admin-section sales-chart"><SectionTitle title="Sales performance" subtitle="Completed orders, last 7 days" />
        <div className="bars">{data.salesByDay.map((day) => <div className="bar-column" key={day.date}><span>{day.salesCents ? money.format(day.salesCents / 100) : ""}</span><div><i style={{ height: `${Math.max(4, day.salesCents / maxSales * 100)}%` }} /></div><small>{new Date(day.date).toLocaleDateString("en-PH", { weekday: "short" })}</small></div>)}</div>
      </section>
      <section className="admin-section"><SectionTitle title="Best sellers" subtitle="By completed quantity" />
        <div className="rank-list">{data.bestSellers.length ? data.bestSellers.map((item, index) => <div key={item.productId}><span>{index + 1}</span><p><strong>{item.productName}</strong><small>{item.quantity} sold</small></p><b>{money.format(item.salesCents / 100)}</b></div>) : <Empty text="Completed sales will appear here." />}</div>
      </section>
    </div>
    <div className="dashboard-grid lower">
      <section className="admin-section"><SectionTitle title="Recent orders" subtitle="Latest customer activity" />
        <div className="compact-table">{data.recentOrders.map((order) => <div key={order.id}><StatusDot status={order.status} /><p><strong>{order.orderNumber}</strong><small>{order.customer.name} · {order.pickupSlot?.label ?? "No slot"}</small></p><b>{money.format(order.totalCents / 100)}</b></div>)}</div>
      </section>
      <section className="admin-section"><SectionTitle title="Stock watch" subtitle="At or below reorder level" />
        {data.lowStock.length ? <div className="stock-watch">{data.lowStock.slice(0, 6).map((item) => <div key={item.id}><AlertTriangle size={17} /><p><strong>{item.name}</strong><small>Reorder at {number.format(item.reorderLevel)} {item.unit}</small></p><b>{number.format(item.quantityOnHand)} {item.unit}</b></div>)}</div> : <Empty icon={<CheckCircle2 />} text="No low-stock items." />}
      </section>
    </div>
  </>;
}

function Metric({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <article className={`metric ${tone}`}><span>{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}

function OrdersView() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const load = useCallback(() => adminApi.orders().then(setOrders).catch((problem) => setError(problem.message)), []);
  useEffect(() => { void load(); }, [load]);
  const filtered = orders.filter((order) => (filter === "all" || order.status === filter) && `${order.orderNumber} ${order.customer.name} ${order.customer.phone}`.toLowerCase().includes(search.toLowerCase()));
  const next: Partial<Record<OrderStatus, OrderStatus>> = { pending: "accepted", accepted: "preparing", preparing: "ready", ready: "completed" };
  const labels: Partial<Record<OrderStatus, string>> = { accepted: "Accept order", preparing: "Start preparing", ready: "Mark ready", completed: "Complete pickup" };

  const updateStatus = async (order: AdminOrder, status: OrderStatus) => {
    setBusyId(order.id); setError("");
    try { const updated = await adminApi.updateOrderStatus(order.id, status); setOrders((current) => current.map((item) => item.id === updated.id ? updated : item)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Order update failed."); }
    finally { setBusyId(""); }
  };
  const confirmPayment = async (order: AdminOrder) => {
    setBusyId(order.id); setError("");
    try { const updated = await adminApi.updatePayment(order.id, "confirmed"); setOrders((current) => current.map((item) => item.id === updated.id ? updated : item)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Payment update failed."); }
    finally { setBusyId(""); }
  };

  return <>
    <PageHeading kicker="Kitchen display" title="Orders" action={<button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh orders"><RefreshCw size={18} /></button>} />
    <ErrorBanner message={error} onClose={() => setError("")} />
    <div className="order-toolbar"><div className="segmented">{(["all", "pending", "accepted", "preparing", "ready", "completed", "cancelled"] as const).map((status) => <button className={filter === status ? "active" : ""} type="button" key={status} onClick={() => setFilter(status)}>{status === "all" ? "All" : status}</button>)}</div><label className="admin-search"><Search size={17} /><input placeholder="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    <div className="order-list">{filtered.map((order) => <article className={`order-ticket ${order.status}`} key={order.id}>
      <header><div><StatusDot status={order.status} /><span>{order.status}</span></div><time>{order.pickupSlot?.label ?? "No pickup slot"}</time></header>
      <div className="ticket-heading"><div><p>{order.orderNumber}</p><h2>{order.customer.name}</h2><span>{order.customer.phone}</span></div><strong>{money.format(order.totalCents / 100)}</strong></div>
      <div className="ticket-items">{order.items.map((item) => <div key={item.id}><b>{item.quantity}×</b><span>{item.productName}</span></div>)}</div>
      {order.customerNote && <p className="order-note">“{order.customerNote}”</p>}
      <div className="payment-row"><div><span>{order.paymentMethod.replaceAll("_", " ")}</span><strong className={order.paymentStatus === "confirmed" ? "paid" : ""}>{order.paymentStatus.replaceAll("_", " ")}</strong></div>{order.paymentReference && <small>Ref: {order.paymentReference}</small>}{order.paymentStatus !== "confirmed" && <button type="button" onClick={() => void confirmPayment(order)} disabled={busyId === order.id}><Check size={15} /> {order.paymentMethod === "cash_on_pickup" ? "Cash received" : "Confirm payment"}</button>}</div>
      <footer>{next[order.status] && <button className="admin-primary" type="button" disabled={busyId === order.id} onClick={() => void updateStatus(order, next[order.status]!) }>{busyId === order.id ? <RefreshCw className="spin" size={17} /> : <ChevronRight size={17} />}{labels[next[order.status]!]}</button>}{["pending", "accepted", "preparing"].includes(order.status) && <button className="admin-quiet danger" type="button" disabled={busyId === order.id} onClick={() => void updateStatus(order, "cancelled")}>Cancel</button>}</footer>
    </article>)}</div>
    {!filtered.length && <Empty text="No orders match this view." />}
  </>;
}

const emptyProduct: ProductInput = { categoryId: "", name: "", description: "", priceCents: 0, imageUrl: "", isActive: true };

function CatalogView() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [editing, setEditing] = useState<CatalogProduct | "new" | null>(null);
  const [recipeProduct, setRecipeProduct] = useState<CatalogProduct | null>(null);
  const [editingCategory, setEditingCategory] = useState<CatalogCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { const [catalog, stock] = await Promise.all([adminApi.catalog(), adminApi.inventory()]); setCategories(catalog); setInventory(stock); } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not load menu."); } }, []);
  useEffect(() => { void load(); }, [load]);
  const products = categories.flatMap((category) => category.products.map((product) => ({ ...product, categoryName: category.name })));

  const addCategory = async (event: FormEvent) => {
    event.preventDefault(); if (!categoryName.trim()) return;
    try { await adminApi.createCategory({ name: categoryName, sortOrder: categories.length + 1 }); setCategoryName(""); await load(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Could not add category."); }
  };
  const deleteCategory = async (category: CatalogCategory) => {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    try { await adminApi.deleteCategory(category.id); await load(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Could not delete category."); }
  };

  return <>
    <PageHeading kicker="Menu management" title="Items and categories" action={<button className="admin-primary" type="button" onClick={() => setEditing("new")}><Plus size={17} /> Add item</button>} />
    <ErrorBanner message={error} onClose={() => setError("")} />
    <section className="category-strip"><form onSubmit={addCategory}><input placeholder="New category" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /><button type="submit" title="Add category"><Plus size={18} /></button></form>{categories.map((category) => <span key={category.id}>{category.name}<button type="button" onClick={() => setEditingCategory(category)} aria-label={`Edit ${category.name}`}><Pencil size={12} /></button><button type="button" onClick={() => void deleteCategory(category)} aria-label={`Delete ${category.name}`}><X size={13} /></button></span>)}</section>
    <section className="admin-section catalog-table"><div className="data-header"><span>Item</span><span>Category</span><span>Price</span><span>Recipe cost</span><span>Availability</span><span /></div>{products.map((product) => {
      const cost = product.inventoryRequirements.reduce((sum, requirement) => sum + Number(requirement.quantity) * Number(requirement.inventoryItem.unitCostCents), 0);
      return <div className="data-row" key={product.id}><div className="item-name"><span><Package size={18} /></span><p><strong>{product.name}</strong><small>{product.description || "No description"}</small></p></div><span>{product.categoryName}</span><strong>{money.format(product.priceCents / 100)}</strong><span>{product.inventoryRequirements.length ? money.format(cost / 100) : "Not set"}</span><span className={`availability ${product.isActive ? "active" : "inactive"}`}>{product.isActive ? "Available" : "Hidden"}</span><div className="row-actions"><button type="button" onClick={() => setRecipeProduct(product)} title="Edit recipe"><Boxes size={17} /></button><button type="button" onClick={() => setEditing(product)} title="Edit item"><Pencil size={17} /></button></div></div>;
    })}{!products.length && <Empty text="Add your first menu item." />}</section>
    {editing && <ProductModal product={editing === "new" ? null : editing} categories={categories} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    {editingCategory && <CategoryModal category={editingCategory} onClose={() => setEditingCategory(null)} onSaved={async () => { setEditingCategory(null); await load(); }} />}
    {recipeProduct && <RecipeModal product={recipeProduct} inventory={inventory} onClose={() => setRecipeProduct(null)} onSaved={async () => { setRecipeProduct(null); await load(); }} />}
  </>;
}

function CategoryModal({ category, onClose, onSaved }: { category: CatalogCategory; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(category.name); const [sortOrder, setSortOrder] = useState(category.sortOrder); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await adminApi.updateCategory(category.id, { name, sortOrder }); await onSaved(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save category."); } finally { setBusy(false); } };
  return <Modal title="Edit category" onClose={onClose}><form className="modal-form" onSubmit={submit}><label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label><label><span>Display order</span><input type="number" min="0" max="999" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} required /></label><ErrorBanner message={error} /><ModalActions busy={busy} onClose={onClose} label="Save category" /></form></Modal>;
}

function ProductModal({ product, categories, onClose, onSaved }: { product: CatalogProduct | null; categories: CatalogCategory[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<ProductInput>(product ? { categoryId: product.categoryId, name: product.name, description: product.description ?? "", priceCents: product.priceCents, imageUrl: product.imageUrl ?? "", isActive: product.isActive } : { ...emptyProduct, categoryId: categories[0]?.id ?? "" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { if (product) await adminApi.updateProduct(product.id, form); else await adminApi.createProduct(form); await onSaved(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save item."); } finally { setBusy(false); } };
  return <Modal title={product ? "Edit menu item" : "Add menu item"} onClose={onClose}><form className="modal-form" onSubmit={submit}><label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label><span>Category</span><select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label><span>Price (PHP)</span><input type="number" min="0" step="0.01" value={form.priceCents / 100} onChange={(event) => setForm({ ...form, priceCents: Math.round(Number(event.target.value) * 100) })} required /></label><label><span>Image URL</span><input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></label><label className="full"><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="toggle full"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /><span>Available on customer menu</span></label><ErrorBanner message={error} /><ModalActions busy={busy} onClose={onClose} label="Save item" /></form></Modal>;
}

function RecipeModal({ product, inventory, onClose, onSaved }: { product: CatalogProduct; inventory: InventoryItem[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [recipe, setRecipe] = useState<Record<string, number>>(() => Object.fromEntries(product.inventoryRequirements.map((item) => [item.inventoryItemId, Number(item.quantity)])));
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const cost = inventory.reduce((sum, item) => sum + (recipe[item.id] ?? 0) * item.unitCostCents, 0);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await adminApi.saveRecipe(product.id, Object.entries(recipe).filter(([, quantity]) => quantity > 0).map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }))); await onSaved(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save recipe."); } finally { setBusy(false); } };
  return <Modal title={`${product.name} recipe`} onClose={onClose} wide><form className="modal-form" onSubmit={submit}><div className="recipe-list full">{inventory.filter((item) => item.isActive).map((item) => <label key={item.id}><span><strong>{item.name}</strong><small>{unitMoney.format(item.unitCostCents / 100)} per {item.unit}</small></span><input type="number" min="0" step="0.001" value={recipe[item.id] ?? 0} onChange={(event) => setRecipe({ ...recipe, [item.id]: Number(event.target.value) })} /><b>{item.unit}</b></label>)}</div><div className="recipe-total full"><span>Estimated cost per item</span><strong>{money.format(cost / 100)}</strong></div><ErrorBanner message={error} /><ModalActions busy={busy} onClose={onClose} label="Save recipe" /></form></Modal>;
}

function InventoryView() {
  const [items, setItems] = useState<InventoryItem[]>([]); const [editing, setEditing] = useState<InventoryItem | "new" | null>(null); const [adjusting, setAdjusting] = useState<InventoryItem | null>(null); const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null); const [error, setError] = useState("");
  const load = useCallback(() => adminApi.inventory().then(setItems).catch((problem) => setError(problem.message)), []);
  useEffect(() => { void load(); }, [load]);
  return <><PageHeading kicker="Stock control" title="Inventory" action={<button className="admin-primary" type="button" onClick={() => setEditing("new")}><Plus size={17} /> Add stock item</button>} /><ErrorBanner message={error} onClose={() => setError("")} />
    <section className="admin-section inventory-table"><div className="data-header"><span>Stock item</span><span>On hand</span><span>Reorder level</span><span>Unit cost</span><span>Used by</span><span /></div>{items.map((item) => <div className={`data-row ${item.lowStock ? "low" : ""}`} key={item.id}><div className="item-name"><span>{item.lowStock ? <AlertTriangle size={18} /> : <Boxes size={18} />}</span><p><strong>{item.name}</strong><small>{item.isActive ? "Active" : "Inactive"}</small></p></div><strong>{number.format(item.quantityOnHand)} {item.unit}</strong><span>{number.format(item.reorderLevel)} {item.unit}</span><span>{unitMoney.format(item.unitCostCents / 100)} / {item.unit}</span><span>{item._count?.requirements ?? 0} menu items</span><div className="row-actions"><button type="button" title="Stock history" onClick={() => setHistoryItem(item)}><History size={17} /></button><button type="button" title="Adjust stock" onClick={() => setAdjusting(item)}><Plus size={17} /></button><button type="button" title="Edit stock item" onClick={() => setEditing(item)}><Pencil size={17} /></button></div></div>)}</section>
    {editing && <InventoryModal item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    {adjusting && <AdjustmentModal item={adjusting} onClose={() => setAdjusting(null)} onSaved={async () => { setAdjusting(null); await load(); }} />}
    {historyItem && <HistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />}
  </>;
}

function HistoryModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  return <Modal title={`${item.name} activity`} onClose={onClose}><div className="history-list">{item.movements?.length ? item.movements.map((movement) => <div key={movement.id}><span className={Number(movement.quantityChange) >= 0 ? "positive" : "negative"}>{Number(movement.quantityChange) >= 0 ? "+" : ""}{number.format(Number(movement.quantityChange))} {item.unit}</span><p><strong>{movement.type}</strong><small>{movement.note || "No note"}</small></p><time>{dateTime.format(new Date(movement.createdAt))}</time></div>) : <Empty text="No stock activity recorded yet." />}</div></Modal>;
}

function InventoryModal({ item, onClose, onSaved }: { item: InventoryItem | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<InventoryInput>(item ? { name: item.name, unit: item.unit, quantityOnHand: item.quantityOnHand, reorderLevel: item.reorderLevel, unitCostCents: item.unitCostCents, isActive: item.isActive } : { name: "", unit: "pc", quantityOnHand: 0, reorderLevel: 0, unitCostCents: 0, isActive: true });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { if (item) { const { quantityOnHand: _, ...editable } = form; void _; await adminApi.updateInventory(item.id, editable); } else await adminApi.createInventory(form); await onSaved(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save stock item."); } finally { setBusy(false); } };
  return <Modal title={item ? "Edit stock item" : "Add stock item"} onClose={onClose}><form className="modal-form" onSubmit={submit}><label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label><span>Unit</span><select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option value="pc">Piece</option><option value="g">Gram</option><option value="kg">Kilogram</option><option value="ml">Milliliter</option><option value="L">Liter</option><option value="pack">Pack</option></select></label>{!item && <label><span>Opening quantity</span><input type="number" min="0" step="0.001" value={form.quantityOnHand} onChange={(event) => setForm({ ...form, quantityOnHand: Number(event.target.value) })} /></label>}<label><span>Reorder level</span><input type="number" min="0" step="0.001" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: Number(event.target.value) })} /></label><label><span>Cost per unit (PHP)</span><input type="number" min="0" step="0.0001" value={form.unitCostCents / 100} onChange={(event) => setForm({ ...form, unitCostCents: Number(event.target.value) * 100 })} /></label><label className="toggle full"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /><span>Active inventory item</span></label><ErrorBanner message={error} /><ModalActions busy={busy} onClose={onClose} label="Save item" /></form></Modal>;
}

function AdjustmentModal({ item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<"purchase" | "adjustment">("purchase"); const [quantity, setQuantity] = useState(0); const [cost, setCost] = useState(item.unitCostCents / 100); const [note, setNote] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await adminApi.adjustInventory(item.id, { type, quantityChange: quantity, unitCostCents: type === "purchase" ? cost * 100 : undefined, note }); await onSaved(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not adjust stock."); } finally { setBusy(false); } };
  return <Modal title={`Adjust ${item.name}`} onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="segmented full"><button className={type === "purchase" ? "active" : ""} type="button" onClick={() => setType("purchase")}>Stock purchase</button><button className={type === "adjustment" ? "active" : ""} type="button" onClick={() => setType("adjustment")}>Correction</button></div><label><span>Quantity change ({item.unit})</span><input type="number" step="0.001" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label>{type === "purchase" && <label><span>Unit cost (PHP)</span><input type="number" min="0" step="0.0001" value={cost} onChange={(event) => setCost(Number(event.target.value))} required /></label>}<label className="full"><span>Note</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Supplier delivery or count correction" /></label><p className="stock-result full">New quantity: <strong>{number.format(item.quantityOnHand + quantity)} {item.unit}</strong></p><ErrorBanner message={error} /><ModalActions busy={busy} onClose={onClose} label="Apply adjustment" /></form></Modal>;
}

function SlotsView() {
  const [slots, setSlots] = useState<AdminPickupSlot[]>([]); const [editing, setEditing] = useState<AdminPickupSlot | "new" | null>(null); const [error, setError] = useState("");
  const load = useCallback(() => adminApi.pickupSlots().then(setSlots).catch((problem) => setError(problem.message)), []);
  useEffect(() => { void load(); }, [load]);
  const remove = async (slot: AdminPickupSlot) => { if (!window.confirm(slot._count.orders ? "This slot has orders and will be closed to new customers. Continue?" : "Delete this pickup slot?")) return; try { await adminApi.deletePickupSlot(slot.id); await load(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not remove slot."); } };
  return <><PageHeading kicker="Capacity planning" title="Pickup slots" action={<button className="admin-primary" type="button" onClick={() => setEditing("new")}><Plus size={17} /> Add slot</button>} /><ErrorBanner message={error} onClose={() => setError("")} /><section className="slot-admin-grid">{slots.map((slot) => <article className={!slot.isActive ? "inactive" : ""} key={slot.id}><header><Clock3 size={18} /><span>{new Date(slot.startTime).toLocaleDateString("en-PH", { month: "short", day: "numeric", weekday: "short" })}</span><b>{slot.isActive ? "Open" : "Closed"}</b></header><h2>{slot.label}</h2><p>{dateTime.format(new Date(slot.startTime))} – {new Date(slot.endTime).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</p><div><span><strong>{slot._count.orders}</strong> booked</span><span><strong>{slot.capacity}</strong> capacity</span></div><footer><button type="button" onClick={() => setEditing(slot)}><Pencil size={16} /> Edit</button><button type="button" onClick={() => void remove(slot)}><Trash2 size={16} /> {slot._count.orders ? "Close" : "Delete"}</button></footer></article>)}</section>{!slots.length && <Empty text="No upcoming pickup slots." />}{editing && <SlotModal slot={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}</>;
}

function toLocalInput(date: Date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16); }
function SlotModal({ slot, onClose, onSaved }: { slot: AdminPickupSlot | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const initialStart = slot ? new Date(slot.startTime) : new Date(Date.now() + 24 * 60 * 60 * 1000); const initialEnd = slot ? new Date(slot.endTime) : new Date(initialStart.getTime() + 15 * 60 * 1000);
  const [form, setForm] = useState({ label: slot?.label ?? initialStart.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }), startTime: toLocalInput(initialStart), endTime: toLocalInput(initialEnd), capacity: slot?.capacity ?? 8, isActive: slot?.isActive ?? true }); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); const payload: PickupSlotInput = { ...form, startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString() }; try { if (slot) await adminApi.updatePickupSlot(slot.id, payload); else await adminApi.createPickupSlot(payload); await onSaved(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save slot."); } finally { setBusy(false); } };
  return <Modal title={slot ? "Edit pickup slot" : "Add pickup slot"} onClose={onClose}><form className="modal-form" onSubmit={submit}><label><span>Customer label</span><input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} required /></label><label><span>Capacity</span><input type="number" min="1" max="500" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} required /></label><label><span>Starts</span><input type="datetime-local" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required /></label><label><span>Ends</span><input type="datetime-local" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} required /></label><label className="toggle full"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /><span>Open for customer booking</span></label><ErrorBanner message={error} /><ModalActions busy={busy} onClose={onClose} label="Save slot" /></form></Modal>;
}

function PageHeading({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) { return <header className="page-heading"><div><p>{kicker}</p><h1>{title}</h1></div>{action}</header>; }
function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) { return <header className="section-title"><div><h2>{title}</h2><p>{subtitle}</p></div></header>; }
function StatusDot({ status }: { status: OrderStatus }) { return <i className={`status-dot ${status}`} aria-hidden="true" />; }
function Empty({ text, icon }: { text: string; icon?: ReactNode }) { return <div className="admin-empty">{icon ?? <Package size={24} />}<span>{text}</span></div>; }
function ModalActions({ busy, onClose, label }: { busy: boolean; onClose: () => void; label: string }) { return <footer className="modal-actions full"><button className="admin-quiet" type="button" onClick={onClose}>Cancel</button><button className="admin-primary" type="submit" disabled={busy}>{busy ? <RefreshCw className="spin" size={17} /> : <Check size={17} />}{label}</button></footer>; }

function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>();
  const [view, setView] = useState<AdminView>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { adminApi.me().then(setSession).catch(() => setSession(null)); }, []);
  if (session === undefined) return <div className="admin-boot"><RefreshCw className="spin" /> Opening Pickup Xpress</div>;
  if (!session) return <Login onLogin={setSession} />;
  const nav: Array<[AdminView, ReactNode, string]> = [["dashboard", <BarChart3 />, "Dashboard"], ["orders", <ChefHat />, "Orders"], ["catalog", <MenuIcon />, "Menu"], ["inventory", <Boxes />, "Inventory"], ["slots", <CalendarClock />, "Pickup slots"]];
  const logout = async () => { await adminApi.logout().catch(() => undefined); setSession(null); };
  return <div className="admin-shell">
    <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}><div className="admin-brand"><span>PX</span><div><strong>Pickup Xpress</strong><small>{session.merchant.name}</small></div></div><nav>{nav.map(([id, icon, label]) => <button className={view === id ? "active" : ""} type="button" key={id} onClick={() => { setView(id); setSidebarOpen(false); }}>{icon}<span>{label}</span>{id === "orders" && <i />}</button>)}</nav><div className="sidebar-bottom"><a href="/"><Store size={18} /> Customer store</a><button type="button" onClick={() => void logout()}><LogOut size={18} /> Sign out</button></div></aside>
    {sidebarOpen && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <div className="admin-main"><header className="admin-topbar"><button className="mobile-menu" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><MenuIcon size={21} /></button><div><Clock3 size={16} /><span>{new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}</span></div><div className="admin-user"><span>{session.user.name.slice(0, 1).toUpperCase()}</span><p><strong>{session.user.name}</strong><small>{session.user.role}</small></p></div></header><main className="admin-content">{view === "dashboard" && <DashboardView />}{view === "orders" && <OrdersView />}{view === "catalog" && <CatalogView />}{view === "inventory" && <InventoryView />}{view === "slots" && <SlotsView />}</main></div>
  </div>;
}

export default AdminApp;
