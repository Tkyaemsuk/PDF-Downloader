import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFile, writeFile } from 'node:fs/promises'
test('Svelte button downloads a paginated A4 document and leaves source unchanged', async ({ page }) => {
  await page.goto('/')
  const before = await page.locator('#report').innerHTML()
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toDataURL
    window.pageImages = []
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      const data = original.apply(this, args)
      if (args[0] === 'image/png' && this.height > 1000) window.pageImages.push(data)
      return data
    }
  })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF Download', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('รายงานเอกสาร.pdf')
  await file.saveAs('test-results/sample-portrait.pdf')
  const images = await page.evaluate(() => window.pageImages)
  for (let i = 0; i < images.length; i++) await writeFile(`test-results/page-${i+1}.png`, Buffer.from(images[i].split(',')[1], 'base64'))
  const pdf = await PDFDocument.load(await readFile(await file.path()))
  expect(pdf.getPageCount()).toBeGreaterThan(1)
  for (const p of pdf.getPages()) { expect(p.getWidth()).toBeCloseTo(595.28, 1); expect(p.getHeight()).toBeCloseTo(841.89, 1) }
  await expect(page.getByRole('status')).toContainText(`สำเร็จ ${pdf.getPageCount()} หน้า`)
  expect(await page.locator('#report').innerHTML()).toBe(before)
  await expect(page.getByRole('button', { name: 'PDF Download', exact: true })).toBeEnabled()
})
test('landscape / letter, invalid selectors, image failures, disabled state', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.setOptions({ targetSelector: '#missing' }))
  await page.getByRole('button', { name: 'PDF Download', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('หนึ่งรายการ')
  await page.evaluate(() => window.setOptions({ targetSelector: '???' }))
  await page.getByRole('button', { name: 'PDF Download', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('ไม่ถูกต้อง')
  await page.evaluate(() => window.setOptions({ targetSelector: '#report', watermarkImage: '/missing-image.png' }))
  await page.getByRole('button', { name: 'PDF Download', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('ลายน้ำ')
  await page.evaluate(() => window.setOptions({ watermarkImage: '', orientation: 'landscape', paperSize: 'Letter', quality: 1 }))
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF Download', exact: true }).click()
  const pdf = await PDFDocument.load(await readFile(await (await download).path()))
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(792,1)
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(612,1)
  await page.evaluate(() => window.setOptions({ disabled: true }))
  await expect(page.getByRole('button', { name: 'PDF Download', exact: true })).toBeDisabled()
})
test('packaged IIFE registers and mounts using Svelte 3 host globals', async ({ page }) => {
  await page.goto('/')
  await page.addScriptTag({ url: '/dist/plugin.min.js' })
  const result = await page.evaluate(() => {
    const plugin = window['##BUDIBASE_CUSTOM_COMPONENTS##'][0]
    const target = document.createElement('div'); document.body.append(target)
    new plugin.Component({ target, props: { targetSelector: '#report', fileName: 'packaged' } })
    return { name: plugin.schema.schema.name, major: plugin.schema.metadata.svelteMajor }
  })
  expect(result).toEqual({name:'PDF Downloader',major:3})
  const download = page.waitForEvent('download')
  await page.getByRole('button', {name:'PDF Download',exact:true}).last().click()
  expect((await download).suggestedFilename()).toBe('packaged.pdf')
})

test('single page, image watermark, explicit breaks and oversize error cleanup', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const target = document.createElement('div')
    target.style.cssText = 'width:800px;background:white;padding:20px'
    target.innerHTML = '<h2>เอกสารทดสอบ</h2><p>Short document</p>'
    document.body.append(target)
    const logo = document.createElement('canvas'); logo.width = logo.height = 40
    const ctx = logo.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 40, 40)
    const single = await window.createPdf(target, { watermarkImage: logo.toDataURL(), watermarkText: 'ทดสอบ', quality: 1 })
    target.innerHTML += '<h2 data-pdf-break-before>Second page</h2><p>End</p>'
    const split = await window.createPdf(target, { quality: 1 })
    target.style.height = '20000px'
    let error = ''
    try { await window.createPdf(target, { quality: 1 }) } catch (e) { error = e.message }
    target.remove()
    return { single: single.pageCount, split: split.pageCount, error, frames: document.querySelectorAll('.html2canvas-container').length }
  })
  expect(result.single).toBe(1)
  expect(result.split).toBe(2)
  expect(result.error).toContain('ขนาดใหญ่')
  expect(result.frames).toBe(0)
})
