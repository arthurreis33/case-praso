// Ficha do ponto (seção 6.6). Cabeçalho com estado, pontos, prazo, decisor, janela e quem paga;
// bloco que depende do estado; linha do tempo única; ações embaixo (uma mão).
import { TIPOS, RESULTADOS, PROXIMAS_ACOES, MOTIVOS_NAO_AVANCO, ESTADOS, TIPOS_VISITA, rotulo, QUEM_PAGA_PONTO, ESTADO_DESCRICAO } from '../catalogo.js';
import { icone } from '../icones.js';
import { esc, toast, quando, data, dinheiro, pct, seloEstado, seloPontos, janelaTexto, mapsUrl, confirmar, rotuloEstado, chips, alternarChip } from '../ui.js';
import { pontosValor, altoPotencial, coordDe } from '../rules.js';
import { nomeDe } from '../store.js';
import { prazoHtml, proximaAcao, seloAvanco, daUltimaVez } from './componentes.js';
import { avaliarPrioridade, textoMotivo } from '../prioridade.js';
import { resumoCompras, FORMAS_PAGAMENTO_ROTULO } from '../historico.js';
import { MODELOS, modeloPara, enviarWhatsApp, cestaHtml } from '../whatsapp.js';
import { modoDemo } from '../demo.js';

const CAUSA = { registro_visita: 'registro de visita', cadastro: 'cadastro no app', pedido: 'pedido no app', tempo: 'prazo passou', correcao_manual: 'correção manual', planejamento: 'entrou na rota', migracao: 'veio da V1' };
const ETAPA_NOME = ['Ainda fora do funil', 'Visita planejada', 'Visitado', 'Decisor encontrado', 'Cadastrado', '1ª compra', '3ª compra pelo app'];
let verTudo = false;

export function renderFicha({ main, barra, store, ir, render }, id) {
  const p = store.ponto(id);
  if (!p) return ir('#/carteira', true);
  const agora = store.agora();
  const sit = store.situacao(p.id);
  const pedidos = store.pedidosDo(p.id);
  const visitas = store.visitasDo(p.id);
  const prior = avaliarPrioridade(store, p, { sit });
  const pa = proximaAcao(store, p, sit);
  const ultimaVez = daUltimaVez(store, p);
  const c = coordDe(p);
  const alto = altoPotencial(p);

  const pino = p.coord_confirmada
    ? `<b>coordenada confirmada ${p.coord_confirmada.origem === 'checkin' ? 'em visita' : p.coord_confirmada.origem === 'manual' ? 'à mão (pino arrastado)' : 'no campo'}</b>${p.coord_confirmada.precisao_m ? ` · ±${p.coord_confirmada.precisao_m} m` : ''}${p.coord_confirmada.em ? ` · ${data(p.coord_confirmada.em)}` : ''}`
    : c ? 'coordenada do cadastro (ainda não confirmada em visita)' : 'sem coordenada: vem no check-in';

  main.innerHTML = `
    <div class="cab-ficha">
      <h1>${esc(nomeDe(p))}${p.ficticio && modoDemo() ? ' <span class="selo">exemplo</span>' : ''}</h1>
      <div class="sutil">${esc([rotulo(TIPOS, p.tipo), p.bairro].filter(Boolean).join(' · '))}</div>
      <div class="linha2">${seloEstado(sit.estado)}${seloPontos(pontosValor(p))}${alto ? '<span class="selo">alto potencial</span>' : ''}${p.mei === true ? '<span class="selo">MEI</span>' : p.mei === false ? '<span class="selo">não MEI</span>' : ''}</div>
      <p class="desc-estado">${esc(ESTADO_DESCRICAO[sit.estado] || '')}${sit.prazo ? ` · ${prazoHtml(sit)}` : ''}</p>
      ${seloAvanco(store, p.id)}
    </div>
    <section class="proxima-ficha" aria-label="Próxima ação">
      <div class="rot">${icone('seta')}Próxima ação</div>
      <p class="acao">${esc(pa.texto)}</p>
      ${ultimaVez ? `<p class="ultima-vez">${esc(ultimaVez)}</p>` : ''}
      <p class="porque">${prior.esperados ? `Por que ir hoje: ${esc(textoMotivo(prior).replace(/^Vale [\d,.]+ pts? ?·? ?/, '') || 'vale a visita')} · ≈${String(prior.esperados).replace('.', ',')} pt prováveis` : `Hoje não: ${esc(prior.bloqueio || 'chance baixa')}`}</p>
    </section>
    <dl class="dl">
      <dt>Decisor</dt><dd>${esc(janelaTexto(p.decisor) || 'ainda não sabemos')}</dd>
      <dt>Quem paga</dt><dd>${esc(rotulo(QUEM_PAGA_PONTO, p.quem_paga) || 'não registrado')}</dd>
      <dt>No funil</dt><dd>${esc(ETAPA_NOME[p.etapa_funil || 0])}</dd>
    </dl>

    ${blocoEstado()}

    <details class="dobra">
      <summary>Cadastro e pino</summary>
      <dl class="dl">
        <dt>CNPJ</dt><dd>${esc(fmtCnpj(p.cnpj) || 'sem CNPJ (verificar no campo)')}</dd>
        ${p.razao_social ? `<dt>Razão social</dt><dd>${esc(p.razao_social)}</dd>` : ''}
        ${p.cnae ? `<dt>CNAE</dt><dd>${esc(p.cnae)}${p.situacao ? ` · ${esc(p.situacao)}` : ''}</dd>` : ''}
        <dt>Endereço</dt><dd>${esc(p.endereco_cadastral || '–')}</dd>
        <dt>Pino</dt><dd>${pino}</dd>
      </dl>
      <div class="linha-btns" style="margin-top:8px">
        <a class="btn peq" href="#/mapa?pino=${esc(p.id)}">Corrigir pino no mapa</a>
        <a class="btn peq" href="#/ponto/${esc(p.id)}/editar">Editar cadastro</a>
      </div>
    </details>

    <h2>Linha do tempo</h2>
    ${linhaDoTempo()}

    <details class="dobra" id="correcao">
      <summary>Corrigir um registro errado</summary>
      <p class="sutil">Use se marcou errado. A correção fica no histórico.</p>
      ${visitas.length ? `<label class="campo" for="corr-visita">Visita</label>
        <select id="corr-visita">${visitas.slice(0, 8).map((v) => `<option value="${esc(v.id)}">${esc(quando(v.checkin.em, agora))} · ${esc(rotulo(RESULTADOS, v.nucleo.resultado) || 'sem resultado')}</option>`).join('')}</select>
        <div class="campo">Resultado correto</div>
        ${chips('corr-resultado', RESULTADOS, null)}
        <button class="btn" data-acao-f="corrigir-visita" style="width:100%;margin-top:8px">Corrigir resultado</button>` : ''}
      ${!pedidos.length && !p.cadastro_em ? `<div class="campo">Estado (ponto sem compras registradas)</div>
        ${chips('corr-estado', ESTADOS, null)}
        <button class="btn" data-acao-f="corrigir-estado" style="width:100%;margin-top:8px">Corrigir estado</button>` : ''}
    </details>
    ${modoDemo() ? `<a class="btn mais-link demo-link" href="#/sim?p=${esc(p.id)}">Demonstração: simular cadastro ou pedido neste ponto</a>` : ''}`;

  // ---------- ações (metade de baixo) ----------
  const aberta = store.visitaAberta();
  const modelo = modeloPara(sit.estado);
  if (aberta && aberta.ponto_id === p.id) {
    barra.innerHTML = `<a class="btn primaria grande" href="#/visita/${aberta.id}">Continuar visita</a>`;
  } else {
    barra.innerHTML = `
      ${aberta ? `<a class="btn grande" href="#/visita/${aberta.id}">Visita aberta em outro ponto</a>` : `<button class="btn destaque grande" data-acao-f="checkin">${icone('checkin')}Check-in</button>`}
      <button class="btn zap grande" data-acao-f="whatsapp" data-modelo="${modelo}" aria-label="Enviar mensagem de ${esc(rotulo(MODELOS, modelo))} pelo WhatsApp">${icone('whatsapp')}WhatsApp</button>
      <a class="btn grande" href="${esc(mapsUrl(p))}" target="_blank" rel="noopener" style="flex:0 0 auto" aria-label="Rota no Google Maps">${icone('navegar')}Rota</a>`;
  }

  const agir = async (ev) => {
    const b = ev.target.closest('[data-acao-f]');
    const chip = ev.target.closest('.chip');
    if (chip && chip.closest('#correcao')) { alternarChip(chip); return; }
    if (!b) return;
    const a = b.dataset.acaoF;
    if (a === 'checkin') {
      try { const v = store.checkin(p.id); ir(`#/visita/${v.id}`); } catch (e) { toast(e.message); }
    } else if (a === 'whatsapp') {
      enviarWhatsApp(store, p, b.dataset.modelo);
      toast('Contato registrado sozinho na linha do tempo');
      setTimeout(render, 400);
    } else if (a === 'corrigir-visita') {
      const vid = main.querySelector('#corr-visita').value;
      const r = main.querySelector('.chips[data-campo="corr-resultado"] .chip[aria-pressed="true"]')?.dataset.v;
      if (!r) return toast('Escolha o resultado correto');
      if (await confirmar('Corrigir registro', `O resultado desta visita passa a ser "${rotulo(RESULTADOS, r)}". Fica no histórico como correção manual.`, 'Corrigir')) {
        store.corrigirResultadoVisita(vid, r); toast('Registro corrigido'); render();
      }
    } else if (a === 'corrigir-estado') {
      const e = main.querySelector('.chips[data-campo="corr-estado"] .chip[aria-pressed="true"]')?.dataset.v;
      if (!e) return toast('Escolha o estado correto');
      if (await confirmar('Corrigir estado', `O estado declarado passa a ser "${rotuloEstado(e)}". Fica no histórico como correção manual.`, 'Corrigir')) {
        store.corrigirEstadoDeclarado(p.id, e); toast('Estado corrigido'); render();
      }
    } else if (a === 'ver-tudo') { verTudo = true; render(); }
  };
  main.addEventListener('click', agir);
  barra.onclick = agir;
  return () => { verTudo = false; };

  // ---------- blocos por estado ----------
  function blocoEstado() {
    const r = resumoCompras(pedidos);
    if (sit.estado === 'lead' || sit.estado === 'cadastrado_sem_compra') {
      return `
        ${sit.estado === 'cadastrado_sem_compra' ? '<div class="caixa destaque"><b>Cadastro feito, falta a 1ª compra.</b> Ajude a fazer o primeiro pedido no app, com a cesta abaixo.</div>' : ''}
        <h2>Cadastro no app, passo a passo</h2>
        <p class="dica">Leva poucos minutos. Faça junto com o dono, no celular dele.</p>
        <ol class="checklist passos">
          <li>E-mail do dono (cria ou acessa a conta)</li>
          <li>Nome e WhatsApp de quem vai pedir</li>
          <li>Nome do estabelecimento e CNPJ${p.cnpj ? ` (${esc(fmtCnpj(p.cnpj))})` : ''}</li>
          <li>Endereço de entrega com número, complemento e ponto de referência. <b>Confira o pino no mapa:</b> é onde o pedido chega</li>
          <li><b>"Como você conheceu a Praso?" → marque "Vendedor da Praso"</b></li>
          <li>Categoria e tipo do estabelecimento</li>
        </ol>
        <div class="aviso-fixo" role="note">Com CNPJ, o cliente pode ter 7 dias para pagar, mas só depois da análise de crédito: não prometa.</div>
        ${!p.cnpj ? '<p class="dica">Sem CNPJ, dá para cadastrar com CPF e data de nascimento. Mas com CNPJ o cliente ganha ofertas de boas-vindas, isenção da taxa de serviço, frete grátis e a chance de 7 dias para pagar.</p>' : ''}
        ${cestaHtml(p.tipo, esc, { demo: modoDemo() })}`;
    }
    if (sit.estado === 'ativacao' || sit.estado === 'ativacao_vencida') {
      const n = Math.min(3, sit.compras_ciclo);
      return `
        <h2>Ativando · ${n} de 3 compras</h2>
        <div class="compras-progresso" aria-label="${n} de 3 compras">${[1, 2, 3].map((i) => `<span class="${i <= n ? 'feita' : ''}"></span>`).join('')}</div>
        <p>${sit.estado === 'ativacao' ? `<b>${esc(sit.prazo.texto)}</b>. A 3ª precisa ser feita pelo app, sem você.` : '<b>Passou dos 45 dias sem a 3ª compra pelo app.</b>'} ${sit.compras_autonomas_ciclo} pelo app neste ciclo.</p>
        ${r ? `<div class="caixa"><b>Último pedido</b> · ${esc(data(r.ultimo_pedido.data))} · ${dinheiro(r.ultimo_pedido.valor)} · ${r.ultimo_pedido.autonomo ? 'pelo app' : 'com você'}
          <div class="sutil">${esc((r.ultimo_pedido.itens || []).map((i) => `${i.qtd}× ${i.nome}`).join(' · '))}</div></div>` : ''}
        <button class="btn zap" data-acao-f="whatsapp" data-modelo="recompra" style="width:100%">${icone('whatsapp')}Mensagem de recompra (repetir o último pedido)</button>`;
    }
    if (sit.estado === 'recorrente') {
      return `<h2>Recorrente</h2>
        ${r ? kpis(r) : ''}
        <p class="sutil">${esc(sit.prazo?.texto || '')}${sit.prazo?.dias_para_churn != null ? ` · churn em ${sit.prazo.dias_para_churn} dias sem comprar` : ''}</p>
        <button class="btn zap" data-acao-f="whatsapp" data-modelo="recompra" style="width:100%">${icone('whatsapp')}Mensagem de recompra</button>`;
    }
    if (sit.estado === 'churn' && r) {
      const cat = r.top_categorias[0];
      return `
        <h2>Histórico de compras</h2>
        ${kpis(r)}
        <div class="caixa destaque"><h3>Roteiro de reconquista</h3>
          <p>Comece por <b>${esc(cat?.rotulo || '')}</b>: era ${pct(cat?.share)} do que ele comprava.${r.parou_de_comprar.length ? ` Antes de sair, parou de comprar <b>${esc(r.parou_de_comprar.map((x) => x.rotulo.toLowerCase()).join(', '))}</b>: pergunte o que aconteceu ali.` : ''}</p></div>
        <h3>Top 5 itens</h3>
        <table class="tabela"><thead><tr><th>Item</th><th class="n">Pedidos</th><th class="n">Total</th></tr></thead><tbody>
          ${r.top_itens.map((i) => `<tr><td>${esc(i.nome)}</td><td class="n">${i.pedidos}</td><td class="n">${dinheiro(i.valor)}</td></tr>`).join('')}</tbody></table>
        <h3>Categorias</h3>
        <table class="tabela"><tbody>${r.top_categorias.slice(0, 5).map((c2) => `<tr><td>${esc(c2.rotulo)}</td><td class="n">${pct(c2.share)}</td></tr>`).join('')}</tbody></table>
        <p class="sutil">Pagava com: <b>${esc(FORMAS_PAGAMENTO_ROTULO[r.forma_pagamento] || r.forma_pagamento || '–')}</b>.</p>
        <button class="btn zap" data-acao-f="whatsapp" data-modelo="reconquista" style="width:100%">${icone('whatsapp')}Mensagem de reconquista</button>`;
    }
    return '';
  }

  function kpis(r) {
    return `<div class="kpis">
      <div class="kpi"><div class="v">${dinheiro(r.total)}</div><div class="r">total em ${r.n} pedidos</div></div>
      <div class="kpi"><div class="v">${dinheiro(r.ticket_medio)}</div><div class="r">ticket médio</div></div>
      <div class="kpi"><div class="v">${r.frequencia_dias ? `${Math.round(r.frequencia_dias)} d` : '–'}</div><div class="r">entre compras</div></div>
      <div class="kpi"><div class="v">${esc(data(r.ultima))}</div><div class="r">última compra</div></div>
    </div>`;
  }

  // ---------- linha do tempo única ----------
  function linhaDoTempo() {
    const itens = [];
    for (const v of visitas) {
      const det = [
        rotulo(TIPOS_VISITA, v.tipo),
        v.motivo_nao_avanco && `motivo: ${rotulo(MOTIVOS_NAO_AVANCO, v.motivo_nao_avanco)}`,
        v.proxima_acao?.tipo && v.proxima_acao.tipo !== 'nenhuma' && `próxima: ${rotulo(PROXIMAS_ACOES, v.proxima_acao.tipo)}${v.proxima_acao.data_hora ? ` ${quando(v.proxima_acao.data_hora, agora)}` : ''}`,
        v.tempos?.no_ponto_s != null && `${Math.round(v.tempos.no_ponto_s / 60)} min no ponto`,
      ].filter(Boolean).join(' · ');
      const nota = v.nota_texto || v.surpresa;
      itens.push({ ts: v.checkin.em, cls: 'visita', href: `#/visita/${v.id}`, html: `<span class="tit">Visita · ${esc(rotulo(RESULTADOS, v.nucleo.resultado) || 'sem resultado')}${v.checkout ? '' : ' (aberta)'}</span>
        <div class="det">${esc(det)}</div>${nota ? `<div class="det">“${esc(nota.slice(0, 220))}”${v.nota_origem === 'voz' ? ' <span class="sutil">(voz)</span>' : ''}</div>` : ''}${v.transcricao_status === 'pendente' ? '<div class="sutil">transcrição na fila</div>' : ''}` });
    }
    for (const c2 of store.contatosDo(p.id)) {
      itens.push({ ts: c2.ts, cls: 'contato', html: `<span class="tit">${esc(c2.canal === 'whatsapp' ? 'WhatsApp' : c2.canal)} · ${esc(rotulo(MODELOS, c2.modelo_mensagem) || 'mensagem')}</span><div class="det sutil">${c2.gerado_pela_plataforma ? 'gerada pela plataforma, gravada sozinha' : ''}</div>` });
    }
    for (const pd of pedidos) {
      itens.push({ ts: pd.data, cls: 'pedido', html: `<span class="tit">Pedido · ${dinheiro(pd.valor)} · ${pd.autonomo ? 'pelo app' : 'com você'}</span>
        <div class="det sutil">${esc((pd.itens || []).slice(0, 4).map((i) => i.nome).join(' · '))}${pd.itens?.length > 4 ? '…' : ''}${pd.pago_em ? ' · pago' : ''}</div>` });
    }
    for (const e of store.eventosDo(p.id)) {
      if (e.dimensao === 'etapa' && e.causa !== 'correcao_manual') continue; // etapa aparece junto do evento que a causou
      const txt = e.dimensao === 'estado'
        ? `${e.de ? `${rotuloEstado(e.de) || e.de} → ` : ''}${rotuloEstado(e.para) || e.para}`
        : `etapa ${ETAPA_NOME[e.de] || e.de} → ${ETAPA_NOME[e.para] || e.para}`;
      itens.push({ ts: e.ts, cls: 'estado', html: `<span class="tit">${esc(txt)}</span><div class="det sutil">${esc(CAUSA[e.causa] || e.causa)}${e.causa === 'correcao_manual' ? ' · não conta como avanço' : ''}</div>` });
    }
    itens.sort((a, b) => b.ts.localeCompare(a.ts));
    const mostrar = verTudo ? itens : itens.slice(0, 15);
    return `<ul class="linha-tempo">${mostrar.map((i) => (i.href
      ? `<li class="${i.cls}"><a class="lt-link" href="${esc(i.href)}"><div class="quando-lt">${esc(quando(i.ts, agora))}</div>${i.html}</a></li>`
      : `<li class="${i.cls}"><div class="quando-lt">${esc(quando(i.ts, agora))}</div>${i.html}</li>`)).join('') || '<li>Nada ainda.</li>'}</ul>
      ${itens.length > mostrar.length ? `<button class="btn" data-acao-f="ver-tudo" style="width:100%">Ver tudo (${itens.length})</button>` : ''}`;
  }
}

export function fmtCnpj(c) {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;
}

