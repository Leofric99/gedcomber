import type { Person, Project } from './types'
import { formatDate, personName, plainStory } from './format'
import { projectTheme } from './themes'
export type BookPage = {
  person: Person
  continuation: number
  lines: { text: string; y: number }[]
  nameLines: string[]
  facts: { label: string; lines: string[]; y: number }[]
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
        top = Math.max(top, 242)
      }
    }
    const factData: [string, string][] = []
    if (b.display.birth) {
      factData.push(['Born', formatDate(p.birthDate, b.display.dates)])
      if (b.display.places) factData.push(['Birthplace', p.birthPlace])
    }
    if (b.display.death) {
      factData.push(['Died', formatDate(p.deathDate, b.display.dates)])
      if (b.display.places) factData.push(['Place of death', p.deathPlace])
    }
    if (b.display.occupation) factData.push(['Occupation', p.occupation])
    if (b.display.burial) factData.push(['Laid to rest', p.burialPlace])
    if (b.display.notes) factData.push(['Notes', p.notes])
    const facts: BookPage['facts'] = []
    // Facts flow vertically so unusually long locations or notes never overlap.
    for (const [label, text] of factData.filter(([, v]) => v)) {
      const lines = measuredWrap(text, w - margin * 2 - 120, '13px Inter')
      facts.push({ label, lines, y: top })
      top += Math.max(28, lines.length * 19 + 10)
    }
    const storyTop = top + (facts.length ? 52 : 30)
    const story = b.story ? plainStory(p.story).trim() : ''
    const lines = story ? measuredWrap(story, w - margin * 2, `${b.fontSize}px Inter`) : []
    const leading = b.fontSize * 1.65,
      bottom = h - 70
    // Paginate all text. Very long stories continue beyond a spread rather than being truncated.
    let continuation = 0,
      offset = 0
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
          label: first ? fact.label : fact.label + ' (cont.)',
          lines: chunk,
          y: cursor,
        })
        cursor += Math.max(28, chunk.length * 19 + 10)
        first = false
      }
    }
    cursor += facts.length ? 52 : 30
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
    while (offset < lines.length) {
      if (!lines[offset]) {
        offset++
        if (page.lines.length) cursor += leading
        continue
      }
      let paragraphEnd = offset
      while (paragraphEnd < lines.length && lines[paragraphEnd]) paragraphEnd++
      while (offset < paragraphEnd) {
        let capacity = Math.floor((bottom - cursor) / leading),
          remaining = paragraphEnd - offset
        if (capacity < Math.min(2, remaining) || (capacity === 2 && remaining === 3)) {
          nextPage()
          capacity = Math.floor((bottom - cursor) / leading)
        }
        let count = Math.min(capacity, remaining)
        if (remaining - count === 1 && count > 2) count--
        // Pathologically tall headers still have a bounded fallback rather than an infinite loop.
        if (count < 1)
          throw new Error(
            'The name is too long for this page size. Choose a shorter name format or larger page.',
          )
        for (let j = 0; j < count; j++) {
          page.lines.push({ text: lines[offset++], y: cursor })
          cursor += leading
        }
        if (offset < paragraphEnd) nextPage()
      }
    }
    personPages.push(page)
    personPages.forEach((pg) => (pg.totalForPerson = personPages.length))
    result.push(...personPages)
  }
  return result
}
