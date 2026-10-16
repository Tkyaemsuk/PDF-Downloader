import App from './App.svelte'
import * as svelte from 'svelte'
import * as internal from 'svelte/internal'
import * as store from 'svelte/store'
Object.assign(window, { svelte, svelte_internal: internal })
new App({ target: document.getElementById('app') })
