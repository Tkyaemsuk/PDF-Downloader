import { readFile, writeFile, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const schema = JSON.parse(await readFile('schema.json', 'utf8'))
if (schema.schema.name !== pkg.name) throw new Error('Budibase component schema.name must match package.name')
const hash = createHash('sha1').update(await readFile('dist/plugin.min.js')).digest('hex')
await writeFile('dist/schema.json', JSON.stringify({ ...schema, hash, version: pkg.version }, null, 2))
await copyFile('package.json', 'dist/package.json')
execFileSync('tar', ['-czf', `dist/${pkg.name}-${pkg.version}.tar.gz`, '-C', 'dist', 'plugin.min.js', 'schema.json', 'package.json'])
console.log(`Packaged dist/${pkg.name}-${pkg.version}.tar.gz`)
