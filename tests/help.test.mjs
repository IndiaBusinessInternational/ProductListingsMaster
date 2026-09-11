import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_ARTICLES, searchHelp, answerFromKb, startersFor, buildHelpPrompt, renderHelpText } from '../app/help.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

test('the knowledge base is well formed', () => {
  const ids = new Set();
  for (const a of HELP_ARTICLES) {
    assert.ok(a.id && !ids.has(a.id), `duplicate or missing id: ${a.id}`); ids.add(a.id);
    assert.ok(a.title.length > 8, a.id);
    assert.ok(Array.isArray(a.tags) && a.tags.length >= 4, `${a.id} needs tags`);
    assert.ok(a.body.length > 150, `${a.id} body too thin`);
    if (a.route) assert.match(a.route, /^#\//, `${a.id} route must be a hash route`);
  }
  assert.ok(HELP_ARTICLES.length >= 20);
});

test('real seller questions reach the right article', () => {
  const cases = [
    ['how do I import my meesho sheet', 'import-sheet'],
    ['amazon title character limit', 'amazon-rules'],
    ['what does the score mean', 'score'],
    ['why was my meesho catalogue rejected', 'meesho-rules'],
    ['how much does it cost', 'plans'],
    ['my images are not in the export', 'images'],
    ['does it work without internet', 'offline'],
    ['how do I upload the sheet to flipkart', 'export'],
    ['colours and sizes', 'variants'],
    ['is my data safe', 'privacy'],
    ['the ai button is not working', 'trouble-ai'],
    ['I want to talk to someone', 'contact'],
    ['what does listings master do', 'what-is-this'],
    ['add a marketplace that is missing', 'custom-channel'],
    ['legal metrology declarations', 'compliance'],
    ['improve my titles from clicks', 'performance'],
  ];
  for (const [q, want] of cases) {
    const a = answerFromKb(q, { route: 'studio' });
    assert.equal(a.articles[0] && a.articles[0].id, want, `"${q}" → ${a.articles[0] && a.articles[0].id} (wanted ${want})`);
    assert.notEqual(a.kind, 'nomatch', q);
  }
});

test('an unrelated question is refused, not guessed', () => {
  const a = answerFromKb('banana milkshake recipe', { route: 'dashboard' });
  assert.equal(a.kind, 'nomatch');
  assert.ok(a.related.length >= 3, 'a refusal still offers starters');
});

test('every answer offers a real screen to open', () => {
  for (const a of HELP_ARTICLES.filter(x => x.route)) {
    const known = ['dashboard', 'products', 'studio', 'keywords', 'performance', 'channels', 'exports', 'account', 'settings', 'help'];
    assert.ok(known.includes(a.route.replace('#/', '').split('/')[0]), `${a.id} → ${a.route}`);
  }
});

test('starters are screen aware', () => {
  const s = startersFor('exports');
  assert.equal(s.length, 4);
  assert.match(s[0].q, /upload|sheet|marketplace/i);
});

test('the AI prompt is grounded and refuses outside its sources', () => {
  const hits = searchHelp('amazon title', 3).map(h => h.article);
  const p = buildHelpPrompt('amazon title', hits, { route: 'studio' });
  assert.match(p.system, /ONLY from the help articles/i);
  assert.match(p.system, /never guess, never invent/i);
  assert.ok(p.user.includes('Item Name'), 'the articles are actually in the prompt');
  assert.ok(p.user.length < 20000, 'prompt stays small');
});

test('the renderer escapes HTML and formats lists', () => {
  const html = renderHelpText('Plain <b>x</b> line\n\n- one **bold**\n- two\n\n1. first\n2. second', esc);
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'), 'html in content is escaped');
  assert.ok(html.includes('<ul><li>one <b>bold</b></li><li>two</li></ul>'));
  assert.ok(html.includes('<ol><li>first</li><li>second</li></ol>'));
  assert.ok(!/<script/i.test(renderHelpText('<script>alert(1)</script>', esc)));
});
