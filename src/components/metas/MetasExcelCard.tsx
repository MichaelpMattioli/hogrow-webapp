import { useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MetaAnualRow, MetaUploadIssue } from '@/hooks/useSupabase';

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CAT_ROWS = [
  { label: 'Receita', key: 'receitaMeta' as const },
  { label: 'Ocupação', key: 'occMeta' as const },
  { label: 'Diária Média', key: 'dmMeta' as const },
];

type Level = 'ok' | 'parcial' | 'erro';
const TONE: Record<Level, { bg: string; color: string; border: string; Icon: typeof Check }> = {
  ok:      { bg: 'var(--green-l)', color: 'var(--green)', border: '#A7F3D0', Icon: Check },
  parcial: { bg: 'var(--gold-l)',  color: 'var(--gold)',  border: '#FDE68A', Icon: AlertTriangle },
  erro:    { bg: 'var(--red-l)',   color: 'var(--red)',   border: '#FECACA', Icon: AlertCircle },
};

// Gera o template no MESMO formato da tabela (ID, Cliente, Categoria, Jan..Dez), com metas atuais.
// xlsx é carregado sob demanda (dynamic import) para não pesar o bundle da página.
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

// O parsing/validação do .xlsx é feito no servidor (Edge Function). Aqui só mandamos o arquivo bruto.
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}

export default function MetasExcelCard({ ano, rows, onDone }: { ano: number; rows: MetaAnualRow[]; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ level: Level; msg: string } | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('metas-upload', {
        body: { ano, filename: file.name, fileBase64 },
      });
      if (error) throw error;
      const d = (data ?? {}) as {
        status?: Level; upserted?: number; ignored?: number; versionado?: boolean; issues?: MetaUploadIssue[];
      };
      const status: Level = d.status ?? 'ok';
      const issues = d.issues ?? [];
      const alertas = issues.filter(i => i.level === 'alerta').length;
      if (status === 'erro') {
        const firstErro = issues.find(i => i.level === 'erro');
        setResult({ level: 'erro', msg: firstErro?.msg ?? 'Não foi possível processar o arquivo.' });
      } else if (status === 'parcial') {
        setResult({
          level: 'parcial',
          msg: `${d.upserted ?? 0} metas atualizadas · ${d.ignored ?? 0} ignoradas${d.versionado === false ? ' · arquivo não versionado' : ''}.`,
        });
      } else {
        setResult({
          level: 'ok',
          msg: `${d.upserted ?? 0} metas atualizadas${alertas ? ` · ${alertas} aviso(s)` : ''} · arquivo versionado no Storage.`,
        });
      }
      onDone();
    } catch (e) {
      setResult({ level: 'erro', msg: (e as Error).message || 'Falha ao enviar o Excel.' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const btn = (primary: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px',
    borderRadius: 'var(--rx)', fontSize: 12.5, fontWeight: 800, cursor: busy ? 'default' : 'pointer',
    border: primary ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: primary ? 'var(--accent)' : 'var(--surface)',
    color: primary ? '#fff' : 'var(--text)',
    opacity: busy ? 0.7 : 1, transition: 'all .12s',
  });

  const tone = result ? TONE[result.level] : null;

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
              Baixe o template, preencha as metas e suba de volta. O arquivo fica versionado no Storage.
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
            {busy ? 'Processando…' : 'Subir Excel'}
          </button>
          <input
            ref={fileRef} type="file" accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {result && tone && (
        <div style={{
          marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--rx)',
          fontSize: 12.5, fontWeight: 700,
          background: tone.bg, color: tone.color, border: `1px solid ${tone.border}`,
        }}>
          <tone.Icon size={15} />
          {result.msg}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-m)', fontWeight: 500 }}>
        Formato: <strong>ID · Cliente · Categoria · Jan…Dez</strong> (Receita, Ocupação, Diária Média por hotel). Edite só as colunas de mês.
        Definição de responsabilidade/permissão por upload virá com a autenticação da página (#24).
      </div>
    </div>
  );
}
