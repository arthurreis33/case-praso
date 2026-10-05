// Modelo de dados e persistência. Entidade central: o PONTO físico com estado;
// as VISITAS ficam penduradas nele (ponto_id). Nada de "lead que vira conta".
//
// Persistência: localStorage, gravação síncrona a cada toque. Escolhido em vez de IndexedDB
// porque o dado está salvo no instante do toque (fechar a aba logo depois não perde nada)
// e o volume do campo (dezenas de visitas) é minúsculo. Toda leitura/escrita tem try/catch;
// sem armazenamento, o app segue em memória e avisa para exportar.
import { calcularRetorno, setPath } from './rules.js';

export const SCHEMA_VERSION = 1;
export const CHAVE = 'praso_campo_v1';

const iso = (d) => (d instanceof Date ? d : new Date(d)).toISOString();
const novoId = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function estadoVazio(agora = new Date()) {
  return { schema_version: SCHEMA_VERSION, criado_em: iso(agora), ultimo_export: null, pontos: [], visitas: [] };
}

export function memoriaStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

export function criarStore({ storage, agora = () => new Date(), chave = CHAVE } = {}) {
  let st = storage;
  const store = {
    estado: estadoVazio(agora()),
    erro: null, // texto do último problema de armazenamento, se houver
    emMemoria: false,
    ouvintes: new Set(),

    carregar() {
      let bruto = null;
      try {
        if (!st) throw new Error('sem storage');
        bruto = st.getItem(chave);
      } catch (e) {
        this._paraMemoria('Armazenamento do navegador indisponível. Os dados ficam só nesta aba: exporte antes de fechar.');
        return this;
      }
      if (!bruto) return this;
      try {
        const dado = JSON.parse(bruto);
        this.estado = migrar(dado);
      } catch (e) {
        // não descarta o que estava lá: guarda o bruto para recuperação manual
        try { st.setItem(`${chave}_corrompido_${Date.now()}`, bruto); } catch {}
        this.erro = 'Os dados salvos estavam ilegíveis; uma cópia foi guardada e o app começou vazio.';
        this.estado = estadoVazio(agora());
      }
      return this;
    },

    _paraMemoria(msg) {
      st = memoriaStorage();
      this.emMemoria = true;
      this.erro = msg;
    },

    salvar() {
      try {
        st.setItem(chave, JSON.stringify(this.estado));
        if (!this.emMemoria) this.erro = null;
      } catch (e) {
        this.erro = 'Não consegui salvar no aparelho (armazenamento cheio ou bloqueado). Exporte agora.';
      }
      this.ouvintes.forEach((f) => f(this));
      return !this.erro;
    },

    aoMudar(f) { this.ouvintes.add(f); return () => this.ouvintes.delete(f); },

    // ---------- Pontos ----------
    ponto(id) { return this.estado.pontos.find((p) => p.id === id); },

    novoPonto(d = {}) {
      const p = {
        id: novoId(),
        nome: (d.nome || '').trim(),
        tipo: d.tipo || 'outro',
        endereco: (d.endereco || '').trim(),
        cnpj: limparCnpj(d.cnpj),
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        precisao_m: d.precisao_m ?? null,
        coord_fonte: d.lat != null ? (d.coord_fonte || 'gps_criacao') : null,
        estado: d.estado || 'lead',
        status_dia: 'a_visitar',
        retorno_sugerido: null,
        retorno_motivo: null,
        decisor: null, // { quem, faixas, dias, atualizado_em } — copiado da última visita
        criado_em: iso(agora()),
        origem: d.origem || 'lista',
        ficticio: !!d.ficticio,
      };
      this.estado.pontos.push(p);
      this.salvar();
      return p;
    },

    atualizarPonto(id, patch) {
      const p = this.ponto(id);
      if (!p) return null;
      if ('cnpj' in patch) patch = { ...patch, cnpj: limparCnpj(patch.cnpj) };
      if (patch.status_dia && patch.status_dia !== 'retornar') {
        patch = { ...patch, retorno_sugerido: null, retorno_motivo: null };
      }
      Object.assign(p, patch);
      this.salvar();
      return p;
    },

    removerFicticios() {
      const ids = new Set(this.estado.pontos.filter((p) => p.ficticio).map((p) => p.id));
      this.estado.pontos = this.estado.pontos.filter((p) => !ids.has(p.id));
      this.estado.visitas = this.estado.visitas.filter((v) => !ids.has(v.ponto_id));
      this.salvar();
    },

    // ---------- Visitas ----------
    visita(id) { return this.estado.visitas.find((v) => v.id === id); },
    visitasDo(pontoId) {
      return this.estado.visitas.filter((v) => v.ponto_id === pontoId).sort((a, b) => b.checkin.em.localeCompare(a.checkin.em));
    },
    visitaAberta() { return this.estado.visitas.find((v) => !v.checkout); },

    /** RF05 · check-in. Cria a visita na hora; a posição chega depois (registrarGeo) e nada espera o GPS. */
    checkin(pontoId) {
      const aberta = this.visitaAberta();
      if (aberta) throw new Error('Já existe uma visita aberta. Faça o check-out dela primeiro.');
      const p = this.ponto(pontoId);
      if (!p) throw new Error('Ponto não encontrado');
      const v = {
        id: novoId(),
        ponto_id: pontoId,
        checkin: { em: iso(agora()), lat: null, lng: null, precisao_m: null, gps_erro: null, gps_em: null },
        checkout: null,
        // se era um retorno, guarda o que foi sugerido para medir a tese do laço
        retorno_previsto: p.status_dia === 'retornar' && p.retorno_sugerido
          ? { quando: p.retorno_sugerido, motivo: p.retorno_motivo } : null,
        versao_conversa: null,
        observacao: [],
        nucleo: { resultado: null, quem_decide: null, faixas: [], dias: [], inicio: null, fim: null, editado_em: null },
        pesquisa: { inicio: null, fim: null },
        surpresa: '',
        registro_modo: null,
      };
      this.estado.visitas.push(v);
      this.salvar();
      return v;
    },

    registrarGeo(visitaId, pos, erro) {
      const v = this.visita(visitaId);
      if (!v) return;
      if (pos) {
        Object.assign(v.checkin, { lat: pos.lat, lng: pos.lng, precisao_m: Math.round(pos.precisao_m), gps_erro: null, gps_em: iso(agora()) });
        // o pino do ponto passa a ser o do check-in (é a coordenada confiável — H2)
        const p = this.ponto(v.ponto_id);
        if (p) Object.assign(p, { lat: pos.lat, lng: pos.lng, precisao_m: Math.round(pos.precisao_m), coord_fonte: 'checkin' });
      } else {
        v.checkin.gps_erro = erro || 'falhou';
      }
      this.salvar();
    },

    /**
     * Grava um campo da visita (caminho tipo "nucleo.resultado" ou "pesquisa.apps.estimulado.conhece")
     * e marca os relógios do RF11: núcleo = primeiro toque; pesquisa = primeiro e último toque.
     */
    setCampo(visitaId, caminho, valor) {
      const v = this.visita(visitaId);
      if (!v) return;
      const t = iso(agora());
      if (caminho.startsWith('nucleo.')) {
        if (!v.nucleo.inicio) v.nucleo.inicio = t;
        if (v.nucleo.fim) v.nucleo.editado_em = t;
      }
      if (caminho.startsWith('pesquisa.')) {
        if (!v.pesquisa.inicio) v.pesquisa.inicio = t;
        v.pesquisa.fim = t;
      }
      setPath(v, caminho, valor);
      // depois de salvo o núcleo, ou depois do check-out, edições reavaliam o laço
      if (v.nucleo.fim || v.checkout) this._aplicarLaco(v);
      this.salvar();
    },

    /** RF06 · "salvar" o núcleo fecha o relógio do núcleo e já alimenta o laço. */
    salvarNucleo(visitaId) {
      const v = this.visita(visitaId);
      if (!v || !v.nucleo.resultado) return null;
      if (!v.nucleo.fim) v.nucleo.fim = iso(agora());
      if (!v.nucleo.inicio) v.nucleo.inicio = v.nucleo.fim;
      const p = this.ponto(v.ponto_id);
      if (p && (v.nucleo.quem_decide || v.nucleo.faixas.length)) {
        p.decisor = { quem: v.nucleo.quem_decide, faixas: [...v.nucleo.faixas], dias: [...v.nucleo.dias], atualizado_em: v.nucleo.fim };
      }
      const r = this._aplicarLaco(v);
      this.salvar();
      return r;
    },

    /** RF09 · check-out grava a saída. A visita continua editável (surpresa é preenchida depois de sair). */
    checkout(visitaId) {
      const v = this.visita(visitaId);
      if (!v || v.checkout) return v;
      v.checkout = { em: iso(agora()) };
      this._aplicarLaco(v);
      this.salvar();
      return v;
    },

    /** RF10 · o registro de hoje muda o dia seguinte. */
    _aplicarLaco(v) {
      const p = this.ponto(v.ponto_id);
      if (!p) return null;
      // só a visita mais recente do ponto manda no status dele
      const ultima = this.visitasDo(p.id)[0];
      if (ultima && ultima.id !== v.id) return null;
      const ref = new Date(v.checkout?.em || v.nucleo.fim || agora());
      const r = calcularRetorno(v, ref);
      if (r) {
        p.status_dia = 'retornar';
        p.retorno_sugerido = iso(r.quando);
        p.retorno_motivo = r.motivo;
      } else {
        p.retorno_sugerido = null;
        p.retorno_motivo = null;
        if (v.checkout || v.nucleo.fim) p.status_dia = 'visitado';
      }
      return r;
    },

    // ---------- Backup ----------
    marcarExport() { this.estado.ultimo_export = iso(agora()); this.salvar(); },

    importar(texto) {
      const dado = migrar(JSON.parse(texto));
      if (!Array.isArray(dado.pontos) || !Array.isArray(dado.visitas)) throw new Error('Arquivo não parece um export desta V1.');
      try { st.setItem(`${chave}_antes_import_${Date.now()}`, JSON.stringify(this.estado)); } catch {}
      this.estado = dado;
      this.salvar();
    },
  };
  return store;
}

/** Migração de schema. Hoje só existe a v1; o ponto de extensão fica aqui para a V2. */
export function migrar(dado) {
  if (!dado || typeof dado !== 'object') throw new Error('formato inválido');
  const v = dado.schema_version ?? 1;
  if (v > SCHEMA_VERSION) throw new Error(`Export de versão mais nova (${v}).`);
  return { ...estadoVazio(), ...dado, schema_version: SCHEMA_VERSION };
}

export function limparCnpj(c) {
  const d = String(c ?? '').replace(/\D/g, '');
  return d.length ? d : null;
}
