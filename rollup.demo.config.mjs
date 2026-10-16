import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
export default { input: 'demo/main.js', output: { file: 'demo/bundle.js', format: 'iife' }, plugins: [svelte({ emitCss: false }), resolve({ browser: true }), commonjs(), json()] }
