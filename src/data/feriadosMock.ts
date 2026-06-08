// MOCK de feriados (visual). Modelo por ABRANGÊNCIA (escopo) — o feriado é registrado uma vez
// e vale para o GRUPO de hotéis daquele escopo:
//   nacional  → todos os hotéis
//   estadual  → todos os hotéis da UF
//   municipal → todos os hotéis da cidade
// (opcional: limitar a hotéis específicos do grupo via `hotelIds`).
// Cada registro é PONTUAL (data única), ANUAL (todo ano na data) ou RECORRENTE (semanal/mensal,
// estilo recorrência do Teams: "todo sábado", "último domingo", "todos os sábados de março").
// Depois vira tabela real (feriado + escopo) no Supabase.

export type Abrangencia = 'nacional' | 'estadual' | 'municipal';
export type RecTipo = 'unica' | 'anual' | 'semanal' | 'mensal';

export interface Recorrencia {
  tipo: RecTipo;
  data?: string;               // 'YYYY-MM-DD' (unica) | base p/ anual (usa MM-DD)
  diasSemana?: number[];       // semanal: 0=Dom … 6=Sáb
  semana?: 1 | 2 | 3 | 4 | -1; // mensal: ordinal (-1 = última)
  diaSemana?: number;          // mensal: 0..6
  mes?: number | null;         // semanal/mensal: limitar a um mês (1..12) ou null = todo mês
}

export interface Feriado {
  id: string;
  nome: string;
  abrangencia: Abrangencia;
  uf?: string;          // estadual/municipal
  cidade?: string;      // municipal
  hotelIds?: number[];  // undefined = todos os hotéis do escopo
  rec: Recorrencia;
  ativo: boolean;
}

export interface HotelRef { hotelId: number; nome: string; cidade: string; estado: string; uhs: number }

export const HOTEIS: HotelRef[] = [
  { hotelId: 15, nome: 'AMAZON PARK HOTEL', cidade: 'Manaus', estado: 'AM', uhs: 85 },
  { hotelId: 13, nome: 'PAULISTA FLAT', cidade: 'São Paulo', estado: 'SP', uhs: 96 },
  { hotelId: 14, nome: 'HOTEL SOL ALPHAVILLE', cidade: 'Barueri', estado: 'SP', uhs: 110 },
  { hotelId: 43, nome: 'UCAYALI', cidade: 'Rio Branco', estado: 'AC', uhs: 120 },
];

// ─── rótulos pt-BR de recorrência ────────────────────────────────
export const DOW_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const DOW_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MASC = [true, false, false, false, false, false, true]; // domingo e sábado são masculinos

function ord(s: number, d: number): string {
  if (s === -1) return MASC[d] ? 'Último' : 'Última';
  return `${s}${MASC[d] ? 'º' : 'ª'}`;
}

export function isRecorrente(r: Recorrencia): boolean {
  return r.tipo === 'semanal' || r.tipo === 'mensal';
}

// Chip da esquerda da linha: data (unica/anual) ou nulo (recorrente → ícone de repetição).
export function chipData(r: Recorrencia): { dia: string; mes: string } | null {
  if ((r.tipo === 'unica' || r.tipo === 'anual') && r.data) {
    return { dia: r.data.slice(8, 10), mes: MES_ABBR[Number(r.data.slice(5, 7)) - 1] ?? '—' };
  }
  return null;
}

export function recorrenciaLabel(r: Recorrencia): string {
  if (r.tipo === 'unica') {
    const [y, m, d] = (r.data ?? '').split('-');
    return d ? `${d}/${m}/${y}` : 'Data única';
  }
  if (r.tipo === 'anual') {
    const [, m, d] = (r.data ?? '').split('-');
    return d ? `Todo ano · ${d}/${m}` : 'Anual';
  }
  if (r.tipo === 'semanal') {
    const dias = (r.diasSemana ?? []).slice().sort((a, b) => a - b);
    let base: string;
    if (dias.length === 1) base = `${MASC[dias[0]] ? 'Todo' : 'Toda'} ${DOW_FULL[dias[0]]}`;
    else if (dias.length === 0) base = 'Semanal';
    else base = `Toda semana · ${dias.map(d => DOW_SHORT[d]).join(', ')}`;
    return r.mes ? `${base} · ${MES_FULL[r.mes - 1]}` : base;
  }
  // mensal
  const base = `${ord(r.semana ?? 1, r.diaSemana ?? 0)} ${DOW_FULL[r.diaSemana ?? 0]}`;
  return r.mes ? `${base} de ${MES_FULL[r.mes - 1]}` : `${base} do mês`;
}

// ─── helpers de construção do mock ───────────────────────────────
const unica = (data: string): Recorrencia => ({ tipo: 'unica', data });
const anual = (data: string): Recorrencia => ({ tipo: 'anual', data });
const semanal = (diasSemana: number[], mes: number | null = null): Recorrencia => ({ tipo: 'semanal', diasSemana, mes });
const mensal = (semana: 1 | 2 | 3 | 4 | -1, diaSemana: number, mes: number | null = null): Recorrencia => ({ tipo: 'mensal', semana, diaSemana, mes });

export function buildMockFeriados(): Feriado[] {
  let n = 0;
  const nac = (nome: string, rec: Recorrencia, ativo = true): Feriado => ({ id: `f${n++}`, nome, abrangencia: 'nacional', rec, ativo });
  const est = (uf: string, nome: string, rec: Recorrencia, ativo = true): Feriado => ({ id: `f${n++}`, nome, abrangencia: 'estadual', uf, rec, ativo });
  const mun = (cidade: string, uf: string, nome: string, rec: Recorrencia, ativo = true): Feriado => ({ id: `f${n++}`, nome, abrangencia: 'municipal', cidade, uf, rec, ativo });

  return [
    // Nacionais (fixos = anual; móveis 2026 = data única)
    nac('Confraternização Universal', anual('2026-01-01')),
    nac('Carnaval', unica('2026-02-17')),
    nac('Sexta-feira Santa', unica('2026-04-03')),
    nac('Tiradentes', anual('2026-04-21')),
    nac('Dia do Trabalho', anual('2026-05-01')),
    nac('Corpus Christi', unica('2026-06-04')),
    nac('Independência do Brasil', anual('2026-09-07')),
    nac('Nossa Senhora Aparecida', anual('2026-10-12')),
    nac('Finados', anual('2026-11-02')),
    nac('Proclamação da República', anual('2026-11-15')),
    nac('Consciência Negra', anual('2026-11-20')),
    nac('Natal', anual('2026-12-25')),

    // Estaduais (valem p/ todos os hotéis da UF)
    est('SP', 'Revolução Constitucionalista', anual('2026-07-09')),
    est('AM', 'Dia do Amazonas', anual('2026-09-05')),

    // Municipais (valem p/ todos os hotéis da cidade)
    mun('São Paulo', 'SP', 'Aniversário de São Paulo', anual('2026-01-25')),
    mun('Manaus', 'AM', 'Aniversário de Manaus', anual('2026-10-24')),
    mun('Manaus', 'AM', 'N. Sra. da Conceição', anual('2026-12-08'), false),
    mun('Barueri', 'SP', 'Aniversário de Barueri', anual('2026-03-26')),
    mun('Rio Branco', 'AC', 'Aniversário de Rio Branco', anual('2026-12-28')),

    // Eventos RECORRENTES (demonstram o seletor de recorrência)
    mun('Manaus', 'AM', 'Feira de artesanato', semanal([6])),                 // Todo sábado
    mun('São Paulo', 'SP', 'Missa da padroeira', mensal(-1, 0)),              // Último domingo do mês
    mun('Barueri', 'SP', 'Festival de verão', semanal([6], 3)),              // Todo sábado · Março
  ];
}
