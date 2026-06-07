import { useState } from 'react';
import { AlertCircle, AlertTriangle, Check, ChevronRight, History, Loader2, Minus } from 'lucide-react';
import type { MetaUploadLogRow } from '@/hooks/useSupabase';
import MetasModal, { IssueList } from './MetasModal';

const STATUS: Record<MetaUploadLogRow['status'], { label: string; color: string; bg: string; Icon: typeof Check }> = {
  ok:      { label: 'OK',      color: 'var(--green)', bg: 'var(--green-l)', Icon: Check },
  parcial: { label: 'Parcial', color: 'var(--gold)',  bg: 'var(--gold-l)',  Icon: AlertTriangle },
  erro:    { label: 'Erro',    color: 'var(--red)',   bg: 'var(--red-l)',   Icon: AlertCircle },
};

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Mensagem amigável da coluna "Observação", a partir das issues estruturadas (Fase 1+).
// O detalhamento completo das issues num modal vem na Fase 4 (ver docs/metas-upload-validacao.md).
function observacao(r: MetaUploadLogRow): string {
  // Defensivo: linhas vindas do cache persistido (anteriores à coluna issues) podem não ter o campo.
  const firstErro = (r.issues ?? []).find(i => i.level === 'erro');
  if (firstErro) return firstErro.msg;
  const parts: string[] = [];
  if ((r.alertas ?? 0) > 0) parts.push(`${r.alertas} alerta(s)`);
  if (r.ignored > 0) parts.push(`${r.ignored} ignorada(s)`);
  if (!r.versionado && r.status !== 'erro' && r.upserted > 0) parts.push('arquivo não versionado');
  if (parts.length) return parts.join(' · ');
  if (r.errorMsg) return r.errorMsg; // legado (linhas antigas sem issues)
  return '—';
}

export default function MetasUploadLog({
  rows, loading, error,
}: { rows: MetaUploadLogRow[]; loading: boolean; error: string | null }) {
  const [detail, setDetail] = useState<MetaUploadLogRow | null>(null);
  const th: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-h)', color: 'var(--text-m)',
    fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
    padding: '9px 12px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)',
  };
  const td: React.CSSProperties = {
    padding: '9px 12px', fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border-l)',
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>
      {/* Cabeçalho do card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 18px', borderBottom: '1px solid var(--border-l)' }}>
        <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-l)', color: 'var(--accent)' }}>
          <History size={17} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>Histórico de uploads</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-m)', fontWeight: 600, marginTop: 1 }}>
            Registro de cada envio de Excel com o status do processamento.
          </div>
        </div>
        {!loading && !error && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--text-m)' }}>
            {rows.length} {rows.length === 1 ? 'envio' : 'envios'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 36, color: 'var(--text-m)' }}>
          <Loader2 size={20} className="animate-spin" />
          <span className="ml-2" style={{ fontSize: 13 }}>Carregando histórico…</span>
        </div>
      ) : error ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--red)', fontWeight: 800, fontSize: 13 }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-m)', fontSize: 13, fontWeight: 600 }}>
          Nenhum upload registrado ainda. Baixe o template, preencha e suba para ver o histórico aqui.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: '46vh' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Quando</th>
                <th style={th}>Arquivo</th>
                <th style={{ ...th, textAlign: 'center' }}>Ano</th>
                <th style={{ ...th, textAlign: 'center' }}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Aplicadas</th>
                <th style={{ ...th, textAlign: 'center' }}>Versionado</th>
                <th style={th}>Observação</th>
                <th style={{ ...th, width: 30 }} aria-label="Detalhe" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const s = STATUS[r.status] ?? STATUS.ok;
                const obs = observacao(r);
                return (
                  <tr key={r.id} className="metas-row" style={{ cursor: 'pointer' }} onClick={() => setDetail(r)} title="Ver detalhes do envio">
                    <td style={{ ...td, color: 'var(--text-m)', fontFamily: 'var(--mono)', fontSize: 11.5 }}>{fmtDateTime(r.createdAt)}</td>
                    <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 650 }} title={r.filename ?? undefined}>
                      {r.filename ?? '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700 }}>{r.ano ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800 }}>
                        <s.Icon size={12} /> {s.label}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>
                      {r.upserted}
                      <span style={{ color: 'var(--text-m)', fontWeight: 500 }}>/{r.metasTotal}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {r.versionado
                        ? <Check size={14} style={{ color: 'var(--green)' }} />
                        : <Minus size={14} style={{ color: 'var(--border)' }} />}
                    </td>
                    <td style={{ ...td, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', color: obs === '—' ? 'var(--border)' : 'var(--text-m)', fontWeight: 600 }} title={obs !== '—' ? obs : undefined}>
                      {obs}
                    </td>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--text-m)' }}><ChevronRight size={14} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <MetasModal
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Detalhes do envio
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, background: STATUS[detail.status].bg, color: STATUS[detail.status].color, fontSize: 11, fontWeight: 800 }}>
              {STATUS[detail.status].label}
            </span>
          </span>}
          subtitle={`${detail.filename ?? '—'} · ${fmtDateTime(detail.createdAt)} · ${detail.upserted}/${detail.metasTotal} aplicadas${detail.ignored ? ` · ${detail.ignored} ignoradas` : ''}`}
          onClose={() => setDetail(null)}
        >
          <IssueList issues={detail.issues ?? []} />
        </MetasModal>
      )}
    </div>
  );
}
