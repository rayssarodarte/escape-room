// Shell: navegação por rota (#/...), sidebar, usuário logado
const NAV = [['dashboard', '▦', 'Dashboard'], ['turmas', '👥', 'Turmas'], ['grupos', '◈', 'Grupos'], ['nova', '＋', 'Nova Atividade'], ['andamento', '∿', 'Atividades em Andamento'], ['historico', '↺', 'Histórico']];
const TITLES = {
  dashboard: ['Dashboard', 'Visão geral das atividades do projeto.'], turmas: ['Turmas', 'Gerencie as turmas participantes.'],
  grupos: ['Grupos', 'Acompanhe os grupos de cada atividade.'], nova: ['Iniciar Nova Atividade', 'Configure e inicie uma nova sessão do Escape Room.'],
  atividade: ['Acompanhamento da Atividade', ''], historico: ['Histórico de Atividades', 'Registro de todas as atividades realizadas.']
};
const ROUTES = { dashboard: viewDashboard, turmas: viewTurmas, grupos: viewGrupos, nova: viewNova, atividade: viewAtividade, historico: viewHistorico };

async function go() {
  clearInterval(window.timer);
  const [, r = 'dashboard', id] = location.hash.split('/');
  $('#side').classList.remove('open');
  $('#nav').innerHTML = NAV.map(([k, i, t]) => `<a href="#/${k}" class="${k === r || (k === 'andamento' && r === 'atividade') ? 'on' : ''}">${i} ${t}</a>`).join('');
  if (r === 'andamento') {
    try { const d = await api('/dashboard'); if (d.atual) return (location.hash = '#/atividade/' + d.atual.id); } catch (e) { toast(e.message, 1); }
    $('#title').textContent = 'Atividades em Andamento'; $('#sub').textContent = '';
    return ($('#view').innerHTML = '<div class="empty">Nenhuma atividade em andamento. <a href="#/nova">Iniciar nova atividade</a></div>');
  }
  const [t, s] = TITLES[r] || TITLES.dashboard;
  $('#title').textContent = t; $('#sub').textContent = s;
  $('#view').innerHTML = '<div class="load">Carregando...</div>';
  try { await (ROUTES[r] || viewDashboard)(id); }
  catch (e) { $('#view').innerHTML = `<div class="empty">${esc(e.message)}</div>`; toast(e.message, 1); }
}

(async () => {
  try {
    const u = await api('/auth/me'); window.me = u;
    $('#who').innerHTML = `<i>${esc(u.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase())}</i><div>${esc(u.nome)}<small>${esc(u.perfil)}</small></div>`;
  } catch { return; }
  $('#menu').onclick = () => $('#side').classList.toggle('open');
  $('#sair').onclick = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); location.href = 'index.html'; };
  addEventListener('hashchange', go); go();
})();
