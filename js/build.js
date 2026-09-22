// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * Build script for browser bundle.
 *
 * Creates a single bundle that works in browsers.
 * For Node.js, use the source files directly.
 */

import * as esbuild from 'esbuild';

await esbuild.build({
    entryPoints: ['src/index.js'],
    bundle: true,
    outfile: 'dist/tytx.browser.js',
    format: 'iife',
    globalName: 'TYTX',
    platform: 'browser',
    target: ['es2020'],
    minify: false,
    sourcemap: true,
    conditions: ['browser'],
    define: {
        'process.env.NODE_ENV': '"production"',
    },
});

console.log('Browser bundle created: dist/tytx.browser.js');
console.log('Usage: <script src="tytx.browser.js"></script>');
console.log('       TYTX.toTytx(...), TYTX.fromTytx(...)');
