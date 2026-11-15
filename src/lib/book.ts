import type { Person, Project } from './types'
import { formatDate, personName, plainStory } from './format'
import { projectTheme } from './themes'
import { composeBookBody, storyFont, type StoryRegion, type BookPicture } from './bookPhoto'
export type BookFactField =
  'birthDate' | 'birthPlace' | 'deathDate' | 'deathPlace' | 'occupation' | 'burialPlace' | 'notes'
export type BookPage = {
  kind?: 'contents' | 'divider'
  section?: string
  entries?: { label: string; page: number; section: boolean }[]
  pictures?: BookPicture[]
  composition?: string
  storyRegions?: StoryRegion[]
  person: Person
  continuation: number
  lines: { text: string; y: number; x?: number }[]
  nameLines: string[]
  facts: { field: BookFactField; label: string; lines: string[]; y: number }[]
  width: number
  height: number
  storyTop: number
  nameX: number
  nameY: number
  photo?: { x: number; y: number; width: number; height: number }
  totalForPerson: number
}
export const paperSizes = { a4: [210, 297], a5: [148, 210], letter: [215.9, 279.4] } as const
let measureContext: CanvasRenderingContext2D | null = null
function measuredWrap(text: string, width: number, font: string): string[] {
  measureContext ??= document.createElement('canvas').getContext('2d')!
  measureContext.font = font
  const result: string[] = []
  for (const para of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      if (!word) continue
      if (line && measureContext.measureText(`${line} ${word}`).width > width) {
        result.push(line)
        line = ''
      }
      if (measureContext.measureText(word).width > width) {
        for (const char of word) {
          if (measureContext.measureText(line + char).width > width) {
            result.push(line)
            line = ''
          }
          line += char
        }
      } else line += (line ? ' ' : '') + word
    }
    result.push(line)
  }
  return result
}
export function bookPages(project: Project): BookPage[] {
  const b = project.book,
    size = paperSizes[b.size],
    w = (b.landscape ? size[1] : size[0]) * 3.78,
    h = (b.landscape ? size[0] : size[1]) * 3.78,
    margin = 52
  const result: BookPage[] = []
  for (const id of b.ids) {
    const p = project.dataset.people[id]
    if (!p) continue
    const hasPhoto = b.display.photos && p.photo
    const nameLines = measuredWrap(
      personName(p, b.display.names),
      w - 2 * margin - (hasPhoto && b.photoPosition !== 'top' ? 128 : 0),
      `400 34px "${projectTheme(project).font}"`,
    )
    const nameX = hasPhoto && b.photoPosition === 'left' ? margin + 130 : margin
    const nameY = hasPhoto && b.photoPosition === 'top' ? 230 : 125
    const continuationTop = nameY + nameLines.length * 38 + 40
    let top = nameY + nameLines.length * 38 + 14
    let photo: BookPage['photo']
    if (hasPhoto) {
      if (b.photoPosition === 'top') {
        photo = { x: w / 2 - 48, y: 70, width: 96, height: 112 }
      } else {
        photo = {
          x: b.photoPosition === 'left' ? margin : w - margin - 100,
          y: 100,
          width: 100,
          height: 120,
        }
        // Right-hand portraits can sit beside the facts. Left-hand portraits
        // share the facts' label column, so those facts still start below them.
        if (b.photoPosition === 'left') top = Math.max(top, 242)
      }
    }
    const factData: [BookFactField, string, string][] = []
    if (b.display.birth) {
      factData.push(['birthDate', 'Born', formatDate(p.birthDate, b.display.dates)])
      if (b.display.places) factData.push(['birthPlace', 'Birthplace', p.birthPlace])
    }
    if (b.display.death) {
      factData.push(['deathDate', 'Died', formatDate(p.deathDate, b.display.dates)])
      if (b.display.places) factData.push(['deathPlace', 'Place of death', p.deathPlace])
    }
    if (b.display.occupation) factData.push(['occupation', 'Occupation', p.occupation])
    if (b.display.burial) factData.push(['burialPlace', 'Laid to rest', p.burialPlace])
    if (b.display.notes) factData.push(['notes', 'Notes', p.notes])
    const facts: BookPage['facts'] = []
    // Facts flow vertically so unusually long locations or notes never overlap.
    for (const [field, label, text] of factData.filter(([, , v]) => v)) {
      const photoInset =
        photo && b.photoPosition === 'right' && top - 13 < photo.y + photo.height + 12
          ? photo.width + 28
          : 0
      const width = w - margin * 2 - 120 - photoInset
      const lines = measuredWrap(text, width, '13px Inter')
      facts.push({ field, label, lines, y: top })
      top += Math.max(28, lines.length * 19 + 10)
    }
    const storyTop = top + (facts.length ? 52 : 30)
    const story = b.story ? plainStory(p.story).trim() : ''
    const leading = b.fontSize * 1.6,
      bottom = h - 70
    // Paginate all text. Very long stories continue beyond a spread rather than being truncated.
    let continuation = 0
    const personPages: BookPage[] = []
    // Facts can be lengthy too; place each fact on an available page before the story.
    let page: BookPage = {
      person: p,
      continuation,
      lines: [],
      nameLines,
      nameX,
      nameY,
      facts: [],
      width: w,
      height: h,
      storyTop,
      photo,
      totalForPerson: 1,
    }
    let cursor = facts.length ? facts[0].y : top
    for (const fact of facts) {
      let remaining = [...fact.lines],
        first = true
      while (remaining.length) {
        if (cursor + 28 > bottom) {
          personPages.push(page)
          continuation++
          page = {
            person: p,
            continuation,
            lines: [],
            nameLines,
            nameX,
            nameY,
            facts: [],
            width: w,
            height: h,
            storyTop: continuationTop,
            totalForPerson: 1,
          }
          cursor = continuationTop
        }
        const capacity = Math.max(1, Math.floor((bottom - cursor - 10) / 19)),
          chunk = remaining.splice(0, capacity)
        page.facts.push({
          field: fact.field,
          label: first ? fact.label : fact.label + ' (cont.)',
          lines: chunk,
          y: cursor,
        })
        cursor += Math.max(28, chunk.length * 19 + 10)
        first = false
      }
    }
    cursor = Math.max(
      cursor + (facts.length ? 52 : 30),
      page.photo ? page.photo.y + page.photo.height + 36 : 0,
    )
    page.storyTop = cursor
    const nextPage = () => {
      personPages.push(page)
      continuation++
      cursor = continuationTop
      page = {
        person: p,
        continuation,
        lines: [],
        nameLines,
        nameX,
        nameY,
        facts: [],
        width: w,
        height: h,
        storyTop: cursor,
        totalForPerson: 1,
      }
    }
    const paragraphs = story.split(/\n/)
    let prepared: BookPage | undefined
    let regions: StoryRegion[] = [],
      regionIndex = 0
    const prepareBody = () => {
      if (prepared === page) return
      prepared = page
      const config = b.pageLayouts?.[`${id}:${page.continuation}`]
      const photos =
        config && config.layout !== 'text'
          ? config.photos
              .slice(0, config.imageCount ?? 2)
              .map((src, i) => ({
                src,
                ratio: config.ratios?.[i] ?? 1.5,
                caption: config.captions?.[i] ?? '',
              }))
              .filter((photo) => photo.src)
          : []
      const area = {
        x: margin,
        y: cursor - b.fontSize,
        width: w - margin * 2,
        height: bottom - cursor + b.fontSize - 6,
      }
      const composition = composeBookBody(
        area,
        area.height >= 140 ? photos : [],
        config?.layout ?? 'gallery-right',
        b.fontSize,
        measuredWrap,
      )
      regions = composition.regions
      regionIndex = 0
      page.pictures = composition.pictures
      page.composition = composition.composition
      page.storyRegions = regions
      cursor = regions[0].y + b.fontSize
    }
    const advanceRegion = () => {
      regionIndex++
      if (regionIndex >= regions.length) {
        nextPage()
        prepareBody()
      } else cursor = regions[regionIndex].y + b.fontSize
    }
    prepareBody()
    for (const paragraph of paragraphs) {
      let remaining = paragraph.trim().split(/\s+/).join(' ')
      let paragraphLines = 0
      if (!remaining) {
        if (page.lines.length) cursor += leading * 0.65
        continue
      }
      while (remaining) {
        let region = regions[regionIndex]
        if (cursor + 4 > region.y + region.height) {
          advanceRegion()
          paragraphLines = 0
          region = regions[regionIndex]
        }
        if (cursor + 4 > region.y + region.height) {
          if (page.pictures?.length) continue
          throw new Error('The name is too long for this page size.')
        }
        const wrapped = measuredWrap(remaining, region.width, `${b.fontSize}px ${storyFont}`)
        const capacity = Math.floor((region.y + region.height - cursor - 4) / leading) + 1
        // Avoid an isolated first or final line at column boundaries.
        const orphan =
          paragraphLines === 0 &&
          (capacity < Math.min(2, wrapped.length) || (capacity === 2 && wrapped.length === 3))
        const widow = paragraphLines > 0 && wrapped.length === 2 && capacity === 1
        if ((orphan || widow) && page.lines.length) {
          advanceRegion()
          paragraphLines = 0
          continue
        }
        const text = wrapped[0]
        page.lines.push({ text, x: region.x, y: cursor })
        remaining = remaining.slice(text.length).trimStart()
        paragraphLines++
        cursor += leading
      }
    }
    personPages.push(page)
    personPages.forEach((pg) => {
      pg.totalForPerson = personPages.length
      const [first, second] = pg.storyRegions ?? []
      if (
        !first ||
        !second ||
        first.y !== second.y ||
        first.width !== second.width ||
        pg.lines.length < 6 ||
        pg.lines.some((line) => line.x !== first.x)
      )
        return
      // Short closing passages balance across the two columns, preferably at a paragraph break.
      const middle = Math.ceil(pg.lines.length / 2)
      const breaks = pg.lines
        .map((line, i) => (i > 0 && line.y - pg.lines[i - 1].y > leading * 1.2 ? i : -1))
        .filter((i) => i >= pg.lines.length * 0.3 && i <= pg.lines.length * 0.7)
      const split = breaks.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0] ?? middle
      const start = pg.lines[split].y
      pg.lines.slice(split).forEach((line) => {
        line.x = second.x
        line.y = second.y + b.fontSize + line.y - start
      })
    })
    result.push(...personPages)
  }
  return result
}

// Preserve the chosen chapter order; each surname transition starts a section.
export function assembledBookPages(project: Project): BookPage[] {
  const chapters = bookPages(project)
  if (!chapters.length) return []
  const body: BookPage[] = [],
    entries: NonNullable<BookPage['entries']> = []
  let previous = ''
  for (const page of chapters) {
    if (!page.continuation) {
      const surname = page.person.surname.trim() || 'Unknown surname'
      if (surname.toLocaleLowerCase() !== previous) {
        entries.push({ label: surname, page: body.length, section: true })
        if (project.book.dividers)
          body.push({
            ...page,
            kind: 'divider',
            section: surname,
            lines: [],
            facts: [],
            photo: undefined,
          })
        previous = surname.toLocaleLowerCase()
      }
      entries.push({ label: personName(page.person), page: body.length, section: false })
    }
    body.push(page)
  }
  const template = chapters[0]
  const rows = Math.max(1, Math.floor((template.height - 210) / 28))
  const wrapped = entries.flatMap((entry) =>
    measuredWrap(entry.label, template.width - 208, '17px "Cormorant Garamond"').map((label) => ({
      ...entry,
      label,
    })),
  )
  const count = Math.ceil(wrapped.length / rows)
  const contents: BookPage[] = Array.from({ length: count }, (_, i) => ({
    ...template,
    kind: 'contents',
    lines: [],
    facts: [],
    photo: undefined,
    entries: wrapped
      .slice(i * rows, (i + 1) * rows)
      .map((entry) => ({ ...entry, page: entry.page + count + 1 })),
  }))
  return [...contents, ...body]
}
