// Copyright 2026 Softwell S.r.l. - SPDX-License-Identifier: Apache-2.0
// Contract: public type inspection must not execute a decoder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerType, getRegisteredType } from '../src/index.js';
test('lookup returns the registered constructor without decoding', () => {
    class Branch {}
    registerType(Branch, 'LOOKUPBRANCH', () => '', () => { throw new Error('must not decode'); });
    assert.equal(getRegisteredType('LOOKUPBRANCH'), Branch);
    assert.equal(getRegisteredType('D'), Date);
    assert.equal(getRegisteredType('UNKNOWNLOOKUP'), null);
    assert.equal(getRegisteredType('toString'), null);
});
