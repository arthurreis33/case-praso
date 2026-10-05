// Nota por voz (fatia 6). Por enquanto só a interface da fila usada pelo topo.
export function pendentesFila(store) {
  return store.estado.visitas.filter((v) => v.transcricao_status === 'pendente').length;
}
export function iniciarFila() {}
export function montarGravador() { return null; }
