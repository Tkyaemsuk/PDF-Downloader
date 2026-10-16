// An explicit page container owns its header, body and signature area.
// No automatic guessing from report titles or customer-specific text.
export function findFormPages(root, options = {}) {
  if (options.paginationMode === 'single' || options.paginationMode === 'multiple') return []
  const selector = String(options.pageSelector || '.pdf-page').trim() || '.pdf-page'
  let matches
  try { matches = [...root.querySelectorAll(selector)]; if (root.matches(selector)) matches.unshift(root) }
  catch { throw new Error('CSS selector ของหน้าแบบฟอร์มไม่ถูกต้อง') }
  const pages = matches.filter(el => {
    const style = root.ownerDocument.defaultView.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
  if (pages.some(a => pages.some(b => a !== b && a.contains(b)))) {
    throw new Error('หน้าแบบฟอร์มซ้อนกัน กรุณาใส่ pdf-page เฉพาะ Container ชั้นนอกของแต่ละชุด')
  }
  const visible = pages.map(el => {
    // Budibase's component wrapper uses display:contents; select its rendered child.
    if (root.ownerDocument.defaultView.getComputedStyle(el).display === 'contents') {
      const children = [...el.children].filter(child => child.getBoundingClientRect().width > 0)
      if (children.length !== 1) throw new Error('กรุณาเลือก Container ที่มีขนาดจริงสำหรับหน้าแบบฟอร์ม')
      return children[0]
    }
    return el
  }).filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
  if (!visible.length && options.paginationMode === 'forms') {
    throw new Error('ไม่พบหน้าแบบฟอร์ม กรุณาใส่ class pdf-page ให้ Container ของแต่ละชุด หรือกำหนด CSS selector ของหน้าแบบฟอร์ม')
  }
  if (visible.length > 100) throw new Error('เอกสารเกิน 100 หน้า กรุณาแบ่งข้อมูลก่อนดาวน์โหลด')
  return visible
}

export function formRegions(root, elements, quality) {
  const origin = root.getBoundingClientRect()
  const rects = elements.map(el => el.getBoundingClientRect())
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    if (r.left < origin.left - 1 || r.right > origin.right + 1 || r.top < origin.top - 1 || r.bottom > origin.bottom + 1) {
      throw new Error('หน้าแบบฟอร์มเกินขอบเอกสาร กรุณาตรวจขนาดและ overflow ของ Container')
    }
    for (const other of rects.slice(i + 1)) {
      if (Math.min(r.right, other.right) - Math.max(r.left, other.left) > 1 && Math.min(r.bottom, other.bottom) - Math.max(r.top, other.top) > 1) {
        throw new Error('หน้าแบบฟอร์มทับกัน กรุณาแยก Container แต่ละชุด')
      }
    }
  }
  return rects.map(r => {
    const left = Math.max(0, Math.floor((r.left - origin.left) * quality))
    const top = Math.max(0, Math.floor((r.top - origin.top) * quality))
    return { left, start: top, width: Math.ceil((r.right - origin.left) * quality) - left, height: Math.ceil((r.bottom - origin.top) * quality) - top }
  })
}
