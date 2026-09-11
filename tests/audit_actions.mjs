/* Every data-act="<name>" in app.js (static markup AND template strings) must resolve to A.<name>.
 * Run: node tests/audit_actions.mjs  — exits 1 if a dead control exists. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'app', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(here, '..', 'app', 'index.html'), 'utf8');
const used = new Set([...(src + html).matchAll(/data-act=\\?["']([A-Za-z0-9_]+)/g)].map(m => m[1]));
const usedSel = [...(src + html).matchAll(/\[data-act=([A-Za-z0-9_]+)\]/g)].map(m => m[1]); usedSel.forEach(u => used.add(u));
// actions handed to a helper as a plain string (e.g. withBtn(ctrl, 'genSku', ...)) are
// referenced too - without this the audit calls every one of them dead.
[...src.matchAll(/withBtn\([^,]+,\s*'([A-Za-z0-9_]+)'/g)].forEach(m => used.add(m[1]));
const aBlock = src.slice(src.indexOf('const A = {'), src.indexOf('/* ───────── helpers used by actions'));
const defined = new Set([...aBlock.matchAll(/^\s{2}(?:async\s+)?([A-Za-z0-9_]+)\s*\(/gm)].map(m => m[1]));
const dead = [...used].filter(u => !defined.has(u));
// referenced only from runtime-built action lists (help answers), so there is no
// literal in the source to find - listing them keeps the info line honest.
const DYNAMIC = /^(toggleTheme|goSync|goAccount|about|imgAdd|authSubmit|helpGo|helpWhatsApp|helpStarter)$/;
const unused = [...defined].filter(d => !used.has(d) && !DYNAMIC.test(d));
console.log(`actions used: ${used.size}, defined: ${defined.size}`);
if (unused.length) console.log('defined but never referenced (info):', unused.join(', '));
if (dead.length) { console.error('DEAD CONTROLS — data-act without a handler:', dead.join(', ')); process.exit(1); }
console.log('OK: every data-act has a handler');
