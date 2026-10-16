import { number } from './layout.js'

// Resize only the selected header image in html2canvas's cloned document.
// Explicit pixel dimensions are used because canvas renderers may ignore object-fit.
export function fitHeaderLogo(root, options, page) {
  if (options.fitLogo === false) return
  const selector = String(options.logoSelector || '').trim()
  let image
  if (selector) {
    let matches
    try { matches = root.querySelectorAll(selector) } catch { throw new Error('CSS selector ของโลโก้ไม่ถูกต้อง') }
    if (matches.length !== 1) throw new Error('CSS selector ของโลโก้ต้องตรงหนึ่งรายการภายในเอกสาร')
    const selected = matches[0]
    const images = selected.tagName === 'IMG' ? [selected] : selected.querySelectorAll('img')
    if (images.length !== 1) throw new Error('ส่วนโลโก้ที่เลือกต้องมีรูป img เพียงหนึ่งรูป')
    image = images[0]
  } else {
    const bounds = root.getBoundingClientRect()
    image = Array.from(root.querySelectorAll('img')).find(img => {
      const rect = img.getBoundingClientRect()
      const style = root.ownerDocument.defaultView.getComputedStyle(img)
      return img.naturalWidth >= 24 && img.naturalHeight >= 24 && rect.width >= 24 && rect.height >= 24 &&
        rect.top >= bounds.top && rect.top - bounds.top <= Math.min(180, bounds.height * 0.2) &&
        style.visibility !== 'hidden' && style.display !== 'none'
    })
  }
  if (!image) return
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('โหลดโลโก้ไม่สำเร็จ')
  const rect = image.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const pxPerMm = root.getBoundingClientRect().width / page.bodyWidth
  // Retain the original allocated header space; never push neighbouring titles out.
  const maxWidth = Math.min(rect.width, number(options.logoMaxWidth, 28, 8, 60) * pxPerMm)
  const maxHeight = Math.min(rect.height, number(options.logoMaxHeight, 20, 8, 40) * pxPerMm)
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight)
  for (const [key, value] of Object.entries({
    width: `${image.naturalWidth * scale}px`, height: `${image.naturalHeight * scale}px`,
    'min-width': '0', 'min-height': '0', 'max-width': 'none', 'max-height': 'none',
    'object-fit': 'contain', 'object-position': 'center', 'flex-grow': '0', 'flex-shrink': '0',
    'align-self': 'center', 'vertical-align': 'middle'
  })) image.style.setProperty(key, value, 'important')
}
