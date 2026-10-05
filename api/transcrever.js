// Função serverless da Vercel: transcrição da nota de voz + extração dos campos por LLM.
// As chaves ficam SÓ nas variáveis de ambiente desta função, nunca no cliente:
//   OPENAI_API_KEY        (obrigatória para o modo real)
//   TRANSCRICAO_MODELO    (padrão: whisper-1)
//   EXTRACAO_MODELO       (padrão: gpt-4o-mini)
// Sem chave, responde 501 e o app entra no MODO DEMONSTRAÇÃO (transcrição simulada no aparelho).
// Entrada: POST JSON { audio_base64, mime, contexto: { tipo_visita, resultado, hoje } }
// Saída:   { modo: 'real', texto, campos: { 'nucleo.resultado': ..., ... } }
// O áudio não é guardado em lugar nenhum: só atravessa esta função.

const CHAVES = {
  'nucleo.resultado': ['fechado', 'aberto_sem_decisor', 'falou_com_decisor', 'recusou'],
  'nucleo.quem_decide': ['dono', 'socio', 'gerente', 'cozinheiro', 'outro'],
  'nucleo.faixas': ['6-9', '9-1130', '1130-14', '14-17', '17-20', 'noite'],
  motivo_nao_avanco: ['tem_fornecedor', 'preco', 'quer_prazo', 'desconfia_app', 'sem_tempo', 'vai_pensar', 'nao_icp', 'outro'],
  'pesquisa.ultima_compra.canal': ['telefone', 'whatsapp', 'representante', 'atacarejo', 'app_site', 'outro'],
  'pesquisa.fornecedores.quantos': ['1', '2', '3', '4+'],
  'pesquisa.pagamento.forma': ['dinheiro_pix', 'boleto_vista', 'boleto_prazo', 'cartao', 'fiado'],
  'pesquisa.pagamento.prazo': ['vista', '7', '14', '28-30', '30+'],
  'pesquisa.apps.estimulado.conhece': ['bees', 'cayena', 'praso', 'nenhum'],
  'pesquisa.troca.o_que_faria_trocar': ['preco', 'prazo_pagamento', 'entrega_rapida', 'sem_minimo', 'qualidade', 'atendimento', 'nada'],
};
const MULTI = new Set(['nucleo.faixas', 'pesquisa.apps.estimulado.conhece', 'pesquisa.troca.o_que_faria_trocar']);

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'use POST' });
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) return res.status(501).json({ modo: 'demo', erro: 'sem chave configurada' });
  try {
    const { audio_base64: b64, mime = 'audio/webm', contexto = {} } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!b64) return res.status(400).json({ erro: 'sem áudio' });
    const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(b64, 'base64')], { type: mime }), `nota.${ext}`);
    form.append('model', process.env.TRANSCRICAO_MODELO || 'whisper-1');
    form.append('language', 'pt');
    const t = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${chave}` }, body: form });
    if (!t.ok) return res.status(502).json({ erro: `transcrição ${t.status}` });
    const texto = (await t.json()).text || '';

    const prompt = `Você extrai campos de uma nota de voz de um vendedor de campo de um e-commerce B2B de insumos para restaurantes.
A nota é do vendedor, ao sair do ponto. Hoje é ${contexto.hoje || new Date().toISOString()}. Tipo de visita: ${contexto.tipo_visita || 'aquisicao'}.
Devolva SÓ um JSON com as chaves abaixo que a nota sustentar com clareza (omita o resto). Valores permitidos:
${Object.entries(CHAVES).map(([k, v]) => `- "${k}": ${MULTI.has(k) ? 'lista de ' : ''}${v.join(' | ')}`).join('\n')}
- "pesquisa.fornecedores.dor_de_cabeca": texto curto
- "proxima_acao": { "tipo": "retorno" | "acompanhar_1a_compra" | "mensagem_recompra" | "nenhuma", "data_hora": ISO 8601 ou null }
Nunca inclua nome ou telefone de pessoas.`;
    const x = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.EXTRACAO_MODELO || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0,
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: texto }],
      }),
    });
    let campos = {};
    if (x.ok) {
      try { campos = validar(JSON.parse((await x.json()).choices?.[0]?.message?.content || '{}')); } catch { campos = {}; }
    }
    return res.status(200).json({ modo: 'real', texto, campos });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

/** Só passa o que está no catálogo: o LLM não inventa chave nem valor. */
export function validar(c) {
  const r = {};
  for (const [k, v] of Object.entries(c || {})) {
    if (CHAVES[k]) {
      if (MULTI.has(k)) { const ok = (Array.isArray(v) ? v : [v]).filter((x) => CHAVES[k].includes(x)); if (ok.length) r[k] = ok; }
      else if (CHAVES[k].includes(v)) r[k] = v;
    } else if (k === 'pesquisa.fornecedores.dor_de_cabeca' && typeof v === 'string') r[k] = v.slice(0, 200);
    else if (k === 'proxima_acao' && v && ['retorno', 'acompanhar_1a_compra', 'mensagem_recompra', 'nenhuma'].includes(v.tipo)) {
      r[k] = { tipo: v.tipo, data_hora: v.data_hora && !Number.isNaN(Date.parse(v.data_hora)) ? new Date(v.data_hora).toISOString() : null };
    }
  }
  return r;
}
