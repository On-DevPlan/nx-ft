import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTone } from '../../src/web/frontend/components/toast/tone.js';

describe('normalizeTone', () => {
  it('canonical + aliases', () => {
    assert.equal(normalizeTone('ok'), 'ok');
    assert.equal(normalizeTone('success'), 'ok');
    assert.equal(normalizeTone('bad'), 'bad');
    assert.equal(normalizeTone('error'), 'bad');
    assert.equal(normalizeTone('err'), 'bad');
    assert.equal(normalizeTone('fail'), 'bad');
    assert.equal(normalizeTone('warn'), 'warn');
    assert.equal(normalizeTone('warning'), 'warn');
  });

  it('unknown / empty → ok', () => {
    assert.equal(normalizeTone(), 'ok');
    assert.equal(normalizeTone('info'), 'ok');
    assert.equal(normalizeTone(''), 'ok');
  });
});
