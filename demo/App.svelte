<script>
  import Component from '../src/Component.svelte'
  import { createPdf } from '../src/export.js'
  window.createPdf = createPdf
  let orientation = 'portrait'
  let component
  window.setOptions = options => component.$set(options)
</script>
<main>
  <header data-pdf-ignore><div><small>BUDIBASE COMPONENT · SVELTE 3</small><h1>PDF Downloader</h1><p>จัดเอกสารให้พร้อมใช้งาน พร้อมเลขหน้าและลายน้ำ</p></div><select aria-label="แนวกระดาษ" bind:value={orientation}><option value="portrait">A4 · แนวตั้ง</option><option value="landscape">A4 · แนวนอน</option></select></header>
  <Component bind:this={component} {orientation} startDate="16/10/2569" documentCode="DOC-2026-001" watermarkText="เอกสารภายใน" fileName="รายงานเอกสาร">
    <article id="report">
      <div class="heading"><div><small>DOCUMENT REPORT</small><h2>รายงานสรุปการดำเนินงาน</h2><p>ตัวอย่างเอกสารภาษาไทย • PDF Downloader</p></div><span class="badge">อนุมัติแล้ว</span></div>
      <div class="grid"><section><small>หน่วยงาน</small><h3>ฝ่ายปฏิบัติการ</h3><p>กรุงเทพมหานคร ประเทศไทย</p></section><section><small>รายละเอียดเอกสาร</small><h3>DOC-2026-001</h3><p>วันที่เริ่มใช้งาน 16 ตุลาคม 2569</p></section></div>
      <h3>รายละเอียดรายการ</h3>
      <table><thead><tr><th>ลำดับ</th><th>รายการ</th><th>สถานะ</th><th>จำนวน</th></tr></thead><tbody>{#each Array(52) as _, i}<tr><td>{i + 1}</td><td>รายการเอกสารและข้อมูลการดำเนินงาน {i + 1}</td><td>ตรวจสอบแล้ว</td><td>{(i + 1) * 10}</td></tr>{/each}</tbody></table>
      <section data-pdf-keep class="note"><h3>หมายเหตุ / Notes</h3><p>เอกสารนี้แสดงการจัดหน้าอัตโนมัติ ตาราง และข้อความภาษาไทย โดยรักษาสัดส่วนเดิมและเว้นพื้นที่ท้ายกระดาษทุกหน้า</p></section>
    </article>
  </Component>
</main>
<style>
  :global(body) { margin: 0; background: #eef2f7; color: #17243a; font: 15px "Noto Sans Thai", Tahoma, sans-serif; }
  :global(*) { box-sizing: border-box; }
  main { max-width: 1120px; margin: 48px auto; padding: 0 24px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 28px; }
  small { color: #667991; font-size: 11px; letter-spacing: 1px; }
  h1 { margin: 8px 0; font-size: 32px; } p { color: #64748b; }
  select { border: 1px solid #cbd5e1; padding: 10px; border-radius: 7px; background: white; }
  article { background: white; padding: 36px; border: 1px solid #e2e8f0; border-radius: 12px; }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  h2 { font-size: 25px; margin: 10px 0; } h3 { font-size: 16px; }
  .badge { padding: 6px 12px; border-radius: 20px; background: #ecfdf5; color: #047857; white-space: nowrap; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 30px 0; }
  section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #eef2f7; text-align: left; } th, td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; }
  td:last-child, th:last-child { text-align: right; }
  .note { margin-top: 24px; }
  @media(max-width: 600px) { header, .heading { flex-wrap: wrap; } .grid { grid-template-columns: 1fr; } article { padding: 16px; } main { padding: 0 12px; } }
</style>
