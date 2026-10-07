// Simulador de eventos (seção 7.2). Painel de desenvolvedor, atrás do botão discreto do topo.
// Em produção, cadastro, pedido e pagamento viriam da integração com o sistema de pedidos;
// aqui eles são disparados à mão para a banca ver os cards se moverem SOZINHOS no funil.
import { esc, toast, quando, seloEstado, dinheiro } from '../ui.js';
import { nomeDe } from '../store.js';
import { carregarSeed } from '../seed.js';
import { DIA_MS } from '../estados.js';

let selecionado = null;
let busca = '';

export function renderSim({ main, store, params, render, ir }) {
  if (params.p) selecionado = params.p;
  const agora = store.agora();

  const lista = () => {
    const q = busca.trim().toLowerCase();
    const ps = store.meusPontos()
      .filter((p) => !q || nomeDe(p).toLowerCase().includes(q) || (p.cnpj || '').includes(q))
      .slice(0, 40);
    return ps.map((p) => `<button type="button" data-sel="${esc(p.id)}" aria-pressed="${p.id === selecionado}">
      ${esc(nomeDe(p))} <span style="float:right">${seloEstado(store.situacao(p.id).estado)}</span></button>`).join('')
      || '<p class="sutil" style="padding:8px">Nenhum ponto.</p>';
  };

  const p = selecionado ? store.ponto(selecionado) : null;
  const sit = p ? store.situacao(p.id) : null;
  const ultPed = p ? store.pedidosDo(p.id)[0] : null;

  main.innerHTML = `
    <h1>Simulador de eventos</h1>
    <p class="sim-nota">Painel de demonstração. Em produção, estes eventos chegam sozinhos da integração com o sistema de pedidos. O vendedor nunca move um card.</p>

    <h2>Relógio</h2>
    <p><b>Hoje simulado:</b> ${esc(quando(agora.toISOString(), agora))} · ${agora.toLocaleDateString('pt-BR')} ${store.offsetDias ? `(<b>${store.offsetDias > 0 ? '+' : ''}${store.offsetDias} dias</b>)` : '(relógio real)'}</p>
    <div class="linha-btns">
      <button class="btn" data-dias="1">+1 dia</button>
      <button class="btn" data-dias="7">+7</button>
      <button class="btn" data-dias="30">+30</button>
      <button class="btn" data-dias="46">+46</button>
    </div>
    <div class="linha-btns" style="margin-top:8px">
      <input type="number" id="sim-n" inputmode="numeric" min="1" max="400" placeholder="N dias" aria-label="Avançar N dias" style="flex:1">
      <button class="btn" data-acao-sim="avancar-n">Avançar N</button>
    </div>
    <button class="btn" data-acao-sim="zerar" style="margin-top:8px;width:100%"${store.offsetDias ? '' : ' disabled'}>Voltar ao relógio real</button>
    <p class="dica">O +1 dia leva ao começo da jornada de amanhã; os outros mantêm a hora. Avançar o relógio roda as regras de tempo: 45 dias sem a 3ª compra autônoma → ativação vencida; mais de 120 dias sem comprar → churn.</p>

    <h2>Evento num ponto</h2>
    <input type="search" id="sim-busca" placeholder="Buscar ponto por nome ou CNPJ" value="${esc(busca)}" aria-label="Buscar ponto">
    <div class="lista-sel" id="sim-lista" style="margin-top:8px">${lista()}</div>
    ${p ? `
      <div class="caixa destaque">
        <b>${esc(nomeDe(p))}</b><br>${seloEstado(sit.estado)} <span class="sutil">${esc(sit.prazo?.texto || '')}${sit.estado === 'ativacao' ? ` · ${sit.compras_ciclo}/3 compras` : ''}</span>
        <div class="pilha" style="margin-top:10px">
          <button class="btn" data-ev="cadastro"${p.cadastro_em || sit.ultima_compra ? ' disabled' : ''}>Cadastro feito</button>
          <div class="linha-btns">
            <button class="btn" data-ev="pedido-autonomo">Pedido autônomo</button>
            <button class="btn" data-ev="pedido-assistido">Pedido assistido</button>
          </div>
          <button class="btn" data-ev="pagamento"${ultPed && !ultPed.pago_em ? '' : ' disabled'}>Pagamento do último pedido${ultPed ? ` (${dinheiro(ultPed.valor)})` : ''}</button>
          <a class="btn" href="#/ponto/${esc(p.id)}">Abrir a ficha</a>
        </div>
      </div>` : '<p class="sutil">Escolha um ponto para disparar cadastro, pedido ou pagamento.</p>'}

    <h2>Dados</h2>
    <div class="pilha">
      <button class="btn" data-acao-sim="reseed">Gerar de novo os dados fictícios</button>
    </div>
    <p class="dica">Recria os pontos fictícios a partir do relógio atual. Pontos reais (da V1 ou criados no campo) não são tocados.</p>`;

  main.querySelector('#sim-busca').addEventListener('input', (e) => {
    busca = e.target.value;
    main.querySelector('#sim-lista').innerHTML = lista();
  });

  main.addEventListener('click', (ev) => {
    const sel = ev.target.closest('[data-sel]');
    if (sel) { selecionado = sel.dataset.sel; return render(); }
    const dias = ev.target.closest('[data-dias]')?.dataset.dias;
    if (dias) return avancar(+dias);
    const a = ev.target.closest('[data-acao-sim]')?.dataset.acaoSim;
    if (a === 'avancar-n') { const n = +main.querySelector('#sim-n').value; if (n > 0) avancar(n); return; }
    if (a === 'zerar') { store.zerarRelogio(); toast('Relógio real'); return render(); }
    if (a === 'reseed') { store.removerFicticios(); const n = carregarSeed(store); toast(`${n} pontos fictícios gerados`); return render(); }
    const e = ev.target.closest('[data-ev]')?.dataset.ev;
    if (!e || !p) return;
    let r = null;
    if (e === 'cadastro') r = store.eventoCadastro(p.id);
    if (e === 'pedido-autonomo') r = store.eventoPedido(p.id, { autonomo: true });
    if (e === 'pedido-assistido') r = store.eventoPedido(p.id, { autonomo: false });
    if (e === 'pagamento' && ultPed) { store.eventoPagamento(ultPed.id); toast('Pagamento registrado'); return render(); }
    const selo = store.avancos.get(p.id);
    toast(r?.mudou && selo ? `${nomeDe(p)} · ${selo.texto}` : 'Evento registrado (sem mudança de etapa)');
    render();
  });

  function avancar(n) {
    // V2.3: o +1 dia leva ao começo da jornada de amanhã, para o retorno marcado hoje aparecer na rota do dia certo
    const a = store.agora();
    const [h, m] = (store.vendedor().jornada?.inicio || '08:00').split(':').map(Number);
    const dias = n === 1 ? (new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1, h, m || 0) - a) / DIA_MS : n;
    const mudaram = store.avancarRelogio(dias);
    toast(`+${n} ${n === 1 ? 'dia · começo da jornada' : 'dias'} · ${mudaram} ponto${mudaram === 1 ? '' : 's'} mudaram de estado sozinhos`, 3500);
    render();
  }
}
