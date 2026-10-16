export function number(value, fallback, min, max) {
  const n = value === '' || value == null ? fallback : Number(value)
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback))
}
export function geometry(options = {}) {
  let [width, height] = options.paperSize === 'Letter' ? [215.9, 279.4] : [210, 297]
  if (options.orientation === 'landscape') [width, height] = [height, width]
  const margin = number(options.margin, 12, 5, 30)
  const footer = 16
  return { width, height, margin, footer, bodyWidth: width - margin * 2, bodyHeight: height - margin * 2 - footer }
}
// Keep ordinary rows/paragraphs together. Oversize blocks must be sliced to make progress.
export function paginate(height, capacity, blocks = [], forced = []) {
  if (!(height > 0 && capacity >= 1)) throw new Error('Invalid page dimensions')
  const pages = []
  let start = 0
  while (start < height) {
    let end = Math.min(height, start + capacity)
    const explicit = forced.filter(y => y > start + 1 && y < end).sort((a, b) => a - b)[0]
    if (explicit != null) end = explicit
    if (end < height) {
      // Iteration handles overlapping blocks in multi-column layouts.
      let changed = true
      while (changed) {
        changed = false
        for (const b of blocks) {
          if (b.top > start + 1 && b.top < end && b.bottom > end && b.bottom - b.top <= capacity) {
            end = b.top
            changed = true
          }
        }
      }
    }
    end = Math.max(start + 1, Math.floor(end))
    pages.push({ start, height: end - start })
    start = end
    if (pages.length > 100) throw new Error('เอกสารเกิน 100 หน้า กรุณาแบ่งข้อมูลก่อนดาวน์โหลด')
  }
  return pages
}
export function filename(value) {
  return (String(value || 'document').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').slice(0, 120) || 'document') + '.pdf'
}
