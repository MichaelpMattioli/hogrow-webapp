// Parsing + validação de links do Booking.com para o cadastro de concorrentes.
//
// O usuário só cola o link da PÁGINA DO HOTEL; daqui extraímos o `slug` (chave
// que o rate shopper usa) e reconstruímos a URL no padrão canônico. `country`
// e `lang` são default (não são preenchimento do usuário).
//
// O comportamento espelha o scraper de produção
// (pipelines-hogrow-webapp/booking_rate_shopper/booking_scraper.py:_base_booking_url),
// que mantém apenas `scheme://host/path` e descarta a query string.
//
// Padrão canônico: https://www.booking.com/hotel/{país}/{slug}.{idioma}.html

export type BookingParse =
  | { ok: true; slug: string; country: string; lang: string; url: string }
  | { ok: false; code: BookingErrorCode; message: string };

export type BookingErrorCode =
  | 'vazio'
  | 'url_invalida'
  | 'dominio'
  | 'nao_hotel'
  | 'incompleto'
  | 'slug';

// /hotel/{cc}/{slug}[.{lang}].html  — slug: minúsculas/dígitos/hífens (sem
// hífen no começo/fim ou duplicado); lang opcional (ex. "pt-br", "en-gb").
const PATH_RE =
  /^\/hotel\/([a-z]{2})\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.([a-z]{2}(?:-[a-z]{2})?))?\.html$/;

const LANG_DEFAULT = 'pt-br';

function fail(code: BookingErrorCode, message: string): BookingParse {
  return { ok: false, code, message };
}

/** Valida e normaliza um link colado do Booking. Não lança — sempre retorna o resultado. */
export function parseBookingUrl(raw: string): BookingParse {
  const input = (raw ?? '').trim();
  if (!input) return fail('vazio', 'Cole o link da página do hotel no Booking.');

  // Conserto comum de colagem: sem esquema → assume https (igual ao scraper).
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return fail('url_invalida', 'Link inválido. Cole apenas o endereço da página.');
  }

  const host = u.hostname.toLowerCase();
  if (host !== 'booking.com' && !host.endsWith('.booking.com')) {
    return fail('dominio', 'O link precisa ser do Booking.com.');
  }

  // Descarta query/fragmento (só caminho), minúsculas, sem barra final.
  let path: string;
  try {
    path = decodeURIComponent(u.pathname);
  } catch {
    path = u.pathname;
  }
  path = path.toLowerCase().replace(/\/+$/, '');

  if (!path.startsWith('/hotel/')) {
    return fail(
      'nao_hotel',
      'Esse não é o link de um hotel. Abra o hotel no Booking e copie o endereço da página dele (contém /hotel/…).',
    );
  }

  const m = PATH_RE.exec(path);
  if (!m) {
    if (!path.endsWith('.html')) {
      return fail('incompleto', 'Link incompleto — copie o endereço completo da página (termina em .html).');
    }
    return fail('slug', 'Não consegui identificar o hotel nesse link.');
  }

  const country = m[1];           // estrutural no Booking — preservamos o do link
  const slug = m[2];              // chave do scraper, vem do link (nunca do nome)
  const lang = LANG_DEFAULT;      // idioma é default fixo, não exibido
  const url = `https://www.booking.com/hotel/${country}/${slug}.${lang}.html`;

  return { ok: true, slug, country, lang, url };
}

/** "paulista-flat" → "Paulista Flat" (sugestão de nome do concorrente, editável). */
export function nameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
