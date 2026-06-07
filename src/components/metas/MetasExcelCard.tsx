import { useRef, useState } from 'react';
import { AlertCircle, Check, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MetaAnualRow } from '@/hooks/useSupabase';

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CAT_ROWS = [
  { label: 'Receita', key: 'receitaMeta' as const },
  { label: 'Ocupação', key: 'occMeta' as const },
  { label: 'Diária Média', key: 'dmMeta' as const },
];

interface MetaIn { hotelId: number; mes: number; receita: unknown; occ: unknown; dm: unknown }

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

async function parseFile(file: File): Promise<{ metas: MetaIn[]; fileBase64: string }> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, blankrows: false });

  const byHotel = new Map<number, { receita?: unknown[]; occ?: unknown[]; dm?: unknown[] }>();
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || row.length < 3) continue;
    const id = Number(row[0]);
    if (!Number.isFinite(id)) continue;
    const cat = String(row[2] ?? '').trim().toLowerCase();
    const months = Array.from({ length: 12 }, (_, m) => row[3 + m]);
    if (!byHotel.has(id)) byHotel.set(id, {});
    const h = byHotel.get(id)!;
    if (cat.includes('receita')) h.receita = months;
    else if (cat.includes('ocup')) h.occ = months;
    else if (cat.includes('di')) h.dm = months;
  }

  const metas: MetaIn[] = [];
  byHotel.forEach((h, id) => {
    for (let mes = 1; mes <= 12; mes++) {
      metas.push({
        hotelId: id, mes,
        receita: h.receita?.[mes - 1] ?? null,
        occ: h.occ?.[mes - 1] ?? null,
        dm: h.dm?.[mes - 1] ?? null,
      });
    }
  });

  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return { metas, fileBase64: btoa(bin) };
}

export default function MetasExcelCard({ ano, rows, onDone }: { ano: number; rows: MetaAnualRow[]; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const { metas, fileBase64 } = await parseFile(file);
      const { data, error } = await supabase.functions.invoke('metas-upload', {
        body: { ano, metas, filename: file.name, fileBase64 },
      });
      if (error) throw error;
      const d = (data ?? {}) as { upserted?: number; ignored?: number; storagePath?: string | null };
      const versionado = typeof d.storagePath === 'string' && !d.storagePath.startsWith('ERRO');
      setResult({
        ok: true,
        msg: `${d.upserted ?? 0} metas atualizadas${d.ignored ? ` · ${d.ignored} ignoradas` : ''} · ${versionado ? 'arquivo versionado no Storage' : 'arquivo não versionado'}.`,
      });
      onDone();
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message || 'Falha ao processar o Excel.' });
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
            try { await downloadTemplate(rows, ano); } catch (e) { setResult({ ok: false, msg: (e as Error).message }); } finally { setBusy(false); }
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

      {result && (
        <div style={{
          marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--rx)',
          fontSize: 12.5, fontWeight: 700,
          background: result.ok ? 'var(--green-l)' : 'var(--red-l)',
          color: result.ok ? 'var(--green)' : 'var(--red)',
          border: `1px solid ${result.ok ? '#A7F3D0' : '#FECACA'}`,
        }}>
          {result.ok ? <Check size={15} /> : <AlertCircle size={15} />}
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
