// MOCK de feriados (visual). Modelo por ABRANGÊNCIA (escopo) — o feriado é registrado uma vez
// e vale para o GRUPO de hotéis daquele escopo:
//   nacional  → todos os hotéis
//   estadual  → todos os hotéis da UF
//   municipal → todos os hotéis da cidade
// Cada registro é PONTUAL (data única), ANUAL (todo ano na data) ou por DIA DA SEMANA
// (escolhe o(s) dia(s) e a frequência: toda semana, ou 1ª/2ª/3ª/4ª/última do mês — estilo Teams).
// Depois vira tabela real (feriado + escopo) no Supabase.

export type Abrangencia = 'nacional' | 'estadual' | 'municipal';
export type RecTipo = 'unica' | 'anual' | 'diaSemana';
export type Ocorrencia = 'toda' | 1 | 2 | 3 | 4 | -1; // 'toda' = toda semana; nº = n-ésima do mês; -1 = última

export interface Recorrencia {
  tipo: RecTipo;
  data?: string;            // unica | base p/ anual (usa MM-DD)
  dias?: number[];          // diaSemana: 0=Dom … 6=Sáb
  ocorrencia?: Ocorrencia;  // diaSemana
  mes?: number | null;      // diaSemana: limitar a um mês (1..12) ou null = todo mês
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

// ─── rótulos pt-BR ───────────────────────────────────────────────
export const DOW_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const DOW_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DOW_INI = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const MES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MASC = [true, false, false, false, false, false, true]; // domingo e sábado masculinos

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

// Chip da esquerda: data (unica/anual) ou nulo (diaSemana → ícone de repetição).
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

// ─── helpers do mock ─────────────────────────────────────────────
const unica = (data: string): Recorrencia => ({ tipo: 'unica', data });
const anual = (data: string): Recorrencia => ({ tipo: 'anual', data });
const ds = (dias: number[], ocorrencia: Ocorrencia = 'toda', mes: number | null = null): Recorrencia => ({ tipo: 'diaSemana', dias, ocorrencia, mes });

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

    // Estaduais
    est('SP', 'Revolução Constitucionalista', anual('2026-07-09')),
    est('AM', 'Dia do Amazonas', anual('2026-09-05')),

    // Municipais
    mun('São Paulo', 'SP', 'Aniversário de São Paulo', anual('2026-01-25')),
    mun('Manaus', 'AM', 'Aniversário de Manaus', anual('2026-10-24')),
    mun('Manaus', 'AM', 'N. Sra. da Conceição', anual('2026-12-08'), false),
    mun('Barueri', 'SP', 'Aniversário de Barueri', anual('2026-03-26')),
    mun('Rio Branco', 'AC', 'Aniversário de Rio Branco', anual('2026-12-28')),

    // Recorrentes por dia da semana
    mun('Manaus', 'AM', 'Feira de artesanato', ds([6], 'toda')),          // Todo sábado
    mun('São Paulo', 'SP', 'Missa da padroeira', ds([0], -1)),            // Último domingo do mês
    mun('Barueri', 'SP', 'Festival de verão', ds([6], 'toda', 3)),       // Todo sábado · Março
  ];
}
