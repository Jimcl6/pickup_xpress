import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  CreditCard,
  Minus,
  PackageCheck,
  Plus,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Store,
  Trash2,
  UtensilsCrossed,
  WalletCards,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createOrder, getMenu, type CreateOrderPayload } from "./api";
import { demoMenu } from "./demo-menu";
import type { MerchantMenu, OrderResponse, Product } from "./types";

type Stage = "menu" | "checkout" | "confirmed";
type PaymentMethod = CreateOrderPayload["paymentMethod"];

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0
});

const categoryIcons = {
  Drinks: Coffee,
  Food: UtensilsCrossed
};

function ProductCard({
  product,
  quantity,
  onChange
}: {
  product: Product;
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  const isDrink = product.name.includes("Latte") || product.name.includes("Cooler");
  const ItemIcon = isDrink ? Coffee : UtensilsCrossed;

  return (
    <article className="product-card">
      <div className={`product-visual ${isDrink ? "drink" : "food"}`}>
        <ItemIcon size={34} strokeWidth={1.7} aria-hidden="true" />
      </div>
      <div className="product-copy">
        <div>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
        </div>
        <div className="product-footer">
          <strong>{money.format(product.priceCents / 100)}</strong>
          {quantity === 0 ? (
            <button className="add-button" type="button" onClick={() => onChange(1)}>
              <Plus size={17} aria-hidden="true" /> Add
            </button>
          ) : (
            <div className="stepper" aria-label={`${product.name} quantity`}>
              <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => onChange(quantity - 1)}>
                <Minus size={15} />
              </button>
              <span>{quantity}</span>
              <button type="button" aria-label={`Add one ${product.name}`} onClick={() => onChange(quantity + 1)}>
                <Plus size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function App() {
  const [menu, setMenu] = useState<MerchantMenu | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<Stage>("menu");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("gcash");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", note: "", reference: "" });
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderResponse | null>(null);

  const loadMenu = () => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError("");
    getMenu(controller.signal)
      .then((data) => {
        setMenu(data);
        setIsPreview(false);
        setSelectedSlotId(data.pickupSlots[0]?.id ?? "");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMenu(demoMenu);
        setIsPreview(true);
        setSelectedSlotId(demoMenu.pickupSlots[0]?.id ?? "");
        setLoadError(error instanceof Error ? error.message : "Could not reach the ordering service.");
      })
      .finally(() => setIsLoading(false));
    return controller;
  };

  useEffect(() => {
    const controller = loadMenu();
    return () => controller.abort();
  }, []);

  const allProducts = useMemo(
    () => menu?.categories.flatMap((category) => category.products) ?? [],
    [menu]
  );
  const productsById = useMemo(
    () => new Map(allProducts.map((product) => [product.id, product])),
    [allProducts]
  );
  const visibleProducts =
    activeCategory === "all"
      ? allProducts
      : menu?.categories.find((category) => category.id === activeCategory)?.products ?? [];
  const cartItems = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ product: productsById.get(id)!, quantity }))
    .filter((item) => item.product);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartItems.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0
  );
  const selectedSlot = menu?.pickupSlots.find((slot) => slot.id === selectedSlotId);

  const updateQuantity = (id: string, quantity: number) => {
    setCart((current) => ({ ...current, [id]: Math.max(0, Math.min(20, quantity)) }));
  };

  const submitOrder = async () => {
    if (!menu || !selectedSlotId || !customer.name.trim() || !customer.phone.trim()) {
      setSubmitError("Please complete your name, mobile number, and pickup time.");
      return;
    }
    if (paymentMethod !== "cash_on_pickup" && !customer.reference.trim()) {
      setSubmitError("Please enter your payment reference number.");
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);
    try {
      const order = await createOrder({
        merchantSlug: menu.slug,
        pickupSlotId: selectedSlotId,
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          email: customer.email.trim()
        },
        paymentMethod,
        paymentReference: customer.reference.trim(),
        customerNote: customer.note.trim(),
        items: cartItems.map(({ product, quantity }) => ({ productId: product.id, quantity }))
      });
      setConfirmedOrder(order);
      setStage("confirmed");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Your order could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (stage === "confirmed" && confirmedOrder) {
    return (
      <div className="app-shell">
        <Header itemCount={itemCount} />
        <main className="confirmation-page">
          <section className="confirmation-panel">
            <div className="success-mark"><Check size={38} /></div>
            <p className="kicker">Order received</p>
            <h1>You’re all set, {confirmedOrder.customer.name.split(" ")[0]}.</h1>
            <p className="confirmation-lead">Cafe Stellaire has your order. Keep this page handy for pickup.</p>
            <div className="confirmation-number">
              <span>Order number</span>
              <strong>{confirmedOrder.orderNumber}</strong>
            </div>
            <div className="confirmation-grid">
              <div><Clock3 /><span>Pickup time</span><strong>{confirmedOrder.pickupSlot?.label}</strong></div>
              <div><ShoppingBag /><span>Order total</span><strong>{money.format(confirmedOrder.totalCents / 100)}</strong></div>
              <div><PackageCheck /><span>Current status</span><strong>Awaiting confirmation</strong></div>
            </div>
            <div className="status-track" aria-label="Order progress">
              {[
                ["Order received", true],
                ["Preparing", false],
                ["Ready for pickup", false]
              ].map(([label, complete]) => (
                <div className={complete ? "active" : ""} key={String(label)}>
                  <span>{complete ? <Check size={14} /> : null}</span>{label}
                </div>
              ))}
            </div>
            <p className="pickup-note"><Store size={18} /> {confirmedOrder.merchant.pickupInstructions}</p>
            <button className="secondary-button" type="button" onClick={() => window.location.reload()}>
              Start another order
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header itemCount={itemCount} />
      {stage === "menu" ? (
        <main>
          <section className="merchant-hero">
            <img src="/images/cafe-pickup-order.png" alt="Iced latte, calamansi drink, chicken panini, and blueberry muffin ready for pickup" />
            <div className="hero-shade" />
            <div className="hero-content">
              <div className="open-badge"><span /> Open for pickup</div>
              <p>Cafe Stellaire</p>
              <h1>Lunch without the line.</h1>
              <div className="hero-meta"><span><Clock3 size={16} /> Ready in about 15 min</span><span><Store size={16} /> Express counter</span></div>
            </div>
          </section>

          {isPreview && (
            <div className="service-banner" role="status">
              <div><RefreshCw size={18} /><span><strong>Preview mode</strong> The database is offline, so checkout is temporarily unavailable.<small>{loadError}</small></span></div>
              <button type="button" onClick={loadMenu}>Retry</button>
            </div>
          )}

          <div className="ordering-layout">
            <section className="menu-section">
              <div className="section-heading">
                <div><p className="kicker">Order ahead</p><h2>What are you craving?</h2></div>
                <span>{allProducts.length} items</span>
              </div>
              <div className="category-tabs" role="tablist" aria-label="Menu categories">
                <button className={activeCategory === "all" ? "active" : ""} type="button" onClick={() => setActiveCategory("all")}>All</button>
                {menu?.categories.map((category) => {
                  const Icon = categoryIcons[category.name as keyof typeof categoryIcons] ?? UtensilsCrossed;
                  return <button className={activeCategory === category.id ? "active" : ""} type="button" key={category.id} onClick={() => setActiveCategory(category.id)}><Icon size={16} />{category.name}</button>;
                })}
              </div>
              {isLoading ? (
                <div className="menu-loading"><RefreshCw className="spin" /> Loading today’s menu…</div>
              ) : (
                <div className="product-grid">
                  {visibleProducts.map((product) => <ProductCard key={product.id} product={product} quantity={cart[product.id] ?? 0} onChange={(quantity) => updateQuantity(product.id, quantity)} />)}
                </div>
              )}
            </section>
            <CartPanel items={cartItems} total={total} itemCount={itemCount} onChange={updateQuantity} onCheckout={() => { setStage("checkout"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          </div>
        </main>
      ) : (
        <main className="checkout-page">
          <button className="back-button" type="button" onClick={() => setStage("menu")}><ArrowLeft size={18} /> Back to menu</button>
          <div className="checkout-heading"><p className="kicker">Almost there</p><h1>Confirm your pickup</h1><p>Review the time and tell Cafe Stellaire who’s collecting the order.</p></div>
          <div className="checkout-layout">
            <div className="checkout-form">
              <section className="form-section">
                <div className="form-title"><span>1</span><div><h2>Pickup time</h2><p>Available pickup windows</p></div></div>
                <div className="slot-grid">
                  {menu?.pickupSlots.map((slot) => <button className={selectedSlotId === slot.id ? "selected" : ""} type="button" key={slot.id} onClick={() => setSelectedSlotId(slot.id)}><Clock3 size={17} />{slot.label}<small>{slot.remainingCapacity <= 3 ? `${slot.remainingCapacity} left` : "Available"}</small></button>)}
                </div>
              </section>
              <section className="form-section">
                <div className="form-title"><span>2</span><div><h2>Your details</h2><p>We’ll use these for this order</p></div></div>
                <div className="field-grid">
                  <label><span>Full name *</span><input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Juan Dela Cruz" autoComplete="name" /></label>
                  <label><span>Mobile number *</span><input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="0917 123 4567" autoComplete="tel" inputMode="tel" /></label>
                  <label className="wide"><span>Email <small>Optional</small></span><input value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} placeholder="juan@example.com" autoComplete="email" type="email" /></label>
                  <label className="wide"><span>Order note <small>Optional</small></span><textarea value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} placeholder="Special requests for the kitchen" maxLength={240} /></label>
                </div>
              </section>
              <section className="form-section">
                <div className="form-title"><span>3</span><div><h2>Payment</h2><p>Choose how you’ll pay</p></div></div>
                <div className="payment-options">
                  {([
                    ["gcash", Smartphone, "GCash"],
                    ["bank_transfer", CreditCard, "Bank transfer"],
                    ["cash_on_pickup", WalletCards, "Cash on pickup"]
                  ] as const).map(([method, Icon, label]) => <button className={paymentMethod === method ? "selected" : ""} type="button" key={method} onClick={() => setPaymentMethod(method)}><Icon size={20} /><span>{label}</span>{paymentMethod === method && <CheckCircle2 size={17} />}</button>)}
                </div>
                {paymentMethod !== "cash_on_pickup" && <div className="payment-instructions"><strong>{paymentMethod === "gcash" ? `GCash: ${menu?.gcashNumber ?? "Not configured"}` : `${menu?.bankName ?? "Bank"}: ${menu?.bankAccountNumber ?? "Not configured"}`}</strong><span>Account name: {paymentMethod === "gcash" ? menu?.gcashAccountName : menu?.bankAccountName}</span><label><span>Payment reference *</span><input value={customer.reference} onChange={(event) => setCustomer({ ...customer, reference: event.target.value })} placeholder="Enter reference number" /></label></div>}
              </section>
            </div>
            <aside className="checkout-summary">
              <p className="kicker">Your order</p><h2>{itemCount} {itemCount === 1 ? "item" : "items"}</h2>
              <div className="summary-items">{cartItems.map(({ product, quantity }) => <div key={product.id}><span>{quantity}×</span><p>{product.name}</p><strong>{money.format((product.priceCents * quantity) / 100)}</strong></div>)}</div>
              <div className="summary-row"><span>Pickup</span><strong>{selectedSlot?.label ?? "Choose a time"}</strong></div>
              <div className="summary-total"><span>Total</span><strong>{money.format(total / 100)}</strong></div>
              {submitError && <p className="form-error"><X size={17} />{submitError}</p>}
              <button className="primary-button" type="button" disabled={isSubmitting || isPreview} onClick={submitOrder}>{isSubmitting ? "Placing order…" : <>Place order <ArrowRight size={18} /></>}</button>
              <p className="secure-note"><Check size={14} /> Prices are confirmed by the store at checkout.</p>
            </aside>
          </div>
        </main>
      )}
    </div>
  );
}

function Header({ itemCount }: { itemCount: number }) {
  return <header className="topbar"><a className="brand" href="#top" aria-label="Pickup Xpress home"><span>PX</span><div><strong>Pickup Xpress</strong><small>Skip the line. Not the store.</small></div></a><div className="header-status"><Clock3 size={16} /><span>Pickup only</span></div><button className="cart-icon" type="button" aria-label={`${itemCount} items in cart`}><ShoppingBag size={20} /><span>{itemCount}</span></button></header>;
}

function CartPanel({ items, total, itemCount, onChange, onCheckout }: { items: Array<{ product: Product; quantity: number }>; total: number; itemCount: number; onChange: (id: string, quantity: number) => void; onCheckout: () => void }) {
  return <aside className="cart-panel"><div className="cart-title"><div><p className="kicker">Your pickup</p><h2>Order summary</h2></div><ShoppingBag size={22} /></div>{items.length === 0 ? <div className="empty-cart"><ShoppingBag size={30} /><strong>Your bag is empty</strong><p>Add a favorite to get started.</p></div> : <><div className="cart-items">{items.map(({ product, quantity }) => <div className="cart-line" key={product.id}><span className="cart-quantity">{quantity}</span><div><strong>{product.name}</strong><small>{money.format((product.priceCents * quantity) / 100)}</small></div><button type="button" aria-label={`Remove ${product.name}`} onClick={() => onChange(product.id, 0)}><Trash2 size={16} /></button></div>)}</div><div className="cart-total"><span>Total</span><strong>{money.format(total / 100)}</strong></div><button className="primary-button" type="button" onClick={onCheckout}>Choose pickup time <ChevronRight size={18} /></button><p className="cart-caption"><Clock3 size={14} /> No delivery fee. No waiting in line.</p></>}<div className="mobile-cart-bar"><div><span>{itemCount} {itemCount === 1 ? "item" : "items"}</span><strong>{money.format(total / 100)}</strong></div><button type="button" onClick={onCheckout} disabled={itemCount === 0}>Checkout <ArrowRight size={18} /></button></div></aside>;
}

export default App;
