/* IBI Product Listings Master — AI enhancement client
 * Two paths: (1) the site's own /api/ai Function (server-held key, plan quota),
 * (2) bring-your-own Gemini key called straight from the browser (key never leaves this device).
 * Either way the draft is passed through engine.enforceLimits() + finishListing() by the caller —
 * the model proposes, the rule engine disposes.
 */
import { cloud, secrets } from './store.js';

export const FIELD_KEYS = ['title', 'highlights', 'bullets', 'description', 'keywords', 'metaDescription'];

export function buildPrompt(product, ch, current, { instructions = '', suggestions = [] } = {}) {
  const f = ch.fields;
  const lim = [];
  if (f.title) lim.push(`title: ${f.title.min ? `${f.title.min}–` : ''}${f.target ? '' : ''}${f.title.target[0]}–${f.title.target[1]} characters, hard max ${f.title.max}. Rules: ${(f.title.rules || []).join(', ')}.`);
  if (f.highlights) lim.push(`highlights: ${f.highlights.target[0]}–${f.highlights.target[1]} chars, max ${f.highlights.max}, phrases separated by "${f.highlights.sep}"${(f.highlights.rules || []).includes('noTitleWords') ? ', never a word already in the title, never the brand' : ''}.`);
  if (f.bullets) lim.push(`bullets: exactly ${f.bullets.count} strings, each ${f.bullets.targetEach ? `${f.bullets.targetEach[0]}–${f.bullets.targetEach[1]}` : 'under ' + f.bullets.maxEach} chars (max ${f.bullets.maxEach}), start with a short benefit label then a colon.`);
  if (f.description) lim.push(`description: ${f.description.target[0]}–${f.description.target[1]} chars, max ${f.description.max}, plain text paragraphs separated by a blank line, factual, includes a specification line.`);
  if (f.keywords) lim.push(`keywords: ${f.keywords.tagMax ? `${f.keywords.tagCount} tags of ≤${f.keywords.tagMax} chars, comma separated` : `space-separated search terms, under ${f.keywords.maxBytes} bytes`}${(f.keywords.rules || []).includes('noTitleWords') ? ', no word that is already in the title, no brand' : ''}.`);
  if (f.metaDescription) lim.push(`metaDescription: ${f.metaDescription.target[0]}–${f.metaDescription.target[1]} chars, max ${f.metaDescription.max}.`);
  const p = product;
  const facts = {
    brand: p.brand, productType: p.productType, category: [p.category, p.subcategory].filter(Boolean).join(' > '), keyFeatures: p.keyFeatures, useCases: p.useCases, audience: p.audience,
    material: p.material, colour: p.colour, size: p.size, dimensionsCm: [p.lengthCm, p.breadthCm, p.heightCm].filter(v => v !== '').join(' x '), weightG: p.weightG, netQuantity: p.netQuantity, packSize: p.packSize,
    certifications: p.certifications, warranty: p.warranty, care: p.care, countryOfOrigin: p.countryOfOrigin, manufacturer: [p.manufacturerName, p.manufacturerAddress].filter(Boolean).join(', '), sellerKeywords: p.keywords, liveSearchSuggestions: suggestions.slice(0, 12), sellerNotes: p.notes,
  };
  return {
    system: `You write e-commerce product listings for Indian and global marketplaces. You are given verified product facts and one target marketplace's rules. Write ONLY from the facts: never invent specifications, awards, certifications, warranties or prices. No promotional words (best, cheap, free, guarantee, discount, offer, sale, No.1, 100%). No ALL-CAPS words. Use the words real shoppers type (synonyms, Hinglish where natural, e.g. chalni, dabba). Respond with a single JSON object and nothing else.`,
    user: `Marketplace: ${ch.name}. ${ch.summary}\nField rules:\n- ${lim.join('\n- ')}\n\nProduct facts (JSON):\n${JSON.stringify(facts, null, 1)}\n\nCurrent draft to improve (keep what is good, fix what is weak):\n${JSON.stringify(Object.fromEntries(FIELD_KEYS.filter(k => current[k] != null && (k in f || (k === 'metaDescription' && f.metaDescription))).map(k => [k, current[k]])), null, 1)}\n${instructions ? `\nSeller instruction: ${instructions}\n` : ''}\nReturn JSON with keys: ${Object.keys(f).join(', ')}. bullets is an array of strings.`,
    schema: {
      type: 'object', additionalProperties: false,
      properties: Object.fromEntries(Object.keys(f).map(k => [k, k === 'bullets' ? { type: 'array', items: { type: 'string' } } : { type: 'string' }])),
      required: Object.keys(f),
    },
  };
}

export function extractJson(text) {
  if (!text) return null;
  const s = String(text).replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '');
  const first = s.indexOf('{'); if (first < 0) return null;
  for (let i = first; i < s.length; i++) {
    if (s[i] !== '{') continue;
    let depth = 0, q = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (q) { if (c === '\\') j++; else if (c === '"') q = false; continue; }
      if (c === '"') q = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) { try { const o = JSON.parse(s.slice(i, j + 1)); if (o && typeof o === 'object' && ('title' in o || 'bullets' in o || 'description' in o)) return o; } catch { /* keep hunting */ } break; } }
    }
  }
  return null;
}

async function viaGemini(prompt, key) {
  const model = 'gemini-3.7-flash';
  const body = { systemInstruction: { parts: [{ text: prompt.system }] }, contents: [{ role: 'user', parts: [{ text: prompt.user }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.6, maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: 'minimal' } } };
  let r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (r.status === 400) { delete body.generationConfig.thinkingConfig; r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || `Gemini HTTP ${r.status}`);
  const text = (((j.candidates || [])[0] || {}).content || {}).parts?.filter(p => !p.thought).map(p => p.text).join('') || '';
  const out = extractJson(text); if (!out) throw new Error('Gemini returned no listing JSON');
  return { draft: out, provider: 'gemini (your key)' };
}

/* Returns {draft, provider, usage?}. Throws with a readable message. */
export async function enhance({ product, channel, current, instructions, suggestions, mode }) {
  const prompt = buildPrompt(product, channel, current, { instructions, suggestions });
  const byok = secrets.get('gemini');
  if (mode === 'byok' || (mode !== 'server' && !cloud.state.ai && byok)) {
    if (!byok) throw new Error('Add your Gemini API key in Settings → AI first.');
    return viaGemini(prompt, byok);
  }
  if (!cloud.state.available) throw new Error(byok ? 'Server AI is offline; switch Settings → AI to “My own Gemini key”.' : 'AI needs the online service (or your own Gemini key in Settings → AI).');
  if (!cloud.state.ai) throw new Error(byok ? 'Server AI is not configured here; switch Settings → AI to “My own Gemini key”.' : 'AI is not configured on this server yet. Add your own Gemini key in Settings → AI, or sign in to a plan that includes AI.');
  const r = await cloud.ai({ channel: channel.id, system: prompt.system, user: prompt.user, schema: prompt.schema });
  const draft = r.draft || extractJson(r.text);
  if (!draft) throw new Error('The AI reply had no listing JSON. Try again.');
  return { draft, provider: r.provider || 'server', usage: r.usage };
}
