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
  assert.equal(unwrapText(JSON.stringify({ answer: ['One.', 'Two.'] })), 'One.\n\nTwo.');
});

test('the provider metadata label is never shown', () => {
  // exactly what DeepSeek returned live on 11 Sep 2026
  assert.equal(unwrapText(JSON.stringify({ type: 'json_object', response: ANSWER })), ANSWER);
  assert.equal(unwrapText(JSON.stringify({ format: 'json', schema: 'v1', out: ANSWER })), ANSWER, 'no known key: the prose survives, the labels do not');
  assert.equal(unwrapText(JSON.stringify({ Answer: ANSWER, model: 'deepseek-v4-flash' })), ANSWER, 'key match is case-insensitive');
});

test('empty and junk inputs never throw', () => {
  for (const v of ['', null, undefined, '{}', '[]', '{"a":null}', '{ broken']) assert.equal(typeof unwrapText(v), 'string');
  assert.equal(unwrapText('{}'), '{}');
});
