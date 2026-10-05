// RF03 · lista do dia. "Retornar" primeiro, ordenado pelo horário sugerido (RF10):
// é aqui que o registro de ontem muda o dia de hoje.
import { TIPOS, QUEM_DECIDE, FAIXAS, rotulo } from '../catalogo.js';
import { esc, quando, mapsUrl } from '../ui.js';

function cartao(p, agora) {
  const tipo = rotulo(TIPOS, p.tipo);
  let extra = '';
  if (p.status_dia === 'retornar' && p.retorno_sugerido) {
    const dec = p.decisor?.quem ? ` · falar com ${rotulo(QUEM_DECIDE, p.decisor.quem).toLowerCase()}` : '';
    const motivo = p.retorno_motivo === 'melhor_horario' ? 'horário combinado' : 'janela do decisor';
    extra = `<div><span class="quando">Voltar ${esc(quando(p.retorno_sugerido, agora))}</span><span class="meta"> · ${motivo}${esc(dec)}</span></div>`;
  } else if (p.decisor?.faixas?.length) {
    extra = `<div class="meta">Decisor: ${esc(p.decisor.faixas.map((f) => rotulo(FAIXAS, f)).join(', '))}</div>`;
  }
  const vencido = p.status_dia === 'retornar' && p.retorno_sugerido && new Date(p.retorno_sugerido) <= agora;
  const sub = [tipo, p.endereco].filter(Boolean).join(' · ');
  return `<div class="cartao ${p.status_dia === 'retornar' ? 'retornar' : ''} ${vencido ? 'vencido' : ''}">
    <a class="corpo" href="#/ponto/${p.id}">
      <div class="nome">${esc(p.nome || 'Sem nome')}${p.ficticio ? ' <span class="selo">fictício</span>' : ''}</div>
      <div class="meta">${esc(sub)}</div>${extra}
    </a>
    <a class="rota" href="${esc(mapsUrl(p))}" target="_blank" rel="noopener" aria-label="Rota no Google Maps para ${esc(p.nome)}">Rota</a>
  </div>`;
}

export function renderLista({ main, barra, store }) {
  const agora = new Date();
  const ps = store.estado.pontos;
  const retornar = ps.filter((p) => p.status_dia === 'retornar')
    .sort((a, b) => (a.retorno_sugerido || '9').localeCompare(b.retorno_sugerido || '9'));
  const aVisitar = ps.filter((p) => p.status_dia === 'a_visitar');
  const visitados = ps.filter((p) => p.status_dia === 'visitado');

  const secao = (titulo, itens, vazio) => `
    <div class="secao-titulo"><h2>${titulo}</h2><span class="sutil">${itens.length}</span></div>
    ${itens.length ? itens.map((p) => cartao(p, agora)).join('') : `<p class="sutil">${vazio}</p>`}`;

  main.innerHTML = ps.length ? `
    ${retornar.length ? secao('Retornar', retornar, '') : ''}
    ${secao('A visitar', aVisitar, 'Nada pendente.')}
    <details class="visitados"${visitados.length && !aVisitar.length && !retornar.length ? ' open' : ''}>
      <summary>Visitados (${visitados.length})</summary>
      ${visitados.map((p) => cartao(p, agora)).join('') || '<p class="sutil">Nenhum ainda.</p>'}
    </details>` : `
    <div class="vazio">
      <h1>Lista do dia vazia</h1>
      <p>Cadastre os pontos do bairro antes de sair, ou crie um ponto na rua pelo GPS.</p>
      <p class="sutil">Para conhecer o app sem dado real, use <b>Exportar → Mais opções → Carregar pontos fictícios</b>.</p>
    </div>`;

  barra.innerHTML = `
    <a class="btn primaria grande" href="#/novo/gps">+ Ponto aqui</a>
    <a class="btn grande" href="#/novo">+ Cadastrar</a>`;
}
