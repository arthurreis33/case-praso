// Hoje (fatia 4). Versão provisória: retornos com hora e a carteira por prioridade simples.
import { cardPonto } from './componentes.js';
export function renderHoje({ main, store }) {
  const ps = store.meusPontos();
  const ret = ps.filter((p) => p.status_dia === 'retornar').sort((a, b) => (a.retorno_sugerido || '').localeCompare(b.retorno_sugerido || ''));
  main.innerHTML = `<h1>Hoje</h1><p class="sutil">Lista sugerida e rota chegam na fatia 4.</p>
    <div class="secao-titulo"><h2>Retornos com hora</h2><span class="sutil">${ret.length}</span></div>
    ${ret.map((p) => cardPonto(store, p)).join('') || '<p class="sutil">Nenhum.</p>'}`;
}
