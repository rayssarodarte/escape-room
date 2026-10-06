// Cliente da API: fetch centralizado com tratamento de erros
async function api(url, o = {}) {
  let r;
  try {
    r = await fetch('/api' + url, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined });
  } catch { throw new Error('Não foi possível conectar ao servidor.'); }
  if (r.status === 401) { location.href = 'index.html'; throw new Error('Sessão expirada.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Falha na requisição.');
  return d;
}
