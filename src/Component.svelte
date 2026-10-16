<script>
  import { getContext } from 'svelte'
  import { writable } from 'svelte/store'
  import { downloadPdf } from './export.js'

  export let targetSelector = ''
  export let fileName = 'document'
  export let paperSize = 'A4'
  export let orientation = 'portrait'
  export let paginationMode = 'auto'
  export let pageSelector = '.pdf-page'
  export let margin = 12
  export let quality = 2
  export let fitLogo = true
  export let logoSelector = ''
  export let logoMaxWidth = 28
  export let logoMaxHeight = 20
  export let startDateLabel = 'วันที่เริ่มใช้งาน'
  export let startDate = ''
  export let documentCodeLabel = 'รหัสเอกสาร'
  export let documentCode = ''
  export let showPageNumbers = true
  export let footerFontSize = 9
  export let watermarkText = ''
  export let watermarkImage = ''
  export let watermarkOpacity = 0.08
  export let watermarkAngle = -30
  export let disabled = false

  const sdk = getContext('sdk') || {}
  const component = getContext('component') || writable({ styles: {} })
  const styleable = sdk.styleable || (() => ({}))
  let content, busy = false, status = '', error = ''
  async function download() {
    if (busy || disabled) return
    busy = true; error = ''; status = 'กำลังเตรียมเอกสาร…'
    try {
      let target = content
      if (String(targetSelector).trim()) {
        let matches
        try { matches = document.querySelectorAll(targetSelector) } catch { throw new Error('CSS selector ไม่ถูกต้อง') }
        if (matches.length !== 1) throw new Error('CSS selector ต้องตรงกับส่วนเอกสารเพียงหนึ่งรายการ')
        target = matches[0]
      }
      const count = await downloadPdf(target, { fileName, paperSize, orientation, paginationMode, pageSelector, margin, quality, fitLogo, logoSelector, logoMaxWidth, logoMaxHeight, startDateLabel, startDate, documentCodeLabel, documentCode, showPageNumbers, footerFontSize, watermarkText, watermarkImage, watermarkOpacity, watermarkAngle }, value => status = value)
      status = `ดาวน์โหลด PDF สำเร็จ ${count} หน้า`
    } catch (e) {
      error = e.message || 'สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่'
      status = ''
    } finally { busy = false }
  }
</script>

<div class="pdf-downloader" use:styleable={$component.styles}>
  <div class="toolbar" data-pdf-ignore>
    <button type="button" on:click={download} disabled={disabled || busy} aria-busy={busy}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5" /></svg>
      {busy ? 'กำลังสร้าง PDF…' : 'PDF Download'}
    </button>
    <span class="status" role="status" aria-live="polite">{status}</span>
    {#if error}<span class="error" role="alert">{error}</span>{/if}
  </div>
  <div class="document pdf-document" bind:this={content}><slot /></div>
</div>

<style>
  .pdf-downloader { width: 100%; min-width: 0; box-sizing: border-box; }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 4px 0 14px; }
  button { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 40px; max-width: 100%; padding: 10px 18px; border: 1px solid transparent; border-radius: 8px; background: var(--spectrum-global-color-blue-600, #2563eb); color: white; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px #0f172a14; }
  button:hover:not(:disabled) { filter: brightness(.92); }
  button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
  button:disabled { opacity: .6; cursor: not-allowed; }
  svg { flex-shrink: 0; }
  .document { min-width: 0; width: 100%; }
  .status, .error { font-size: 12px; overflow-wrap: anywhere; }
  .status { color: #475569; }
  .error { color: #b91c1c; }
</style>
