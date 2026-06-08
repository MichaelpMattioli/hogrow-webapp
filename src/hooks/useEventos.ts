import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import type { Abrangencia, Feriado, HotelRef, Recorrencia } from '@/data/eventos';

// ─── Leitura ──────────────────────────────────────────────────────

function toFeriado(r: Record<string, unknown>): Feriado {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ''),
    abrangencia: r.abrangencia as Abrangencia,
    uf: (r.uf as string) ?? undefined,
    cidade: (r.cidade as string) ?? undefined,
    hotelId: r.hotel_id == null ? undefined : Number(r.hotel_id),
    rec: (r.recorrencia ?? { tipo: 'unica' }) as Recorrencia,
    ativo: !!r.ativo,
  };
}

/** Todos os eventos/feriados (tabela `evento`, leitura anon). */
export function useEventos() {
  return useQuery({
    queryKey: ['eventos'],
    queryFn: async (): Promise<Feriado[]> => {
      const { data, error } = await supabase.from('evento').select('*').order('nome');
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(toFeriado);
    },
  });
}

/** Dimensão hotel-cliente (ativos). `estado` = código da UF, para casar com evento.uf. */
export function useHoteisCliente() {
  return useQuery({
    queryKey: ['hoteis-cliente-dim'],
    queryFn: async (): Promise<HotelRef[]> => {
      const { data, error } = await supabase
        .from('hotel')
        .select('id,nome_fantasia,cidade,estado,uf,total_uhs')
        .eq('tipo', 'cliente')
        .eq('ativo', true)
        .order('nome_fantasia');
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(r => ({
        hotelId: Number(r.id),
        nome: String(r.nome_fantasia ?? ''),
        cidade: (r.cidade as string) ?? '',
        estado: (r.uf as string) ?? '', // código da UF; vazio p/ hotéis sem localização
        uhs: Number(r.total_uhs ?? 0),
      }));
    },
  });
}

// ─── Escrita (Edge Function `evento-write`, service_role no servidor) ──

async function callWrite(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('evento-write', { body });
  if (error) throw error;
  if (data && (data as { error?: string }).error) throw new Error((data as { error: string }).error);
  await queryClient.invalidateQueries({ queryKey: ['eventos'] });
  return data;
}

export interface NovoEvento {
  nome: string;
  abrangencia: Abrangencia;
  uf?: string;
  cidade?: string;
  hotelId?: number;
  rec: Recorrencia;
}

export function useEventoMutations() {
  return {
    create: (e: NovoEvento) =>
      callWrite({
        action: 'create',
        nome: e.nome,
        abrangencia: e.abrangencia,
        uf: e.uf ?? null,
        cidade: e.cidade ?? null,
        hotel_id: e.hotelId ?? null,
        recorrencia: e.rec,
      }),
    update: (id: string, patch: { nome?: string; rec?: Recorrencia }) =>
      callWrite({ action: 'update', id, nome: patch.nome, recorrencia: patch.rec }),
    toggle: (id: string, ativo: boolean) => callWrite({ action: 'toggle', id, ativo }),
    remove: (id: string) => callWrite({ action: 'delete', id }),
  };
}
