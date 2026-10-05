// Descobrir (seção 6.9): fila de pontos desconhecidos, em três grupos.
//  1) Na Receita e fora da carteira → lead novo, já com o selo MEI / não MEI;
//  2) No mapa aberto sem CNPJ casado → "verificar no campo";
//  3) Casado com baixa confiança → "confirmar".
// O vendedor adiciona à lista de hoje ou descarta com motivo (fechou, não é ICP, duplicado).
// No protótipo os desconhecidos são fictícios (seed); o cruzamento real Receita + Overture está em scripts/.
import { TIPOS, DESCARTE, rotulo } from '../catalogo.js';
import { esc, toast } from '../ui.js';
import { GRUPO } from './mapa.js';
import { gerarPlano } from '../plano.js';

const ACAO = { receita: 'lead novo', mapa_aberto: 'verificar no campo', baixa_confianca: 'confirmar' };
let descartando = null;

export function renderDescobrir({ main, store, render }) {
  const novos = store.estado.desconhecidos.filter((d) => d.status === 'novo');
  const feitos = store.estado.desconhecidos.filter((d) => d.status !== 'novo');
  const grupo = (g) => novos.filter((d) => d.grupo === g);

  main.innerHTML = `
    <h1>Descobrir</h1>
    <p class="sutil">Estabelecimentos do ICP que ainda não estão na carteira. Dados fictícios no protótipo; em produção, vêm do cruzamento Receita + mapa aberto (ver <code>scripts/</code>).</p>
    ${Object.keys(GRUPO).map((g) => `
      <div class="secao-titulo"><h2>${esc(GRUPO[g])}</h2><span class="sutil">${grupo(g).length}</span></div>
      ${grupo(g).map((d) => `
        <div class="caixa">
          <b>${esc(d.nome)}</b> ${d.mei != null ? `<span class="selo">${d.mei ? 'MEI · 0,5 pt' : 'não MEI'}</span>` : ''}<span class="selo">${esc(ACAO[g])}</span>
          <div class="sutil">${esc(rotulo(TIPOS, d.tipo))} · ${esc(d.bairro)}${d.confianca != null ? ` · confiança ${Math.round(d.confianca * 100)}%` : ''} · ${esc(d.fonte)}</div>
          ${descartando === d.id ? `
            <div class="campo">Motivo do descarte</div>
            <div class="linha-btns">${DESCARTE.map(([k, r]) => `<button class="btn peq" data-descartar="${esc(d.id)}" data-motivo="${k}">${esc(r)}</button>`).join('')}</div>` : `
            <div class="linha-btns" style="margin-top:8px">
              <button class="btn primaria peq" data-adotar="${esc(d.id)}">+ lista de hoje</button>
              <button class="btn peq" data-quase-descartar="${esc(d.id)}">Descartar</button>
              <a class="btn peq" href="#/mapa?foco=" data-ver="${esc(d.id)}" style="flex:0 0 auto">Mapa</a>
            </div>`}
        </div>`).join('') || '<p class="sutil">Nada pendente.</p>'}`).join('')}
    ${feitos.length ? `<details class="dobra"><summary>Já tratados (${feitos.length})</summary>${feitos.map((d) => `<p>${esc(d.nome)} · ${d.status === 'adotado' ? 'virou ponto da carteira' : `descartado: ${esc(rotulo(DESCARTE, d.motivo_descarte))}`}</p>`).join('')}</details>` : ''}`;

  main.addEventListener('click', (ev) => {
    const ad = ev.target.closest('[data-adotar]')?.dataset.adotar;
    if (ad) {
      const p = store.adotarDesconhecido(ad);
      const pl = store.estado.plano_dia;
      if (pl) {
        const novo = gerarPlano(store, { removidos: pl.removidos, adicionados: [...(pl.adicionados || []), p.id], feitos: pl.feitos });
        store.setPlano(novo);
        store.marcarPlanejado(novo.paradas.map((x) => x.id));
        const entrou = novo.paradas.some((x) => x.id === p.id);
        toast(entrou ? `${p.nome_fantasia} entrou na lista de hoje` : `${p.nome_fantasia} entrou na carteira; não coube hoje: ${novo.nao_couberam.find((x) => x.id === p.id)?.motivo || 'sem espaço'}`, 4000);
      } else toast('Entrou na carteira');
      return render();
    }
    const q = ev.target.closest('[data-quase-descartar]')?.dataset.quaseDescartar;
    if (q) { descartando = q; return render(); }
    const ds = ev.target.closest('[data-descartar]');
    if (ds) { store.descartarDesconhecido(ds.dataset.descartar, ds.dataset.motivo); descartando = null; toast('Descartado'); return render(); }
    const ver = ev.target.closest('[data-ver]');
    if (ver) {
      ev.preventDefault();
      const d = store.estado.desconhecidos.find((x) => x.id === ver.dataset.ver);
      location.hash = `#/mapa?lat=${d.lat}&lng=${d.lng}`;
    }
  });
}
