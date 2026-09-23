// Copyright 2026 Softwell S.r.l. - SPDX-License-Identifier: Apache-2.0
// Contract: a top-level string on the json transport comes back as the same
// string, never as the value it spells (issue #43). The wire is the one the
// Python side writes: the JSON-quoted string inside the transport quotes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toTytx, fromTytx } from '../src/index.js';

const STRINGS = [
    '42', 'true', 'false', 'null', '1.5', '[1,2]', '{"a":1}',
    'hello', '', 'x::JS', 'say "hi"', '"q"', 'àè',
];
const NON_STRINGS = [42, 1.5, true, false, null, [1, 2], { a: 1 }, ['42', 'true'], { code: '42' }];
const TRANSPORTS = [null, 'json'];

for (const transport of TRANSPORTS) {
    test(`top-level strings round-trip (transport ${transport})`, () => {
        for (const value of STRINGS) {
            assert.strictEqual(fromTytx(toTytx(value, transport), transport), value);
        }
    });

    test(`string and number encode differently (transport ${transport})`, () => {
        assert.notEqual(toTytx('42', transport), toTytx(42, transport));
    });

    test(`non-string values keep round-tripping (transport ${transport})`, () => {
        for (const value of NON_STRINGS) {
            assert.deepStrictEqual(fromTytx(toTytx(value, transport), transport), value);
        }
    });
}

test('json wire of a top-level string is the JSON-quoted string, quoted again', () => {
    assert.equal(toTytx('42', 'json'), '""42""');
    assert.equal(toTytx(42, 'json'), '"42"');
    assert.strictEqual(fromTytx('""42""', 'json'), '42');
});
