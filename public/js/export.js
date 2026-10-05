// RF12 · export. JSON = estado completo (schema 2: pontos, visitas, pedidos, contatos, eventos…).
// CSV = uma linha por visita com os dados do ponto juntos, pronto para planilha.
// Compatibilidade com a V1: as 55 colunas da V1 vêm primeiro, com os mesmos nomes e na mesma ordem;
// as colunas novas da V2 entram depois. Atenção: ponto_estado passa a usar os 6 estados da V2.
// CSV com ";" e BOM UTF-8: abre direto no Excel em português (que usa vírgula como decimal);
// o Google Sheets detecta o separador sozinho.
import { duracoes, pontosValor } from './rules.js';
import { SCHEMA_VERSION } from './store.js';

export function paraJSON(estado, agora = new Date()) {
  return JSON.stringify({ ...estado, schema_version: SCHEMA_VERSION, exportado_em: agora.toISOString() });
}

const lista = (a) => (Array.isArray(a) ? a.join('|') : a ?? '');
const local = (s) => {
  if (!s) return '';
  const d = new Date(s), z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
};

// [cabeçalho, função que extrai o valor de (ponto, visita, durações)]
const COLUNAS = [
  ['schema_version', () => SCHEMA_VERSION],
  ['visita_id', (p, v) => v.id],
  ['ponto_id', (p) => p.id],
  ['ponto_nome', (p) => p.nome_fantasia ?? p.nome],
  ['ponto_tipo', (p) => p.tipo],
  ['ponto_endereco', (p) => p.endereco_cadastral ?? p.endereco],
  ['ponto_cnpj', (p) => p.cnpj],
  ['ponto_estado', (p) => p.estado],
  ['ponto_status_dia', (p) => p.status_dia],
  ['ponto_origem', (p) => p.origem],
  ['ponto_ficticio', (p) => (p.ficticio ? 'sim' : 'nao')],
  ['ponto_retorno_sugerido', (p) => local(p.retorno_sugerido)],
  ['ponto_retorno_motivo', (p) => p.retorno_motivo],
  ['checkin_em', (p, v) => local(v.checkin?.em)],
  ['checkin_lat', (p, v) => v.checkin?.lat],
  ['checkin_lng', (p, v) => v.checkin?.lng],
  ['checkin_precisao_m', (p, v) => v.checkin?.precisao_m],
  ['checkin_gps_erro', (p, v) => v.checkin?.gps_erro],
  ['checkout_em', (p, v) => local(v.checkout?.em)],
  ['versao_conversa', (p, v) => v.versao_conversa],
  ['observacao', (p, v) => lista(v.observacao)],
  ['nucleo_resultado', (p, v) => v.nucleo?.resultado],
  ['nucleo_quem_decide', (p, v) => v.nucleo?.quem_decide],
  ['nucleo_faixas', (p, v) => lista(v.nucleo?.faixas)],
  ['nucleo_dias', (p, v) => lista(v.nucleo?.dias)],
  ['p2_quem_paga', (p, v) => v.pesquisa?.papeis?.quem_paga],
  ['p2_quem_recebe', (p, v) => v.pesquisa?.papeis?.quem_recebe],
  ['p3_canal', (p, v) => lista(v.pesquisa?.ultima_compra?.canal)],
  ['p3_de_quem', (p, v) => v.pesquisa?.ultima_compra?.de_quem],
  ['p3_anterior_parecida', (p, v) => v.pesquisa?.ultima_compra?.anterior_parecida],
  ['p4_n_fornecedores', (p, v) => v.pesquisa?.fornecedores?.quantos],
  ['p4_dor_de_cabeca', (p, v) => v.pesquisa?.fornecedores?.dor_de_cabeca],
  ['p5_ultima_troca', (p, v) => v.pesquisa?.ultima_troca?.quando],
  ['p5_o_que_fez_mudar', (p, v) => v.pesquisa?.ultima_troca?.o_que_fez_mudar],
  ['p5_quase_desistiu', (p, v) => v.pesquisa?.ultima_troca?.quase_desistiu],
  ['p6_espontaneo_ja_comprou', (p, v) => v.pesquisa?.apps?.espontaneo?.ja_comprou],
  ['p6_espontaneo_qual', (p, v) => v.pesquisa?.apps?.espontaneo?.qual],
  ['p6_estimulado_conhece', (p, v) => lista(v.pesquisa?.apps?.estimulado?.conhece)],
  ['p6_estimulado_usou', (p, v) => lista(v.pesquisa?.apps?.estimulado?.usou)],
  ['p7_forma_pagamento', (p, v) => lista(v.pesquisa?.pagamento?.forma)],
  ['p7_prazo', (p, v) => v.pesquisa?.pagamento?.prazo],
  ['p7_deixou_de_comprar', (p, v) => v.pesquisa?.pagamento?.deixou_de_comprar],
  ['p7_deixou_de_comprar_texto', (p, v) => v.pesquisa?.pagamento?.deixou_texto],
  ['p8_pode_voltar', (p, v) => v.pesquisa?.fechamento?.pode_voltar],
  ['p8_melhor_faixas', (p, v) => lista(v.pesquisa?.fechamento?.melhor_horario?.faixas)],
  ['p8_melhor_dias', (p, v) => lista(v.pesquisa?.fechamento?.melhor_horario?.dias)],
  ['p8_indicacao', (p, v) => v.pesquisa?.fechamento?.indicacao],
  ['surpresa', (p, v) => v.surpresa],
  ['registro_modo', (p, v) => v.nota_origem ?? v.registro_modo],
  ['tempo_no_ponto_s', (p, v, d) => d.tempo_no_ponto_s],
  ['tempo_nucleo_s', (p, v, d) => d.tempo_nucleo_s],
  ['tempo_pesquisa_s', (p, v, d) => d.tempo_pesquisa_s],
  ['nucleo_salvo_no_ponto', (p, v, d) => (d.nucleo_no_ponto == null ? '' : d.nucleo_no_ponto ? 'sim' : 'nao')],
  ['revisita_retorno_previsto', (p, v) => local(v.retorno_previsto?.quando)],
  ['revisita_desvio_min', (p, v, d) => d.revisita_desvio_min],
  // ---- V2 (colunas novas, sempre depois das da V1) ----
  ['v2_vendedor_id', (p, v) => v.vendedor_id],
  ['v2_visita_tipo', (p, v) => v.tipo],
  ['v2_estado_no_checkin', (p, v) => v.estado_no_checkin],
  ['v2_planejada_para', (p, v) => local(v.planejada_para)],
  ['v2_checkin_distancia_pino_m', (p, v) => v.checkin?.distancia_pino_m],
  ['v2_motivo_nao_avanco', (p, v) => v.motivo_nao_avanco],
  ['v2_proxima_acao', (p, v) => v.proxima_acao?.tipo],
  ['v2_proxima_acao_quando', (p, v) => local(v.proxima_acao?.data_hora)],
  ['v2_nota_texto', (p, v) => v.nota_texto],
  ['v2_nota_origem', (p, v) => v.nota_origem],
  ['v2_transcricao_status', (p, v) => v.transcricao_status],
  ['v2_campos_ia', (p, v) => lista(v.campos_ia)],
  ['v2_o_que_faria_trocar', (p, v) => lista(v.pesquisa?.troca?.o_que_faria_trocar)],
  ['v2_ponto_etapa_funil', (p) => p.etapa_funil],
  ['v2_ponto_mei', (p) => (p.mei == null ? '' : p.mei ? 'sim' : 'nao')],
  ['v2_ponto_pontos_valor', (p) => (p.id ? String(pontosValor(p)).replace('.', ',') : '')],
  ['v2_ponto_coord_confirmada_origem', (p) => p.coord_confirmada?.origem],
];

function celula(x) {
  if (x === null || x === undefined) return '';
  const s = String(x);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function paraCSV(estado, opcoes = { todas: true }) {
  const pontos = new Map(estado.pontos.map((p) => [p.id, p]));
  const visitas = [...estado.visitas].filter((v) => opcoes.todas || !v.ficticio).sort((a, b) => a.checkin.em.localeCompare(b.checkin.em));
  const linhas = [COLUNAS.map(([c]) => c).join(';')];
  for (const v of visitas) {
    const p = pontos.get(v.ponto_id) || {};
    const d = duracoes(v);
    linhas.push(COLUNAS.map(([, f]) => celula(f(p, v, d))).join(';'));
  }
  return '﻿' + linhas.join('\r\n') + '\r\n';
}

export function nomeArquivo(ext, agora = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `praso-campo-${agora.getFullYear()}${z(agora.getMonth() + 1)}${z(agora.getDate())}-${z(agora.getHours())}${z(agora.getMinutes())}.${ext}`;
}

/** Baixa o arquivo. Funciona offline (Blob local). */
export function baixar(conteudo, nome, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Compartilha pelo menu do Android (WhatsApp, Drive, e-mail), quando o navegador suporta arquivos. */
export function podeCompartilharArquivo() {
  try { return typeof File === 'function' && !!navigator.canShare?.({ files: [new File(['x'], 't.txt', { type: 'text/plain' })] }); } catch { return false; }
}

export async function compartilhar(conteudo, nome, tipo) {
  const arquivo = new File([conteudo], nome, { type: tipo });
  if (!navigator.canShare?.({ files: [arquivo] })) return false;
  await navigator.share({ files: [arquivo], title: nome });
  return true;
}
