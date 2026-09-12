import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parse, compileTemplate } = require('@vue/compiler-sfc')
const { transformSync } = require('esbuild')
const root = path.resolve(import.meta.dirname, '..')
function collectVueFiles(directory) {
  const result = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...collectVueFiles(absolute))
    else if (entry.isFile() && entry.name.endsWith('.vue')) result.push(path.relative(root, absolute).replace(/\\/g, '/'))
  }
  return result
}

const targets = ['App.vue', ...collectVueFiles(path.join(root, 'pages'))]

let failed = false
for (const relative of targets) {
  const filename = path.join(root, relative)
  const source = fs.readFileSync(filename, 'utf8')
  const result = parse(source, { filename })
  if (result.errors.length) {
    failed = true
    console.error(`${relative}:`, result.errors)
    continue
  }
  const descriptor = result.descriptor
  try {
    if (descriptor.script) transformSync(descriptor.script.content, { loader: 'js' })
    if (descriptor.template) {
      const compiled = compileTemplate({
        source: descriptor.template.content,
        filename,
        id: relative
      })
      if (compiled.errors.length) throw new Error(compiled.errors.map(String).join('\n'))
    }
  } catch (error) {
    failed = true
    console.error(`${relative}:`, error.message || error)
  }
}

if (failed) process.exitCode = 1
else console.log(`Vue SFC validation OK: ${targets.length} files`)
