// Cadastro de clientes (hotéis tipo='cliente') + concorrentes.
// Leitura: anon direto em `hotel` / `hotel_booking_info`.
// Escrita: Edge Function `hotel-write` (service_role) — ver supabase/functions.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';

// ─── Tipos ───────────────────────────────────────────────────────────

export interface ClienteAdminRow {
  id: number;
  nomeFantasia: string;
  razaoSocial: string;
  cidade: string | null;
  estado: string | null;
  uf: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  concorrentes: number;
  concorrentesAtivos: number;
}

export interface CompetitorRow {
  infoId: number;
  hotelId: number; // id do hotel concorrente
  name: string;
  slug: string;
  url: string;
  country: string;
  lang: string;
  ordem: number;
  ativo: boolean;
}

export interface CompetitorPayload {
  slug: string;
  url: string;
  country: string;
  lang: string;
  name: string;
  ativo: boolean;
  ordem: number;
}

export interface ClienteFields {
  nome_fantasia: string;
  razao_social: string;
  cidade: string | null;
  uf: string | null;
  estado: string | null;
  ativo: boolean;
}

export interface DeleteDependents {
  receita_diaria: number;
  boletim_ocupacao: number;
  metas: number;
  tarifas_booking: number;
  rate_shopper_runs: number;
  eventos_do_hotel: number;
  fonte_externa: number;
  vinculado_como_concorrente: number;
}

export type WriteResult =
  | { success: true; softened?: string[] }
  | { success: false; error: string };

// ─── Leitura ─────────────────────────────────────────────────────────

export function useClientesAdmin() {
  return useQuery({
    queryKey: ['clientes-admin'],
    queryFn: async (): Promise<ClienteAdminRow[]> => {
      const [hotelsRes, linksRes] = await Promise.all([
        supabase
          .from('hotel')
          .select('id,nome_fantasia,razao_social,cidade,estado,uf,ativo,created_at,updated_at')
          .eq('tipo', 'cliente')
          .order('nome_fantasia', { ascending: true }),
        supabase.from('hotel_booking_info').select('hotel_id,booking_hotel_id,ativo'),
      ]);
      if (hotelsRes.error) throw hotelsRes.error;
      if (linksRes.error) throw linksRes.error;

      const links = (linksRes.data ?? []) as Array<{ hotel_id: number; booking_hotel_id: number; ativo: boolean }>;
      const countByClient = new Map<number, { total: number; ativos: number }>();
      for (const l of links) {
        if (l.booking_hotel_id === l.hotel_id) continue; // self-link não é concorrente
        const c = countByClient.get(l.hotel_id) ?? { total: 0, ativos: 0 };
        c.total++;
        if (l.ativo) c.ativos++;
        countByClient.set(l.hotel_id, c);
      }

      return ((hotelsRes.data ?? []) as Record<string, unknown>[]).map(r => {
        const c = countByClient.get(r.id as number) ?? { total: 0, ativos: 0 };
        return {
          id: r.id as number,
          nomeFantasia: (r.nome_fantasia as string) ?? '',
          razaoSocial: (r.razao_social as string) ?? '',
          cidade: (r.cidade as string | null) ?? null,
          estado: (r.estado as string | null) ?? null,
          uf: (r.uf as string | null) ?? null,
          ativo: Boolean(r.ativo),
          createdAt: (r.created_at as string) ?? '',
          updatedAt: (r.updated_at as string) ?? '',
          concorrentes: c.total,
          concorrentesAtivos: c.ativos,
        };
      });
    },
  });
}

/** Sugestões de cidade a partir dos valores já existentes (reduz erro de digitação). */
export function useCidadesExistentes() {
  return useQuery({
    queryKey: ['cidades-existentes'],
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('hotel').select('cidade').not('cidade', 'is', null);
      if (error) throw error;
      const set = new Set<string>();
      for (const r of (data ?? []) as Array<{ cidade: string | null }>) {
        if (r.cidade) set.add(r.cidade.trim());
      }
      return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    },
  });
}

export function useClienteCompetitors(clienteId: number | null) {
  return useQuery({
    queryKey: ['cliente-competitors', clienteId],
    enabled: !!clienteId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    queryFn: async (): Promise<CompetitorRow[]> => {
      const { data: links, error } = await supabase
        .from('hotel_booking_info')
        .select('id,booking_hotel_id,booking_slug,booking_url,booking_country,booking_lang,ordem,ativo')
        .eq('hotel_id', clienteId!)
        .order('ordem', { ascending: true });
      if (error) throw error;

      const rows = ((links ?? []) as Record<string, unknown>[]).filter(
        l => (l.booking_hotel_id as number) !== clienteId,
      );
      const ids = [...new Set(rows.map(r => r.booking_hotel_id as number))];
      const nameById = new Map<number, string>();
      if (ids.length) {
        const { data: hs } = await supabase.from('hotel').select('id,nome_fantasia').in('id', ids);
        for (const h of (hs ?? []) as Array<{ id: number; nome_fantasia: string }>) {
          nameById.set(h.id, h.nome_fantasia);
        }
      }

      return rows.map(r => ({
        infoId: r.id as number,
        hotelId: r.booking_hotel_id as number,
        name: nameById.get(r.booking_hotel_id as number) ?? String(r.booking_slug ?? ''),
        slug: String(r.booking_slug ?? ''),
        url: String(r.booking_url ?? ''),
        country: String(r.booking_country ?? 'br'),
        lang: String(r.booking_lang ?? 'pt-br'),
        ordem: Number(r.ordem ?? 0),
        ativo: Boolean(r.ativo),
      }));
    },
  });
}

// ─── Escrita (Edge Function `hotel-write`) ───────────────────────────

const ERR_MSG: Record<string, string> = {
  nome_fantasia_obrigatorio: 'Informe o nome fantasia.',
  razao_social_obrigatoria: 'Informe a razão social.',
  insert_falhou: 'Não foi possível salvar o cliente.',
  update_falhou: 'Não foi possível salvar as alterações.',
  set_ativo_falhou: 'Não foi possível alterar o status.',
  delete_falhou: 'Não foi possível excluir.',
  has_dependents: 'Este cliente tem dados vinculados — use Desativar.',
  id_obrigatorio: 'Cliente inválido.',
  config_ausente: 'Configuração do servidor ausente.',
  json_invalido: 'Requisição inválida.',
  action_invalida: 'Ação inválida.',
  erro_inesperado: 'Erro inesperado no servidor.',
};
function msgFor(code: string): string {
  return ERR_MSG[code] ?? 'Erro ao processar a solicitação.';
}

// Invoca a função e SEMPRE devolve o corpo JSON — inclusive em respostas de erro
// (ex.: 409 has_dependents), que o supabase-js entrega via error.context.
async function invokeHotelWrite(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('hotel-write', { body });
  if (error) {
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') return (await ctx.json()) as Record<string, unknown>;
    } catch {
      /* sem corpo JSON */
    }
    return { error: 'erro_inesperado', detail: error.message };
  }
  return (data ?? {}) as Record<string, unknown>;
}

async function invalidate(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['clientes-admin'] }),
    queryClient.invalidateQueries({ queryKey: ['cliente-competitors'] }),
    queryClient.invalidateQueries({ queryKey: ['client-hotel-ids'] }),
    queryClient.invalidateQueries({ queryKey: ['hotels-summary'] }),
    queryClient.invalidateQueries({ queryKey: ['clientes-table'] }),
    queryClient.invalidateQueries({ queryKey: ['clientes-calendar'] }),
    queryClient.invalidateQueries({ queryKey: ['home-page'] }),
    queryClient.invalidateQueries({ queryKey: ['hoteis-cliente-dim'] }),
    queryClient.invalidateQueries({ queryKey: ['cidades-existentes'] }),
  ]);
}

export async function createCliente(
  fields: ClienteFields,
  competitors: CompetitorPayload[],
): Promise<WriteResult> {
  const res = await invokeHotelWrite({ action: 'create', ...fields, competitors });
  if (res.error) return { success: false, error: msgFor(String(res.error)) };
  await invalidate();
  return { success: true, softened: (res.softened as string[]) ?? [] };
}

export async function updateCliente(
  id: number,
  fields: Partial<ClienteFields>,
  competitors?: CompetitorPayload[],
): Promise<WriteResult> {
  const body: Record<string, unknown> = { action: 'update', id, ...fields };
  if (competitors !== undefined) body.competitors = competitors;
  const res = await invokeHotelWrite(body);
  if (res.error) return { success: false, error: msgFor(String(res.error)) };
  await invalidate();
  return { success: true, softened: (res.softened as string[]) ?? [] };
}

export async function setClienteAtivo(id: number, ativo: boolean): Promise<WriteResult> {
  const res = await invokeHotelWrite({ action: 'set_ativo', id, ativo });
  if (res.error) return { success: false, error: msgFor(String(res.error)) };
  await invalidate();
  return { success: true };
}

export interface CheckDeleteResult {
  canDelete: boolean;
  dependents: DeleteDependents;
  total: number;
}

export async function checkDeleteCliente(id: number): Promise<CheckDeleteResult | null> {
  const res = await invokeHotelWrite({ action: 'check_delete', id });
  if (res.error) return null;
  return {
    canDelete: Boolean(res.can_delete),
    dependents: res.dependents as DeleteDependents,
    total: Number(res.total ?? 0),
  };
}

export type DeleteResult =
  | { success: true }
  | { success: false; dependents: DeleteDependents }
  | { success: false; error: string };

export async function deleteCliente(id: number): Promise<DeleteResult> {
  const res = await invokeHotelWrite({ action: 'delete', id });
  if (res.error === 'has_dependents') {
    return { success: false, dependents: res.dependents as DeleteDependents };
  }
  if (res.error) return { success: false, error: msgFor(String(res.error)) };
  await invalidate();
  return { success: true };
}

// Rótulos legíveis dos vínculos que impedem exclusão (para o modal de "danger zone").
export const DEPENDENT_LABELS: Record<keyof DeleteDependents, string> = {
  receita_diaria: 'Receita diária',
  boletim_ocupacao: 'Boletins de ocupação',
  metas: 'Metas',
  tarifas_booking: 'Tarifas do Booking',
  rate_shopper_runs: 'Execuções do rate shopper',
  eventos_do_hotel: 'Eventos do hotel',
  fonte_externa: 'Fonte de dados externa',
  vinculado_como_concorrente: 'Usado como concorrente de outro hotel',
};
