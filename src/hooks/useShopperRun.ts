import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── Atualização on-demand do rate-shopper (botão "Atualizar agora") ───────────
// Chama a Edge Function `shopper-trigger` (gateway seguro: rate-limit + dispara o
// worker na Railway), e acompanha o progresso via polling de public.shopper_runs.

export interface ShopperRunRow {
  id: string;
  hotel_id: number;
  status: 'queued' | 'running' | 'done' | 'error';
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  fetches_total: number | null;
  fetches_done: number;
  rows_upserted: number | null;
  progress_pct: number | null;
  data_extracao: string | null;
  error_msg: string | null;
  note: string | null;
}

const COOLDOWN_MS = 0; // cooldown removido (2026-06-07): reprocessa sem espera (limite só 3/dia)
const POLL_MS = 2500;

export interface ShopperRunState {
  trigger: () => Promise<void>;
  run: ShopperRunRow | null;
  isActive: boolean;                       // disparando ou queued/running
  rejection: { reason: string; retryAfter: number | null } | null;
  cooldownUntil: number | null;            // epoch ms (botão indisponível até lá)
  dailyLimited: boolean;
  busy: boolean;                           // worker no teto de runs simultâneos (retryable)
}

export function useShopperRun(hotelId: number): ShopperRunState {
  const qc = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [run, setRun] = useState<ShopperRunRow | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [rejection, setRejection] = useState<{ reason: string; retryAfter: number | null } | null>(null);

  // Último run do hotel: define cooldown / retoma polling se ainda estiver rodando.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('shopper_runs')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setRun(data as ShopperRunRow);
      if (data.status === 'queued' || data.status === 'running') setActiveRunId(data.id);
    })();
    return () => { cancelled = true; };
  }, [hotelId]);

  // Polling do run ativo até concluir; ao concluir com sucesso, recarrega os preços.
  useEffect(() => {
    if (!activeRunId) return;
    let stop = false;
    const tick = async () => {
      const { data } = await supabase
        .from('shopper_runs')
        .select('*')
        .eq('id', activeRunId)
        .maybeSingle();
      if (stop || !data) return;
      setRun(data as ShopperRunRow);
      if (data.status === 'done' || data.status === 'error') {
        setActiveRunId(null);
        if (data.status === 'done') {
          // os hooks reais do shopper no ClienteDetalhe usam estas chaves:
          qc.invalidateQueries({ queryKey: ['cliente-rate-shopper', hotelId] });
          qc.invalidateQueries({ queryKey: ['cliente-rate-shopper-months', hotelId] });
          // (mantém os antigos por segurança, caso algo ainda use)
          qc.invalidateQueries({ queryKey: ['booking-rates', hotelId] });
          qc.invalidateQueries({ queryKey: ['booking-rates-months', hotelId] });
        }
      }
    };
    void tick();
    const iv = setInterval(tick, POLL_MS);
    return () => { stop = true; clearInterval(iv); };
  }, [activeRunId, hotelId, qc]);

  const trigger = useCallback(async () => {
    if (triggering || activeRunId) return;
    setTriggering(true);
    setRejection(null);
    try {
      const { data, error } = await supabase.functions.invoke('shopper-trigger', {
        body: { hotel_id: hotelId },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        if (ctx && ctx.status === 429) {
          const body = (await ctx.json().catch(() => null)) as
            { reason?: string; retry_after_seconds?: number } | null;
          setRejection({ reason: body?.reason ?? 'rejeitado', retryAfter: body?.retry_after_seconds ?? null });
        } else {
          setRejection({ reason: 'erro_servidor', retryAfter: null });
        }
        return;
      }
      if (data?.run_id) {
        setActiveRunId(data.run_id);
        setRun({
          id: data.run_id, hotel_id: hotelId, status: 'queued',
          requested_at: new Date().toISOString(), started_at: null, finished_at: null,
          fetches_total: null, fetches_done: 0, rows_upserted: null, progress_pct: 0,
          data_extracao: null, error_msg: null, note: null,
        });
      }
    } catch {
      setRejection({ reason: 'erro_rede', retryAfter: null });
    } finally {
      setTriggering(false);
    }
  }, [hotelId, triggering, activeRunId]);

  const isActive = triggering || run?.status === 'queued' || run?.status === 'running';

  let cooldownUntil: number | null = null;
  if (rejection?.reason === 'cooldown_3h' && rejection.retryAfter) {
    cooldownUntil = Date.now() + rejection.retryAfter * 1000;
  } else if (run && !isActive && run.status !== 'error') {
    const until = new Date(run.requested_at).getTime() + COOLDOWN_MS;
    if (until > Date.now()) cooldownUntil = until;
  }

  return {
    trigger,
    run: run ?? null,
    isActive: Boolean(isActive),
    rejection,
    cooldownUntil,
    dailyLimited: rejection?.reason === 'daily_limit_3',
    busy: run?.status === 'error' && run?.error_msg === 'worker_busy',
  };
}
