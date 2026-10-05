// Persistência da V2: IndexedDB para tudo (decisão 3 do plano).
// Cada coleção é um object store; cada toque grava só os registros que mudaram, numa transação curta.
// A garantia "salvo no instante do toque" da V1 é mantida pelo DIÁRIO síncrono no localStorage
// (ver store.js): os registros alterados vão para lá antes, e saem quando o IndexedDB confirma.
//
// Interface comum dos adaptadores (o de memória serve aos testes e ao fallback):
//   abrir() · lerTudo() → { meta, pontos: [], visitas: [], ... } · gravar(ops) · limpar()
//   salvarAudio(id, blob) · lerAudio(id) · apagarAudio(id)
// op = { c: 'meta' | coleção, id, v: registro | null (apagar) }

export const COLECOES = ['pontos', 'visitas', 'pedidos', 'contatos', 'eventos', 'vendedores', 'desconhecidos'];
export const NOME_DB = 'praso_campo_v2';

export function adaptadorMemoria() {
  const d = { meta: null, audios: new Map() };
  COLECOES.forEach((c) => { d[c] = new Map(); });
  return {
    nome: 'memoria',
    _d: d,
    async abrir() { return this; },
    async lerTudo() {
      const r = { meta: d.meta ? structuredClone(d.meta) : null };
      COLECOES.forEach((c) => { r[c] = [...d[c].values()].map((x) => structuredClone(x)); });
      return r;
    },
    async gravar(ops) {
      for (const { c, id, v } of ops) {
        if (c === 'meta') d.meta = v ? structuredClone(v) : null;
        else if (v == null) d[c].delete(id);
        else d[c].set(id, structuredClone(v));
      }
    },
    async limpar() { d.meta = null; COLECOES.forEach((c) => d[c].clear()); },
    async salvarAudio(id, blob) { d.audios.set(id, blob); },
    async lerAudio(id) { return d.audios.get(id) ?? null; },
    async apagarAudio(id) { d.audios.delete(id); },
  };
}

const req = (r) => new Promise((ok, erro) => { r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
const fim = (tx) => new Promise((ok, erro) => {
  tx.oncomplete = () => ok();
  tx.onerror = () => erro(tx.error);
  tx.onabort = () => erro(tx.error || new Error('transação abortada'));
});

export function adaptadorIndexedDB(nome = NOME_DB, idb = globalThis.indexedDB) {
  let db = null;
  return {
    nome: 'indexeddb',
    async abrir() {
      if (!idb) throw new Error('IndexedDB indisponível');
      db = await new Promise((ok, erro) => {
        const r = idb.open(nome, 1);
        r.onupgradeneeded = () => {
          const x = r.result;
          if (!x.objectStoreNames.contains('meta')) x.createObjectStore('meta');
          if (!x.objectStoreNames.contains('audios')) x.createObjectStore('audios');
          COLECOES.forEach((c) => { if (!x.objectStoreNames.contains(c)) x.createObjectStore(c, { keyPath: 'id' }); });
        };
        r.onsuccess = () => ok(r.result);
        r.onerror = () => erro(r.error);
        r.onblocked = () => erro(new Error('banco bloqueado por outra aba'));
      });
      return this;
    },
    async lerTudo() {
      const tx = db.transaction(['meta', ...COLECOES], 'readonly');
      const r = { meta: (await req(tx.objectStore('meta').get('estado'))) || null };
      for (const c of COLECOES) r[c] = await req(tx.objectStore(c).getAll());
      return r;
    },
    async gravar(ops) {
      if (!ops.length) return;
      const tx = db.transaction(['meta', ...COLECOES], 'readwrite');
      for (const { c, id, v } of ops) {
        const os = tx.objectStore(c);
        if (c === 'meta') { if (v) os.put(v, 'estado'); else os.delete('estado'); } else if (v == null) os.delete(id); else os.put(v);
      }
      await fim(tx);
    },
    async limpar() {
      const tx = db.transaction(['meta', ...COLECOES], 'readwrite');
      ['meta', ...COLECOES].forEach((c) => tx.objectStore(c).clear());
      await fim(tx);
    },
    async salvarAudio(id, blob) { const tx = db.transaction('audios', 'readwrite'); tx.objectStore('audios').put(blob, id); await fim(tx); },
    async lerAudio(id) { return (await req(db.transaction('audios').objectStore('audios').get(id))) ?? null; },
    async apagarAudio(id) { const tx = db.transaction('audios', 'readwrite'); tx.objectStore('audios').delete(id); await fim(tx); },
  };
}
