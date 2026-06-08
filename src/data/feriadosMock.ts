// MOCK de feriados para validar o visual da página de Feriados.
// Depois será substituído por dados reais (tabela `feriado` / `hotel_feriado` no Supabase).
// Modelo: cada hotel tem sua lista de feriados — os NACIONAIS são semeados de um template
// (ativáveis/desativáveis por hotel, não excluíveis) e os LOCAIS são por hotel (CRUD completo).

export type FeriadoTipo = 'nacional' | 'estadual' | 'municipal';

export interface Feriado {
  id: string;
  data: string; // 'YYYY-MM-DD'
  nome: string;
  tipo: FeriadoTipo;
  ativo: boolean;
}

export interface HotelFeriados {
  hotelId: number;
  nome: string;
  cidade: string;
  estado: string;
  uhs: number;
  feriados: Feriado[];
}

// Feriados nacionais 2026 (datas móveis calculadas p/ Páscoa 05/04/2026).
const NACIONAIS_2026: { data: string; nome: string }[] = [
  { data: '2026-01-01', nome: 'Confraternização Universal' },
  { data: '2026-02-16', nome: 'Carnaval (segunda)' },
  { data: '2026-02-17', nome: 'Carnaval' },
  { data: '2026-04-03', nome: 'Sexta-feira Santa' },
  { data: '2026-04-21', nome: 'Tiradentes' },
  { data: '2026-05-01', nome: 'Dia do Trabalho' },
  { data: '2026-06-04', nome: 'Corpus Christi' },
  { data: '2026-09-07', nome: 'Independência do Brasil' },
  { data: '2026-10-12', nome: 'Nossa Senhora Aparecida' },
  { data: '2026-11-02', nome: 'Finados' },
  { data: '2026-11-15', nome: 'Proclamação da República' },
  { data: '2026-11-20', nome: 'Consciência Negra' },
  { data: '2026-12-25', nome: 'Natal' },
];

// Locais por hotel (mock — baseado na cidade/UF).
const LOCAIS: Record<number, { data: string; nome: string; tipo: FeriadoTipo; ativo?: boolean }[]> = {
  15: [ // AMAZON PARK — Manaus/AM
    { data: '2026-09-05', nome: 'Dia do Amazonas', tipo: 'estadual' },
    { data: '2026-10-24', nome: 'Aniversário de Manaus', tipo: 'municipal' },
    { data: '2026-12-08', nome: 'N. Sra. da Conceição (padroeira)', tipo: 'municipal', ativo: false },
  ],
  13: [ // PAULISTA FLAT — São Paulo/SP
    { data: '2026-01-25', nome: 'Aniversário de São Paulo', tipo: 'municipal' },
    { data: '2026-07-09', nome: 'Revolução Constitucionalista', tipo: 'estadual' },
    { data: '2026-11-20', nome: 'Consciência Negra (SP)', tipo: 'estadual' },
  ],
  14: [ // HOTEL SOL ALPHAVILLE — Barueri/SP
    { data: '2026-03-26', nome: 'Aniversário de Barueri', tipo: 'municipal' },
    { data: '2026-07-09', nome: 'Revolução Constitucionalista', tipo: 'estadual' },
  ],
  43: [ // UCAYALI (cidade mock)
    { data: '2026-06-15', nome: 'Aniversário da cidade', tipo: 'municipal' },
  ],
};

// Hotéis do mock (cidade/UF p/ contextualizar os feriados locais).
const HOTEIS: Omit<HotelFeriados, 'feriados'>[] = [
  { hotelId: 15, nome: 'AMAZON PARK HOTEL', cidade: 'Manaus', estado: 'AM', uhs: 85 },
  { hotelId: 13, nome: 'PAULISTA FLAT', cidade: 'São Paulo', estado: 'SP', uhs: 96 },
  { hotelId: 14, nome: 'HOTEL SOL ALPHAVILLE', cidade: 'Barueri', estado: 'SP', uhs: 110 },
  { hotelId: 43, nome: 'UCAYALI', cidade: 'Rio Branco', estado: 'AC', uhs: 120 },
];

// Alguns nacionais começam desativados em hotéis específicos, p/ demonstrar o toggle.
const NACIONAIS_OFF: Record<number, string[]> = {
  15: ['2026-06-04'], // AMAZON PARK sem Corpus Christi
  43: ['2026-02-16'], // UCAYALI sem Carnaval (segunda)
};

export function buildMockFeriados(): HotelFeriados[] {
  return HOTEIS.map(h => {
    const nacionais: Feriado[] = NACIONAIS_2026.map((f, i) => ({
      id: `n-${h.hotelId}-${i}`,
      data: f.data,
      nome: f.nome,
      tipo: 'nacional',
      ativo: !(NACIONAIS_OFF[h.hotelId] ?? []).includes(f.data),
    }));
    const locais: Feriado[] = (LOCAIS[h.hotelId] ?? []).map((f, i) => ({
      id: `l-${h.hotelId}-${i}`,
      data: f.data,
      nome: f.nome,
      tipo: f.tipo,
      ativo: f.ativo ?? true,
    }));
    return { ...h, feriados: [...nacionais, ...locais] };
  });
}
