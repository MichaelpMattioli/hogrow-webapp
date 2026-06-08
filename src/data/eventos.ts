// Eventos e Feriados — tipos + rótulos pt-BR (lógica de exibição da recorrência).
// Os DADOS vêm do banco (tabela `evento`) via src/hooks/useEventos.ts; a expansão
// da recorrência em rótulo continua no app (mesmo shape do jsonb `recorrencia`).
// Modelo por ABRANGÊNCIA (escopo): nacional / estadual (uf) / municipal (uf+cidade) / hotel.

export type Abrangencia = 'nacional' | 'estadual' | 'municipal' | 'hotel';
export type RecTipo = 'unica' | 'anual' | 'diaSemana';
export type Ocorrencia = 'toda' | 1 | 2 | 3 | 4 | -1;

export interface Recorrencia {
  tipo: RecTipo;
  data?: string;
  dias?: number[];
  ocorrencia?: Ocorrencia;
  mes?: number | null;
}

export interface Feriado {
  id: string;
  nome: string;
  abrangencia: Abrangencia;
  uf?: string;        // estadual/municipal
  cidade?: string;    // municipal
  hotelId?: number;   // hotel (exclusivo)
  rec: Recorrencia;
  ativo: boolean;
}

// Dimensão de hotel-cliente usada para montar os grupos da página.
// `estado` carrega o CÓDIGO da UF (PA, SP…) para casar com `evento.uf`.
export interface HotelRef { hotelId: number; nome: string; cidade: string; estado: string; uhs: number }

// ─── rótulos pt-BR ───────────────────────────────────────────────
export const DOW_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const DOW_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MASC = [true, false, false, false, false, false, true];

export const OCORRENCIAS: { v: Ocorrencia; label: string; curto: string }[] = [
  { v: 'toda', label: 'Toda semana', curto: 'Toda semana' },
  { v: 1, label: '1ª do mês', curto: '1ª' },
  { v: 2, label: '2ª do mês', curto: '2ª' },
  { v: 3, label: '3ª do mês', curto: '3ª' },
  { v: 4, label: '4ª do mês', curto: '4ª' },
  { v: -1, label: 'Última do mês', curto: 'Última' },
];

function ordGen(oc: Ocorrencia, d: number): string {
  if (oc === -1) return MASC[d] ? 'Último' : 'Última';
  return `${oc}${MASC[d] ? 'º' : 'ª'}`;
}

export function isRecorrente(r: Recorrencia): boolean {
  return r.tipo === 'diaSemana';
}

export function chipData(r: Recorrencia): { dia: string; mes: string } | null {
  if ((r.tipo === 'unica' || r.tipo === 'anual') && r.data) {
    return { dia: r.data.slice(8, 10), mes: MES_ABBR[Number(r.data.slice(5, 7)) - 1] ?? '—' };
  }
  return null;
}

export function recorrenciaLabel(r: Recorrencia): string {
  if (r.tipo === 'unica') { const [y, m, d] = (r.data ?? '').split('-'); return d ? `${d}/${m}/${y}` : 'Data única'; }
  if (r.tipo === 'anual') { const [, m, d] = (r.data ?? '').split('-'); return d ? `Todo ano · ${d}/${m}` : 'Anual'; }
  const dias = (r.dias ?? []).slice().sort((a, b) => a - b);
  const oc = r.ocorrencia ?? 'toda';
  let base: string;
  if (dias.length === 0) base = 'Dia da semana';
  else if (oc === 'toda') {
    base = dias.length === 1 ? `${MASC[dias[0]] ? 'Todo' : 'Toda'} ${DOW_FULL[dias[0]]}` : `Toda semana · ${dias.map(d => DOW_SHORT[d]).join(', ')}`;
  } else {
    const o = dias.length === 1 ? ordGen(oc, dias[0]) : (oc === -1 ? 'Última' : `${oc}ª`);
    const nomes = dias.length === 1 ? DOW_FULL[dias[0]] : dias.map(d => DOW_SHORT[d]).join(', ');
    base = `${o} ${nomes} do mês`;
  }
  if (r.mes) return oc === 'toda' ? `${base} · ${MES_FULL[r.mes - 1]}` : base.replace(' do mês', ` de ${MES_FULL[r.mes - 1]}`);
  return base;
}

// Quais eventos (ativos) caem numa data 'YYYY-MM-DD' — expande a recorrência e
// devolve os nomes. Usado p/ badges em tabelas/calendários (ex.: pick-up diário).
export function eventosNaData(eventos: Feriado[], dateStr: string): string[] {
  if (!dateStr) return [];
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return [];
  const wd = new Date(y, m - 1, d).getDay(); // 0=domingo … 6=sábado
  const names: string[] = [];
  for (const e of eventos) {
    if (!e.ativo) continue;
    const r = e.rec;
    if (r.tipo === 'unica') {
      if (r.data === dateStr) names.push(e.nome);
    } else if (r.tipo === 'anual') {
      if (r.data && r.data.slice(5) === dateStr.slice(5)) names.push(e.nome); // mesmo dia/mês
    } else if (r.tipo === 'diaSemana') {
      const dias = r.dias ?? [];
      if (!dias.includes(wd)) continue;
      if (r.mes && r.mes !== m) continue;
      const oc = r.ocorrencia ?? 'toda';
      if (oc === 'toda') { names.push(e.nome); continue; }
      const nth = Math.floor((d - 1) / 7) + 1;            // 1ª..4ª ocorrência do weekday no mês
      const isLast = d + 7 > new Date(y, m, 0).getDate(); // última do mês?
      if (oc === -1 ? isLast : oc === nth) names.push(e.nome);
    }
  }
  return names;
}
