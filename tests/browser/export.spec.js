import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFile, writeFile } from 'node:fs/promises'
import pkg from '../../package.json' with { type: 'json' }
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
  const result = await page.evaluate(packageName => {
    // Budibase server identifies components by package.name; client registers schema.schema.name.
    const manifest = Object.fromEntries(window['##BUDIBASE_CUSTOM_COMPONENTS##'].map(p => [`plugin/${p.schema.schema.name}`, p]))
    const plugin = manifest[`plugin/${packageName}`]
    if (!plugin) throw new Error(`Budibase cannot resolve plugin/${packageName}`)
    const target = document.createElement('div'); document.body.append(target)
    new plugin.Component({ target, props: { targetSelector: '#report', fileName: 'packaged' } })
    return { name: plugin.schema.schema.name, major: plugin.schema.metadata.svelteMajor }
  }, pkg.name)
  expect(result).toEqual({name:pkg.name,major:3})
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

test('near-page signature area fits on one page and footer stays outside content', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const target = document.createElement('div')
    target.style.cssText = 'width:800px;height:1250px;position:relative;background:white'
    target.innerHTML = '<h2>รายงานผล</h2><div style="position:absolute;bottom:0;width:100%;height:90px;background:rgb(255,0,255)">Submit by / Supervisor / Date</div>'
    document.body.append(target)
    const original = HTMLCanvasElement.prototype.toDataURL
    let bounds
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      if (args[0] === 'image/png' && this.height > 1000) {
        const ctx = this.getContext('2d'), pixels = ctx.getImageData(0, 0, this.width, this.height).data
        let lastSignatureY = -1, firstSignatureY = -1, signatureX = -1
        for (let y=0;y<this.height;y++) for (let x=0;x<this.width;x++) {
          const i=(y*this.width+x)*4
          if (pixels[i]>240 && pixels[i+1]<20 && pixels[i+2]>240) {
            if(firstSignatureY<0) {firstSignatureY=y;signatureX=x}
            lastSignatureY=y
          }
        }
        bounds={ firstSignatureY,lastSignatureY,signatureX,width:this.width,height:this.height }
      }
      return original.apply(this,args)
    }
    try {
      const auto = await window.createPdf(target, { quality: 1 })
      const autoBounds = bounds
      const multiple = await window.createPdf(target, { quality: 1, paginationMode: 'multiple' })
      return { count:auto.pageCount, multiple:multiple.pageCount, bounds:autoBounds }
    } finally { HTMLCanvasElement.prototype.toDataURL=original;target.remove() }
  })
  expect(result.count).toBe(1)
  expect(result.multiple).toBe(2)
  expect(result.bounds.firstSignatureY).toBeGreaterThan(0)
  // Bottom of the form must remain above the 16mm footer band and 12mm margin.
  expect(result.bounds.lastSignatureY).toBeLessThan(result.bounds.height * 270 / 297)
  expect(result.bounds.lastSignatureY-result.bounds.firstSignatureY).toBeGreaterThan(60)
  expect(result.bounds.signatureX).toBeGreaterThan(result.bounds.width * 12 / 210)

  await page.evaluate(() => window.setOptions({ paginationMode:'single', fileName:'single-page' }))
  const download=page.waitForEvent('download')
  await page.getByRole('button',{name:'PDF Download',exact:true}).click()
  const pdf=await PDFDocument.load(await readFile(await (await download).path()))
  expect(pdf.getPageCount()).toBe(1)
})

test('header logo retains intrinsic ratio in PDF without changing source or body images', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const c=document.createElement('canvas');c.width=100;c.height=100
    const ctx=c.getContext('2d');ctx.fillStyle='rgb(255,0,255)';ctx.fillRect(0,0,100,100)
    const root=document.createElement('div');root.style.cssText='width:800px;height:900px;background:white'
    root.innerHTML=`<header style="display:flex;align-items:center"><img id="logo" src="${c.toDataURL()}" style="width:140px;height:60px"><h2>Company report</h2></header><div style="height:450px"></div><img id="body-image" src="${c.toDataURL()}" style="width:140px;height:60px">`
    document.body.append(root)
    await Promise.all(Array.from(root.querySelectorAll('img')).map(img=>img.decode()))
    const before=root.innerHTML
    const original=HTMLCanvasElement.prototype.toDataURL
    let box
    HTMLCanvasElement.prototype.toDataURL=function(...args){
      if(args[0]==='image/png' && this.height>1000){
        const p=this.getContext('2d').getImageData(0,0,this.width,Math.floor(this.height/3)).data
        let left=this.width,right=-1,top=this.height,bottom=-1
        for(let y=0;y<this.height/3-1;y++)for(let x=0;x<this.width;x++){
          const i=(y*this.width+x)*4
          if(p[i]>240&&p[i+1]<20&&p[i+2]>240){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
        }
        box={width:right-left+1,height:bottom-top+1}
      }
      return original.apply(this,args)
    }
    try{
      await window.createPdf(root,{quality:1})
      const automatic=box
      await window.createPdf(root,{quality:1,logoSelector:'#logo',logoMaxWidth:8})
      const smaller=box
      await window.createPdf(root,{quality:1,fitLogo:false})
      const disabled=box
      let error=''
      try{await window.createPdf(root,{logoSelector:'#missing'})}catch(e){error=e.message}
      return {automatic,smaller,disabled,unchanged:before===root.innerHTML,error}
    }finally{HTMLCanvasElement.prototype.toDataURL=original;root.remove()}
  })
  expect(result.automatic.width).toBeGreaterThan(20)
  expect(Math.abs(result.automatic.width-result.automatic.height)).toBeLessThanOrEqual(1)
  expect(result.smaller.width).toBeLessThan(result.automatic.width)
  expect(result.disabled.width/result.disabled.height).toBeGreaterThan(2)
  expect(result.unchanged).toBe(true)
  expect(result.error).toContain('หนึ่งรายการ')
})

test('two logical forms keep both logos and signatures on their own PDF pages', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const logo=document.createElement('canvas');logo.width=100;logo.height=100
    const logoCtx=logo.getContext('2d');logoCtx.fillStyle='rgb(255,0,255)';logoCtx.fillRect(0,0,100,100)
    const root=document.createElement('div');root.style.cssText='width:800px;display:flex;flex-direction:column;gap:64px;background:rgb(255,0,0)'
    root.innerHTML=[1100,1300].map((height,i)=>`<section class="pdf-page" style="height:${height}px;position:relative;background:white;flex-shrink:0"><header class="pdf-header" style="display:flex;align-items:center;height:90px"><img class="pdf-logo" src="${logo.toDataURL()}" style="width:140px;height:60px"><h2>Form ${i+1}</h2></header><div style="padding:20px">Independent report body</div><div class="pdf-signatures" style="position:absolute;bottom:0;height:90px;width:100%;background:rgb(0,255,0)">Supervisor / Signature ${i+1}</div></section>`).join('')
    document.body.append(root)
    await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode()))
    const before=root.innerHTML
    const original=HTMLCanvasElement.prototype.toDataURL
    let captured=[]
    HTMLCanvasElement.prototype.toDataURL=function(...args){
      if(args[0]==='image/png'&&this.height>1000){
        const data=this.getContext('2d').getImageData(0,0,this.width,this.height).data
        const logo={left:this.width,right:-1,top:this.height,bottom:-1};let signature=0,signatureBottom=-1,gap=0
        for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){
          const i=(y*this.width+x)*4,r=data[i],g=data[i+1],b=data[i+2]
          if(r>240&&g<20&&b>240){logo.left=Math.min(logo.left,x);logo.right=Math.max(logo.right,x);logo.top=Math.min(logo.top,y);logo.bottom=Math.max(logo.bottom,y)}
          if(r<20&&g>240&&b<20){signature++;signatureBottom=y}
          if(r>240&&g<20&&b<20)gap++
        }
        captured.push({logoWidth:logo.right-logo.left+1,logoHeight:logo.bottom-logo.top+1,logoTop:logo.top,signature,signatureBottom,gap,height:this.height})
      }
      return original.apply(this,args)
    }
    try{
      const auto=await window.createPdf(root,{quality:1})
      const images=captured
      captured=[]
      const forms=await window.createPdf(root,{quality:1,paginationMode:'forms'})
      let missing=''
      try {await window.createPdf(root,{quality:1,paginationMode:'forms',pageSelector:'.missing'})}catch(e){missing=e.message}
      // Explicit page semantics must work on Budibase display:contents wrappers too.
      root.querySelectorAll('.pdf-page').forEach(el=>{el.className='';const wrapper=document.createElement('div');wrapper.className='pdf-page';wrapper.style.display='contents';el.replaceWith(wrapper);wrapper.append(el)})
      const wrappers=await window.createPdf(root,{quality:1,paginationMode:'forms'})
      return {count:auto.pageCount,forms:forms.pageCount,wrappers:wrappers.pageCount,images,missing,before}
    } finally { HTMLCanvasElement.prototype.toDataURL=original;root.remove() }
  })
  expect(result.count).toBe(2)
  expect(result.forms).toBe(2)
  expect(result.wrappers).toBe(2)
  expect(result.images).toHaveLength(2)
  for(const image of result.images){
    expect(image.logoWidth).toBeGreaterThan(20)
    expect(Math.abs(image.logoWidth-image.logoHeight)).toBeLessThanOrEqual(1)
    expect(image.logoTop).toBeLessThan(100)
    expect(image.signature).toBeGreaterThan(1000)
    expect(image.signatureBottom).toBeLessThan(image.height*270/297)
    expect(image.gap).toBe(0)
  }
  expect(result.missing).toContain('ไม่พบหน้าแบบฟอร์ม')
})
