import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * Cache coherence with the daily data refresh.
 *
 * The backend pipelines run ~08:30 BRT and the materialized views finish by
 * ~09:00. So "today's data" only exists after that window. We therefore key the
 * cache to a DATA CYCLE whose boundary is 09:30 BRT (a safety buffer after the
 * refresh completes), NOT to midnight:
 *
 *  - Before 09:30 BRT  -> the active cycle is YESTERDAY (today's refresh isn't
 *                         ready yet), so we keep serving yesterday's data.
 *  - At/after 09:30 BRT -> the cycle flips to TODAY; the next access busts the
 *                         persisted cache and queries become stale, so fresh
 *                         data is fetched.
 *
 * `staleTime` is the time remaining until the next 09:30 boundary, so any query
 * — whenever it was fetched — goes stale exactly when new data lands and then
 * refetches on the next mount/navigation/window-focus.
 */
const TZ = 'America/Sao_Paulo';
const REFRESH_BOUNDARY_MIN = 9 * 60 + 30; // 09:30 BRT

function spNow(d: Date = new Date()): { date: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** Date (YYYY-MM-DD) of the currently-active data cycle in São Paulo time. */
export function dataCycleKey(d: Date = new Date()): string {
  const { date, minutes } = spNow(d);
  if (minutes >= REFRESH_BOUNDARY_MIN) return date;
  // Before the refresh boundary -> yesterday's cycle.
  const dt = new Date(`${date}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** Milliseconds until the next 09:30 BRT boundary (used as staleTime). */
export function msUntilNextRefresh(d: Date = new Date()): number {
  const { minutes } = spNow(d);
  let deltaMin = REFRESH_BOUNDARY_MIN - minutes;
  if (deltaMin <= 0) deltaMin += 24 * 60;
  return deltaMin * 60 * 1000;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Fresh until the next daily refresh boundary, then stale -> refetch.
      staleTime: () => msUntilNextRefresh(),
      gcTime: 24 * 60 * 60 * 1000, // 24h
      retry: 1,
      // After the boundary, returning to the tab refetches the now-stale data;
      // before it, data is still fresh so focus does not trigger requests.
      refetchOnWindowFocus: true,
    },
  },
});

/** Persist the cache to sessionStorage so a reload within the same cycle is instant. */
export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.sessionStorage : undefined!,
  // v2: bump da chave — descarta snapshots antigos do sessionStorage (que ainda
  // persistiam o rate-shopper) numa só tacada quando esta versão subir.
  key: 'hogrow-query-cache-v2',
});

/** Daily buster keyed to the 09:30 data cycle: a new cycle discards the persisted cache. */
export const cacheBuster = dataCycleKey();
