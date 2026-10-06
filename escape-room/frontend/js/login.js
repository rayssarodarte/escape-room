// Login: validação, mostrar/ocultar senha, chamada à API
const $ = s => document.querySelector(s);
$('#eye').onclick = () => { const s = $('#senha'); s.type = s.type === 'password' ? 'text' : 'password'; };
$('#esq').onclick = e => { e.preventDefault(); $('#msg').style.color = 'var(--warn)'; $('#msg').textContent = 'Para redefinir a senha, procure o administrador do sistema.'; };
$('#f').onsubmit = async e => {
  e.preventDefault();
  const login = $('#login').value.trim(), senha = $('#senha').value;
  $('#e1').textContent = login ? '' : 'Informe o usuário ou e-mail.';
  $('#e2').textContent = senha ? '' : 'Informe a senha.';
  if (!login || !senha) return;
  const b = $('#ok'); b.disabled = true; b.textContent = 'Entrando...';
  try {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha, lembrar: $('#lembrar').checked }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'Falha no login.');
    $('#msg').style.color = 'var(--ok)'; $('#msg').textContent = 'Login realizado. Redirecionando...';
    location.href = 'app.html#/dashboard';
  } catch (er) {
    $('#msg').style.color = 'var(--bad)';
    $('#msg').textContent = er instanceof TypeError ? 'Não foi possível conectar ao servidor.' : er.message;
    b.disabled = false; b.textContent = 'Entrar';
  }
};
