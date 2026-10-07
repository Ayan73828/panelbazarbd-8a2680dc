import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Cpu, Gamepad2, Grid2X2, Headphones, Menu, Monitor, Package, Play, Search, ShieldCheck, ShoppingBag, Smartphone, Tag, UserRound, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categories, products, type Product } from "@/lib/catalog";
import banner from "@/assets/store-banner.jpg";

export const Route = createFileRoute("/")({
  component: Storefront,
  head: () => ({ meta: [
    { title: "Panel Bazar BD — Gaming Panels & Digital Products" },
    { name: "description", content: "Explore gaming panels and digital products at Panel Bazar BD. Browse Android, iPhone and PC categories." },
    { property: "og:title", content: "Panel Bazar BD — Gaming & Digital Store" },
    { property: "og:description", content: "Discover the Panel Bazar BD gaming storefront, with Android, iPhone and PC product categories." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});

function Brand() {
  return <a className="brand" href="#" aria-label="Panel Bazar BD home"><span className="brand-symbol"><Gamepad2 size={25} /></span><span><span className="brand-name">PANEL BAZAR <b>BD</b></span><span className="brand-caption">YOUR DIGITAL GAMING STORE</span></span></a>;
}
const categoryIcons = [Grid2X2, Smartphone, Cpu, Smartphone, Monitor, Package];
const slides = [
  { eyebrow: "PREMIUM DIGITAL EXPERIENCE", title: "PANEL BAZAR", accent: "BD", description: "Gaming panels. Digital products. All in one place.", button: "Explore Products" },
  { eyebrow: "ANDROID · iOS · PC", title: "YOUR NEXT", accent: "LEVEL", description: "Explore a collection made for your gaming setup.", button: "Browse Categories" },
  { eyebrow: "THE DIGITAL GAMING STORE", title: "PANEL BAZAR", accent: "COLLECTION", description: "Discover Android, iPhone and PC products.", button: "View Collection" },
] as const;
type ModalState = { kind: "product" | "buy" | "demo"; product: Product } | { kind: "account" | "support" | "guide" };

function Storefront() {
  const [category, setCategory] = useState("All Products");
  const [search, setSearch] = useState("");
  const [slide, setSlide] = useState(0);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const shown = products.filter(p => (category === "All Products" || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase()));
  const current = slides[slide] ?? slides[0];
  const move = (step: number) => setSlide(value => (value + step + slides.length) % slides.length);
  return <>
    <div className="preview-strip">নকশার প্রিভিউ • পণ্য ও দাম নমুনা • কেনাকাটা এখনো চালু নয়</div>
    <header className="store-header"><div className="store-width header-inner">
      <Brand />
      <nav className="header-links" aria-label="Main navigation"><a href="#" className="active">Home</a><a href="#products">Products</a><a href="#why-us">Why Choose Us</a><a href="#support" onClick={e => { e.preventDefault(); setModal({kind:"support"}); }}>Support</a></nav>
      <div className="header-actions"><Button className="desktop-account" variant="outline" onClick={() => setModal({kind:"account"})}><UserRound /> My Account</Button><Button variant="ghost" size="icon" className="mobile-menu" aria-label="My account" onClick={() => setModal({kind:"account"})}><UserRound /></Button><Button variant="ghost" size="icon" className="mobile-menu" aria-label="Toggle menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</Button></div>
    </div>{menu && <nav className="mobile-nav" aria-label="Mobile navigation"><a href="#products" onClick={() => setMenu(false)}>Products</a><a href="#why-us" onClick={() => setMenu(false)}>Why Choose Us</a><a href="#support" onClick={e => {e.preventDefault(); setMenu(false); setModal({kind:"support"});}}>Support</a></nav>}</header>
    <main>
      <div className="store-width banner-wrap"><section className="store-banner" aria-roledescription="carousel" aria-label="Store highlights">
        <img src={banner} width={1536} height={640} className="banner-image" alt="Futuristic armored gaming character with a violet energy sword" fetchPriority="high" />
        <div className="banner-overlay" /><div className="banner-content" aria-live="polite"><div className="banner-eyebrow"><Zap size={13} />{current.eyebrow}</div><h1>{current.title}<br /><span className="brand-gradient">{current.accent}</span></h1><p>{current.description}</p><Button asChild><a href="#products">{current.button}<ArrowRight /></a></Button></div>
        <div className="banner-controls"><Button variant="outline" size="icon" aria-label="Previous banner" onClick={() => move(-1)}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Next banner" onClick={() => move(1)}><ChevronRight /></Button></div>
      </section><div className="banner-pagination">{slides.map((_,i) => <Button key={i} variant="ghost" className="slide-dot" aria-label={`Show banner ${i+1}`} aria-pressed={slide === i} onClick={() => setSlide(i)} />)}</div>
      <div className="reassurance"><span><Zap /> Digital Products</span><span><ShieldCheck /> Wallet Checkout</span><span><Headphones /> Customer Support</span></div></div>
      <section id="products" className="store-width catalog-section">
        <div className="section-topline"><div><h2><ShoppingBag /> Our Products</h2><p>Find the right panel for your next game.</p></div><label className="search-field"><Search /><input aria-label="Search products" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />{search && <Button size="icon" variant="ghost" className="h-5 w-5" aria-label="Clear search" onClick={() => setSearch("")}><X /></Button>}</label></div>
        <div className="category-tabs" role="group" aria-label="Product categories">{categories.map((c,i) => {const Icon = categoryIcons[i] ?? Package; return <Button key={c} variant={category === c ? "default" : "secondary"} aria-pressed={category === c} onClick={() => setCategory(c)}><Icon />{c === "All Products" ? c : c.replace(" PANEL", "") + (c.includes("PANEL") ? " PANEL" : "")}</Button>;})}</div>
        <div className="category-heading"><h3>{category === "All Products" ? "ALL PRODUCTS" : category}</h3><span>{shown.length} products</span></div>
        {shown.length ? <div className="product-grid">{shown.map(p => <ProductCard key={p.id} product={p} onOpen={kind => setModal({kind, product:p})} />)}</div> : <div className="empty-state"><Search size={30} /><h3>No products found</h3><p>Try another name or category.</p><Button variant="outline" onClick={() => {setSearch("");setCategory("All Products");}}>Reset filters</Button></div>}
      </section>
      <section id="why-us" className="trust-section"><div className="store-width"><div className="trust-title"><h2>Made for your digital experience</h2><p>One store. Your favourite platforms.</p></div><div className="trust-grid">
        <div className="trust-item"><span className="trust-icon"><Zap size={23} /></span><h3>DIGITAL PRODUCTS</h3><p>Explore gaming panels and digital items in one collection.</p></div>
        <div className="trust-item"><span className="trust-icon"><Headphones size={23} /></span><h3>CUSTOMER SUPPORT</h3><p>Get help choosing the right product for your device.</p></div>
        <div className="trust-item"><span className="trust-icon"><ShieldCheck size={23} /></span><h3>WALLET CHECKOUT</h3><p>Account and wallet checkout will be available once connected.</p></div>
      </div></div></section>
    </main>
    <footer className="store-footer"><div className="store-width footer-inner"><Brand /><p>© 2026 Panel Bazar BD. All rights reserved.</p><Button variant="link" onClick={() => setModal({kind:"guide"})}><Play size={14} /> How to buy</Button></div></footer>
    <Button className="support-float" onClick={() => setModal({kind:"support"})}><Headphones /> Support</Button>
    {modal && <StoreModal modal={modal} close={() => setModal(null)} />}
  </>;
}
function ProductCard({product:p, onOpen}:{product:Product; onOpen:(kind:"product"|"demo"|"buy")=>void}) {
  const Icon = p.category === "PC PANEL" ? Monitor : Smartphone;
  return <article className="product-card"><div className="product-header"><span className="product-platform-icon"><Icon /></span><div><h4>{p.name}</h4><p>{p.platform}</p></div></div><div className="product-image-wrap"><img className="product-image" src={p.image} alt={`${p.name} sample product artwork`} loading="lazy" width={512} height={512} /><span className="sample-badge">Preview</span></div><div className="product-body"><div className="product-tag"><Tag />{p.category}</div><div className="product-price">From <strong>{p.price}</strong><small>Sample price</small></div><div className="product-actions"><Button variant="secondary" onClick={() => onOpen("demo")}><Play /> Demo</Button><Button onClick={() => onOpen("buy")}><ShoppingBag /> Buy</Button></div></div></article>;
}
function StoreModal({modal,close}:{modal:ModalState;close:()=>void}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow="hidden";
    box.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handler = (e:KeyboardEvent) => {
      if(e.key === "Escape") close();
      if(e.key === "Tab") {
        const items = box.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
        const first=items?.[0], last=items?.[items.length-1];
        if(e.shiftKey && document.activeElement===first && last) {e.preventDefault();last.focus();}
        else if(!e.shiftKey && document.activeElement===last && first) {e.preventDefault();first.focus();}
      }
    };
    document.addEventListener("keydown",handler);
    return () => {document.body.style.overflow=oldOverflow;document.removeEventListener("keydown",handler);if(previous instanceof HTMLElement) previous.focus();};
  },[close]);
  const product = "product" in modal ? modal.product : null;
  const title = product ? product.name : modal.kind === "account" ? "My Account" : modal.kind === "support" ? "Customer Support" : "How to buy";
  return <div className="dialog-backdrop" onClick={e=>{if(e.target===e.currentTarget)close();}}><div ref={box} className="store-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><Button className="dialog-close" size="icon" variant="ghost" aria-label="Close dialog" onClick={close}><X /></Button><h2 id="dialog-title">{title}</h2>
    {product && <><img src={product.image} alt={product.name} className="dialog-product-image" /><div className="product-tag"><Tag />{product.category} · {product.platform}</div><div className="product-price">From <strong>{product.price}</strong><small>Sample price</small></div></>}
    <div className="dialog-notice"><p>{modal.kind === "buy" ? "এটি নমুনা পণ্য। আসল পণ্য, স্টক ও পেমেন্ট সংযুক্ত হলে কেনাকাটা চালু হবে। এখন কোনো টাকা নেওয়া হচ্ছে না।" : modal.kind === "demo" ? "এটি নকশার জন্য তৈরি নমুনা ছবি। আপনার আসল প্রোডাক্টের ডেমো ভিডিও এখনো সংযুক্ত করা হয়নি।" : modal.kind === "account" ? "এই প্রিভিউতে আপনার পুরোনো অ্যাকাউন্ট সংযুক্ত নেই। লগইন ও ওয়ালেট এখনো চালু হয়নি।" : modal.kind === "support" ? "আপনার সাপোর্ট নম্বর বা টেলিগ্রাম লিংক এখনো এই প্রিভিউতে যুক্ত হয়নি।" : "আসল পণ্য ও পেমেন্ট যুক্ত হওয়ার পর অ্যাকাউন্টে লগইন করে পছন্দের পণ্য বেছে ওয়ালেট দিয়ে কিনতে পারবেন। এই প্রিভিউতে কেনাকাটা বন্ধ আছে।"}</p></div><Button className="w-full" variant="secondary" onClick={close}>Close</Button></div></div>;
}
