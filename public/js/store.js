// Modelo de dados e persistência da V2. Entidade central: o PONTO físico com estado.
// Visitas, pedidos, contatos e eventos ficam pendurados nele por ponto_id; o histórico nunca se perde.
//
// Persistência: IndexedDB (db.js) + DIÁRIO síncrono no localStorage. A cada toque:
//   1) o registro muda na memória;
//   2) os registros alterados vão, na hora e de forma síncrona, para o diário (localStorage);
//   3) uma transação curta grava os mesmos registros no IndexedDB; ao confirmar, saem do diário.
// Se a aba fechar entre 2 e 3, a próxima abertura reaplica o diário. Nada no fluxo espera a rede.
//
// Estados: nenhum card é movido à mão. reavaliar() roda o motor (estados.js), compara com o gravado
// e grava um EventoEstado para cada transição (estado e etapa do funil), com a causa.
import { calcularRetorno, setPath, coordDe, distanciaM } from './rules.js';
import { avaliar, tipoVisitaPara, DIA_MS } from './estados.js';
import { migrar, estadoVazioV2, metaVazia, tempos, SCHEMA_VERSION, VENDEDOR_PADRAO } from './migrar.js';
import { COLECOES, adaptadorMemoria } from './db.js';
import { CONFIG } from './config.js';

export { SCHEMA_VERSION };
export const CHAVE_V1 = 'praso_campo_v1';
export const CHAVE_DIARIO = 'praso_v2_diario';
const LIMITE_DIARIO = 1_500_000; // bytes; acima disso (carga do seed) o diário é pulado

const iso = (d) => (d instanceof Date ? d : new Date(d)).toISOString();
export const novoId = (pref = '') =>
  pref + (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function memoriaStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

const META_CAMPOS = ['schema_version', 'criado_em', 'ultimo_export', 'config', 'plano_dia', 'migrado_de_v1_em'];
const TEXTO_CAUSA = {
  cadastro: 'cadastro detectado', pedido: 'pedido detectado', tempo: 'tempo', registro_visita: 'registro de visita',
  planejamento: 'entrou na lista do dia', correcao_manual: 'correção manual', migracao: 'migração da V1',
};

export function criarStore({ adaptador = adaptadorMemoria(), storage = memoriaStorage(), agora = () => new Date() } = {}) {
  let ad = adaptador;
  const store = {
    estado: estadoVazioV2(agora()),
    erro: null,
    emMemoria: false,
    migrouV1: 0,
    ouvintes: new Set(),
    avancos: new Map(), // ponto_id → { texto, ts } · selo "avançou: …" por alguns segundos
    _sujos: new Map(),
    _metaSujo: false,
    _pend: new Map(),
    _seq: 0,
    _ultimaGravacao: Promise.resolve(),
    _idx: null,

    // ---------- Relógio (o simulador pode avançar N dias) ----------
    agoraReal: agora,
    agora() { return new Date(agora().getTime() + (this.estado.config?.relogio_offset_ms || 0)); },
    get offsetDias() { return Math.round((this.estado.config?.relogio_offset_ms || 0) / DIA_MS); },

    // ---------- Carga ----------
    async carregar() {
      let dados = null;
      try {
        await ad.abrir();
        dados = await ad.lerTudo();
      } catch (e) {
        ad = adaptadorMemoria();
        this.emMemoria = true;
        this.erro = 'Armazenamento do aparelho indisponível. Os dados ficam só nesta aba: exporte antes de fechar.';
      }
      if (dados?.meta) {
        this.estado = { ...metaVazia(agora()), ...dados.meta };
        COLECOES.forEach((c) => { this.estado[c] = dados[c] || []; });
      } else {
        this.estado = estadoVazioV2(agora());
      }
      const reaplicados = this._reaplicarDiario();
      if (!dados?.meta && !reaplicados) {
        // primeira abertura da V2 neste aparelho: migra os dados da V1, se houver (mesmo domínio)
        const v1 = this._lerStorage(CHAVE_V1);
        if (v1) {
          try {
            this.estado = migrar(JSON.parse(v1), agora());
            this.migrouV1 = this.estado.pontos.length;
          } catch (e) {
            this.erro = `Não consegui migrar os dados da V1 (${e.message}). Eles continuam guardados.`;
          }
        }
        this._tudoSujo();
      }
      this._idx = null;
      this.reavaliarTodos({ silencioso: true });
      this.salvar();
      return this;
    },

    _lerStorage(k) { try { return storage?.getItem(k) ?? null; } catch { return null; } },

    _reaplicarDiario() {
      const bruto = this._lerStorage(CHAVE_DIARIO);
      if (!bruto) return 0;
      let ops;
      try { ops = JSON.parse(bruto); } catch { return 0; }
      if (!Array.isArray(ops) || !ops.length) return 0;
      for (const { c, id, v } of ops) {
        if (c === 'meta') { if (v) Object.assign(this.estado, v); continue; }
        const lista = this.estado[c];
        if (!lista) continue;
        const i = lista.findIndex((x) => x.id === id);
        if (v == null) { if (i >= 0) lista.splice(i, 1); } else if (i >= 0) lista[i] = v; else lista.push(v);
        this._sujos.set(`${c}|${id}`, { c, id, v });
      }
      this._metaSujo = true;
      return ops.length;
    },

    // ---------- Gravação ----------
    _mudou(c, reg) { this._sujos.set(`${c}|${reg.id}`, { c, id: reg.id, v: reg }); this._idx = null; },
    _apagou(c, id) { this._sujos.set(`${c}|${id}`, { c, id, v: null }); this._idx = null; },
    _mudouMeta() { this._metaSujo = true; },
    _tudoSujo() {
      COLECOES.forEach((c) => this.estado[c].forEach((r) => this._mudou(c, r)));
      this._metaSujo = true;
    },
    _meta() { const m = {}; META_CAMPOS.forEach((k) => { if (k in this.estado) m[k] = this.estado[k]; }); return m; },

    salvar({ diario = true } = {}) {
      const ops = [...this._sujos.values()];
      this._sujos.clear();
      if (this._metaSujo) { ops.push({ c: 'meta', id: 'estado', v: this._meta() }); this._metaSujo = false; }
      if (ops.length) {
        const s = ++this._seq;
        ops.forEach((o) => { o.s = s; this._pend.set(`${o.c}|${o.id}`, o); });
        if (diario) this._escreverDiario();
        // a transação copia os registros no momento da chamada (structured clone síncrono)
        const p = ad.gravar(ops.map(({ c, id, v }) => ({ c, id, v })))
          .then(() => {
            ops.forEach((o) => { const k = `${o.c}|${o.id}`; if (this._pend.get(k)?.s === s) this._pend.delete(k); });
            this._escreverDiario();
            if (!this.emMemoria && this.erro?.startsWith('Não consegui salvar')) this.erro = null;
          })
          .catch(() => { this.erro = 'Não consegui salvar no aparelho (armazenamento cheio ou bloqueado). Exporte agora.'; this._avisar(); });
        this._ultimaGravacao = p;
      }
      this._avisar();
      return !this.erro;
    },

    _escreverDiario() {
      try {
        if (!this._pend.size) { storage?.removeItem(CHAVE_DIARIO); return; }
        const txt = JSON.stringify([...this._pend.values()].map(({ c, id, v }) => ({ c, id, v })));
        if (txt.length > LIMITE_DIARIO) { storage?.removeItem(CHAVE_DIARIO); return; }
        storage?.setItem(CHAVE_DIARIO, txt);
      } catch { /* sem localStorage: segue só com o IndexedDB */ }
    },

    /** Para testes e para o export: espera a última transação terminar. */
    gravado() { return this._ultimaGravacao; },
    _avisar() { this.ouvintes.forEach((f) => f(this)); },
    aoMudar(f) { this.ouvintes.add(f); return () => this.ouvintes.delete(f); },

    // ---------- Índices ----------
    _indice() {
      if (this._idx) return this._idx;
      const por = (lista) => { const m = new Map(); for (const x of lista) { if (!m.has(x.ponto_id)) m.set(x.ponto_id, []); m.get(x.ponto_id).push(x); } return m; };
      this._idx = {
        pontos: new Map(this.estado.pontos.map((p) => [p.id, p])),
        visitas: por(this.estado.visitas), pedidos: por(this.estado.pedidos),
        contatos: por(this.estado.contatos), eventos: por(this.estado.eventos),
      };
      return this._idx;
    },
    ponto(id) { return this._indice().pontos.get(id); },
    vendedor(id = this.estado.config.vendedor_id) { return this.estado.vendedores.find((v) => v.id === id) || this.estado.vendedores[0]; },
    meusPontos() { const vid = this.estado.config.vendedor_id; return this.estado.pontos.filter((p) => (p.vendedor_id || VENDEDOR_PADRAO) === vid); },
    visita(id) { return this.estado.visitas.find((v) => v.id === id); },
    visitasDo(pid) { return [...(this._indice().visitas.get(pid) || [])].sort((a, b) => b.checkin.em.localeCompare(a.checkin.em)); },
    pedidosDo(pid) { return [...(this._indice().pedidos.get(pid) || [])].sort((a, b) => b.data.localeCompare(a.data)); },
    contatosDo(pid) { return [...(this._indice().contatos.get(pid) || [])].sort((a, b) => b.ts.localeCompare(a.ts)); },
    /** Mais recente primeiro; no empate de horário, o gravado por último vem antes. */
    eventosDo(pid) {
      return (this._indice().eventos.get(pid) || []).map((e, i) => [e, i])
        .sort(([a, i], [b, j]) => b.ts.localeCompare(a.ts) || j - i).map(([e]) => e);
    },
    visitaAberta() { const vid = this.estado.config.vendedor_id; return this.estado.visitas.find((v) => !v.checkout && (v.vendedor_id || VENDEDOR_PADRAO) === vid); },

    /** Situação calculada do ponto (estado, etapa, prazo, compras do ciclo). Não grava nada. */
    situacao(pid) {
      const p = this.ponto(pid);
      if (!p) return null;
      return avaliar(p, this._indice().pedidos.get(pid) || [], this._indice().visitas.get(pid) || [], this.agora());
    },

    // ---------- Motor de estados ----------
    /**
     * Roda o motor no ponto e grava os EventoEstado das transições novas.
     * `causa`: dica para a etapa quando ela muda por registro de visita, planejamento ou correção.
     */
    reavaliar(pid, { causa = null, autor = 'sistema', silencioso = false } = {}) {
      const p = this.ponto(pid);
      if (!p) return null;
      const res = this.situacao(pid);
      const evs = this._indice().eventos.get(pid) || [];
      const ja = new Set(evs.filter((e) => e.dimensao === 'estado').map((e) => `${e.ts}|${e.para}`));
      const novos = [];
      for (const tr of res.transicoes) {
        if (ja.has(`${tr.ts}|${tr.para}`)) continue;
        // ignora o passado anterior a uma migração/correção já registrada
        if (p.estado_desde && tr.ts < p.estado_desde && tr.para !== res.estado) continue;
        novos.push(tr);
      }
      const estadoAntes = p.estado;
      const etapaAntes = p.etapa_funil ?? 0;
      let mudou = false;
      for (const tr of novos) {
        this._evento(p, { ts: tr.ts, dimensao: 'estado', de: tr.de, para: tr.para, causa: tr.causa, autor: 'sistema' });
      }
      if (estadoAntes !== res.estado) {
        if (!novos.some((tr) => tr.para === res.estado)) {
          this._evento(p, { ts: iso(this.agora()), dimensao: 'estado', de: estadoAntes, para: res.estado, causa: causa || 'correcao_manual', autor });
        }
        p.estado = res.estado;
        p.estado_desde = res.desde || iso(this.agora());
        mudou = true;
      }
      if (etapaAntes !== res.etapa) {
        const causaEtapa = novos.length ? novos.at(-1).causa : causa || 'registro_visita';
        this._evento(p, { ts: iso(this.agora()), dimensao: 'etapa', de: etapaAntes, para: res.etapa, causa: causaEtapa, autor });
        p.etapa_funil = res.etapa;
        p.etapa_desde = iso(this.agora());
        mudou = true;
        if (!silencioso && causaEtapa !== 'correcao_manual') {
          const sobe = res.etapa > etapaAntes;
          this.avancos.set(pid, { texto: `${sobe ? 'avançou' : 'mudou'}: ${TEXTO_CAUSA[causaEtapa] || causaEtapa}`, ts: Date.now(), sobe });
        }
      } else if (mudou && !silencioso && novos.length) {
        const c = novos.at(-1);
        this.avancos.set(pid, { texto: `mudou: ${c.causa === 'tempo' ? (res.estado === 'churn' ? '120 dias sem comprar' : '45 dias sem 3ª compra') : TEXTO_CAUSA[c.causa]}`, ts: Date.now(), sobe: false });
      }
      if (mudou) { p.atualizado_em = iso(this.agora()); this._mudou('pontos', p); }
      return { mudou, de: estadoAntes, para: res.estado, etapaDe: etapaAntes, etapaPara: res.etapa };
    },

    reavaliarTodos(opts = {}) {
      let n = 0;
      for (const p of this.estado.pontos) if (this.reavaliar(p.id, opts)?.mudou) n++;
      return n;
    },

    _evento(p, e) {
      const ev = { id: novoId('ev-'), ponto_id: p.id, ...e };
      this.estado.eventos.push(ev);
      this._mudou('eventos', ev);
      return ev;
    },

    /**
     * Única exceção à regra "nunca à mão": corrigir um registro errado. Exige confirmação na tela,
     * grava causa correcao_manual e não aparece como avanço. Corrige a ENTRADA (resultado da visita
     * ou estado declarado sem histórico), e o motor recalcula.
     */
    corrigirResultadoVisita(visitaId, resultado, autor = 'vendedor') {
      const v = this.visita(visitaId);
      if (!v) return null;
      v.nucleo.resultado = resultado;
      v.corrigido_em = iso(this.agora());
      this._mudou('visitas', v);
      const r = this.reavaliar(v.ponto_id, { causa: 'correcao_manual', autor });
      this.salvar();
      return r;
    },
    corrigirEstadoDeclarado(pid, estado, autor = 'vendedor') {
      const p = this.ponto(pid);
      if (!p) return null;
      p.estado_base = estado;
      p.estado_desde = iso(this.agora());
      this._mudou('pontos', p);
      const r = this.reavaliar(pid, { causa: 'correcao_manual', autor });
      this.salvar();
      return r;
    },

    // ---------- Eventos do sistema (no protótipo, vêm do simulador) ----------
    eventoCadastro(pid) {
      const p = this.ponto(pid);
      if (!p || p.cadastro_em) return null;
      p.cadastro_em = iso(this.agora());
      this._mudou('pontos', p);
      const r = this.reavaliar(pid, { causa: 'cadastro' });
      this.salvar();
      return r;
    },
    eventoPedido(pid, { autonomo = true, itens = null, valor = null, forma_pagamento = 'pix', data = null } = {}) {
      const p = this.ponto(pid);
      if (!p) return null;
      const its = itens || this.pedidosDo(pid)[0]?.itens?.map((i) => ({ ...i })) || [];
      const ped = {
        id: novoId('pd-'), ponto_id: pid, data: data || iso(this.agora()),
        valor: valor ?? Math.round(its.reduce((s, i) => s + (i.valor || 0), 0) * 100) / 100,
        itens: its, forma_pagamento, autonomo: !!autonomo, assistido: !autonomo, pago_em: null, simulado: true,
      };
      this.estado.pedidos.push(ped);
      this._mudou('pedidos', ped);
      const r = this.reavaliar(pid, { causa: 'pedido' });
      this.salvar();
      return { pedido: ped, ...r };
    },
    eventoPagamento(pedidoId) {
      const ped = this.estado.pedidos.find((x) => x.id === pedidoId);
      if (!ped || ped.pago_em) return null;
      ped.pago_em = iso(this.agora());
      this._mudou('pedidos', ped);
      this.salvar();
      return ped;
    },
    avancarRelogio(dias) {
      this.estado.config = { ...this.estado.config, relogio_offset_ms: (this.estado.config.relogio_offset_ms || 0) + dias * DIA_MS };
      this._mudouMeta();
      const n = this.reavaliarTodos();
      this.salvar();
      return n;
    },
    zerarRelogio() {
      this.estado.config = { ...this.estado.config, relogio_offset_ms: 0 };
      this._mudouMeta();
      this.reavaliarTodos({ causa: 'tempo', silencioso: true });
      this.salvar();
    },
    setConfig(patch) { this.estado.config = { ...this.estado.config, ...patch }; this._mudouMeta(); this.salvar(); },
    setPlano(plano) { this.estado.plano_dia = plano; this._mudouMeta(); this.salvar(); },

    // ---------- Pontos ----------
    novoPonto(d = {}) {
      const t = iso(this.agora());
      const p = {
        id: d.id || novoId(),
        cnpj: limparCnpj(d.cnpj),
        razao_social: d.razao_social || null,
        nome_fantasia: (d.nome_fantasia ?? d.nome ?? '').trim(),
        tipo: d.tipo || 'outro',
        mei: d.mei ?? null,
        cnae: d.cnae || null,
        situacao: d.situacao || null,
        endereco_cadastral: (d.endereco_cadastral ?? d.endereco ?? '').trim(),
        coord_cadastral: d.coord_cadastral || null,
        coord_confirmada: d.coord_confirmada || null,
        horario_funcionamento: d.horario_funcionamento || null,
        decisor: d.decisor || null,
        quem_paga: d.quem_paga || null,
        cadastro_em: d.cadastro_em || null,
        estado: 'lead',
        estado_base: d.estado_base || null,
        etapa_funil: 0,
        origem: d.origem || 'campo',
        vendedor_id: d.vendedor_id || this.estado.config.vendedor_id,
        status_dia: 'a_visitar',
        retorno_sugerido: null,
        retorno_motivo: null,
        planejado_em: null,
        verificar: !!d.verificar,
        ficticio: !!d.ficticio,
        criado_em: t,
        atualizado_em: t,
      };
      if (typeof d.alto_potencial === 'boolean') p.alto_potencial = d.alto_potencial;
      this.estado.pontos.push(p);
      this._mudou('pontos', p);
      this.reavaliar(p.id, { silencioso: true });
      this.salvar();
      return p;
    },

    atualizarPonto(id, patch) {
      const p = this.ponto(id);
      if (!p) return null;
      if ('cnpj' in patch) patch = { ...patch, cnpj: limparCnpj(patch.cnpj) };
      if (patch.status_dia && patch.status_dia !== 'retornar') patch = { ...patch, retorno_sugerido: null, retorno_motivo: null };
      Object.assign(p, patch, { atualizado_em: iso(this.agora()) });
      this._mudou('pontos', p);
      this.salvar();
      return p;
    },

    /** Pino: a posição confirmada (check-in ou arraste) sempre prevalece sobre a cadastral. */
    corrigirPino(id, { lat, lng, precisao_m = null }, origem = 'manual') {
      const p = this.ponto(id);
      if (!p) return null;
      p.coord_confirmada = { lat, lng, precisao_m: precisao_m != null ? Math.round(precisao_m) : null, origem, em: iso(this.agora()) };
      p.atualizado_em = iso(this.agora());
      this._mudou('pontos', p);
      this.salvar();
      return p;
    },

    marcarPlanejado(ids) {
      const t = iso(this.agora());
      for (const id of ids) {
        const p = this.ponto(id);
        if (!p) continue;
        if (!p.planejado_em || p.planejado_em < (p.estado_desde || '')) { p.planejado_em = t; this._mudou('pontos', p); }
        this.reavaliar(id, { causa: 'planejamento', silencioso: true });
      }
      this.salvar();
    },

    removerFicticios() {
      const ids = new Set(this.estado.pontos.filter((p) => p.ficticio).map((p) => p.id));
      for (const c of ['visitas', 'pedidos', 'contatos', 'eventos']) {
        this.estado[c] = this.estado[c].filter((x) => { if (ids.has(x.ponto_id)) { this._apagou(c, x.id); return false; } return true; });
      }
      this.estado.pontos = this.estado.pontos.filter((p) => { if (ids.has(p.id)) { this._apagou('pontos', p.id); return false; } return true; });
      this.estado.desconhecidos.forEach((d) => this._apagou('desconhecidos', d.id));
      this.estado.desconhecidos = [];
      this.estado.vendedores = this.estado.vendedores.filter((v) => { if (v.ficticio) { this._apagou('vendedores', v.id); return false; } return true; });
      this.estado.plano_dia = null;
      this._mudouMeta();
      this.salvar();
      return ids.size;
    },

    /** Carrega um lote (seed) de uma vez, sem passar pelo diário. */
    carregarLote({ pontos = [], visitas = [], pedidos = [], contatos = [], eventos = [], vendedores = [], desconhecidos = [] }) {
      const add = (c, lista) => lista.forEach((x) => { this.estado[c].push(x); this._mudou(c, x); });
      add('vendedores', vendedores.filter((v) => !this.estado.vendedores.some((x) => x.id === v.id)));
      add('pontos', pontos); add('visitas', visitas); add('pedidos', pedidos);
      add('contatos', contatos); add('eventos', eventos); add('desconhecidos', desconhecidos);
      for (const p of pontos) this.reavaliar(p.id, { silencioso: true });
      this._mudouMeta();
      this.salvar({ diario: false });
    },

    // ---------- Visitas ----------
    checkin(pontoId) {
      const aberta = this.visitaAberta();
      if (aberta) throw new Error('Já existe uma visita aberta. Faça o check-out dela primeiro.');
      const p = this.ponto(pontoId);
      if (!p) throw new Error('Ponto não encontrado');
      const plano = this.estado.plano_dia;
      const parada = plano?.paradas?.find((x) => x.id === pontoId);
      const v = {
        id: novoId(),
        ponto_id: pontoId,
        vendedor_id: this.estado.config.vendedor_id,
        tipo: tipoVisitaPara(p.estado),
        estado_no_checkin: p.estado,
        planejada_para: parada?.chegada || null,
        checkin: { em: iso(this.agora()), lat: null, lng: null, precisao_m: null, gps_erro: null, gps_em: null, distancia_pino_m: null },
        checkout: null,
        retorno_previsto: p.status_dia === 'retornar' && p.retorno_sugerido ? { quando: p.retorno_sugerido, motivo: p.retorno_motivo } : null,
        versao_conversa: null,
        observacao: [],
        // a plataforma só pede o que não sabe: decisor e janela já conhecidos vêm do ponto (não contam toque)
        nucleo: {
          resultado: null, quem_decide: p.decisor?.papel || null,
          faixas: [...(p.decisor?.janela?.faixas || [])], dias: [...(p.decisor?.janela?.dias || [])],
          prefill: !!(p.decisor?.papel || p.decisor?.janela?.faixas?.length),
          inicio: null, fim: null, editado_em: null,
        },
        motivo_nao_avanco: null,
        proxima_acao: null,
        pesquisa: { inicio: null, fim: null },
        surpresa: '',
        nota_texto: '',
        nota_origem: null,
        transcricao_status: null,
        campos_ia: [],
      };
      this.estado.visitas.push(v);
      this._mudou('visitas', v);
      this.salvar();
      return v;
    },

    /** GPS do check-in. Devolve a distância até o pino anterior (para a pergunta "corrigir o pino?"). */
    registrarGeo(visitaId, pos, erro) {
      const v = this.visita(visitaId);
      if (!v) return null;
      let dist = null;
      if (pos) {
        const p = this.ponto(v.ponto_id);
        const c = coordDe(p);
        dist = c ? distanciaM(c.lat, c.lng, pos.lat, pos.lng) : null;
        Object.assign(v.checkin, { lat: pos.lat, lng: pos.lng, precisao_m: Math.round(pos.precisao_m), gps_erro: null, gps_em: iso(this.agora()), distancia_pino_m: dist });
        // Sem pino nenhum, ou pino a menos do limiar: a posição do check-in vira o pino confirmado.
        if (p && (!c || dist <= CONFIG.limiar_corrigir_pino_m)) this.corrigirPino(p.id, pos, 'checkin');
      } else {
        v.checkin.gps_erro = erro || 'falhou';
      }
      this._mudou('visitas', v);
      this.salvar();
      return dist;
    },

    setCampo(visitaId, caminho, valor) {
      const v = this.visita(visitaId);
      if (!v) return;
      const t = iso(this.agora());
      if (caminho.startsWith('nucleo.')) {
        if (!v.nucleo.inicio) v.nucleo.inicio = t;
        if (v.nucleo.fim) v.nucleo.editado_em = t;
      }
      if (caminho.startsWith('pesquisa.')) {
        if (!v.pesquisa.inicio) v.pesquisa.inicio = t;
        v.pesquisa.fim = t;
      }
      setPath(v, caminho, valor);
      if (v.campos_ia?.includes(caminho)) v.campos_ia = v.campos_ia.filter((c) => c !== caminho);
      this._mudou('visitas', v);
      if (v.nucleo.fim || v.checkout) { this._aplicarLaco(v); this.reavaliar(v.ponto_id, { causa: 'registro_visita', autor: 'vendedor' }); }
      this.salvar();
    },

    salvarNucleo(visitaId) {
      const v = this.visita(visitaId);
      if (!v || !v.nucleo.resultado) return null;
      if (!v.nucleo.fim) v.nucleo.fim = iso(this.agora());
      if (!v.nucleo.inicio) v.nucleo.inicio = v.nucleo.fim;
      const p = this.ponto(v.ponto_id);
      if (p && (v.nucleo.quem_decide || v.nucleo.faixas.length)) {
        p.decisor = {
          papel: v.nucleo.quem_decide || p.decisor?.papel || null,
          janela: v.nucleo.faixas.length ? { dias: [...v.nucleo.dias], faixas: [...v.nucleo.faixas] } : p.decisor?.janela || { dias: [], faixas: [] },
          atualizado_em: v.nucleo.fim,
        };
        this._mudou('pontos', p);
      }
      const qp = v.pesquisa?.papeis?.quem_paga;
      if (p && qp) { p.quem_paga = qp === 'decisor' ? 'decisor' : 'outro'; this._mudou('pontos', p); }
      this._mudou('visitas', v);
      const r = this._aplicarLaco(v);
      this.reavaliar(v.ponto_id, { causa: 'registro_visita', autor: 'vendedor' });
      this.salvar();
      return r;
    },

    checkout(visitaId) {
      const v = this.visita(visitaId);
      if (!v || v.checkout) return v;
      v.checkout = { em: iso(this.agora()) };
      v.tempos = { ...tempos(v), nota_origem: v.nota_origem };
      this._mudou('visitas', v);
      this._aplicarLaco(v);
      this.reavaliar(v.ponto_id, { causa: 'registro_visita', autor: 'vendedor' });
      this.salvar();
      return v;
    },

    /** Próxima ação confirmada pelo vendedor (um toque). Um retorno com hora muda a lista do dia certo. */
    confirmarProximaAcao(visitaId, pa) {
      const v = this.visita(visitaId);
      if (!v) return null;
      v.proxima_acao = pa ? { tipo: pa.tipo, data_hora: pa.data_hora || null, porque: pa.porque || null, sugerida: !!pa.sugerida, confirmada_em: iso(this.agora()) } : null;
      this._mudou('visitas', v);
      this._aplicarLaco(v);
      this.salvar();
      return v.proxima_acao;
    },

    /** Cadastro detectado entre o check-in e agora (no protótipo, vem do simulador). */
    cadastroNaVisita(v) {
      const p = this.ponto(v.ponto_id);
      return !!(p?.cadastro_em && p.cadastro_em >= v.checkin.em && (!v.checkout || p.cadastro_em <= v.checkout.em));
    },

    /** RF10 · o registro de hoje muda o dia seguinte (retorno com hora). */
    _aplicarLaco(v) {
      const p = this.ponto(v.ponto_id);
      if (!p) return null;
      const ultima = this.visitasDo(p.id)[0];
      if (ultima && ultima.id !== v.id) return null;
      const ref = new Date(v.checkout?.em || v.nucleo.fim || this.agora());
      // V2: a próxima ação confirmada pelo vendedor manda; sem ela, vale o laço da V1 (janela / melhor horário)
      let r;
      if (v.proxima_acao?.confirmada_em) {
        r = v.proxima_acao.tipo === 'retorno' && v.proxima_acao.data_hora
          ? { quando: new Date(v.proxima_acao.data_hora), motivo: v.nucleo.resultado === 'aberto_sem_decisor' && v.nucleo.faixas?.length ? 'janela_decisor' : 'proxima_acao' }
          : null;
      } else {
        r = calcularRetorno(v, ref);
      }
      if (r) {
        p.status_dia = 'retornar';
        p.retorno_sugerido = iso(r.quando);
        p.retorno_motivo = r.motivo;
      } else {
        p.retorno_sugerido = null;
        p.retorno_motivo = null;
        if (v.checkout || v.nucleo.fim) p.status_dia = 'visitado';
      }
      this._mudou('pontos', p);
      return r;
    },

    // ---------- Descobrir (desconhecidos: Receita fora da carteira, mapa aberto sem CNPJ) ----------
    descartarDesconhecido(id, motivo) {
      const d = this.estado.desconhecidos.find((x) => x.id === id);
      if (!d) return null;
      Object.assign(d, { status: 'descartado', motivo_descarte: motivo, descartado_em: iso(this.agora()) });
      this._mudou('desconhecidos', d);
      this.salvar();
      return d;
    },
    /** Vira ponto da carteira (lead). Mapa aberto e casamento fraco entram marcados para verificar no campo. */
    adotarDesconhecido(id) {
      const d = this.estado.desconhecidos.find((x) => x.id === id);
      if (!d) return null;
      const p = this.novoPonto({
        nome_fantasia: d.nome, tipo: d.tipo, cnpj: d.cnpj, mei: d.mei, endereco_cadastral: d.endereco,
        coord_cadastral: { lat: d.lat, lng: d.lng }, origem: d.grupo === 'mapa_aberto' ? 'mapa_aberto' : 'receita',
        verificar: d.grupo !== 'receita', ficticio: !!d.ficticio,
      });
      p.bairro = d.bairro;
      Object.assign(d, { status: 'adotado', ponto_id: p.id });
      this._mudou('desconhecidos', d);
      this._mudou('pontos', p);
      this.salvar();
      return p;
    },

    // ---------- Contatos (WhatsApp) ----------
    registrarContato(pid, { canal = 'whatsapp', modelo_mensagem = null, gerado_pela_plataforma = true } = {}) {
      const c = { id: novoId('ct-'), ponto_id: pid, ts: iso(this.agora()), canal, modelo_mensagem, gerado_pela_plataforma, vendedor_id: this.estado.config.vendedor_id };
      this.estado.contatos.push(c);
      this._mudou('contatos', c);
      this.salvar();
      return c;
    },

    // ---------- Backup ----------
    marcarExport() { this.estado.ultimo_export = iso(this.agoraReal()); this._mudouMeta(); this.salvar(); },

    importar(texto) {
      const novo = migrar(JSON.parse(texto), this.agora());
      try { storage?.setItem(`praso_v2_antes_import_${Date.now()}`, JSON.stringify(this._meta())); } catch {}
      COLECOES.forEach((c) => this.estado[c].forEach((x) => this._apagou(c, x.id)));
      this.estado = novo;
      this._idx = null;
      this._tudoSujo();
      this.reavaliarTodos({ silencioso: true });
      this.salvar({ diario: false });
      return novo.pontos.length;
    },

    async apagarTudo() {
      await ad.limpar();
      try { storage?.removeItem(CHAVE_DIARIO); } catch {}
      this._pend.clear();
      this._sujos.clear();
      this.estado = estadoVazioV2(agora());
      this._idx = null;
      this._metaSujo = true;
      this.salvar();
    },

    // ---------- Nota por voz: fila de transcrição e campos sugeridos pela IA ----------
    registrarAudio(visitaId, { mime, dur_s }) {
      const v = this.visita(visitaId);
      if (!v) return null;
      v.audio = { id: v.id, mime, dur_s, gravado_em: iso(this.agora()) };
      v.transcricao_status = 'pendente';
      v.nota_origem = v.nota_texto?.trim() ? 'misto' : 'voz';
      this._mudou('visitas', v);
      this.salvar();
      return v;
    },
    /** Resultado da fila: texto transcrito + campos sugeridos (ficam como sugestão até o vendedor confirmar). */
    registrarTranscricao(visitaId, { status, texto = '', campos = null, modo = null, erro = null }) {
      const v = this.visita(visitaId);
      if (!v) return null;
      v.transcricao_status = status;
      v.transcricao_modo = modo;
      v.transcricao_erro = erro;
      v.transcricao_tentativas = (v.transcricao_tentativas || 0) + 1;
      if (status === 'ok') {
        v.transcricao = texto;
        v.nota_texto = [v.nota_texto?.trim(), texto].filter(Boolean).join('\n');
        v.ia_sugestao = campos && Object.keys(campos).length ? { campos, em: iso(this.agora()) } : null;
        v.audio = v.audio ? { ...v.audio, apagado_em: iso(this.agora()) } : null; // o áudio é apagado depois de transcrito
      }
      this._mudou('visitas', v);
      this.salvar();
      return v;
    },
    /** Um toque: aplica o que a IA sugeriu. O que a IA preencheu fica marcado em campos_ia. */
    aplicarIA(visitaId, campos = this.visita(visitaId)?.ia_sugestao?.campos) {
      const v = this.visita(visitaId);
      if (!v || !campos) return null;
      const t = iso(this.agora());
      const marcados = [];
      for (const [k, val] of Object.entries(campos)) {
        if (k === 'proxima_acao') { v.proxima_acao = { ...val, porque: 'extraída da nota de voz', sugerida: true, confirmada_em: t }; marcados.push(k); continue; }
        if (k.startsWith('nucleo.') && !v.nucleo.inicio) v.nucleo.inicio = t;
        if (k.startsWith('pesquisa.')) { if (!v.pesquisa.inicio) v.pesquisa.inicio = t; v.pesquisa.fim = t; }
        setPath(v, k, val);
        marcados.push(k);
      }
      v.campos_ia = [...new Set([...(v.campos_ia || []), ...marcados])];
      v.ia_sugestao = null;
      v.nucleo_por_ia = marcados.some((k) => k.startsWith('nucleo.'));
      this._mudou('visitas', v);
      if (v.nucleo.resultado && !v.nucleo.fim) { this.salvarNucleo(v.id); } else { this._aplicarLaco(v); this.reavaliar(v.ponto_id, { causa: 'registro_visita', autor: 'vendedor' }); }
      this.salvar();
      return marcados;
    },
    descartarIA(visitaId) {
      const v = this.visita(visitaId);
      if (!v) return;
      v.ia_sugestao = null;
      this._mudou('visitas', v);
      this.salvar();
    },

    // ---------- Áudio (nota por voz) ----------
    salvarAudio(id, blob) { return ad.salvarAudio(id, blob); },
    lerAudio(id) { return ad.lerAudio(id); },
    apagarAudio(id) { return ad.apagarAudio(id); },
  };
  return store;
}

export function limparCnpj(c) {
  const d = String(c ?? '').replace(/\D/g, '');
  return d.length ? d : null;
}

export const nomeDe = (p) => p?.nome_fantasia || p?.razao_social || 'Sem nome';
