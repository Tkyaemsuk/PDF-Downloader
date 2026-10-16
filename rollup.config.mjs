import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'
export default {
  input: 'src/index.js',
  external: id => id === 'svelte' || id === 'svelte/internal',
  output: {
    file: 'dist/plugin.min.js', format: 'iife', name: 'plugin',
    globals: { svelte: 'svelte', 'svelte/internal': 'svelte_internal' }
  },
  plugins: [svelte({ emitCss: false }), resolve({ browser: true }), commonjs(), json(), terser()]
}
