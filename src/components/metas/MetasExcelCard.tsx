import { useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MetaAnualRow, MetaUploadIssueGroup } from '@/hooks/useSupabase';
import MetasModal, { IssueList } from './MetasModal';

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CAT_ROWS = [
  { label: 'Receita', key: 'receitaMeta' as const },
  { label: 'Ocupação', key: 'occMeta' as const },
  { label: 'Diária Média', key: 'dmMeta' as const },
];

type Level = 'ok' | 'parcial' | 'erro';
const TONE: Record<Level, { bg: string; color: string; border: string; Icon: typeof Check; label: string }> = {
  ok:      { bg: 'var(--green-l)', color: 'var(--green)', border: '#A7F3D0', Icon: Check,          label: 'Tudo certo' },
  parcial: { bg: 'var(--gold-l)',  color: 'var(--gold)',  border: '#FDE68A', Icon: AlertTriangle,  label: 'Parcial' },
  erro:    { bg: 'var(--red-l)',   color: 'var(--red)',   border: '#FECACA', Icon: AlertCircle,    label: 'Com erros' },
};

interface Diff { criadas: number; substituidas: number; mantidas: number; inalteradas: number; aplicar: number; ignored: number; hoteisAusentes: number; hoteisValidos: number; metasTotal: number }
interface PreviewState { name: string; base64: string; status: Level; diff: Diff; issues: MetaUploadIssueGroup[] }

async function downloadTemplate(rows: MetaAnualRow[], ano: number) {
  const XLSX = await import('xlsx');
  const byHotel = new Map<number, { nome: string; byMes: Map<number, MetaAnualRow> }>();
  rows.forEach(r => {
    if (!byHotel.has(r.hotelId)) byHotel.set(r.hotelId, { nome: r.hotelNome, byMes: new Map() });
    byHotel.get(r.hotelId)!.byMes.set(r.mes, r);
  });
  const aoa: (string | number | null)[][] = [['ID', 'Cliente', 'Categoria', ...MES_ABBR]];
  [...byHotel.entries()]
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome))
    .forEach(([id, h]) => {
      CAT_ROWS.forEach(cat => {
        const row: (string | number | null)[] = [id, h.nome, cat.label];
        for (let mes = 1; mes <= 12; mes++) {
          const v = h.byMes.get(mes)?.[cat.key];
          row.push(v != null && v !== 0 ? v : null);
        }
        aoa.push(row);
      });
    });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 14 }, ...MES_ABBR.map(() => ({ wch: 11 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Metas ${ano}`);
  XLSX.writeFile(wb, `template-metas-${ano}.xlsx`);
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}

function StatChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border-l)', borderRadius: 'var(--rx)', padding: '8px 10px', minWidth: 0 }}>
      <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--mono)', color: color ?? 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 3 }}>{label}</div>
    </div>
  );
}

export default function MetasExcelCard({ ano, rows, onDone }: { ano: number; rows: MetaAnualRow[]; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [result, setResult] = useState<{ level: Level; msg: string } | null>(null);

  // 1) Escolher arquivo → PREVIEW (dry-run, não grava nada)
  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('metas-upload', {
        body: { ano, filename: file.name, fileBase64: base64, modo: 'preview' },
      });
      if (error) throw error;
      const d = (data ?? {}) as { status?: Level; diff?: Diff; issues?: MetaUploadIssueGroup[] };
      setPreview({
        name: file.name, base64,
        status: d.status ?? 'ok',
        diff: d.diff ?? { criadas: 0, substituidas: 0, mantidas: 0, inalteradas: 0, aplicar: 0, ignored: 0, hoteisAusentes: 0, hoteisValidos: 0, metasTotal: 0 },
        issues: d.issues ?? [],
      });
    } catch (e) {
      setResult({ level: 'erro', msg: (e as Error).message || 'Falha ao processar o Excel.' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // 2) Confirmar → APPLY (grava + versiona + loga)
  async function confirmApply() {
    if (!preview) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('metas-upload', {
        body: { ano, filename: preview.name, fileBase64: preview.base64, modo: 'apply' },
      });
      if (error) throw error;
      const d = (data ?? {}) as { status?: Level; upserted?: number; ignored?: number; versionado?: boolean; issues?: MetaUploadIssueGroup[] };
      const status: Level = d.status ?? 'ok';
      const issues = d.issues ?? [];
      const alertas = issues.filter(g => g.level === 'alerta').reduce((s, g) => s + g.count, 0);
      if (status === 'erro') {
        setResult({ level: 'erro', msg: issues.find(g => g.level === 'erro')?.items[0]?.msg ?? 'Não foi possível aplicar.' });
      } else if (status === 'parcial') {
        setResult({ level: 'parcial', msg: `${d.upserted ?? 0} aplicadas · ${d.ignored ?? 0} ignoradas${alertas ? ` · ${alertas} aviso(s)` : ''}.` });
      } else {
        setResult({ level: 'ok', msg: `${d.upserted ?? 0} metas aplicadas${alertas ? ` · ${alertas} aviso(s)` : ''} · arquivo versionado.` });
      }
      onDone();
    } catch (e) {
      setResult({ level: 'erro', msg: (e as Error).message || 'Falha ao aplicar.' });
    } finally {
      setApplying(false);
      setPreview(null);
    }
  }

  const btn = (primary: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px',
    borderRadius: 'var(--rx)', fontSize: 12.5, fontWeight: 800, cursor: busy ? 'default' : 'pointer',
    border: primary ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: primary ? 'var(--accent)' : 'var(--surface)',
    color: primary ? '#fff' : 'var(--text)', opacity: busy ? 0.7 : 1, transition: 'all .12s',
  });

  const tone = result ? TONE[result.level] : null;
  const pTone = preview ? TONE[preview.status] : null;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 18, boxShadow: 'var(--sh)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green-l)', color: 'var(--green)' }}>
            <FileSpreadsheet size={19} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>Editar metas por Excel — {ano}</div>
            <div style={{ fontSize: 12, color: 'var(--text-m)', fontWeight: 600, marginTop: 1 }}>
              Baixe o template, preencha e suba. Você verá uma pré-visualização antes de aplicar.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={btn(false)} disabled={busy} onClick={async () => {
            setBusy(true);
            try { await downloadTemplate(rows, ano); } catch (e) { setResult({ level: 'erro', msg: (e as Error).message }); } finally { setBusy(false); }
          }}>
            <Download size={15} /> Baixar template {ano}
          </button>
          <button type="button" style={btn(true)} disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {busy ? 'Analisando…' : 'Subir Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
        </div>
      </div>

      {result && tone && (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--rx)', fontSize: 12.5, fontWeight: 700, background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}>
          <tone.Icon size={15} /> {result.msg}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-m)', fontWeight: 500 }}>
        Formato: <strong>ID · Cliente · Categoria · Jan…Dez</strong>. Edite só as colunas de mês — <strong>célula vazia mantém a meta atual</strong> (não apaga).
        Definição de responsabilidade por upload virá com a autenticação (#24).
      </div>

      {/* Pré-visualização (Fase 4) */}
      {preview && pTone && (
        <MetasModal
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Pré-visualização
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, background: pTone.bg, color: pTone.color, fontSize: 11, fontWeight: 800 }}>
              <pTone.Icon size={12} /> {pTone.label}
            </span>
          </span>}
          subtitle={preview.name}
          onClose={() => setPreview(null)}
          footer={<>
            <button onClick={() => setPreview(null)} disabled={applying}
              style={{ height: 38, padding: '0 16px', borderRadius: 'var(--rx)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={confirmApply} disabled={applying || preview.status === 'erro'}
              style={{ height: 38, padding: '0 18px', borderRadius: 'var(--rx)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 7, background: preview.status === 'erro' ? 'var(--surface-h)' : 'var(--accent)', color: preview.status === 'erro' ? 'var(--text-m)' : '#fff', fontSize: 12.5, fontWeight: 800, cursor: applying || preview.status === 'erro' ? 'default' : 'pointer', opacity: applying ? 0.7 : 1 }}>
              {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {applying ? 'Aplicando…' : `Confirmar · aplicar ${preview.diff.aplicar}`}
            </button>
          </>}
        >
          {preview.status === 'erro' ? (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--rx)', background: 'var(--red-l)', color: 'var(--red)', fontSize: 12.5, fontWeight: 700, border: '1px solid #FECACA' }}>
              O arquivo tem erros que impedem a aplicação. Corrija e suba novamente.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 8, marginBottom: 16 }}>
              <StatChip label="A aplicar" value={preview.diff.aplicar} color="var(--accent)" />
              <StatChip label="Novas" value={preview.diff.criadas} color="var(--green)" />
              <StatChip label="Substituídas" value={preview.diff.substituidas} color="var(--gold)" />
              <StatChip label="Mantidas" value={preview.diff.mantidas} />
              <StatChip label="Ignoradas" value={preview.diff.ignored} color={preview.diff.ignored ? 'var(--red)' : undefined} />
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Observações ({preview.issues.length})
          </div>
          <IssueList issues={preview.issues} />
        </MetasModal>
      )}
    </div>
  );
}
