import { useState, useEffect, useRef } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from "recharts";
import { TrendingUp, TrendingDown, Hotel, BarChart3, Target, Users, DollarSign, ArrowUpRight, ArrowDownRight, Eye, ChevronRight, Bell, Search, ArrowLeft, Building2, LayoutDashboard, ChevronDown, Zap, AlertTriangle, CheckCircle } from "lucide-react";

// ─── Client Data ─────────────────────────────────────────────────────
const clients = [
  {
    id: 1, name: "Sol Alphaville", city: "Barueri, SP", uhs: 100, stars: 4,
    occ: 71.3, dm: 410, revpar: 291, receita: 219600, pkOcc: 3.5, pkDm: 25, pkRevp: 38,
    metaPct: 70.5, barAtual: "BAR 3", status: "healthy",
    pickup: [
      { day: "03/02", pkOcc: 2.1, pkDm: 15, pkRevp: 18 },
      { day: "04/02", pkOcc: 1.8, pkDm: -5, pkRevp: 8 },
      { day: "05/02", pkOcc: 3.2, pkDm: 22, pkRevp: 35 },
      { day: "06/02", pkOcc: 0.5, pkDm: -12, pkRevp: -3 },
      { day: "07/02", pkOcc: 4.1, pkDm: 30, pkRevp: 42 },
      { day: "08/02", pkOcc: 2.8, pkDm: 8, pkRevp: 19 },
      { day: "09/02", pkOcc: 1.2, pkDm: -2, pkRevp: 5 },
      { day: "10/02", pkOcc: 3.5, pkDm: 25, pkRevp: 38 },
    ],
    otb: [
      { day: "Seg", occ: 62, dm: 385, revpar: 238, receita: 23870 },
      { day: "Ter", occ: 58, dm: 372, revpar: 216, receita: 21580 },
      { day: "Qua", occ: 65, dm: 390, revpar: 254, receita: 25350 },
      { day: "Qui", occ: 71, dm: 410, revpar: 291, receita: 29120 },
      { day: "Sex", occ: 82, dm: 445, revpar: 365, receita: 36480 },
      { day: "Sáb", occ: 91, dm: 520, revpar: 473, receita: 47320 },
      { day: "Dom", occ: 78, dm: 460, revpar: 359, receita: 35880 },
    ],
    competitors: [
      { name: "Sol Alphaville", dm: 410, occ: 71, revpar: 291, bar: "BAR 3", own: true },
      { name: "Comfort Tamboré", dm: 385, occ: 68, revpar: 262, bar: "BAR 2" },
      { name: "Radisson Alphaville", dm: 450, occ: 59, revpar: 266, bar: "BAR 4" },
      { name: "Mercure Alphaville", dm: 370, occ: 74, revpar: 274, bar: "BAR 2" },
    ],
    barLevels: [
      { level: "RACK", value: 890 }, { level: "BAR 1", value: 720 }, { level: "BAR 2", value: 580 },
      { level: "BAR 3", value: 460 }, { level: "BAR 4", value: 380 }, { level: "BAR 5", value: 320 },
    ],
    meta: { total: 1000000, realizado: 420000, otbVal: 285000, forecast: 295000 },
  },
  {
    id: 2, name: "Vitória Palace", city: "Vitória, ES", uhs: 78, stars: 3,
    occ: 64.2, dm: 295, revpar: 189, receita: 147420, pkOcc: 1.8, pkDm: -8, pkRevp: 4,
    metaPct: 58.2, barAtual: "BAR 2", status: "warning",
    pickup: [
      { day: "03/02", pkOcc: 1.0, pkDm: -3, pkRevp: 2 },
      { day: "04/02", pkOcc: 0.5, pkDm: -10, pkRevp: -4 },
      { day: "05/02", pkOcc: 2.1, pkDm: 5, pkRevp: 12 },
      { day: "06/02", pkOcc: -0.3, pkDm: -15, pkRevp: -8 },
      { day: "07/02", pkOcc: 3.0, pkDm: 12, pkRevp: 22 },
      { day: "08/02", pkOcc: 1.4, pkDm: -2, pkRevp: 6 },
      { day: "09/02", pkOcc: 0.8, pkDm: -6, pkRevp: 0 },
      { day: "10/02", pkOcc: 1.8, pkDm: -8, pkRevp: 4 },
    ],
    otb: [
      { day: "Seg", occ: 52, dm: 280, revpar: 146, receita: 11350 },
      { day: "Ter", occ: 48, dm: 275, revpar: 132, receita: 10296 },
      { day: "Qua", occ: 55, dm: 290, revpar: 160, receita: 12440 },
      { day: "Qui", occ: 64, dm: 295, revpar: 189, receita: 14742 },
      { day: "Sex", occ: 76, dm: 330, revpar: 251, receita: 19566 },
      { day: "Sáb", occ: 85, dm: 380, revpar: 323, receita: 25194 },
      { day: "Dom", occ: 70, dm: 310, revpar: 217, receita: 16926 },
    ],
    competitors: [
      { name: "Vitória Palace", dm: 295, occ: 64, revpar: 189, bar: "BAR 2", own: true },
      { name: "Bristol Vitória", dm: 310, occ: 60, revpar: 186, bar: "BAR 3" },
      { name: "Golden Camburi", dm: 260, occ: 72, revpar: 187, bar: "BAR 1" },
      { name: "Comfort Praia", dm: 285, occ: 66, revpar: 188, bar: "BAR 2" },
    ],
    barLevels: [
      { level: "RACK", value: 650 }, { level: "BAR 1", value: 520 }, { level: "BAR 2", value: 410 },
      { level: "BAR 3", value: 340 }, { level: "BAR 4", value: 280 }, { level: "BAR 5", value: 230 },
    ],
    meta: { total: 680000, realizado: 252000, otbVal: 148000, forecast: 280000 },
  },
  {
    id: 3, name: "Porto Sul Resort", city: "Ilhéus, BA", uhs: 142, stars: 5,
    occ: 83.7, dm: 620, revpar: 519, receita: 736980, pkOcc: 5.2, pkDm: 45, pkRevp: 62,
    metaPct: 82.1, barAtual: "BAR 5", status: "excellent",
    pickup: [
      { day: "03/02", pkOcc: 4.0, pkDm: 35, pkRevp: 50 },
      { day: "04/02", pkOcc: 3.5, pkDm: 20, pkRevp: 38 },
      { day: "05/02", pkOcc: 5.8, pkDm: 55, pkRevp: 72 },
      { day: "06/02", pkOcc: 2.1, pkDm: 10, pkRevp: 18 },
      { day: "07/02", pkOcc: 6.2, pkDm: 60, pkRevp: 80 },
      { day: "08/02", pkOcc: 4.5, pkDm: 38, pkRevp: 55 },
      { day: "09/02", pkOcc: 3.8, pkDm: 28, pkRevp: 42 },
      { day: "10/02", pkOcc: 5.2, pkDm: 45, pkRevp: 62 },
    ],
    otb: [
      { day: "Seg", occ: 75, dm: 580, revpar: 435, receita: 61770 },
      { day: "Ter", occ: 72, dm: 570, revpar: 410, receita: 58220 },
      { day: "Qua", occ: 78, dm: 600, revpar: 468, receita: 66456 },
      { day: "Qui", occ: 84, dm: 620, revpar: 521, receita: 73882 },
      { day: "Sex", occ: 92, dm: 680, revpar: 626, receita: 88852 },
      { day: "Sáb", occ: 96, dm: 750, revpar: 720, receita: 102240 },
      { day: "Dom", occ: 88, dm: 690, revpar: 607, receita: 86194 },
    ],
    competitors: [
      { name: "Porto Sul Resort", dm: 620, occ: 84, revpar: 519, bar: "BAR 5", own: true },
      { name: "Opaba Praia", dm: 480, occ: 78, revpar: 374, bar: "BAR 3" },
      { name: "Jardim Atlântico", dm: 550, occ: 71, revpar: 391, bar: "BAR 4" },
      { name: "Cana Brava Resort", dm: 590, occ: 80, revpar: 472, bar: "BAR 4" },
    ],
    barLevels: [
      { level: "RACK", value: 1250 }, { level: "BAR 1", value: 980 }, { level: "BAR 2", value: 820 },
      { level: "BAR 3", value: 700 }, { level: "BAR 4", value: 620 }, { level: "BAR 5", value: 540 },
    ],
    meta: { total: 2200000, realizado: 1150000, otbVal: 656000, forecast: 394000 },
  },
  {
    id: 4, name: "Metropolitan BH", city: "Belo Horizonte, MG", uhs: 120, stars: 4,
    occ: 68.5, dm: 340, revpar: 233, receita: 279600, pkOcc: 2.2, pkDm: 10, pkRevp: 16,
    metaPct: 65.3, barAtual: "BAR 2", status: "healthy",
    pickup: [
      { day: "03/02", pkOcc: 1.5, pkDm: 8, pkRevp: 12 },
      { day: "04/02", pkOcc: 1.0, pkDm: -3, pkRevp: 3 },
      { day: "05/02", pkOcc: 2.8, pkDm: 18, pkRevp: 28 },
      { day: "06/02", pkOcc: 0.8, pkDm: -5, pkRevp: 1 },
      { day: "07/02", pkOcc: 3.5, pkDm: 22, pkRevp: 35 },
      { day: "08/02", pkOcc: 2.0, pkDm: 5, pkRevp: 12 },
      { day: "09/02", pkOcc: 1.1, pkDm: -1, pkRevp: 4 },
      { day: "10/02", pkOcc: 2.2, pkDm: 10, pkRevp: 16 },
    ],
    otb: [
      { day: "Seg", occ: 58, dm: 320, revpar: 186, receita: 22280 },
      { day: "Ter", occ: 55, dm: 315, revpar: 173, receita: 20790 },
      { day: "Qua", occ: 62, dm: 335, revpar: 208, receita: 24920 },
      { day: "Qui", occ: 69, dm: 340, revpar: 235, receita: 28140 },
      { day: "Sex", occ: 80, dm: 380, revpar: 304, receita: 36480 },
      { day: "Sáb", occ: 88, dm: 420, revpar: 370, receita: 44352 },
      { day: "Dom", occ: 74, dm: 365, revpar: 270, receita: 32400 },
    ],
    competitors: [
      { name: "Metropolitan BH", dm: 340, occ: 69, revpar: 233, bar: "BAR 2", own: true },
      { name: "Mercure Lourdes", dm: 360, occ: 65, revpar: 234, bar: "BAR 3" },
      { name: "Ibis Savassi", dm: 245, occ: 82, revpar: 201, bar: "BAR 1" },
      { name: "Quality Afonso P.", dm: 310, occ: 70, revpar: 217, bar: "BAR 2" },
    ],
    barLevels: [
      { level: "RACK", value: 780 }, { level: "BAR 1", value: 620 }, { level: "BAR 2", value: 490 },
      { level: "BAR 3", value: 400 }, { level: "BAR 4", value: 340 }, { level: "BAR 5", value: 280 },
    ],
    meta: { total: 850000, realizado: 355000, otbVal: 200000, forecast: 295000 },
  },
  {
    id: 5, name: "Oceano Flat", city: "Fortaleza, CE", uhs: 65, stars: 3,
    occ: 55.1, dm: 230, revpar: 127, receita: 82550, pkOcc: 0.4, pkDm: -18, pkRevp: -6,
    metaPct: 42.8, barAtual: "BAR 1", status: "critical",
    pickup: [
      { day: "03/02", pkOcc: 0.8, pkDm: -10, pkRevp: -2 },
      { day: "04/02", pkOcc: -0.5, pkDm: -20, pkRevp: -14 },
      { day: "05/02", pkOcc: 1.2, pkDm: -5, pkRevp: 3 },
      { day: "06/02", pkOcc: -1.0, pkDm: -25, pkRevp: -18 },
      { day: "07/02", pkOcc: 1.5, pkDm: 5, pkRevp: 8 },
      { day: "08/02", pkOcc: 0.2, pkDm: -15, pkRevp: -8 },
      { day: "09/02", pkOcc: -0.3, pkDm: -22, pkRevp: -12 },
      { day: "10/02", pkOcc: 0.4, pkDm: -18, pkRevp: -6 },
    ],
    otb: [
      { day: "Seg", occ: 42, dm: 210, revpar: 88, receita: 5720 },
      { day: "Ter", occ: 38, dm: 200, revpar: 76, receita: 4940 },
      { day: "Qua", occ: 45, dm: 220, revpar: 99, receita: 6435 },
      { day: "Qui", occ: 55, dm: 230, revpar: 127, receita: 8255 },
      { day: "Sex", occ: 68, dm: 270, revpar: 184, receita: 11960 },
      { day: "Sáb", occ: 75, dm: 310, revpar: 233, receita: 15145 },
      { day: "Dom", occ: 60, dm: 250, revpar: 150, receita: 9750 },
    ],
    competitors: [
      { name: "Oceano Flat", dm: 230, occ: 55, revpar: 127, bar: "BAR 1", own: true },
      { name: "Praia Centro", dm: 250, occ: 62, revpar: 155, bar: "BAR 2" },
      { name: "Seara Praia", dm: 320, occ: 58, revpar: 186, bar: "BAR 3" },
      { name: "Holiday Inn Express", dm: 280, occ: 70, revpar: 196, bar: "BAR 2" },
    ],
    barLevels: [
      { level: "RACK", value: 520 }, { level: "BAR 1", value: 400 }, { level: "BAR 2", value: 320 },
      { level: "BAR 3", value: 260 }, { level: "BAR 4", value: 210 }, { level: "BAR 5", value: 170 },
    ],
    meta: { total: 450000, realizado: 120000, otbVal: 73000, forecast: 257000 },
  },
  {
    id: 6, name: "Grand Curitiba", city: "Curitiba, PR", uhs: 95, stars: 4,
    occ: 75.8, dm: 375, revpar: 284, receita: 269800, pkOcc: 4.0, pkDm: 18, pkRevp: 32,
    metaPct: 74.6, barAtual: "BAR 4", status: "excellent",
    pickup: [
      { day: "03/02", pkOcc: 3.0, pkDm: 12, pkRevp: 22 },
      { day: "04/02", pkOcc: 2.5, pkDm: 5, pkRevp: 15 },
      { day: "05/02", pkOcc: 4.5, pkDm: 28, pkRevp: 42 },
      { day: "06/02", pkOcc: 1.8, pkDm: -2, pkRevp: 8 },
      { day: "07/02", pkOcc: 5.0, pkDm: 32, pkRevp: 50 },
      { day: "08/02", pkOcc: 3.5, pkDm: 15, pkRevp: 28 },
      { day: "09/02", pkOcc: 2.8, pkDm: 8, pkRevp: 18 },
      { day: "10/02", pkOcc: 4.0, pkDm: 18, pkRevp: 32 },
    ],
    otb: [
      { day: "Seg", occ: 65, dm: 350, revpar: 228, receita: 21630 },
      { day: "Ter", occ: 62, dm: 345, revpar: 214, receita: 20330 },
      { day: "Qua", occ: 70, dm: 365, revpar: 256, receita: 24290 },
      { day: "Qui", occ: 76, dm: 375, revpar: 285, receita: 27075 },
      { day: "Sex", occ: 86, dm: 420, revpar: 361, receita: 34295 },
      { day: "Sáb", occ: 93, dm: 480, revpar: 446, receita: 42370 },
      { day: "Dom", occ: 80, dm: 400, revpar: 320, receita: 30400 },
    ],
    competitors: [
      { name: "Grand Curitiba", dm: 375, occ: 76, revpar: 284, bar: "BAR 4", own: true },
      { name: "Bourbon Curitiba", dm: 395, occ: 72, revpar: 284, bar: "BAR 4" },
      { name: "Slaviero Palace", dm: 340, occ: 78, revpar: 265, bar: "BAR 3" },
      { name: "Four Points CWB", dm: 420, occ: 68, revpar: 286, bar: "BAR 5" },
    ],
    barLevels: [
      { level: "RACK", value: 850 }, { level: "BAR 1", value: 680 }, { level: "BAR 2", value: 550 },
      { level: "BAR 3", value: 450 }, { level: "BAR 4", value: 375 }, { level: "BAR 5", value: 310 },
    ],
    meta: { total: 920000, realizado: 436000, otbVal: 250000, forecast: 234000 },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const end = value;
    const duration = 900;
    const startTime = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - startTime) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(end * e);
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);
  return <span>{prefix}{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString("pt-BR")}{suffix}</span>;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="tooltip-row">
          <span className="tooltip-dot" style={{ background: p.color }} />
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

const statusConfig = {
  excellent: { label: "Excelente", color: "#10B981", bg: "#ECFDF5", icon: Zap },
  healthy: { label: "Saudável", color: "#3B82F6", bg: "#EBF2FF", icon: CheckCircle },
  warning: { label: "Atenção", color: "#F59E0B", bg: "#FFFBEB", icon: AlertTriangle },
  critical: { label: "Crítico", color: "#EF4444", bg: "#FEF2F2", icon: AlertTriangle },
};

// ─── Navigation ──────────────────────────────────────────────────────
const tabs = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "clientes", label: "Clientes", icon: Building2 },
];

function Navbar({ active, setActive, selectedClient, setSelectedClient }) {
  return (
    <header className="navbar">
      <div className="navbar-left">
        <div className="nav-brand">
          <div className="brand-icon"><Hotel size={18} /></div>
          <span className="brand-name">HoGrow</span>
        </div>
        <div className="nav-tabs">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`nav-tab ${active === t.id && !selectedClient ? "active" : ""}`}
                onClick={() => { setActive(t.id); setSelectedClient(null); }}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
          {selectedClient && (
            <div className="nav-tab active breadcrumb-tab">
              <button className="breadcrumb-back" onClick={() => setSelectedClient(null)}>
                <ArrowLeft size={14} />
                Clientes
              </button>
              <ChevronRight size={12} className="breadcrumb-sep" />
              <span>{selectedClient.name}</span>
            </div>
          )}
        </div>
      </div>
      <div className="navbar-right">
        <div className="search-box">
          <Search size={14} />
          <span>Buscar hotel...</span>
        </div>
        <button className="nav-icon-btn">
          <Bell size={17} />
          <span className="notif-dot" />
        </button>
        <div className="avatar"><span>VA</span></div>
      </div>
    </header>
  );
}

// ─── Home View ───────────────────────────────────────────────────────
function HomeView({ setActive, setSelectedClient }) {
  const totalReceita = clients.reduce((s, c) => s + c.receita, 0);
  const avgOcc = (clients.reduce((s, c) => s + c.occ, 0) / clients.length).toFixed(1);
  const avgRevpar = Math.round(clients.reduce((s, c) => s + c.revpar, 0) / clients.length);
  const alerts = clients.filter(c => c.status === "critical" || c.status === "warning");
  const top = [...clients].sort((a, b) => b.revpar - a.revpar).slice(0, 3);

  return (
    <div className="home-view fade-in">
      <div className="home-hero">
        <div className="hero-left">
          <p className="hero-greeting">Bom dia, Viviane</p>
          <h1 className="hero-title">Painel de Receita</h1>
          <p className="hero-desc">
            {clients.length} hotéis gerenciados &middot; atualização às 08:42
          </p>
        </div>
        <div className="hero-kpis">
          <div className="hero-kpi">
            <span className="hk-label">Receita Total</span>
            <span className="hk-value">R$ <AnimatedNumber value={totalReceita / 1000} decimals={0} />k</span>
          </div>
          <div className="hero-kpi-divider" />
          <div className="hero-kpi">
            <span className="hk-label">Occ Média</span>
            <span className="hk-value">{avgOcc}%</span>
          </div>
          <div className="hero-kpi-divider" />
          <div className="hero-kpi">
            <span className="hk-label">RevPAR Médio</span>
            <span className="hk-value">R$ {avgRevpar}</span>
          </div>
        </div>
      </div>

      <div className="home-grid">
        <div className="home-card alerts-card">
          <h3 className="hc-title"><AlertTriangle size={15} style={{marginRight:6,verticalAlign:'middle',color:'var(--amber)'}}/> Requer Atenção</h3>
          {alerts.length === 0 ? (
            <p className="hc-empty">Nenhum alerta no momento</p>
          ) : (
            <div className="alert-list">
              {alerts.map(c => {
                const cfg = statusConfig[c.status];
                const Icon = cfg.icon;
                return (
                  <button key={c.id} className="alert-row" onClick={() => { setActive("clientes"); setSelectedClient(c); }}>
                    <div className="alert-badge" style={{ background: cfg.bg, color: cfg.color }}>
                      <Icon size={14} />
                    </div>
                    <div className="alert-info">
                      <span className="alert-name">{c.name}</span>
                      <span className="alert-detail">
                        Occ {c.occ}% · DM R${c.dm} · Meta {c.metaPct}%
                      </span>
                    </div>
                    <ChevronRight size={14} className="alert-chevron" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="home-card top-card">
          <h3 className="hc-title"><Zap size={15} style={{marginRight:6,verticalAlign:'middle',color:'var(--green)'}}/> Top RevPAR</h3>
          <div className="top-list">
            {top.map((c, i) => (
              <button key={c.id} className="top-row" onClick={() => { setActive("clientes"); setSelectedClient(c); }}>
                <span className="top-rank">{i + 1}</span>
                <div className="top-info">
                  <span className="top-name">{c.name}</span>
                  <span className="top-city">{c.city}</span>
                </div>
                <span className="top-value">R$ {c.revpar}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="home-card snapshot-card full-width">
          <h3 className="hc-title"><Building2 size={15} style={{marginRight:6,verticalAlign:'middle',color:'var(--accent)'}}/> Todos os Hotéis</h3>
          <div className="snapshot-grid">
            {clients.map(c => {
              const cfg = statusConfig[c.status];
              return (
                <button key={c.id} className="snap-card" onClick={() => { setActive("clientes"); setSelectedClient(c); }}>
                  <div className="snap-top">
                    <div className="snap-status" style={{ background: cfg.color }} />
                    <span className="snap-name">{c.name}</span>
                  </div>
                  <p className="snap-city">{c.city}</p>
                  <div className="snap-kpis">
                    <div className="snap-kpi">
                      <span className="sk-val">{c.occ}%</span>
                      <span className="sk-lbl">Occ</span>
                    </div>
                    <div className="snap-kpi">
                      <span className="sk-val">R${c.dm}</span>
                      <span className="sk-lbl">DM</span>
                    </div>
                    <div className="snap-kpi">
                      <span className="sk-val">R${c.revpar}</span>
                      <span className="sk-lbl">RevPAR</span>
                    </div>
                  </div>
                  <div className="snap-meta-bar">
                    <div className="snap-meta-fill" style={{ width: `${c.metaPct}%`, background: cfg.color }} />
                  </div>
                  <div className="snap-bottom">
                    <span className="snap-meta-label">Meta {c.metaPct}%</span>
                    <span className="snap-bar-label">{c.barAtual}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Clientes List View ──────────────────────────────────────────────
function ClientesView({ setSelectedClient }) {
  const [sort, setSort] = useState("revpar");
  const sorted = [...clients].sort((a, b) => b[sort] - a[sort]);

  return (
    <div className="clientes-view fade-in">
      <div className="clientes-header">
        <div>
          <h2 className="cv-title">Clientes</h2>
          <p className="cv-desc">{clients.length} hotéis — clique para análise completa</p>
        </div>
        <div className="sort-group">
          <span className="sort-label">Ordenar</span>
          {[
            { key: "revpar", label: "RevPAR" },
            { key: "occ", label: "Occ%" },
            { key: "receita", label: "Receita" },
          ].map(s => (
            <button key={s.key} className={`sort-btn ${sort === s.key ? "active" : ""}`} onClick={() => setSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="client-cards">
        {sorted.map((c, i) => {
          const cfg = statusConfig[c.status];
          const Icon = cfg.icon;
          const pkPos = c.pkRevp >= 0;
          return (
            <button key={c.id} className="client-card" onClick={() => setSelectedClient(c)} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="cc-left">
                <div className="cc-name-row">
                  <span className="cc-status-dot" style={{ background: cfg.color }} />
                  <h3 className="cc-name">{c.name}</h3>
                  <span className="cc-badge" style={{ background: cfg.bg, color: cfg.color }}>
                    <Icon size={11} /> {cfg.label}
                  </span>
                </div>
                <p className="cc-city">{c.city} · {c.uhs} UHs · {c.stars}★</p>
              </div>
              <div className="cc-kpis">
                <div className="cc-kpi"><span className="ck-val">{c.occ}%</span><span className="ck-lbl">Occ</span></div>
                <div className="cc-kpi"><span className="ck-val">R$ {c.dm}</span><span className="ck-lbl">DM</span></div>
                <div className="cc-kpi highlight"><span className="ck-val">R$ {c.revpar}</span><span className="ck-lbl">RevPAR</span></div>
                <div className="cc-kpi"><span className="ck-val">R$ {(c.receita / 1000).toFixed(0)}k</span><span className="ck-lbl">Receita</span></div>
                <div className="cc-kpi"><span className={`ck-val pk ${pkPos ? "pos" : "neg"}`}>{pkPos ? "+" : ""}{c.pkRevp}</span><span className="ck-lbl">PK RevP</span></div>
                <div className="cc-kpi"><span className="ck-val bar-val">{c.barAtual}</span><span className="ck-lbl">BAR</span></div>
              </div>
              <div className="cc-meta-wrap">
                <div className="cc-meta-bar"><div className="cc-meta-fill" style={{ width: `${c.metaPct}%`, background: cfg.color }} /></div>
                <span className="cc-meta-pct">{c.metaPct}%</span>
              </div>
              <ChevronRight size={16} className="cc-chevron" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Client Detail View ──────────────────────────────────────────────
function ClientDetailView({ client }) {
  const [pickupMode, setPickupMode] = useState("occ");
  const c = client;
  const cfg = statusConfig[c.status];
  const metaSegs = [
    { label: "Realizado", value: c.meta.realizado, pct: (c.meta.realizado / c.meta.total * 100).toFixed(1) },
    { label: "OTB", value: c.meta.otbVal, pct: (c.meta.otbVal / c.meta.total * 100).toFixed(1) },
    { label: "Forecast", value: c.meta.forecast, pct: (c.meta.forecast / c.meta.total * 100).toFixed(1) },
  ];
  const remaining = c.meta.total - c.meta.realizado - c.meta.otbVal;
  const fazerPorDia = Math.round(remaining / 18);

  return (
    <div className="detail-view fade-in">
      <div className="detail-header" style={{ borderLeftColor: cfg.color }}>
        <div className="dh-left">
          <h2 className="dh-name">{c.name}</h2>
          <p className="dh-info">{c.city} · {c.uhs} UHs · {c.stars}★ · BAR: <strong>{c.barAtual}</strong></p>
        </div>
        <span className="dh-badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
      </div>

      <div className="kpi-row">
        {[
          { title: "Ocupação OTB", value: c.occ, suffix: "%", decimals: 1, delta: c.pkOcc, deltaLabel: "% pk", icon: Users },
          { title: "Diária Média", value: c.dm, prefix: "R$ ", delta: c.pkDm, deltaLabel: " pk", icon: DollarSign },
          { title: "RevPAR", value: c.revpar, prefix: "R$ ", delta: c.pkRevp, deltaLabel: " pk", icon: TrendingUp },
          { title: "Receita Hosp.", value: c.receita, prefix: "R$ ", delta: parseFloat(((c.pkRevp / c.revpar) * 100).toFixed(1)), deltaLabel: "%", icon: BarChart3 },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="kpi-top">
              <span className="kpi-title">{k.title}</span>
              <div className="kpi-icon"><k.icon size={15} /></div>
            </div>
            <div className="kpi-value"><AnimatedNumber value={k.value} prefix={k.prefix} suffix={k.suffix} decimals={k.decimals} /></div>
            <div className={`kpi-delta ${k.delta >= 0 ? "pos" : "neg"}`}>
              {k.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {k.delta >= 0 ? "+" : ""}{k.delta}{k.deltaLabel}
            </div>
          </div>
        ))}
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-head">
            <div><h3 className="card-title">Variação — Pick-up</h3><p className="card-desc">Movimento diário vs planning anterior</p></div>
            <div className="toggle-group">
              {[{ key: "occ", label: "OCC" }, { key: "dm", label: "DM" }, { key: "revp", label: "RevPAR" }].map(t => (
                <button key={t.key} className={`toggle-btn ${pickupMode === t.key ? "active" : ""}`} onClick={() => setPickupMode(t.key)}>{t.label}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={c.pickup} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs><linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF4" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3B8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey={pickupMode === "occ" ? "pkOcc" : pickupMode === "dm" ? "pkDm" : "pkRevp"} name={pickupMode === "occ" ? "PK OCC %" : pickupMode === "dm" ? "PK DM" : "PK RevPAR"} stroke="#3B82F6" strokeWidth={2.5} fill="url(#gBlue)" dot={{ fill: "#3B82F6", r: 3.5, strokeWidth: 2, stroke: "#fff" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3 className="card-title">OTB Acumulado</h3><p className="card-desc">RevPAR por dia da semana</p></div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={c.otb} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF4" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3B8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revpar" name="RevPAR" radius={[6, 6, 0, 0]} maxBarSize={36}>
                {c.otb.map((e, i) => (<Cell key={i} fill={e.occ >= 80 ? "#10B981" : e.occ >= 65 ? "#3B82F6" : "#F59E0B"} fillOpacity={0.8} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="legend-row">
            <span className="legend-item"><span className="leg-dot" style={{ background: "#10B981" }} />≥80%</span>
            <span className="legend-item"><span className="leg-dot" style={{ background: "#3B82F6" }} />65–79%</span>
            <span className="legend-item"><span className="leg-dot" style={{ background: "#F59E0B" }} />&lt;65%</span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3 className="card-title">Posicionamento Competitivo</h3><p className="card-desc">Set competitivo — Qui 13/02</p></div>
          </div>
          <table className="comp-table">
            <thead><tr><th>Hotel</th><th>BAR</th><th>DM</th><th>Occ%</th><th>RevPAR</th></tr></thead>
            <tbody>
              {c.competitors.map((comp, i) => (
                <tr key={i} className={comp.own ? "own" : ""}>
                  <td><div className="comp-name"><span className="comp-dot" style={{ background: comp.own ? "#3B82F6" : "#CBD5E1" }} />{comp.name}</div></td>
                  <td><span className="bar-badge">{comp.bar}</span></td>
                  <td>R$ {comp.dm}</td>
                  <td>{comp.occ}%</td>
                  <td className="bold">R$ {comp.revpar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3 className="card-title">Fechamento Mensal</h3><p className="card-desc">Meta: R$ {(c.meta.total / 1000).toFixed(0)}k — Fev/2026</p></div>
          </div>
          <div className="meta-content">
            <div className="meta-bar-track">
              {metaSegs.map((seg, i) => (<div key={i} className={`meta-seg seg-${i}`} style={{ width: `${seg.pct}%` }}>{parseFloat(seg.pct) > 12 && <span className="seg-lbl">{seg.label}</span>}</div>))}
            </div>
            <div className="meta-details">
              {metaSegs.map((seg, i) => (<div key={i} className="meta-detail"><span className={`md-dot seg-${i}`} /><span className="md-label">{seg.label}</span><span className="md-value">R$ {(seg.value / 1000).toFixed(0)}k</span><span className="md-pct">{seg.pct}%</span></div>))}
            </div>
            <div className="fazer-dia"><span>Fazer por dia (restante)</span><strong>R$ {fazerPorDia.toLocaleString("pt-BR")}</strong></div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3 className="card-title">Grade BAR</h3><p className="card-desc">Atual: {c.barAtual}</p></div>
            <span className="bar-current">{c.barAtual}</span>
          </div>
          <div className="bar-levels">
            {c.barLevels.map((b, i) => {
              const isCurrent = b.level === c.barAtual;
              const pct = (b.value / c.barLevels[0].value) * 100;
              return (<div key={i} className={`bar-row ${isCurrent ? "current" : ""}`}><span className="bar-name">{b.level}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div><span className="bar-val">R$ {b.value}</span></div>);
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3 className="card-title">Leitura Consolidada</h3><p className="card-desc">Síntese da tendência</p></div>
            <Eye size={16} style={{ color: "#9CA3B8" }} />
          </div>
          <div className="insights">
            {c.pkOcc > 2 && (<div className="insight pos"><TrendingUp size={15} /><p><strong>Pickup de ocupação acelerando</strong> — crescimento consistente nos últimos dias</p></div>)}
            {c.pkOcc <= 2 && c.pkOcc > 0 && (<div className="insight warn"><AlertTriangle size={15} /><p><strong>Pickup de ocupação lento</strong> — ritmo insuficiente para alcançar meta</p></div>)}
            {c.pkOcc <= 0 && (<div className="insight neg"><TrendingDown size={15} /><p><strong>Pickup negativo</strong> — cancelamentos superando novas reservas</p></div>)}
            {c.pkDm < 0 && (<div className="insight warn"><TrendingDown size={15} /><p><strong>DM sob pressão</strong> — diária média em queda, avaliar proteção tarifária</p></div>)}
            {c.pkDm >= 0 && (<div className="insight pos"><DollarSign size={15} /><p><strong>DM estável/subindo</strong> — espaço para manutenção ou incremento de BAR</p></div>)}
            <div className="insight neutral"><Target size={15} /><p><strong>Recomendação</strong> — {c.occ > 75 ? `Manter ${c.barAtual}, avaliar subida no fim de semana` : c.occ > 60 ? `Manter ${c.barAtual} até consolidar volume OTB` : `Avaliar redução de BAR para capturar volume`}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState("home");
  const [selectedClient, setSelectedClient] = useState(null);

  const handleSelectClient = (c) => {
    setSelectedClient(c);
    setActive("clientes");
  };

  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg:#F5F6FA;--surface:#FFFFFF;--surface-h:#F0F2F8;--border:#E4E8F1;--border-l:#EEF0F6;
  --text:#161921;--text-s:#5A6178;--text-m:#99A0B4;
  --accent:#3B82F6;--accent-l:#EBF2FF;--accent-d:#2563EB;
  --green:#10B981;--green-l:#ECFDF5;--red:#EF4444;--red-l:#FEF2F2;
  --amber:#F59E0B;--amber-l:#FFFBEB;
  --r:16px;--rs:10px;--rx:6px;
  --sh:0 1px 3px rgba(0,0,0,0.04),0 1px 2px rgba(0,0,0,0.02);
  --sh-m:0 4px 16px rgba(0,0,0,0.05),0 1px 3px rgba(0,0,0,0.03);
  --font:'DM Sans',-apple-system,sans-serif;--mono:'JetBrains Mono',monospace;
}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:var(--font);background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;}
button{font-family:var(--font);cursor:pointer;border:none;background:none;color:inherit;}

@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeIn .4s ease forwards}
@keyframes cardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

.navbar{display:flex;align-items:center;justify-content:space-between;padding:0 28px;height:56px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50}
.navbar-left{display:flex;align-items:center;gap:24px}
.nav-brand{display:flex;align-items:center;gap:8px}
.brand-icon{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#3B82F6,#6366F1);display:flex;align-items:center;justify-content:center;color:#fff}
.brand-name{font-size:15px;font-weight:700;letter-spacing:-.3px}
.nav-tabs{display:flex;align-items:center;gap:2px}
.nav-tab{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:var(--rx);font-size:13px;font-weight:500;color:var(--text-s);transition:all .15s}
.nav-tab:hover{background:var(--surface-h);color:var(--text)}
.nav-tab.active{background:var(--accent-l);color:var(--accent-d)}
.breadcrumb-tab{gap:4px}
.breadcrumb-back{display:flex;align-items:center;gap:3px;color:var(--text-m);font-size:13px;font-weight:500;transition:color .15s}
.breadcrumb-back:hover{color:var(--accent)}
.breadcrumb-sep{color:var(--text-m)}
.navbar-right{display:flex;align-items:center;gap:10px}
.search-box{display:flex;align-items:center;gap:7px;padding:6px 14px;background:var(--bg);border:1px solid var(--border);border-radius:100px;font-size:12.5px;color:var(--text-m);transition:border .15s}
.search-box:hover{border-color:var(--accent)}
.nav-icon-btn{position:relative;width:34px;height:34px;border:1px solid var(--border);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-s);transition:all .15s}
.nav-icon-btn:hover{border-color:var(--accent);color:var(--accent)}
.notif-dot{position:absolute;top:5px;right:6px;width:6px;height:6px;background:var(--red);border-radius:50%;border:1.5px solid var(--surface)}
.avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#3B82F6,#8B5CF6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff}

.content{padding:24px 28px 40px;max-width:1360px;margin:0 auto}

.home-hero{background:linear-gradient(135deg,#1A2744,#1E3E6E,#2D6CB5);border-radius:var(--r);padding:32px 36px;color:#fff;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.hero-greeting{font-size:13px;opacity:.6;font-weight:500;margin-bottom:4px}
.hero-title{font-size:26px;font-weight:700;letter-spacing:-.5px;margin-bottom:6px}
.hero-desc{font-size:13px;opacity:.55}
.hero-kpis{display:flex;align-items:center;gap:0}
.hero-kpi{display:flex;flex-direction:column;align-items:center;padding:0 28px}
.hk-label{font-size:11px;opacity:.55;font-weight:500;margin-bottom:4px}
.hk-value{font-size:22px;font-weight:700;letter-spacing:-.3px}
.hero-kpi-divider{width:1px;height:40px;background:rgba(255,255,255,.15)}
.home-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.home-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:22px}
.home-card.full-width{grid-column:1/-1}
.hc-title{font-size:14px;font-weight:600;margin-bottom:14px;letter-spacing:-.2px}
.hc-empty{font-size:13px;color:var(--text-m)}
.alert-list{display:flex;flex-direction:column;gap:6px}
.alert-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--rs);transition:background .15s;width:100%;text-align:left}
.alert-row:hover{background:var(--surface-h)}
.alert-badge{width:32px;height:32px;border-radius:var(--rx);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.alert-info{flex:1;min-width:0}
.alert-name{font-size:13px;font-weight:600;display:block}
.alert-detail{font-size:11.5px;color:var(--text-m)}
.alert-chevron{color:var(--text-m);flex-shrink:0}
.top-list{display:flex;flex-direction:column;gap:4px}
.top-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--rs);transition:background .15s;width:100%;text-align:left}
.top-row:hover{background:var(--surface-h)}
.top-rank{width:24px;height:24px;border-radius:50%;background:var(--accent-l);color:var(--accent);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.top-info{flex:1;min-width:0}
.top-name{font-size:13px;font-weight:600;display:block}
.top-city{font-size:11px;color:var(--text-m)}
.top-value{font-size:14px;font-weight:700;color:var(--accent);font-family:var(--mono)}
.snapshot-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.snap-card{padding:16px;border:1px solid var(--border);border-radius:var(--rs);text-align:left;transition:all .2s}
.snap-card:hover{border-color:var(--accent);box-shadow:var(--sh-m);transform:translateY(-1px)}
.snap-top{display:flex;align-items:center;gap:8px;margin-bottom:2px}
.snap-status{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.snap-name{font-size:13px;font-weight:600}
.snap-city{font-size:11px;color:var(--text-m);margin-bottom:10px}
.snap-kpis{display:flex;gap:12px;margin-bottom:10px}
.snap-kpi{display:flex;flex-direction:column}
.sk-val{font-size:13px;font-weight:700;font-family:var(--mono)}
.sk-lbl{font-size:10px;color:var(--text-m);font-weight:500}
.snap-meta-bar{height:4px;background:var(--border-l);border-radius:100px;overflow:hidden;margin-bottom:4px}
.snap-meta-fill{height:100%;border-radius:100px;transition:width .6s ease}
.snap-bottom{display:flex;justify-content:space-between;align-items:center}
.snap-meta-label{font-size:10px;color:var(--text-m);font-weight:500}
.snap-bar-label{font-size:10px;font-weight:600;color:var(--text-s);font-family:var(--mono);padding:1px 6px;background:var(--bg);border-radius:100px}

.clientes-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px}
.cv-title{font-size:20px;font-weight:700;letter-spacing:-.4px}
.cv-desc{font-size:13px;color:var(--text-m);margin-top:2px}
.sort-group{display:flex;align-items:center;gap:4px}
.sort-label{font-size:11.5px;color:var(--text-m);margin-right:4px;font-weight:500}
.sort-btn{padding:5px 12px;border-radius:var(--rx);font-size:12px;font-weight:500;color:var(--text-m);transition:all .15s}
.sort-btn:hover{background:var(--surface-h);color:var(--text)}
.sort-btn.active{background:var(--accent-l);color:var(--accent-d)}
.client-cards{display:flex;flex-direction:column;gap:8px}
.client-card{display:flex;align-items:center;gap:16px;padding:18px 22px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);transition:all .2s;text-align:left;animation:cardIn .4s ease forwards;opacity:0}
.client-card:hover{border-color:var(--accent);box-shadow:var(--sh-m);transform:translateY(-1px)}
.cc-left{min-width:220px}
.cc-name-row{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.cc-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.cc-name{font-size:14.5px;font-weight:600;letter-spacing:-.2px}
.cc-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:100px;font-size:10.5px;font-weight:600}
.cc-city{font-size:12px;color:var(--text-m)}
.cc-kpis{display:flex;gap:20px;flex:1}
.cc-kpi{display:flex;flex-direction:column;align-items:center;min-width:64px}
.ck-val{font-size:14px;font-weight:700;font-family:var(--mono);letter-spacing:-.3px}
.ck-val.pk.pos{color:var(--green)}.ck-val.pk.neg{color:var(--red)}
.ck-val.bar-val{font-size:12px;padding:2px 8px;background:var(--bg);border-radius:100px}
.ck-lbl{font-size:10px;color:var(--text-m);font-weight:500;margin-top:2px}
.cc-kpi.highlight .ck-val{color:var(--accent-d)}
.cc-meta-wrap{display:flex;align-items:center;gap:8px;min-width:100px}
.cc-meta-bar{flex:1;height:4px;background:var(--border-l);border-radius:100px;overflow:hidden}
.cc-meta-fill{height:100%;border-radius:100px}
.cc-meta-pct{font-size:12px;font-weight:600;color:var(--text-s);font-family:var(--mono);min-width:36px;text-align:right}
.cc-chevron{color:var(--text-m);flex-shrink:0}

.detail-header{border-left:4px solid;border-radius:var(--rx);padding:14px 18px;background:var(--surface);margin-bottom:18px;display:flex;justify-content:space-between;align-items:center}
.dh-name{font-size:20px;font-weight:700;letter-spacing:-.4px}
.dh-info{font-size:13px;color:var(--text-m);margin-top:2px}
.dh-badge{padding:5px 14px;border-radius:100px;font-size:12px;font-weight:600}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.kpi-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px;animation:cardIn .45s ease forwards;opacity:0;transition:box-shadow .2s}
.kpi-card:hover{box-shadow:var(--sh-m)}
.kpi-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.kpi-title{font-size:12px;font-weight:500;color:var(--text-m)}
.kpi-icon{width:30px;height:30px;border-radius:var(--rx);background:var(--accent-l);color:var(--accent);display:flex;align-items:center;justify-content:center}
.kpi-value{font-size:24px;font-weight:700;letter-spacing:-.6px;margin-bottom:4px}
.kpi-delta{display:inline-flex;align-items:center;gap:2px;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:100px}
.kpi-delta.pos{background:var(--green-l);color:var(--green)}.kpi-delta.neg{background:var(--red-l);color:var(--red)}
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px;animation:cardIn .5s ease forwards;animation-delay:.15s;opacity:0}
.card-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.card-title{font-size:14px;font-weight:600;letter-spacing:-.2px}
.card-desc{font-size:11.5px;color:var(--text-m);margin-top:1px}
.toggle-group{display:flex;gap:2px;background:var(--bg);border-radius:var(--rx);padding:2px}
.toggle-btn{padding:4px 11px;border-radius:5px;font-size:11.5px;font-weight:500;color:var(--text-m);transition:all .15s}
.toggle-btn.active{background:var(--surface);color:var(--text);box-shadow:var(--sh)}
.custom-tooltip{background:var(--text);border-radius:var(--rx);padding:9px 13px;font-size:11.5px;color:#fff}
.tooltip-label{font-weight:600;margin-bottom:5px;opacity:.6;font-size:10.5px}
.tooltip-row{display:flex;align-items:center;gap:5px;margin-top:2px}
.tooltip-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.legend-row{display:flex;gap:14px;justify-content:center;padding-top:8px}
.legend-item{display:flex;align-items:center;gap:5px;font-size:10.5px;color:var(--text-m)}
.leg-dot{width:7px;height:7px;border-radius:50%}
.comp-table{width:100%;border-collapse:collapse;font-size:12.5px}
.comp-table th{text-align:left;padding:7px 10px;font-size:10.5px;font-weight:600;color:var(--text-m);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)}
.comp-table td{padding:9px 10px;border-bottom:1px solid var(--border-l)}
.comp-table tr.own{background:var(--accent-l)}
.comp-table tr.own td{font-weight:500}
.comp-name{display:flex;align-items:center;gap:7px;font-weight:500}
.comp-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.bar-badge{display:inline-block;padding:1px 7px;background:var(--bg);border-radius:100px;font-size:10.5px;font-weight:600;font-family:var(--mono)}
td.bold{font-weight:600}
.meta-content{display:flex;flex-direction:column;gap:14px}
.meta-bar-track{display:flex;height:28px;border-radius:var(--rs);overflow:hidden;background:var(--bg)}
.meta-seg{display:flex;align-items:center;justify-content:center}
.seg-lbl{font-size:9.5px;font-weight:600;color:#fff}
.seg-0{background:var(--green)}.seg-1{background:var(--accent)}.seg-2{background:var(--border)}.seg-2 .seg-lbl{color:var(--text-m)}
.meta-details{display:flex;gap:16px}
.meta-detail{display:flex;align-items:center;gap:5px;font-size:12px}
.md-dot{width:7px;height:7px;border-radius:50%}
.md-dot.seg-0{background:var(--green)}.md-dot.seg-1{background:var(--accent)}.md-dot.seg-2{background:var(--border)}
.md-label{color:var(--text-m)}.md-value{font-weight:600}.md-pct{color:var(--text-m);font-size:11px}
.fazer-dia{display:flex;justify-content:space-between;padding:9px 14px;background:var(--amber-l);border:1px solid #FDE68A;border-radius:var(--rs);font-size:12.5px;color:var(--text-s)}
.fazer-dia strong{color:var(--amber);font-family:var(--mono)}
.bar-current{padding:3px 11px;background:var(--accent);color:#fff;border-radius:100px;font-size:11.5px;font-weight:600;font-family:var(--mono)}
.bar-levels{display:flex;flex-direction:column;gap:6px}
.bar-row{display:flex;align-items:center;gap:10px;padding:5px 8px;border-radius:var(--rx);transition:background .15s}
.bar-row.current{background:var(--accent-l)}
.bar-name{width:52px;font-size:11.5px;font-weight:600;font-family:var(--mono);color:var(--text-m);flex-shrink:0}
.bar-row.current .bar-name{color:var(--accent-d)}
.bar-track{flex:1;height:7px;background:var(--bg);border-radius:100px;overflow:hidden}
.bar-fill{height:100%;background:var(--border);border-radius:100px;transition:width .6s ease}
.bar-row.current .bar-fill{background:var(--accent)}
.bar-val{width:56px;text-align:right;font-size:12px;font-weight:600;font-family:var(--mono);color:var(--text-m)}
.bar-row.current .bar-val{color:var(--accent-d)}
.insights{display:flex;flex-direction:column;gap:8px}
.insight{display:flex;gap:9px;padding:10px 12px;border-radius:var(--rs);align-items:flex-start}
.insight svg{flex-shrink:0;margin-top:1px}
.insight p{font-size:12.5px;line-height:1.5;color:var(--text-s)}
.insight strong{color:var(--text)}
.insight.pos{background:var(--green-l)}.insight.pos svg{color:var(--green)}
.insight.warn{background:var(--amber-l)}.insight.warn svg{color:var(--amber)}
.insight.neg{background:var(--red-l)}.insight.neg svg{color:var(--red)}
.insight.neutral{background:var(--accent-l)}.insight.neutral svg{color:var(--accent)}

@media(max-width:1100px){.kpi-row{grid-template-columns:repeat(2,1fr)}.detail-grid{grid-template-columns:1fr}.snapshot-grid{grid-template-columns:repeat(2,1fr)}.cc-kpis{flex-wrap:wrap;gap:12px}}
@media(max-width:768px){.content{padding:16px}.kpi-row{grid-template-columns:1fr}.home-hero{flex-direction:column;gap:20px}.hero-kpis{flex-wrap:wrap}.snapshot-grid{grid-template-columns:1fr}.client-card{flex-direction:column;align-items:flex-start}.cc-kpis{width:100%}.cc-meta-wrap{width:100%}}
      `}</style>

      <Navbar active={active} setActive={setActive} selectedClient={selectedClient} setSelectedClient={setSelectedClient} />
      <div className="content">
        {selectedClient ? (
          <ClientDetailView client={selectedClient} />
        ) : active === "home" ? (
          <HomeView setActive={setActive} setSelectedClient={handleSelectClient} />
        ) : (
          <ClientesView setSelectedClient={handleSelectClient} />
        )}
      </div>
    </>
  );
}
