// Perfil (menu do topo). Junta o que é ajuste e não trabalho do dia:
//  Minha rota (deslocamento, base, jornada, tempo por visita) · Backup (CSV, JSON, importar)
//  · Visão do gestor · Dados de exemplo · Modo demonstração (simulador e relógio).
// Em produção: rota e jornada vêm do cadastro do vendedor, o backup vira sincronização
// e a visão do gestor vira um papel no login.
import { MODOS_DESLOCAMENTO } from '../catalogo.js';
import { esc, toast, quando } from '../ui.js';
import { podeCompartilharArquivo } from '../export.js';
import { obterPosicao } from '../geo.js';
import { duracoesMedidas } from '../plano.js';
import { replanejar } from './hoje.js';
import { modoDemo, ligarDemo } from '../demo.js';
import { icone } from '../icones.js';

const TIPO_VISITA = { aquisicao: 'Aquisição', acompanhamento: 'Acompanhamento', reconquista: 'Reconquista' };

export function renderPerfil({ main, store, render }) {
  const e = store.estado;
  const vend = store.vendedor();
  const modo = e.config.modo_deslocamento || 'moto';
  const dur = duracoesMedidas(store);
  const reais = e.pontos.filter((p) => !p.ficticio).length;
  const ficticios = e.pontos.length - reais;
  const desde = e.ultimo_export;
  const semBackup = e.visitas.filter((v) => !v.ficticio && (!desde || v.checkin.em > desde)).length;
  const demo = modoDemo();

  main.innerHTML = `
    <h1>Perfil</h1>
    <p class="sutil">${esc(vend.nome || 'Você')} · meta de ${vend.meta_pontos_semana} pt por semana</p>

    <section class="grupo-perfil" id="rota">
      <h2>${icone('rota')}Minha rota</h2>
      <div class="campo">Deslocamento</div>
      <div class="chips">${MODOS_DESLOCAMENTO.map(([k, r]) => `<button type="button" class="chip" data-modo-desl="${k}" aria-pressed="${modo === k}">${r}</button>`).join('')}</div>
      <dl class="dl">
        <dt>Jornada</dt><dd>${esc(vend.jornada.inicio)} às ${esc(vend.jornada.fim)} · almoço ${esc(vend.jornada.almoco.join(' às '))}</dd>
        <dt>Saída</dt><dd>${vend.base ? 'da sua base' : 'base não definida'}</dd>
        <dt>Tempo por visita</dt><dd>${Object.entries(dur).map(([t, d]) => `${TIPO_VISITA[t] || t} ${d.min} min`).join(' · ')}</dd>
      </dl>
      <button type="button" class="btn" data-acao-p="base-aqui" style="width:100%;margin-top:10px">${icone('mira')}Usar minha posição como base</button>
    </section>

    <section class="grupo-perfil" id="backup">
      <h2>${icone('nuvem')}Backup</h2>
      <p class="${semBackup ? 'alerta-txt' : 'sutil'}">${semBackup ? `${semBackup} visita${semBackup > 1 ? 's' : ''} sem backup.` : 'Tudo com backup.'} Último: ${desde ? esc(quando(desde)) : 'nunca'}.</p>
      <p class="sutil">${reais} pontos seus · ${e.visitas.length} visitas · tudo salvo neste aparelho.</p>
      <div class="pilha">
        <button type="button" class="btn primaria" data-acao="baixar-csv">${icone('baixar')}Baixar planilha (CSV)</button>
        <button type="button" class="btn" data-acao="baixar-json">${icone('baixar')}Baixar backup completo (JSON)</button>
        ${podeCompartilharArquivo() ? `<button type="button" class="btn" data-acao="compartilhar-csv">${icone('compartilhar')}Compartilhar planilha</button>
        <button type="button" class="btn" data-acao="compartilhar-json">${icone('compartilhar')}Compartilhar backup</button>` : ''}
        <label class="btn">${icone('subir')}Restaurar backup (JSON)<input type="file" accept="application/json,.json" id="inp-importar" hidden></label>
      </div>
    </section>

    <section class="grupo-perfil">
      <h2>${icone('equipe')}Equipe</h2>
      <a class="btn" href="#/gestor" style="width:100%">Abrir a visão do gestor</a>
    </section>

    <section class="grupo-perfil">
      <h2>${icone('caixa')}Dados de exemplo</h2>
      <p class="sutil">${ficticios ? `${ficticios} pontos de exemplo na carteira.` : 'Para treinar sem mexer na sua carteira.'}</p>
      <div class="pilha">
        <button type="button" class="btn" data-acao="carregar-exemplo">${ficticios ? 'Gerar de novo os dados de exemplo' : 'Carregar dados de exemplo'}</button>
        ${ficticios ? '<button type="button" class="btn perigo" data-acao="remover-exemplo">Remover dados de exemplo</button>' : ''}
      </div>
    </section>

    <section class="grupo-perfil">
      <h2>${icone('demo')}Modo demonstração</h2>
      <p class="sutil">${demo ? 'Ligado: aparecem o simulador, o relógio e as marcas de dado de exemplo.' : 'Desligado.'}</p>
      <div class="pilha">
        ${demo ? '<a class="btn primaria" href="#/sim">Abrir o simulador</a>' : ''}
        <button type="button" class="btn" data-acao-p="demo">${demo ? 'Desligar o modo demonstração' : 'Ligar o modo demonstração'}</button>
      </div>
    </section>
    <p class="sutil versao">Campo Praso · V2.1</p>`;

  main.addEventListener('click', async (ev) => {
    const m = ev.target.closest('[data-modo-desl]')?.dataset.modoDesl;
    if (m) { store.setConfig({ modo_deslocamento: m }); replanejar(store); toast('Rota de hoje recalculada'); return render(); }
    const a = ev.target.closest('[data-acao-p]')?.dataset.acaoP;
    if (a === 'demo') { ligarDemo(!demo); toast(demo ? 'Modo demonstração desligado' : 'Modo demonstração ligado'); return render(); }
    if (a === 'base-aqui') {
      try {
        toast('Buscando sua posição…');
        const pos = await obterPosicao({ maximumAge: 60000, timeout: 8000 });
        const v = store.vendedor();
        v.base = { lat: pos.lat, lng: pos.lng };
        store._mudou('vendedores', v); store.salvar();
        replanejar(store); toast('Base atualizada · rota recalculada'); render();
      } catch (e2) { toast(`GPS: ${e2.message}`); }
    }
  });
}
