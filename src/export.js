import html2canvas from 'html2canvas'
import { PDFDocument } from 'pdf-lib'
import { geometry, number, paginate, filename } from './layout.js'

async function loadImage(url) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('โหลดรูปลายน้ำหมดเวลา')), 15000)
    image.onload = () => { clearTimeout(timeout); resolve() }
    image.onerror = () => { clearTimeout(timeout); reject(new Error('โหลดรูปลายน้ำไม่ได้ กรุณาตรวจ URL และ CORS')) }
    image.src = url
  })
  return image
}
function canvas(width, height) {
  const result = document.createElement('canvas')
  result.width = Math.ceil(width)
  result.height = Math.ceil(height)
  if (!result.getContext('2d')) throw new Error('เบราว์เซอร์ไม่รองรับ Canvas')
  return result
}
function footerText(ctx, text, x, y, width, align, size, font) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x - (align === 'right' ? width : align === 'center' ? width / 2 : 0), y - size * 1.5, width, size * 3)
  ctx.clip()
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#475569'
  ctx.font = `${size}px ${font}`
  // Fit within each independent column, retaining the whole label/value.
  const measured = ctx.measureText(text).width
  if (measured > width) ctx.font = `${Math.max(size * 0.65, size * width / measured)}px ${font}`
  const words = Array.from(text)
  while (words.length && ctx.measureText(words.join('')).width > width) words.pop()
  const fitted = words.length < text.length ? words.slice(0, -1).join('') + '…' : text
  ctx.fillText(fitted, x, y)
  ctx.restore()
}

export async function createPdf(target, options = {}, progress = () => {}) {
  if (!(target instanceof HTMLElement) || !target.isConnected) throw new Error('ไม่พบส่วนเอกสารที่ต้องการส่งออก')
  if (!target.textContent.trim() && !target.querySelector('img,canvas,svg,input,textarea')) throw new Error('กรุณาเพิ่ม components เอกสารภายใน PDF Downloader หรือระบุ CSS selector')
  await document.fonts.ready
  // Wait for images actually present in the selected document; never silently export broken images.
  await Promise.all(Array.from(target.querySelectorAll('img')).map(async img => {
    if (img.currentSrc || img.src) {
      try { await img.decode() } catch { throw new Error('โหลดรูปภาพในเอกสารไม่สำเร็จ') }
    }
  }))
  const g = geometry(options)
  const watermark = options.watermarkImage ? await loadImage(options.watermarkImage) : null
  let blocks = [], forced = []
  const quality = number(options.quality, 2, 1, 3)
  progress('กำลังจัดหน้าเอกสาร…')
  let cloneFrame
  const capture = await html2canvas(target, {
    scale: quality, useCORS: true, allowTaint: false, backgroundColor: '#ffffff',
    logging: false, imageTimeout: 15000,
    ignoreElements: element => element.hasAttribute('data-pdf-ignore'),
    onclone: async (doc, clone) => {
      cloneFrame = doc.defaultView.frameElement
      // Expand scrolling containers in the clone, leaving the live Budibase screen untouched.
      for (const el of [clone, ...clone.querySelectorAll('*')]) {
        const style = doc.defaultView.getComputedStyle(el)
        if (['auto', 'scroll'].includes(style.overflowY)) {
          el.style.setProperty('height', 'auto', 'important')
          el.style.setProperty('max-height', 'none', 'important')
          el.style.setProperty('overflow-y', 'visible', 'important')
        }
        if (['auto', 'scroll'].includes(style.overflowX)) el.style.setProperty('overflow-x', 'visible', 'important')
        if (['fixed', 'sticky'].includes(style.position)) el.style.setProperty('position', 'static', 'important')
        el.style.setProperty('animation', 'none', 'important')
        el.style.setProperty('transition', 'none', 'important')
      }
      // Include wide tables without changing the responsive viewport or grid configuration.
      clone.style.setProperty('width', `${Math.max(clone.getBoundingClientRect().width, clone.scrollWidth)}px`, 'important')
      clone.style.setProperty('max-width', 'none', 'important')
      await doc.fonts.ready
      const rect = clone.getBoundingClientRect()
      if (!rect.width || !rect.height) throw new Error('ส่วนเอกสารถูกซ่อนหรือไม่มีขนาด')
      if (rect.width * quality > 16000 || rect.height * quality > 16000 || rect.width * rect.height * quality * quality > 32000000) {
        throw new Error('เอกสารมีขนาดใหญ่เกินไป กรุณาลดความละเอียดหรือแบ่งข้อมูลเป็นชุดเล็กลง')
      }
      const candidates = clone.querySelectorAll('tr,p,h1,h2,h3,h4,h5,h6,img,svg,canvas,[data-pdf-keep]')
      blocks = Array.from(candidates).map(el => {
        const r = el.getBoundingClientRect()
        return { top: Math.floor((r.top - rect.top) * quality), bottom: Math.ceil((r.bottom - rect.top) * quality) }
      })
      forced = Array.from(clone.querySelectorAll('[data-pdf-break-before]')).map(el => Math.floor((el.getBoundingClientRect().top - rect.top) * quality))
      // html2canvas skips inaccessible cross-origin images. Detect this instead of losing them silently.
      for (const img of clone.querySelectorAll('img')) {
        const source = img.currentSrc || img.src
        if (source && !source.startsWith('data:') && !source.startsWith('blob:') && new URL(source, doc.baseURI).origin !== location.origin) await loadImage(source)
      }
    }
  }).catch(error => { cloneFrame?.remove(); throw error })
  const pages = paginate(capture.height, Math.floor(capture.width * g.bodyHeight / g.bodyWidth), blocks, forced)
  const pdf = await PDFDocument.create()
  pdf.setTitle(String(options.fileName || 'document'))
  pdf.setCreator('PDF Downloader — Budibase 3.4.1 / Svelte 3')
  const pxPerMm = Math.min(10, capture.width / g.bodyWidth)
  const font = getComputedStyle(target).fontFamily || 'sans-serif'
  for (let i = 0; i < pages.length; i++) {
    progress(`กำลังสร้าง PDF ${i + 1}/${pages.length}…`)
    const pageCanvas = canvas(g.width * pxPerMm, g.height * pxPerMm)
    const ctx = pageCanvas.getContext('2d')
    const m = g.margin * pxPerMm, bodyWidth = g.bodyWidth * pxPerMm
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    const slice = pages[i]
    ctx.drawImage(capture, 0, slice.start, capture.width, slice.height, m, m, bodyWidth, slice.height / capture.width * bodyWidth)
    // Low-opacity watermark over the captured background remains visible on opaque Budibase cards.
    // It is restricted to the document body and never covers the footer.
    if (options.watermarkText || watermark) {
      ctx.save()
      ctx.beginPath(); ctx.rect(m, m, bodyWidth, g.bodyHeight * pxPerMm); ctx.clip()
      ctx.globalAlpha = number(options.watermarkOpacity, 0.08, 0, 0.3)
      ctx.translate(pageCanvas.width / 2, m + g.bodyHeight * pxPerMm / 2)
      ctx.rotate(number(options.watermarkAngle, -30, -180, 180) * Math.PI / 180)
      if (watermark) {
        const ratio = Math.min(bodyWidth * 0.55 / watermark.width, g.bodyHeight * pxPerMm * 0.45 / watermark.height)
        ctx.drawImage(watermark, -watermark.width * ratio / 2, -watermark.height * ratio / 2, watermark.width * ratio, watermark.height * ratio)
      }
      if (options.watermarkText) {
        const text = String(options.watermarkText)
        ctx.font = `600 ${12 * pxPerMm}px ${font}`
        const fit = Math.min(1, bodyWidth * 0.8 / ctx.measureText(text).width)
        ctx.font = `600 ${12 * pxPerMm * fit}px ${font}`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#64748b'
        ctx.fillText(text, 0, watermark ? 20 * pxPerMm : 0)
      }
      ctx.restore()
    }
    const footerY = (g.height - g.margin - 5) * pxPerMm
    ctx.strokeStyle = '#dbe2ea'; ctx.lineWidth = 0.2 * pxPerMm
    ctx.beginPath(); ctx.moveTo(m, footerY - 5 * pxPerMm); ctx.lineTo(pageCanvas.width - m, footerY - 5 * pxPerMm); ctx.stroke()
    const size = number(options.footerFontSize, 9, 7, 14) * 25.4 / 72 * pxPerMm
    const join = (label, value) => [label, value].filter(v => v != null && String(v).length).join(' ')
    footerText(ctx, join(options.startDateLabel ?? 'วันที่เริ่มใช้งาน', options.startDate), m, footerY, bodyWidth * 0.4, 'left', size, font)
    if (options.showPageNumbers !== false) footerText(ctx, `${i + 1}/${pages.length}`, pageCanvas.width / 2, footerY, bodyWidth * 0.16, 'center', size, font)
    footerText(ctx, join(options.documentCodeLabel ?? 'รหัสเอกสาร', options.documentCode), pageCanvas.width - m, footerY, bodyWidth * 0.4, 'right', size, font)
    const img = await pdf.embedPng(pageCanvas.toDataURL('image/png'))
    const page = pdf.addPage([g.width * 72 / 25.4, g.height * 72 / 25.4])
    page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
    pageCanvas.width = pageCanvas.height = 0
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  capture.width = capture.height = 0
  return { bytes: await pdf.save(), pageCount: pages.length }
}
export async function downloadPdf(target, options, progress) {
  const result = await createPdf(target, options, progress)
  const url = URL.createObjectURL(new Blob([result.bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url; link.download = filename(options.fileName)
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return result.pageCount
}
