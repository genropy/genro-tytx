// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * Build script for browser bundle.
 *
 * Creates a single bundle that works in browsers.
 * For Node.js, use the source files directly.
 */

import * as esbuild from 'esbuild';

// Plugin to handle Node.js 'module' import for browser
const nodeModulePlugin = {
    name: 'node-module-shim',
    setup(build) {
        // Replace 'module' with a shim that returns a no-op createRequire
        build.onResolve({ filter: /^module$/ }, () => ({
            path: 'module',
            namespace: 'node-module-shim',
        }));

        build.onLoad({ filter: /.*/, namespace: 'node-module-shim' }, () => ({
            contents: `
                // Browser shim for Node.js 'module' package
                export function createRequire() {
                    // In browser, return a require that always throws
                    return function browserRequire(id) {
                        throw new Error(\`Cannot require '\${id}' in browser environment\`);
                    };
                }
            `,
            loader: 'js',
        }));
    },
};

await esbuild.build({
    entryPoints: ['src/index.js'],
    bundle: true,
    outfile: 'dist/tytx.browser.js',
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    minify: false,
    sourcemap: true,
    plugins: [nodeModulePlugin],
    define: {
        'process.env.NODE_ENV': '"production"',
    },
});

console.log('Browser bundle created: dist/tytx.browser.js');
