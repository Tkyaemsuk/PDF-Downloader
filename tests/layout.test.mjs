import { test } from 'node:test'
import assert from 'node:assert/strict'
import { geometry, paginate, filename, number } from '../src/layout.js'
test('page formats reserve margin and footer, including malformed bound values', () => {
  const a = geometry({ margin: 'invalid' })
  assert.equal(a.bodyWidth, 186); assert.equal(a.bodyHeight, 257)
  const b = geometry({ paperSize: 'Letter', orientation: 'landscape', margin: 500 })
  assert.equal(b.width, 279.4); assert.equal(b.margin, 30)
  assert.equal(number('', 2, 1, 3), 2)
})
test('rows do not straddle page boundaries; no pixels omitted or duplicated', () => {
  const pages = paginate(2500, 1000, [{ top: 950, bottom: 1050 }, { top: 1850, bottom: 2000 }])
  assert.deepEqual(pages, [{start:0,height:950},{start:950,height:900},{start:1850,height:650}])
  assert.equal(pages.reduce((sum,p)=>sum+p.height,0),2500)
})
test('oversized blocks split; explicit breaks and exact page endings work', () => {
  assert.equal(paginate(2000,1000,[{top:0,bottom:2000}]).length,2)
  assert.deepEqual(paginate(1500,1000,[],[500]), [{start:0,height:500},{start:500,height:1000}])
  assert.throws(()=>paginate(5,0))
  assert.throws(()=>paginate(501,1), /500/)
})
test('download filename stays usable and preserves Thai', () => {
  assert.equal(filename('รายงาน/2569.pdf'),'รายงาน-2569.pdf')
  assert.equal(filename(''),'document.pdf')
})

test('auto-fit keeps a near-page form and its signature area together, inside body bounds', async () => {
  const { planPages } = await import('../src/layout.js')
  for (const orientation of ['portrait', 'landscape']) {
    const page = geometry({ orientation })
    const width = 800, height = Math.ceil(width * page.bodyHeight / page.bodyWidth * 1.15)
    const result = planPages(width, height, page)
    assert.equal(result.pages.length, 1)
    assert.equal(result.pages[0].height, height)
    assert.ok(height * result.scale <= page.bodyHeight + 1e-9)
    assert.ok(result.x >= page.margin)
    assert.ok(Math.abs(result.x * 2 + width * result.scale - page.width) < 1e-9)
    assert.ok(planPages(width, height, page, 'multiple').pages.length > 1)
  }
})
test('long reports stay multipage, explicit breaks are respected, single-page mode fits all content', async () => {
  const { planPages } = await import('../src/layout.js')
  const page = geometry()
  assert.ok(planPages(800, 3000, page).pages.length > 1)
  const fit = planPages(800, 3000, page, 'single', [], [1000])
  assert.equal(fit.pages.length, 1)
  assert.equal(fit.pages[0].height, 3000)
  assert.ok(fit.scale * 3000 <= page.bodyHeight + 1e-9)
  assert.equal(planPages(800, 500, page, 'auto', [], [250]).pages.length, 2)
})
