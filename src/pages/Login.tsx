import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, LogIn, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const inputWrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 12px',
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rx)',
};
const inputStyle: React.CSSProperties = {
  flex: 1, background: 'transparent', border: 'none', outline: 'none',
  fontSize: 13.5, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font)',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-m)', marginBottom: 6,
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const ok = await login(username, password);
    setLoading(false);
    if (ok) navigate('/', { replace: true });
    else setError('Usuário ou senha inválidos.');
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'linear-gradient(135deg, #0F1A2E 0%, #1A2744 45%, #1E3E6E 100%)',
    }}>
      <div style={{ width: '100%', maxWidth: 392 }}>
        {/* Logo + título */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img src="/logo-hogrow.svg" alt="HoGrow" style={{ height: 30, width: 'auto', margin: '0 auto 14px' }} />
          <p style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.65)' }}>
            Revenue Intelligence
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          style={{
            background: 'var(--surface)', borderRadius: 'var(--r)', padding: '26px 24px',
            border: '1px solid var(--border)', boxShadow: '0 28px 70px rgba(0,0,0,0.4)',
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 850, letterSpacing: '-0.3px', marginBottom: 3 }}>Entrar</h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-m)', marginBottom: 18 }}>
            Acesse o painel com suas credenciais.
          </p>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2"
              style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 'var(--rx)', background: 'var(--red-l)', color: 'var(--red)', fontSize: 12.5, fontWeight: 600 }}
            >
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="login-user" style={labelStyle}>Usuário</label>
            <div style={inputWrap}>
              <User size={15} style={{ color: 'var(--text-m)', flexShrink: 0 }} />
              <input
                id="login-user" name="username" type="text" autoFocus autoComplete="username"
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Seu usuário" aria-label="Usuário" style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="login-pass" style={labelStyle}>Senha</label>
            <div style={inputWrap}>
              <Lock size={15} style={{ color: 'var(--text-m)', flexShrink: 0 }} />
              <input
                id="login-pass" name="password" type={show ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Sua senha" aria-label="Senha" style={inputStyle}
              />
              <button
                type="button" onClick={() => setShow(s => !s)}
                aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 'var(--rx)', border: 'none', background: 'transparent', color: 'var(--text-m)', cursor: 'pointer', flexShrink: 0 }}
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="flex items-center justify-center gap-2"
            style={{ width: '100%', height: 44, borderRadius: 'var(--rx)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.75 : 1, transition: 'opacity .15s' }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          © HoGrow Hotéis · acesso restrito
        </p>
      </div>
    </div>
  );
}
