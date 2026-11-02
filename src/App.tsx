import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3, Box, Camera, CheckCircle2, Compass, Menu, MessageCircle, Search,
  Settings as SettingsIcon, ShieldCheck, Sparkles, Sun, UserRound, X, AlertCircle,
} from "lucide-react";
import { useStore, type Page } from "./store";
import Overview from "./pages/Overview";
import Analysis from "./pages/Analysis";
import ProfilePage from "./pages/Profile";
import RoutinePage from "./pages/Routine";
import SmartShelf from "./pages/SmartShelf";
import Discover from "./pages/Discover";
import MyProducts from "./pages/MyProducts";
import Journey from "./pages/Journey";
import Assistant from "./pages/Assistant";
import SettingsPage from "./pages/Settings";

const NAV: { id: Page; label: string; icon: typeof Sparkles; group: "Today" | "Intelligence" | "Shelf" | "You" }[] = [
  { id: "overview", label: "Overview", icon: Sparkles, group: "Today" },
  { id: "analysis", label: "Skin Analysis", icon: Camera, group: "Today" },
  { id: "routine", label: "My Routine", icon: Sun, group: "Today" },
  { id: "profile", label: "Skin Profile", icon: UserRound, group: "Intelligence" },
  { id: "smart-shelf", label: "Skin-to-Shelf", icon: ShieldCheck, group: "Intelligence" },
  { id: "journey", label: "Skin Journey", icon: BarChart3, group: "Intelligence" },
  { id: "my-products", label: "My Products", icon: Box, group: "Shelf" },
  { id: "discover", label: "Discover", icon: Compass, group: "Shelf" },
  { id: "assistant", label: "Assistant", icon: MessageCircle, group: "You" },
  { id: "settings", label: "Settings", icon: SettingsIcon, group: "You" },
];
const TITLES: Record<Page, string> = Object.fromEntries(NAV.map((n) => [n.id, n.label])) as Record<Page, string>;

export default function App() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("scroll", onScroll); window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("keydown", onKey); };
  }, []);

  const initials = (s.profile?.name || "You").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const groups = ["Today", "Intelligence", "Shelf", "You"] as const;

  const pages: Record<Page, ReactNode> = {
    overview: <Overview />, analysis: <Analysis />, profile: <ProfilePage />, routine: <RoutinePage />,
    "smart-shelf": <SmartShelf />, discover: <Discover initialQuery={q} />, "my-products": <MyProducts />,
    journey: <Journey />, assistant: <Assistant />, settings: <SettingsPage />,
  };

  return (
    <div className="shell">
      {open && <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Primary">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div>
            <div className="brand-name row" style={{ gap: 6 }}>Skin<em style={{ marginLeft: -6 }}>Wise</em><span className="ai-badge" style={{ height: 20, fontSize: 10 }}>AI</span></div>
            <div className="brand-tag">Your skin, understood.</div>
          </div>
          <button className="icon-btn sm ghost menu-btn" style={{ marginLeft: "auto" }} onClick={() => setOpen(false)} aria-label="Close menu"><X size={16} /></button>
        </div>
        <nav className="nav" style={{ overflowY: "auto" }}>
          {groups.map((g) => (
            <div key={g}>
              <div className="nav-label">{g}</div>
              {NAV.filter((n) => n.group === g).map((n) => {
                const Icon = n.icon;
                return (
                  <button key={n.id} className={`nav-item ${s.page === n.id ? "active" : ""}`} aria-current={s.page === n.id ? "page" : undefined} onClick={() => { s.go(n.id); setOpen(false); }}>
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{n.label}</span>
                    {n.id === "analysis" && <span className="nav-tag">YouCam</span>}
                    {n.id === "smart-shelf" && s.ready && s.coverage.needs.length > 0 && <span className="nav-count">{s.coverage.percent}%</span>}
                    {n.id === "my-products" && <span className="nav-count">{s.shelf.length}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="provider-pill">
            <span className={`dot ${s.offline ? "warn" : s.providerReady ? "ok" : s.providerReady === false ? "warn" : ""}`} />
            <div>
              <b>{s.offline ? "Server offline" : s.providerReady ? "YouCam connected" : s.providerReady === false ? "YouCam key missing" : "Checking…"}</b>
              <small>{s.offline ? "Start the Express backend" : "Skin Analysis API v2"}</small>
            </div>
          </div>
          <button className="me" onClick={() => { s.go("profile"); setOpen(false); }}>
            <span className="avatar">{initials}</span>
            <span><b>{s.profile?.name || "Your profile"}</b><small>{s.profile?.skinType || "Add your skin type"}</small></span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
          <div className="crumb"><span>SkinWise</span><span>/</span><b>{TITLES[s.page]}</b></div>
          <div className="top-actions">
            <label className="search">
              <Search size={15} />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim().length >= 2) s.go("discover"); }} placeholder="Search products, brands…" aria-label="Search catalog" />
              <kbd>⌘K</kbd>
            </label>
            {s.page !== "analysis" && <button className="btn btn-primary" onClick={() => s.go("analysis")}><Sparkles size={15} /> <span>AI Skin Scan</span></button>}
          </div>
        </header>

        <div className="content">
          {s.offline && (
            <div className="callout amber" style={{ marginBottom: 20 }}>
              <AlertCircle size={18} />
              <div><b>Can't reach the SkinWise server.</b> Start the backend (<code>cd server &amp;&amp; npm run dev</code>) and refresh. Nothing on this screen is simulated, so pages stay empty until the API responds.</div>
            </div>
          )}
          <div key={s.page}>{pages[s.page]}</div>
          <footer className="footer">
            <span><b>SkinWise</b> · A calmer, smarter skincare journey.</span>
            <span>Skin analysis by YouCam API · Catalog by Open Beauty Facts · Not medical advice</span>
          </footer>
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Quick navigation">
        <button className={s.page === "overview" ? "on" : ""} onClick={() => s.go("overview")}><Sparkles size={20} />Home</button>
        <button className={s.page === "routine" ? "on" : ""} onClick={() => s.go("routine")}><Sun size={20} />Routine</button>
        <button onClick={() => s.go("analysis")} aria-label="Analyze skin"><span className="fab"><Camera size={24} /></span></button>
        <button className={s.page === "smart-shelf" ? "on" : ""} onClick={() => s.go("smart-shelf")}><ShieldCheck size={20} />Shelf</button>
        <button className={s.page === "profile" ? "on" : ""} onClick={() => s.go("profile")}><UserRound size={20} />Profile</button>
      </nav>

      <div className="toast-wrap" aria-live="polite">
        {s.toasts.map((t) => (
          <div key={t.id} className={`toast ${t.error ? "err" : ""}`}>{t.error ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}<span>{t.text}</span></div>
        ))}
      </div>
    </div>
  );
}
