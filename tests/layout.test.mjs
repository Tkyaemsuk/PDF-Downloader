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
  assert.throws(()=>paginate(101,1), /100/)
})
test('download filename stays usable and preserves Thai', () => {
  assert.equal(filename('รายงาน/2569.pdf'),'รายงาน-2569.pdf')
  assert.equal(filename(''),'document.pdf')
})
