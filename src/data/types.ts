// ─── Hotel Status ────────────────────────────────────────────────────
export type HotelStatus = 'excellent' | 'healthy' | 'warning' | 'critical';

// ─── Database Row Types (match Supabase tables) ─────────────────────

export interface HotelRow {
  id: number;
  property_id: number | null;
  razao_social: string;
  nome_fantasia: string;
  cidade: string | null;
  estado: string | null;
  total_uhs: number;
  total_leitos: number | null;
  cadastur: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReceitaDiariaRow {
  id: number;
  hotel_id: number;
  data_extracao: string;
  data_referencia: string;
  uhs: number;
  out_of_order: number;
  ocupados: number;
  occ_pct: string;
  disponivel: number;
  cortesia: number;
  house_use: number;
  exchange: number;
  checkins: number;
  walkins: number;
  checkouts: number;
  reservas: number;
  pax: number | null;
  chd: number | null;
  rec_total: string;
  rec_diarias: string;
  rec_ab: string;
  adr: string;
  revpar: string;
  agr: string | null;
  status_auditoria: string | null;
  created_at: string;
}

// ─── Parsed KPI for UI ──────────────────────────────────────────────

export interface KpiDiario {
  id: number;
  hotelId: number;
  dataExtracao: string;
  date: string;
  recTotal: number;
  recDiarias: number;
  recAb: number;
  ocupados: number;
  cortesia: number;
  totalUhs: number;
  occPct: number;
  revpar: number;
  adr: number;
  pax: number | null;
  chd: number | null;
  checkins: number;
  checkouts: number;
  statusAuditoria: string | null;
}

// ─── Pick-up View Row (vw_pickup_diario) ────────────────────────────

export interface PickupRow {
  hotel_id: number;
  data_extracao: string;
  data_extracao_ant: string | null;
  data_referencia: string;
  pu_tt_uh: number;
  pu_rec_hosp: string;
  pu_dm_tt: string;
  pu_occ_tt: string;
  pu_revpar_tt: string;
  tt_uhs_ocup: number;
  rec_hosp: string;
  dm_cc_tt: string;
  occ_tt: string;
  revp_tt: string;
  tt_hosp: number | null;
  chds: number | null;
  uhs_disp: number;
  uhs: number;
}

// ─── Hotel Summary (for list/cards) ─────────────────────────────────

export interface HotelSummary {
  id: number;
  name: string;
  razaoSocial: string;
  city: string;
  state: string;
  uhs: number;
  leitos: number | null;
  ativo: boolean;

  // Aggregated KPIs
  avgOcc: number;
  avgRevpar: number;
  avgDm: number | null;
  totalReceita: number;
  totalRecDiarias: number;
  totalRecAb: number;
  diasComDados: number;

  receitaMesAnterior: number;
  receitaMesAtual: number;
  receitaMesQueVem: number;

  occMesAnterior: number;
  occMesAtual: number;
  occMesQueVem: number;

  // Current-month operational KPIs
  ocupadosMesAtual: number;
  hospedesMesAtual: number;
  diasMesAtual: number;

  // Latest day snapshot
  latestDate: string;
  latestExtracao: string;
  latestOcc: number;
  latestRevpar: number;
  latestDm: number | null;
  latestRecTotal: number;

  status: HotelStatus;
}

// ─── Portfolio Summary ──────────────────────────────────────────────
export interface PortfolioSummary {
  totalReceita: number;
  avgOcc: number;
  avgRevpar: number;
  avgDm: number;
  totalHotels: number;
  totalDias: number;
  alerts: HotelSummary[];
  topRevpar: HotelSummary[];
}

// ─── Status Config ──────────────────────────────────────────────────
export interface StatusConfig {
  label: string;
  color: string;
  bg: string;
}

// ─── Booking Rate (Rate Shopper) ─────────────────────────────────────
export interface BookingRate {
  id: number;
  hotelId: number;
  checkinDate: string;       // YYYY-MM-DD
  slug: string;
  label: string;
  type: 'cliente' | 'concorrente';
  roomName: string;
  roomId: string | null;
  maxPersons: number;
  mealPlan: string | null;
  cancellation: string | null;
  priceBrl: number;
  scrapedAt: string;
}

// Computed per-day summary for the calendar cell
export interface RateDaySummary {
  date: string;
  clientMin: number | null;
  competitorMin: number | null;
  pctVsCompetitor: number | null; // positive = client more expensive
  hasData: boolean;
}
