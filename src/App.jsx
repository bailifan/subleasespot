import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://wlvkklpmpzcrrzoorvmk.supabase.co";
const SUPABASE_KEY = "sb_publishable_9OpjrwLBrbCoshz19dQGzQ_SOtPL5Vh";

const db = {
  async getListings(filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/listings?select=*&active=eq.true&expires_at=gt.${new Date().toISOString()}&order=featured.desc,created_at.desc`;
    if (filters.type && filters.type !== "All") url += `&type=eq.${filters.type}`;
    if (filters.city && filters.city !== "All Cities") url += `&city=eq.${encodeURIComponent(filters.city)}`;
    if (filters.maxPrice) url += `&price=lte.${filters.maxPrice}`;
    const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) throw new Error("Failed to load listings");
    return res.json();
  },
  async submitListing(data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to submit listing");
    return true;
  },
  async submitInquiry(data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to submit inquiry");
    return true;
  },
};

// ─── STRIPE CONFIG (add your keys when ready) ─────────────────────────────────
const STRIPE = {
  publishableKey: "pk_live_51RDo39JUf2t1v5EFvu21BeBc0TNCnctAzmjxAIGZJ0doE2Jqi0zGq2twg2iE2i0kxlTuEk34kjrHwEhz93lox3QJ00wPVJGJiw", // paste your Stripe publishable key
  prices: {
    featured: "price_1T8ZSHJUf2t1v5EFZoIP2Jzw", // $99/mo price ID from Stripe dashboard
    broker: "price_1T8ZTRJUf2t1v5EFmDqCNSOc",     // $299/mo price ID from Stripe dashboard
  },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TYPES = ["All", "Office", "Warehouse", "Retail"];
const PRICING_PLANS = [
  { id: "free", name: "Free", price: 0, features: ["1 active listing", "Standard placement", "Email inquiries", "30-day listing"], cta: "List Free", color: "#888" },
  { id: "featured", name: "Featured", price: 99, features: ["3 active listings", "⭐ Gold featured badge", "Priority placement", "90-day listing", "Analytics dashboard"], cta: "Get Featured — $99/mo", color: "#FFD166", popular: true },
  { id: "broker", name: "Broker Pro", price: 299, features: ["Unlimited listings", "✓ Verified broker badge", "Lead notifications", "API access", "White-label inquiries"], cta: "Broker Plan — $299/mo", color: "#7EB8F7" },
];
const fmt$ = (n) => `$${Number(n).toLocaleString()}/mo`;
const fmtSqft = (n) => `${Number(n).toLocaleString()} sqft`;
const inputStyle = { width: "100%", padding: "9px 12px", border: "1.5px solid #e0e0e0", borderRadius: "5px", fontSize: "14px", boxSizing: "border-box", outline: "none", fontFamily: "inherit" };

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
function Tag({ children, variant = "default" }) {
  const s = { featured: { background: "#FFD166", color: "#1a1a2e" }, office: { background: "#E8F4FB", color: "#1560A0" }, warehouse: { background: "#EAF4E8", color: "#2D6B1A" }, retail: { background: "#FBE8E8", color: "#A01515" }, verified: { background: "#E8FBF0", color: "#1A7A3C" }, default: { background: "#f0f0f0", color: "#555" } };
  return <span style={{ ...s[variant] || s.default, padding: "2px 9px", borderRadius: "2px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase" }}>{children}</span>;
}
function Btn({ children, dark, onClick, disabled, style }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: "8px 18px", borderRadius: "5px", fontSize: "13px", cursor: disabled ? "not-allowed" : "pointer", border: dark ? "none" : "1.5px solid #ddd", background: dark ? (disabled ? "#ccc" : "#1a1a2e") : "transparent", color: dark ? "#fff" : "#555", fontFamily: "inherit", fontWeight: dark ? "700" : "600", ...style }}>{children}</button>;
}
function Overlay({ children, onClick }) {
  return <div onClick={onClick} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>{children}</div>;
}
function Modal({ children, onClick, width = "440px" }) {
  return <div onClick={onClick} style={{ background: "#fff", borderRadius: "10px", padding: "32px", maxWidth: width, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }}>{children}</div>;
}
function FieldGroup({ label, children, style }) {
  return <div style={{ marginBottom: "12px", ...style }}><label style={{ fontSize: "11px", fontWeight: "700", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "4px" }}>{label}</label>{children}</div>;
}
function Spinner() {
  return <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><div style={{ width: "32px", height: "32px", border: "3px solid #eee", borderTop: "3px solid #1a1a2e", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
}
function Toast({ msg }) {
  if (!msg) return null;
  return <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#1a1a2e", color: "#FFD166", padding: "12px 24px", borderRadius: "6px", fontSize: "14px", fontWeight: "700", zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>{msg}</div>;
}

// ─── CONTACT MODAL ────────────────────────────────────────────────────────────
function ContactModal({ listing, onClose, toast }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  if (!listing) return null;

  const send = async () => {
    setLoading(true);
    try {
      await db.submitInquiry({ listing_id: listing.id, name: form.name, email: form.email, company: form.company, message: form.message });
      setStep(2);
    } catch {
      toast("❌ Error sending — try again");
    } finally { setLoading(false); }
  };

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        {step === 2 ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "44px" }}>✅</div>
            <h3 style={{ margin: "12px 0 6px", color: "#1a1a2e", fontFamily: "'Playfair Display', serif" }}>Inquiry Sent!</h3>
            <p style={{ color: "#666", fontSize: "14px", margin: "0 0 20px" }}>The lessor typically responds within 24 hours.</p>
            <Btn dark onClick={onClose}>Close</Btn>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: "700", color: "#1a1a2e", marginBottom: "4px" }}>{listing.img} {listing.title}</div>
            <div style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>{listing.city}, {listing.state} · {fmt$(listing.price)}</div>
            {[["Your Name", "name", "Full name"], ["Email", "email", "you@company.com"], ["Company", "company", "Optional"]].map(([label, key, ph]) => (
              <FieldGroup key={key} label={label}><input value={form[key]} onChange={set(key)} placeholder={ph} style={inputStyle} /></FieldGroup>
            ))}
            <FieldGroup label="Message"><textarea value={form.message} onChange={set("message")} rows={3} placeholder="Tell them what you need and your timeline..." style={{ ...inputStyle, resize: "vertical" }} /></FieldGroup>
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <Btn onClick={onClose}>Cancel</Btn>
              <Btn dark disabled={!form.name || !form.email || loading} onClick={send} style={{ flex: 2 }}>{loading ? "Sending..." : "Send Inquiry →"}</Btn>
            </div>
          </>
        )}
      </Modal>
    </Overlay>
  );
}

// ─── SUBMIT MODAL ─────────────────────────────────────────────────────────────
function SubmitModal({ onClose, toast }) {
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", city: "", state: "", type: "Office", sqft: "", price: "", term_left: "", contact_email: "", description: "", img: "🏢" });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async () => {
    if (!photoFile) return null;
    setUploadProgress("Uploading photo...");
    const ext = photoFile.name.split(".").pop();
    const filename = `listing-${Date.now()}.${ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/listing-images/${filename}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": photoFile.type },
      body: photoFile,
    });
    if (!res.ok) { setUploadProgress("Photo upload failed — listing saved without photo"); return null; }
    setUploadProgress("");
    return `${SUPABASE_URL}/storage/v1/object/public/listing-images/${filename}`;
  };

  const submit = async () => {
    setLoading(true);
    try {
      const photo_url = await uploadPhoto();
      await db.submitListing({ ...form, sqft: parseInt(form.sqft), price: parseInt(form.price), term_left: parseInt(form.term_left), plan, featured: plan === "featured" || plan === "broker", verified: false, active: true, ...(photo_url && { photo_url }) });
      setStep(3);
      if (plan !== "free") toast("🎉 Plan selected — Stripe checkout coming soon!");
    } catch {
      toast("❌ Submission error — try again");
    } finally { setLoading(false); }
  };

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()} width={step === 2 ? "640px" : "460px"}>
        {step === 3 ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "44px" }}>🏢</div>
            <h3 style={{ margin: "12px 0 6px", color: "#1a1a2e", fontFamily: "'Playfair Display', serif" }}>Listing Submitted!</h3>
            <p style={{ color: "#666", fontSize: "14px", margin: "0 0 4px" }}>{plan === "free" ? "Your listing goes live within 24 hours." : "Your paid listing will go live immediately after payment."}</p>
            {plan !== "free" && <p style={{ color: "#aaa", fontSize: "12px", margin: "0 0 20px" }}>Stripe checkout integration coming in next build.</p>}
            <Btn dark onClick={onClose}>Done</Btn>
          </div>
        ) : step === 2 ? (
          <>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "19px", fontWeight: "700", color: "#1a1a2e", marginBottom: "6px" }}>Choose Your Plan</div>
            <p style={{ fontSize: "13px", color: "#888", marginBottom: "24px" }}>First 30 days free on any paid plan. Cancel anytime.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "20px" }}>
              {PRICING_PLANS.map((p) => (
                <div key={p.id} onClick={() => setPlan(p.id)} style={{ border: `2px solid ${plan === p.id ? p.color : "#e0e0e0"}`, borderRadius: "8px", padding: "16px 12px", cursor: "pointer", background: plan === p.id ? "#fffef8" : "#fff", position: "relative", transition: "all 0.15s" }}>
                  {p.popular && <div style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", background: p.color, color: "#1a1a2e", fontSize: "10px", fontWeight: "800", padding: "2px 10px", borderRadius: "10px", whiteSpace: "nowrap" }}>MOST POPULAR</div>}
                  <div style={{ fontSize: "14px", fontWeight: "800", color: "#1a1a2e", marginBottom: "4px" }}>{p.name}</div>
                  <div style={{ fontSize: "20px", fontWeight: "900", color: "#1a1a2e", marginBottom: "10px", fontFamily: "'DM Mono', monospace" }}>{p.price === 0 ? "Free" : `$${p.price}`}<span style={{ fontSize: "11px", fontWeight: "400", color: "#888" }}>{p.price > 0 ? "/mo" : ""}</span></div>
                  {p.features.map((f) => <div key={f} style={{ fontSize: "11px", color: "#555", marginBottom: "3px" }}>✓ {f}</div>)}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <Btn onClick={() => setStep(1)}>← Back</Btn>
              <Btn dark disabled={!plan || loading} onClick={submit} style={{ flex: 2 }}>{loading ? "Submitting..." : plan ? PRICING_PLANS.find(p => p.id === plan)?.cta : "Select a plan →"}</Btn>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "19px", fontWeight: "700", color: "#1a1a2e", marginBottom: "20px" }}>List Your Space</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <FieldGroup label="Property Title" style={{ gridColumn: "1/-1" }}><input value={form.title} onChange={set("title")} placeholder="e.g. Open-plan office suite" style={inputStyle} /></FieldGroup>
              <FieldGroup label="City"><input value={form.city} onChange={set("city")} placeholder="e.g. Austin" style={inputStyle} /></FieldGroup>
              <FieldGroup label="State"><input value={form.state} onChange={set("state")} placeholder="e.g. TX" style={inputStyle} /></FieldGroup>
              <FieldGroup label="Monthly Price ($)"><input value={form.price} onChange={set("price")} placeholder="e.g. 4500" type="number" style={inputStyle} /></FieldGroup>
              <FieldGroup label="Square Footage"><input value={form.sqft} onChange={set("sqft")} placeholder="e.g. 3200" type="number" style={inputStyle} /></FieldGroup>
              <FieldGroup label="Months Left on Lease"><input value={form.term_left} onChange={set("term_left")} placeholder="e.g. 18" type="number" style={inputStyle} /></FieldGroup>
              <FieldGroup label="Space Type">
                <select value={form.type} onChange={set("type")} style={{ ...inputStyle, cursor: "pointer" }}>
                  {["Office", "Warehouse", "Retail"].map(t => <option key={t}>{t}</option>)}
                </select>
              </FieldGroup>
              <FieldGroup label="Your Email" style={{ gridColumn: "1/-1" }}><input value={form.contact_email} onChange={set("contact_email")} placeholder="you@company.com" style={inputStyle} /></FieldGroup>
              <FieldGroup label="Description" style={{ gridColumn: "1/-1" }}><textarea value={form.description} onChange={set("description")} rows={3} placeholder="Amenities, condition, access, special features..." style={{ ...inputStyle, resize: "vertical" }} /></FieldGroup>
              <FieldGroup label="Photo (optional)" style={{ gridColumn: "1/-1" }}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} style={{ fontSize: "13px", color: "#555" }} />
                {photoPreview && <img src={photoPreview} alt="preview" style={{ marginTop: "8px", maxHeight: "120px", borderRadius: "6px", objectFit: "cover", width: "100%" }} />}
                {uploadProgress && <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>{uploadProgress}</div>}
              </FieldGroup>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <Btn onClick={onClose}>Cancel</Btn>
              <Btn dark disabled={!form.title || !form.city || !form.contact_email} onClick={() => setStep(2)} style={{ flex: 2 }}>Next: Choose Plan →</Btn>
            </div>
          </>
        )}
      </Modal>
    </Overlay>
  );
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
function ListingCard({ l, onContact }) {
  const [open, setOpen] = useState(false);
  const typeKey = (l.type || "").toLowerCase();
  return (
    <div style={{ background: l.featured ? "#fffef8" : "#fff", border: `1.5px solid ${l.featured ? "#FFD166" : "#e8e8e8"}`, borderRadius: "8px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.09)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {l.featured && <Tag variant="featured">⭐ Featured</Tag>}
          <Tag variant={typeKey}>{l.type}</Tag>
          {l.verified && <Tag variant="verified">✓ Verified</Tag>}
        </div>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "20px", fontWeight: "700", color: "#1a1a2e" }}>{fmt$(l.price)}</span>
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px", fontWeight: "700", color: "#1a1a2e", marginBottom: "3px" }}>{l.img || "🏢"} {l.title}</div>
      <div style={{ fontSize: "13px", color: "#777" }}>📍 {l.city}, {l.state} &nbsp;·&nbsp; {fmtSqft(l.sqft)} &nbsp;·&nbsp; <span style={{ color: "#c0392b", fontWeight: "700" }}>{l.term_left}mo remaining</span></div>
      {l.photo_url && <img src={l.photo_url} alt={l.title} style={{ width: "100%", height: "160px", objectFit: "cover", borderRadius: "6px", marginTop: "12px" }} />}
      {open && <p style={{ margin: "12px 0 0", fontSize: "14px", color: "#444", lineHeight: "1.65", borderTop: "1px solid #f2f2f2", paddingTop: "12px" }}>{(l.description || "").replace(/QR Code Link to This Post\s*/gi, "").trim()}</p>}
      <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
        <Btn onClick={() => setOpen(!open)}>{open ? "Less ↑" : "Details ↓"}</Btn>
        <Btn dark onClick={() => onContact(l)}>Contact Lessor →</Btn>
      </div>
    </div>
  );
}

// ─── REVENUE CALC ─────────────────────────────────────────────────────────────
function RevenueCalc() {
  const [featured, setFeatured] = useState(12);
  const [brokers, setBrokers] = useState(4);
  const total = featured * 99 + brokers * 299;
  return (
    <div style={{ background: "#1a1a2e", color: "#fff", padding: "28px", borderRadius: "10px", marginBottom: "28px" }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: "700", marginBottom: "6px", color: "#FFD166" }}>📊 Revenue Calculator</div>
      <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "20px" }}>Drag to model your monthly revenue</div>
      {[[`Featured Listings @ $99/mo — ${featured}`, featured, setFeatured, 0, 100, "#FFD166"], [`Broker Pro Accounts @ $299/mo — ${brokers}`, brokers, setBrokers, 0, 30, "#7EB8F7"]].map(([label, val, set, min, max, color]) => (
        <div key={label} style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", color, fontWeight: "600", marginBottom: "6px" }}>{label}</div>
          <input type="range" min={min} max={max} value={val} onChange={e => set(Number(e.target.value))} style={{ width: "100%", accentColor: color }} />
        </div>
      ))}
      <div style={{ borderTop: "1px solid #333", paddingTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
        {[["Featured Rev", featured * 99, "#FFD166"], ["Broker Rev", brokers * 299, "#7EB8F7"], ["Total/Month", total, "#5FDD9B"]].map(([label, val, color]) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: label === "Total/Month" ? "26px" : "20px", fontWeight: "900", color, fontFamily: "'DM Mono', monospace" }}>${val.toLocaleString()}</div>
            <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function SubleaseScout() {
  const [view, setView] = useState("listings");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All Cities");
  const [maxPrice, setMaxPrice] = useState(15000);
  const [sortBy, setSortBy] = useState("featured");
  const [search, setSearch] = useState("");
  const [contactListing, setContactListing] = useState(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const toast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3500); };

  const loadListings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await db.getListings({ type: typeFilter, city: cityFilter, maxPrice });
      setListings(data);
    } catch (e) {
      setError("Could not load listings. Check your Supabase connection.");
    } finally { setLoading(false); }
  }, [typeFilter, cityFilter, maxPrice]);

  useEffect(() => { loadListings(); }, [loadListings]);

  const cities = ["All Cities", ...Array.from(new Set(listings.map(l => l.city))).sort()];

  const filtered = listings.filter(l => {
    if (search && !l.title?.toLowerCase().includes(search.toLowerCase()) && !l.city?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "price_asc") return a.price - b.price;
    if (sortBy === "price_desc") return b.price - a.price;
    if (sortBy === "term") return a.term_left - b.term_left;
    if (sortBy === "newest") return new Date(b.created_at) - new Date(a.created_at);
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#F5F4F1", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700&family=DM+Mono:wght@500;700&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background: "#1a1a2e", padding: "0 24px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" }}>
          <div style={{ cursor: "pointer" }} onClick={() => setView("listings")}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: "900", color: "#fff", letterSpacing: "-0.02em" }}>Sublease<span style={{ color: "#FFD166" }}>Scout</span></div>
            <div style={{ fontSize: "10px", color: "#666", letterSpacing: "0.1em", textTransform: "uppercase" }}>Commercial space at sublease rates</div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={() => setView(view === "pricing" ? "listings" : "pricing")} style={{ background: "transparent", border: "1.5px solid #444", borderRadius: "4px", color: "#aaa", padding: "7px 16px", fontSize: "13px", cursor: "pointer", fontWeight: "600" }}>
              {view === "pricing" ? "← Listings" : "Pricing"}
            </button>
            <button onClick={() => setShowSubmit(true)} style={{ background: "#FFD166", border: "none", borderRadius: "4px", color: "#1a1a2e", padding: "8px 18px", fontSize: "13px", cursor: "pointer", fontWeight: "800" }}>+ List Your Space</button>
          </div>
        </div>
      </div>

      {/* TRUST STRIP */}
      <div style={{ background: "#232340", padding: "10px 24px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", gap: "24px", flexWrap: "wrap" }}>
          {[["💰 Save 30–60%", "vs. direct rate"], ["🚫 No broker fees", "direct contact"], ["📋 6–36mo terms", "flexible options"], ["✅ Verified listings", "screened before live"]].map(([a, b]) => (
            <div key={a}><span style={{ color: "#fff", fontWeight: "700", fontSize: "13px" }}>{a}</span><span style={{ color: "#888", fontSize: "12px", marginLeft: "6px" }}>{b}</span></div>
          ))}
        </div>
      </div>

      {view === "pricing" ? (
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "48px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "32px", fontWeight: "900", color: "#1a1a2e", margin: "0 0 10px" }}>Simple, transparent pricing</h1>
            <p style={{ color: "#888", fontSize: "15px", margin: 0 }}>First 30 days free on any paid plan. No setup fees. Cancel anytime.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px", marginBottom: "48px" }}>
            {PRICING_PLANS.map((p) => (
              <div key={p.id} style={{ background: "#fff", border: `2px solid ${p.popular ? p.color : "#e8e8e8"}`, borderRadius: "10px", padding: "28px 22px", position: "relative" }}>
                {p.popular && <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "#FFD166", color: "#1a1a2e", fontSize: "11px", fontWeight: "800", padding: "3px 14px", borderRadius: "12px", whiteSpace: "nowrap" }}>MOST POPULAR</div>}
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "19px", fontWeight: "700", color: "#1a1a2e", marginBottom: "6px" }}>{p.name}</div>
                <div style={{ fontSize: "34px", fontWeight: "900", color: "#1a1a2e", marginBottom: "18px", fontFamily: "'DM Mono', monospace" }}>{p.price === 0 ? "Free" : `$${p.price}`}<span style={{ fontSize: "13px", fontWeight: "400", color: "#888" }}>{p.price > 0 ? "/mo" : ""}</span></div>
                {p.features.map(f => <div key={f} style={{ fontSize: "13px", color: "#555", marginBottom: "8px" }}>✓ {f}</div>)}
                <button onClick={() => { setShowSubmit(true); setView("listings"); }} style={{ marginTop: "20px", width: "100%", background: p.popular ? "#FFD166" : p.id === "broker" ? "#1a1a2e" : "transparent", color: p.popular ? "#1a1a2e" : p.id === "broker" ? "#fff" : "#1a1a2e", border: p.id === "free" ? "2px solid #ddd" : "none", borderRadius: "6px", padding: "12px", fontWeight: "800", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>{p.cta}</button>
              </div>
            ))}
          </div>
          <RevenueCalc />
        </div>
      ) : (
        <>
          {/* FILTERS */}
          <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "14px 24px", position: "sticky", top: "79px", zIndex: 90 }}>
            <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search city or title..." style={{ ...inputStyle, width: "190px", fontSize: "13px" }} />
              <div style={{ display: "flex", gap: "5px" }}>
                {TYPES.map(t => <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: "6px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: "700", cursor: "pointer", border: `1.5px solid ${typeFilter === t ? "#1a1a2e" : "#ddd"}`, background: typeFilter === t ? "#1a1a2e" : "transparent", color: typeFilter === t ? "#fff" : "#666", fontFamily: "inherit" }}>{t}</button>)}
              </div>
              <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: "13px" }}>
                {cities.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} style={{ ...inputStyle, width: "auto", fontSize: "13px" }}>
                {[3000, 5000, 7500, 10000, 15000].map(v => <option key={v} value={v}>Max ${v.toLocaleString()}/mo</option>)}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: "13px", marginLeft: "auto" }}>
                <option value="featured">Featured first</option>
                <option value="newest">Newest</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
                <option value="term">Shortest term</option>
              </select>
            </div>
          </div>

          <div style={{ maxWidth: "960px", margin: "0 auto", padding: "28px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "18px", alignItems: "center" }}>
              <div style={{ fontSize: "13px", color: "#888", fontWeight: "600" }}>
                {loading ? "Loading..." : `${filtered.length} listing${filtered.length !== 1 ? "s" : ""} found`}
              </div>
              {error && <div style={{ fontSize: "13px", color: "#c0392b", fontWeight: "600" }}>{error} <button onClick={loadListings} style={{ color: "#1a1a2e", fontWeight: "700", cursor: "pointer", border: "none", background: "none", textDecoration: "underline" }}>Retry</button></div>}
            </div>

            {loading ? <Spinner /> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: "14px" }}>
                {filtered.length === 0
                  ? <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "80px 20px", color: "#bbb", fontSize: "16px" }}>No listings match your filters.</div>
                  : filtered.map(l => <ListingCard key={l.id} l={l} onContact={setContactListing} />)
                }
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div style={{ background: "#1a1a2e", padding: "48px 24px", marginTop: "20px" }}>
            <div style={{ maxWidth: "580px", margin: "0 auto", textAlign: "center" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", fontWeight: "900", color: "#fff", marginBottom: "10px" }}>Paying rent on empty square footage?</div>
              <div style={{ fontSize: "14px", color: "#888", marginBottom: "24px" }}>Over 209 million sq ft of commercial sublease space sits vacant in the U.S. Let someone else cover your rent.</div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => setShowSubmit(true)} style={{ background: "#FFD166", color: "#1a1a2e", border: "none", borderRadius: "5px", padding: "13px 28px", fontWeight: "800", fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}>List My Space Free →</button>
                <button onClick={() => setView("pricing")} style={{ background: "transparent", color: "#aaa", border: "1.5px solid #444", borderRadius: "5px", padding: "13px 22px", fontWeight: "600", fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}>See Pricing</button>
              </div>
            </div>
          </div>
        </>
      )}

      {contactListing && <ContactModal listing={contactListing} onClose={() => setContactListing(null)} toast={toast} />}
      {showSubmit && <SubmitModal onClose={() => { setShowSubmit(false); loadListings(); }} toast={toast} />}
      <Toast msg={toastMsg} />
    </div>
  );
}
