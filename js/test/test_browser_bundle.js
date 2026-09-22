// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

test('browser bundle provides JSON and MessagePack registered-type codecs without Node shims', async () => {
    const outfile = `/tmp/tytx-browser-${process.pid}-${Date.now()}.mjs`;
    await build({
        entryPoints: [new URL('../src/index.js', import.meta.url).pathname],
        bundle: true,
        outfile,
        format: 'esm',
        platform: 'browser',
        target: ['es2020'],
        conditions: ['browser'],
    });
    const source = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
    class Root { constructor(value) { this.value = value; } }
    Root.tytxSuffix = 'BROWSERROOT';
    Root.prototype.toTytx = function toTytx() { return JSON.stringify(this.value); };
    Root.fromTytx = value => new Root(JSON.parse(value));
    source.registerClass(Root);
    for (const transport of ['json', 'msgpack']) {
        const decoded = source.fromTytx(source.toTytx(new Root({message: 'browser'}), transport), transport);
        assert.ok(decoded instanceof Root);
        assert.deepEqual(decoded.value, {message: 'browser'});
    }
});
