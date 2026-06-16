// Gate de acesso à UI (login simples por usuário/senha).
//
// ATENÇÃO — isto é um portão de UX, NÃO uma fronteira de segurança forte:
// como é uma SPA, a lógica e o hash da senha ficam no bundle, e os dados já são
// lidos via a anon key do Supabase (também pública). Para proteção real seria
// preciso Supabase Auth + RLS exigindo usuário autenticado em todas as
// queries/RPCs/edge functions. Aqui só impedimos o acesso casual à interface.

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const AUTH_USER = 'viviane';
// SHA-256 de 'hogrow321' (evita a senha em texto puro no código).
const AUTH_PASS_HASH = '49e2e71ac8e052fba3388adbddc37829f8d2304c8d4d3a22eca5d8c62017078e';
const STORAGE_KEY = 'hg_auth';

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface AuthContextValue {
  user: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restaura a sessão do localStorage de forma síncrona (sem flash de login).
  const [user, setUser] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === AUTH_USER ? AUTH_USER : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const ok = username.trim().toLowerCase() === AUTH_USER && (await sha256Hex(password)) === AUTH_PASS_HASH;
    if (ok) {
      setUser(AUTH_USER);
      try { localStorage.setItem(STORAGE_KEY, AUTH_USER); } catch { /* storage indisponível */ }
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage indisponível */ }
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
