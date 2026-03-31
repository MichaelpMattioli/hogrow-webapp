import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, AlertTriangle, Building2, MapPin, Hash, Bed, FileText, ToggleLeft, ToggleRight } from 'lucide-react';
import type { HotelRow } from '@/data/types';

interface HotelEditFormProps {
  hotel: HotelRow;
  onSave: (data: Partial<HotelRow>) => Promise<{ success: boolean; error?: string }>;
}

interface FieldConfig {
  key: keyof HotelRow;
  label: string;
  icon: React.ElementType;
  type: 'text' | 'number' | 'toggle';
  placeholder?: string;
  required?: boolean;
}

const FIELDS: FieldConfig[] = [
  { key: 'nome_fantasia', label: 'Nome Fantasia', icon: Building2, type: 'text', placeholder: 'Ex: Hotel Sol Nascente', required: true },
  { key: 'razao_social', label: 'Razão Social', icon: FileText, type: 'text', placeholder: 'Ex: Sol Nascente Hotelaria LTDA', required: true },
  { key: 'cidade', label: 'Cidade', icon: MapPin, type: 'text', placeholder: 'Ex: Santarém' },
  { key: 'estado', label: 'Estado (UF)', icon: MapPin, type: 'text', placeholder: 'Ex: PA' },
  { key: 'total_uhs', label: 'Total de UHs', icon: Hash, type: 'number', placeholder: '0', required: true },
  { key: 'total_leitos', label: 'Total de Leitos', icon: Bed, type: 'number', placeholder: '0' },
  { key: 'property_id', label: 'Property ID (Hits)', icon: Hash, type: 'number', placeholder: 'ID externo' },
  { key: 'cadastur', label: 'Cadastur', icon: FileText, type: 'text', placeholder: 'Registro Cadastur' },
  { key: 'ativo', label: 'Hotel Ativo', icon: ToggleLeft, type: 'toggle' },
];

export default function HotelEditForm({ hotel, onSave }: HotelEditFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  // Initialize form data from hotel
  useEffect(() => {
    const data: Record<string, unknown> = {};
    for (const field of FIELDS) {
      data[field.key] = hotel[field.key];
    }
    setFormData(data);
    setDirty(false);
  }, [hotel]);

  function handleChange(key: string, value: unknown) {
    setFormData(prev => ({ ...prev, [key]: value }));
    setDirty(true);
    setFeedback(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;

    setSaving(true);
    setFeedback(null);

    // Build update payload — only changed fields
    const payload: Partial<HotelRow> = {};
    for (const field of FIELDS) {
      const original = hotel[field.key];
      const current = formData[field.key];
      if (current !== original) {
        (payload as Record<string, unknown>)[field.key] = current;
      }
    }

    if (Object.keys(payload).length === 0) {
      setFeedback({ type: 'success', message: 'Nenhuma alteração detectada.' });
      setSaving(false);
      return;
    }

    const result = await onSave(payload);
    setSaving(false);

    if (result.success) {
      setFeedback({ type: 'success', message: 'Hotel atualizado com sucesso!' });
      setDirty(false);
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Erro ao salvar.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-in" style={{ animationDelay: '60ms' }}>
      <div
        className="rounded-[var(--r)]"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '24px',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-[15px] font-bold" style={{ letterSpacing: '-0.3px' }}>
              Dados do Hotel
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-m)' }}>
              Edite as informações cadastrais do hotel
            </p>
          </div>
          {feedback && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full text-[11.5px] font-semibold transition-all duration-300"
              style={{
                padding: '5px 14px',
                background: feedback.type === 'success' ? 'var(--green-l)' : 'var(--red-l)',
                color: feedback.type === 'success' ? 'var(--green)' : 'var(--red)',
              }}
            >
              {feedback.type === 'success' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
              {feedback.message}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {FIELDS.map(field => {
            const IconComp = field.icon;
            const value = formData[field.key];

            if (field.type === 'toggle') {
              const isOn = value === true;
              return (
                <div key={field.key} className="col-span-2">
                  <div
                    className="flex items-center justify-between rounded-[var(--rs)] transition-colors duration-150"
                    style={{
                      padding: '14px 16px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border-l)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center rounded-[var(--rx)]"
                        style={{
                          width: 32,
                          height: 32,
                          background: isOn ? 'var(--green-l)' : 'var(--red-l)',
                          color: isOn ? 'var(--green)' : 'var(--red)',
                        }}
                      >
                        <IconComp size={15} />
                      </div>
                      <div>
                        <span className="text-[13px] font-medium">{field.label}</span>
                        <p className="text-[11px]" style={{ color: 'var(--text-m)' }}>
                          {isOn ? 'O hotel está ativo e aparece no dashboard' : 'O hotel está inativo e oculto do dashboard'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleChange(field.key, !isOn)}
                      className="transition-colors duration-200"
                      style={{ color: isOn ? 'var(--green)' : 'var(--text-m)' }}
                    >
                      {isOn ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={field.key}>
                <label className="flex items-center gap-1.5 text-[11.5px] font-medium mb-1.5" style={{ color: 'var(--text-m)' }}>
                  <IconComp size={12} />
                  {field.label}
                  {field.required && <span style={{ color: 'var(--red)' }}>*</span>}
                </label>
                <input
                  type={field.type}
                  value={value == null ? '' : String(value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  onChange={e => {
                    const val = field.type === 'number'
                      ? (e.target.value === '' ? null : Number(e.target.value))
                      : e.target.value;
                    handleChange(field.key, val);
                  }}
                  className="w-full rounded-[var(--rx)] text-[13px] font-medium outline-none transition-all duration-150"
                  style={{
                    padding: '10px 14px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border-l)',
                    color: 'var(--text)',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-l)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-l)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            );
          })}
        </div>

        {/* Meta info */}
        <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-l)' }}>
          <div className="flex gap-4">
            <span className="text-[11px]" style={{ color: 'var(--text-m)' }}>
              ID: <span className="font-mono font-medium" style={{ color: 'var(--text-s)' }}>{hotel.id}</span>
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-m)' }}>
              Criado em: <span className="font-mono font-medium" style={{ color: 'var(--text-s)' }}>{new Date(hotel.created_at).toLocaleDateString('pt-BR')}</span>
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-m)' }}>
              Atualizado em: <span className="font-mono font-medium" style={{ color: 'var(--text-s)' }}>{new Date(hotel.updated_at).toLocaleDateString('pt-BR')}</span>
            </span>
          </div>

          <button
            type="submit"
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-[var(--rx)] text-[13px] font-semibold transition-all duration-200"
            style={{
              padding: '10px 22px',
              background: dirty ? 'var(--accent)' : 'var(--border)',
              color: dirty ? '#fff' : 'var(--text-m)',
              cursor: dirty && !saving ? 'pointer' : 'default',
              opacity: saving ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (dirty && !saving) e.currentTarget.style.background = 'var(--accent-d)'; }}
            onMouseLeave={e => { if (dirty) e.currentTarget.style.background = 'var(--accent)'; }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </form>
  );
}
