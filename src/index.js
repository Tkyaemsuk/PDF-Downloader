import Component from './Component.svelte'
import schema from '../schema.json'
import pkg from '../package.json'
const plugin = { Component, schema, version: pkg.version }
if (typeof window !== 'undefined') {
  const key = '##BUDIBASE_CUSTOM_COMPONENTS##'
  ;(window[key] ||= []).push(plugin)
  if (window.registerCustomComponent) window.registerCustomComponent(plugin)
}
export { Component, schema }
export const version = pkg.version
