// As 27 unidades federativas do Brasil (código + nome por extenso).
// A tela de cadastro usa um único <select> de UF que grava os DOIS campos do
// hotel: `uf` (código, ex. "PA") e `estado` (nome, ex. "Pará"). Manter os dois
// consistentes evita o problema de eventos estaduais/municipais não resolverem
// (a resolução usa `hotel.uf`). Ver supabase migration 20260608130000_add_hotel_uf.

export interface UF {
  uf: string;    // código de 2 letras
  nome: string;  // nome por extenso
}

export const UFS: readonly UF[] = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
];

const BY_UF = new Map(UFS.map(u => [u.uf, u.nome]));
const BY_NOME = new Map(UFS.map(u => [u.nome.toLowerCase(), u.uf]));

/** Nome por extenso a partir do código ("PA" → "Pará"). */
export function estadoFromUf(uf: string | null | undefined): string | null {
  if (!uf) return null;
  return BY_UF.get(uf.trim().toUpperCase()) ?? null;
}

/**
 * Resolve o código da UF a partir de um valor que pode ser o código ("PA") ou o
 * nome por extenso ("Pará"). Usado para pré-selecionar o <select> ao editar um
 * hotel cujo `uf` ainda esteja nulo mas `estado` preenchido.
 */
export function ufFromAny(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length === 2 && BY_UF.has(v.toUpperCase())) return v.toUpperCase();
  return BY_NOME.get(v.toLowerCase()) ?? null;
}
