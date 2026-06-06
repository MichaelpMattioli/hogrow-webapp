import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="text-center py-20 fade-in">
      <p className="font-mono mb-2" style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-m)' }}>
        404
      </p>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
        Página não encontrada
      </h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-m)' }}>
        O endereço que você acessou não existe ou foi movido.
      </p>
      <button
        onClick={() => navigate('/')}
        className="text-[13px] font-medium rounded-[var(--rx)] px-4 py-2"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        Voltar para o início
      </button>
    </div>
  );
}
