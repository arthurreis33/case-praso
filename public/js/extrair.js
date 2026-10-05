// Extração dos campos a partir do texto da nota (voz transcrita ou digitada).
// No modo demonstração (sem chave de LLM) esta extração por regras faz o papel do LLM, para o
// protótipo funcionar para quem abrir o link. Com chave, o servidor devolve os campos do LLM e
// esta função só completa o que faltar. Saída: { 'caminho.do.campo': valor } com chaves do catálogo.
import { proximaOcorrencia } from './rules.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tem = (t, ...re) => re.some((r) => r.test(t));
const DIAS_SEMANA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

export function extrairCampos(texto, { agora = new Date() } = {}) {
  const t = norm(texto);
  const c = {};
  // ---- núcleo ----
  if (tem(t, /recus/, /nao quer/, /nao tem interesse/)) c['nucleo.resultado'] = 'recusou';
  else if (tem(t, /(estava|tava|ta) fechad/, /ponto fechado/, /portao fechado/)) c['nucleo.resultado'] = 'fechado';
  else if (tem(t, /nao estava/, /ausente/, /(dono|socio|gerente|decisor) (nao|so) (esta|chega|vem)/, /nao tava/)) c['nucleo.resultado'] = 'aberto_sem_decisor';
  else if (tem(t, /falei com/, /conversei com/, /cadastro feito/, /cadastrei/)) c['nucleo.resultado'] = 'falou_com_decisor';

  const quem = [[/\bsocio/, 'socio'], [/\bgerente/, 'gerente'], [/cozinheir/, 'cozinheiro'], [/\bdon[oa]\b/, 'dono']].find(([r]) => r.test(t));
  if (quem && tem(t, /decide/, /quem compra/, /manda/, /falei com/, /chega/, /esta/)) c['nucleo.quem_decide'] = quem[1];

  const faixas = new Set();
  if (tem(t, /\bcedo\b/, /\b(6|7|8) ?h\b/, /das (seis|sete)/)) faixas.add('6-9');
  if (tem(t, /de manha/, /pela manha/, /\b(9|10|11) ?h/, /das (nove|dez)/)) faixas.add('9-1130');
  if (tem(t, /almoco/, /meio[- ]dia/)) faixas.add('1130-14');
  if (tem(t, /a tarde/, /de tarde/, /depois das (duas|tres|2|3)/, /das (duas|tres) /, /\b(14|15|16) ?h/)) faixas.add('14-17');
  if (tem(t, /fim de tarde/, /final da tarde/, /depois das (cinco|5)/, /\b(17|18|19) ?h/)) faixas.add('17-20');
  if (tem(t, /a noite/, /de noite/)) faixas.add('noite');
  if (faixas.size) c['nucleo.faixas'] = [...faixas];

  // ---- motivo de não avanço ----
  const mot = [[/ja tem fornecedor/, 'tem_fornecedor'], [/preco/, 'preco'], [/quer prazo|pediu prazo|prazo de/, 'quer_prazo'],
    [/desconfi/, 'desconfia_app'], [/sem tempo|correria|ocupad/, 'sem_tempo'], [/vai pensar|vou pensar|pensar/, 'vai_pensar']].find(([r]) => r.test(t));
  if (mot && c['nucleo.resultado'] !== 'aberto_sem_decisor' && !/cadastro feito|cadastrei/.test(t)) c.motivo_nao_avanco = mot[1];

  // ---- próxima ação ----
  if (tem(t, /\bvolt(ar|o)\b/, /retornar/, /passar de novo/)) {
    let dia = null;
    if (/amanha/.test(t)) dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
    const ds = Object.entries(DIAS_SEMANA).find(([n]) => new RegExp(`\\b${n}`).test(t));
    if (!dia && ds) { const d = (ds[1] - agora.getDay() + 7) % 7 || 7; dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + d); }
    const fx = c['nucleo.faixas'] || ['14-17'];
    const q = dia ? proximaOcorrencia(new Date(dia.getTime() - 60000), fx, []) : proximaOcorrencia(agora, fx, []);
    if (q) c.proxima_acao = { tipo: 'retorno', data_hora: q.toISOString() };
  } else if (/cadastro feito|cadastrei/.test(t)) {
    c.proxima_acao = { tipo: 'acompanhar_1a_compra', data_hora: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 10).toISOString() };
  }

  // ---- bloco de pesquisa ----
  const canal = [[/whats|zap/, 'whatsapp'], [/telefon|liga/, 'telefone'], [/representante|vendedor que passa/, 'representante'], [/atacarejo|atacadao|assai/, 'atacarejo'], [/\bapp\b|aplicativo|site/, 'app_site']].find(([r]) => r.test(t));
  if (canal && tem(t, /compra/, /pede/)) c['pesquisa.ultima_compra.canal'] = canal[1];
  const nf = [[/(um|1) fornecedor\b/, '1'], [/(dois|2) fornecedores/, '2'], [/(tres|3) fornecedores/, '3'], [/(quatro|cinco|varios|4|5) fornecedores/, '4+']].find(([r]) => r.test(t));
  if (nf) c['pesquisa.fornecedores.quantos'] = nf[1];
  const recl = t.match(/reclama d[aoe]s? ([^.,;]+)/);
  if (recl) c['pesquisa.fornecedores.dor_de_cabeca'] = recl[1].trim();
  const forma = [[/\bpix\b|dinheiro/, 'dinheiro_pix'], [/boleto a prazo|boleto (de|com) \d+/, 'boleto_prazo'], [/boleto/, 'boleto_vista'], [/cartao/, 'cartao'], [/fiado|caderneta/, 'fiado']].find(([r]) => r.test(t));
  if (forma) c['pesquisa.pagamento.forma'] = forma[1];
  const prazo = [[/\b(28|30) dias/, '28-30'], [/\b14 dias|quinze dias/, '14'], [/\b7 dias|uma semana/, '7'], [/a vista/, 'vista']].find(([r]) => r.test(t));
  if (prazo) c['pesquisa.pagamento.prazo'] = prazo[1];
  const conhece = ['praso', 'bees', 'cayena'].filter((a) => new RegExp(`\\b${a}\\b`).test(t) && /conhec|ouviu|usa|usou/.test(t));
  if (conhece.length) c['pesquisa.apps.estimulado.conhece'] = conhece;
  const troca = [[/frete|entrega/, 'entrega_rapida'], [/prazo/, 'prazo_pagamento'], [/preco|mais barato/, 'preco'], [/pedido minimo|minimo/, 'sem_minimo'], [/qualidade/, 'qualidade']]
    .filter(([r]) => r.test(t)).map(([, k]) => k);
  if (troca.length && /troca|trocaria|mudaria|reclama/.test(t)) c['pesquisa.troca.o_que_faria_trocar'] = [...new Set(troca)];
  if (/quem paga (e|eh) (o|a) (mesm|dono|propri)/.test(t)) c['pesquisa.papeis.quem_paga'] = 'decisor';
  return c;
}

/** Textos de exemplo do modo demonstração (notas do vendedor, ao sair do ponto). */
export const NOTAS_EXEMPLO = {
  falou_com_decisor: 'Falei com o dono, ele que decide tudo. Compra pelo WhatsApp com dois fornecedores e reclama do frete do fornecedor de carne. Paga no boleto de 28 dias e quer prazo. Fica aqui de tarde, depois das duas. Vou voltar quinta à tarde com a cesta de fritura.',
  aberto_sem_decisor: 'O dono não estava, quem atendeu foi o gerente. O dono só chega à tarde, depois das três. Eles pedem por telefone e pagam no PIX. Volto amanhã à tarde.',
  recusou: 'Recusou. Disse que já tem fornecedor há anos e que o preço é o que manda. Paga à vista no PIX. Não conhecia a Praso.',
  fechado: 'Estava fechado, portão fechado às dez da manhã. Vizinho disse que abre só à tarde. Volto amanhã à tarde.',
  cadastro: 'Cadastro feito no app com o dono. A primeira compra vai ser gordura e batata. Paga no PIX. Conhecia a Praso pelo Instagram e já ouviu falar da BEES.',
};
