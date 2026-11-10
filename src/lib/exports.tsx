import { renderToStaticMarkup } from 'react-dom/server'
import { jsPDF } from 'jspdf'
import { TreePrint } from '../components/Artwork'
import { BookArtwork } from '../components/BookArtwork'
import { layoutTree } from './tree'
import { projectTheme } from './themes'
import { bookPages } from './book'
import { download } from './storage'
import type { Project } from './types'
import interURL from '@fontsource/inter/files/inter-latin-400-normal.woff2?url'
import cormorantURL from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2?url'
let fontPromise: Promise<string> | undefined
function dataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Unable to read generated artwork.'))
    r.readAsDataURL(blob)
  })
}
export function embeddedFonts() {
  fontPromise ??= Promise.all(
    [
      ['Inter', interURL],
      ['Cormorant Garamond', cormorantURL],
    ].map(async ([family, url]) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Unable to load the export fonts.')
      return `@font-face{font-family:'${family}';src:url('${await dataURL(await response.blob())}') format('woff2');font-weight:100 900;}`
    }),
  ).then((parts) => parts.join('\n'))
  return fontPromise
}
export async function rasterize(svg: string, width: number, height: number, scale: number) {
  if (width * height * scale * scale > 64000000 || Math.max(width, height) * scale > 16384)
    throw new Error(
      'This tree is too large at that resolution. Choose a lower resolution or export SVG for unlimited detail.',
    )
  const img = new Image(),
    url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('The artwork could not be rendered.'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * scale)
    canvas.height = Math.ceil(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('The browser cannot create the export canvas.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}
export async function exportTree(
  project: Project,
  format: 'svg' | 'png' | 'jpeg' | 'pdf',
  scale: number,
  title: string,
  subtitle: string,
) {
  await document.fonts.ready
  const layout = layoutTree(project),
    theme = projectTheme(project),
    width = Math.max(760, layout.width),
    height = layout.height + (title || subtitle ? 160 : 35) + 35
  const svg = renderToStaticMarkup(
      <TreePrint
        project={project}
        layout={layout}
        theme={theme}
        title={title}
        subtitle={subtitle}
        fontCSS={await embeddedFonts()}
      />,
    ),
    filename =
      (title || 'Family tree').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80) || 'Family tree'
  if (format === 'svg') {
    download(svg, filename + '.svg', 'image/svg+xml')
    return
  }
  const canvas = await rasterize(svg, width, height, scale)
  if (format === 'pdf') {
    const factor = Math.min(1, 4000 / Math.max(width, height)),
      w = width * factor,
      h = height * factor
    const doc = new jsPDF({
      orientation: w > h ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [w, h],
      compress: true,
    })
    doc.addImage(canvas, 'PNG', 0, 0, w, h)
    doc.save(filename + '.pdf')
  } else {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, format === 'png' ? 'image/png' : 'image/jpeg', 0.95),
    )
    if (!blob) throw new Error('Unable to encode the export.')
    download(blob, filename + '.' + (format === 'jpeg' ? 'jpg' : 'png'), blob.type)
  }
}
export async function exportBook(project: Project, onProgress: (n: number, total: number) => void) {
  await document.fonts.ready
  const pages = bookPages(project)
  if (!pages.length) throw new Error('Select at least one person for the book.')
  const theme = projectTheme(project),
    fontCSS = await embeddedFonts(),
    doc = new jsPDF({
      orientation: project.book.landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: project.book.size,
      compress: true,
    })
  doc.setProperties({ title: project.book.title, creator: 'Gedcomber' })
  for (let i = 0; i < pages.length; i++) {
    if (i) doc.addPage(project.book.size, project.book.landscape ? 'landscape' : 'portrait')
    const p = pages[i],
      svg = renderToStaticMarkup(
        <BookArtwork page={p} project={project} theme={theme} index={i} fontCSS={fontCSS} />,
      ),
      canvas = await rasterize(svg, p.width, p.height, 2.5)
    doc.addImage(
      canvas,
      'JPEG',
      0,
      0,
      doc.internal.pageSize.getWidth(),
      doc.internal.pageSize.getHeight(),
      undefined,
      'FAST',
    )
    canvas.width = 0
    canvas.height = 0
    onProgress(i + 1, pages.length)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  doc.save(
    (project.book.title || 'Ancestry book').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80) + '.pdf',
  )
}
