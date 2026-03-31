import type { HotelRow, ReceitaDiariaRow, KpiDiario, HotelSummary, HotelStatus, PortfolioSummary } from './types';

/** Parse a ReceitaDiariaRow (string numerics) to a KpiDiario (numbers) */
export function parseKpiRow(row: ReceitaDiariaRow): KpiDiario {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    dataExtracao: row.data_extracao,
    date: row.data_referencia,
    recTotal: parseFloat(row.rec_total) || 0,
    recDiarias: parseFloat(row.rec_diarias) || 0,
    recAb: parseFloat(row.rec_ab) || 0,
    ocupados: row.ocupados,
    cortesia: row.cortesia,
    totalUhs: row.uhs,
    occPct: parseFloat(row.occ_pct) || 0,
    revpar: parseFloat(row.revpar) || 0,
    adr: parseFloat(row.adr) || 0,
    pax: row.pax,
    chd: row.chd,
    checkins: row.checkins,
    checkouts: row.checkouts,
    statusAuditoria: row.status_auditoria,
  };
}

/** Derive status from average occupancy */
export function deriveStatus(avgOcc: number): HotelStatus {
  if (avgOcc < 25) return 'critical';
  if (avgOcc < 45) return 'warning';
  if (avgOcc < 70) return 'healthy';
  return 'excellent';
}

/** Build a HotelSummary from hotel + its receita rows */
export function buildHotelSummary(hotel: HotelRow, kpiRows: ReceitaDiariaRow[]): HotelSummary {
  const kpis = kpiRows.map(parseKpiRow);
  const n = kpis.length;

  const totalReceita = kpis.reduce((s, k) => s + k.recTotal, 0);
  const totalRecDiarias = kpis.reduce((s, k) => s + k.recDiarias, 0);
  const totalRecAb = kpis.reduce((s, k) => s + k.recAb, 0);
  const avgOcc = n > 0 ? parseFloat((kpis.reduce((s, k) => s + k.occPct, 0) / n).toFixed(1)) : 0;
  const avgRevpar = n > 0 ? parseFloat((kpis.reduce((s, k) => s + k.revpar, 0) / n).toFixed(2)) : 0;

  const avgDm = n > 0
    ? parseFloat((kpis.reduce((s, k) => s + k.adr, 0) / n).toFixed(2))
    : null;

  // Receitas por Mês
  const now = new Date();
  
  const currY = now.getFullYear();
  const currM = now.getMonth() + 1;
  const currYm = `${currY}-${String(currM).padStart(2, '0')}`;
  
  const prevM = currM === 1 ? 12 : currM - 1;
  const prevY = currM === 1 ? currY - 1 : currY;
  const prevYm = `${prevY}-${String(prevM).padStart(2, '0')}`;
  
  const nextM = currM === 12 ? 1 : currM + 1;
  const nextY = currM === 12 ? currY + 1 : currY;
  const nextYm = `${nextY}-${String(nextM).padStart(2, '0')}`;

  let receitaMesAnterior = 0;
  let receitaMesAtual = 0;
  let receitaMesQueVem = 0;

  let sumOccAnt = 0; let countOccAnt = 0;
  let sumOccAtual = 0; let countOccAtual = 0;
  let sumOccProx = 0; let countOccProx = 0;

  let ocupadosMesAtual = 0;
  let hospedesMesAtual = 0;

  kpis.forEach(k => {
    const ym = k.date.substring(0, 7);
    if (ym === prevYm) {
      receitaMesAnterior += k.recTotal;
      sumOccAnt += k.occPct;
      countOccAnt++;
    }
    else if (ym === currYm) {
      receitaMesAtual += k.recTotal;
      sumOccAtual += k.occPct;
      countOccAtual++;
      ocupadosMesAtual += k.ocupados;
      hospedesMesAtual += (k.pax ?? 0) + (k.chd ?? 0);
    }
    else if (ym === nextYm) {
      receitaMesQueVem += k.recTotal;
      sumOccProx += k.occPct;
      countOccProx++;
    }
  });

  const occMesAnterior = countOccAnt > 0 ? sumOccAnt / countOccAnt : 0;
  const occMesAtual = countOccAtual > 0 ? sumOccAtual / countOccAtual : 0;
  const occMesQueVem = countOccProx > 0 ? sumOccProx / countOccProx : 0;

  const latest = kpis.length > 0 ? kpis[kpis.length - 1] : null;

  // Most recent extraction date from raw rows
  const latestExtracao = kpiRows.length > 0
    ? kpiRows.reduce((max, r) => r.data_extracao > max ? r.data_extracao : max, kpiRows[0].data_extracao)
    : '—';

  return {
    id: hotel.id,
    name: hotel.nome_fantasia,
    razaoSocial: hotel.razao_social,
    city: hotel.cidade ?? '—',
    state: hotel.estado ?? '—',
    uhs: hotel.total_uhs,
    leitos: hotel.total_leitos,
    ativo: hotel.ativo,
    avgOcc,
    avgRevpar,
    avgDm,
    totalReceita,
    totalRecDiarias,
    totalRecAb,
    diasComDados: n,
    receitaMesAnterior,
    receitaMesAtual,
    receitaMesQueVem,
    occMesAnterior,
    occMesAtual,
    occMesQueVem,
    ocupadosMesAtual,
    hospedesMesAtual,
    diasMesAtual: countOccAtual,
    latestDate: latest?.date ?? '—',
    latestExtracao,
    latestOcc: latest?.occPct ?? 0,
    latestRevpar: latest?.revpar ?? 0,
    latestDm: latest?.adr ?? null,
    latestRecTotal: latest?.recTotal ?? 0,
    status: deriveStatus(avgOcc),
  };
}

/** Build portfolio-level summary */
export function aggregatePortfolio(hotels: HotelSummary[]): PortfolioSummary {
  const totalReceita = hotels.reduce((s, h) => s + h.totalReceita, 0);
  const n = hotels.length;
  const avgOcc = n > 0 ? parseFloat((hotels.reduce((s, h) => s + h.avgOcc, 0) / n).toFixed(1)) : 0;
  const avgRevpar = n > 0 ? Math.round(hotels.reduce((s, h) => s + h.avgRevpar, 0) / n) : 0;
  const dms = hotels.filter(h => h.avgDm !== null);
  const avgDm = dms.length > 0 ? Math.round(dms.reduce((s, h) => s + (h.avgDm ?? 0), 0) / dms.length) : 0;
  const totalDias = hotels.reduce((s, h) => s + h.diasComDados, 0);

  const alerts = hotels.filter(h => h.status === 'critical' || h.status === 'warning');
  const topRevpar = [...hotels].sort((a, b) => b.avgRevpar - a.avgRevpar).slice(0, 3);

  return { totalReceita, avgOcc, avgRevpar, avgDm, totalHotels: n, totalDias, alerts, topRevpar };
}

/** Generate textual insights from KPI data */
export function getInsights(kpis: KpiDiario[]): Array<{ type: 'pos' | 'warn' | 'neg' | 'neutral'; title: string; text: string }> {
  const insights: Array<{ type: 'pos' | 'warn' | 'neg' | 'neutral'; title: string; text: string }> = [];
  if (kpis.length < 2) {
    insights.push({ type: 'neutral', title: 'Dados insuficientes', text: 'Menos de 2 dias de dados para análise de tendência.' });
    return insights;
  }

  // Compare last 7 days vs previous 7
  const recent = kpis.slice(-7);
  const previous = kpis.slice(-14, -7);

  const recentAvgOcc = recent.reduce((s, k) => s + k.occPct, 0) / recent.length;
  const recentAvgRevpar = recent.reduce((s, k) => s + k.revpar, 0) / recent.length;

  if (previous.length > 0) {
    const prevAvgOcc = previous.reduce((s, k) => s + k.occPct, 0) / previous.length;
    const occDelta = recentAvgOcc - prevAvgOcc;

    if (occDelta > 5) {
      insights.push({ type: 'pos', title: 'Ocupação subindo', text: `+${occDelta.toFixed(1)}pp vs semana anterior. Tendência positiva.` });
    } else if (occDelta > 0) {
      insights.push({ type: 'warn', title: 'Ocupação leve melhora', text: `+${occDelta.toFixed(1)}pp vs semana anterior. Ritmo lento.` });
    } else {
      insights.push({ type: 'neg', title: 'Ocupação em queda', text: `${occDelta.toFixed(1)}pp vs semana anterior.` });
    }

    const prevAvgRevpar = previous.reduce((s, k) => s + k.revpar, 0) / previous.length;
    const revparDelta = recentAvgRevpar - prevAvgRevpar;
    if (revparDelta >= 0) {
      insights.push({ type: 'pos', title: 'RevPAR estável/subindo', text: `+R$ ${revparDelta.toFixed(2)} vs semana anterior.` });
    } else {
      insights.push({ type: 'warn', title: 'RevPAR sob pressão', text: `R$ ${revparDelta.toFixed(2)} vs semana anterior.` });
    }
  }

  // General recommendation
  if (recentAvgOcc >= 70) {
    insights.push({ type: 'pos', title: 'Recomendação', text: 'Ocupação boa. Oportunidade para avaliar incremento de tarifa.' });
  } else if (recentAvgOcc >= 40) {
    insights.push({ type: 'neutral', title: 'Recomendação', text: 'Ocupação moderada. Manter preços e monitorar pickup.' });
  } else {
    insights.push({ type: 'neg', title: 'Recomendação', text: 'Ocupação baixa. Avaliar ações promocionais para capturar volume.' });
  }

  return insights;
}
