/* Regression: a help answer must never reach the user wrapped in the provider's JSON.
 * Found live on 11 Sep 2026 — DeepSeek's json_object mode returned {"response": "..."}
 * and the shopper saw the braces. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { unwrapText } from '../functions/api/ai.js';

const ANSWER = 'On Amazon India the Item Name can be up to 75 characters.';

test('unwraps whatever key the provider chose', () => {
  for (const key of ['answer', 'response', 'text', 'reply', 'result', 'output']) {
    assert.equal(unwrapText(JSON.stringify({ [key]: ANSWER })), ANSWER, key);
  }
});

test('unwraps through code fences and leading prose', () => {
  assert.equal(unwrapText('```json\n{"answer": "' + ANSWER + '"}\n```'), ANSWER);
  assert.equal(unwrapText('Here you go:\n{"response":"' + ANSWER + '"}'), ANSWER);
});

test('plain text is returned untouched', () => {
  assert.equal(unwrapText(ANSWER), ANSWER);
  assert.equal(unwrapText('  ' + ANSWER + '  '), ANSWER);
  assert.equal(unwrapText('Cost is ₹499 { not json } really'), 'Cost is ₹499 { not json } really');
});

test('nested and multi-key objects keep every string, in order', () => {
  assert.equal(unwrapText(JSON.stringify({ answer: { text: ANSWER } })), ANSWER);
  assert.equal(unwrapText(JSON.stringify({ intro: 'First.', detail: 'Second.' })), 'First.\n\nSecond.');
  assert.equal(unwrapText(JSON.stringify({ steps: ['One.', 'Two.'] })), 'One.\n\nTwo.');
});

test('empty and junk inputs never throw', () => {
  for (const v of ['', null, undefined, '{}', '[]', '{"a":null}', '{ broken']) assert.equal(typeof unwrapText(v), 'string');
  assert.equal(unwrapText('{}'), '{}');
});
