import { beforeAll, describe, expect, it, vi } from 'vitest'
import { bookPages } from './book'
import { demoDataset } from './demo'
import { newProject } from './types'
import { exportGedcom, parseGedcom } from './gedcom'
beforeAll(() => {
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ font: '', measureText: (text: string) => ({ width: text.length * 8 }) }),
    }),
  })
})
describe('book pagination', () => {
  it('starts every selected individual on their own page and uses requested page dimensions', () => {
    const p = newProject(demoDataset(), '@I1@')
    p.book.ids = ['@I2@', '@I3@']
    const pages = bookPages(p)
    expect(pages).toHaveLength(2)
    expect(pages.map((p) => p.person.id)).toEqual(['@I2@', '@I3@'])
    expect(pages[0].width).toBeCloseTo(210 * 3.78)
    p.book.landscape = true
    p.book.size = 'a5'
    const landscape = bookPages(p)
    expect(landscape[0].width).toBeCloseTo(210 * 3.78)
    expect(landscape[0].height).toBeCloseTo(148 * 3.78)
  })
  it('preserves an entire long story across continuation pages with no footer overlap', () => {
    const p = newProject(demoDataset(), '@I1@')
    p.book.ids = ['@I1@']
    p.book.size = 'a5'
    p.book.landscape = true
    const story = Array.from({ length: 1200 }, (_, i) => `word${i}`).join(' ')
    p.dataset.people['@I1@'].story = story
    const pages = bookPages(p)
    expect(pages.length).toBeGreaterThan(2)
    expect(pages.flatMap((p) => p.lines.map((l) => l.text)).join(' ')).toBe(story)
    pages.forEach((pg, i) => {
      expect(pg.continuation).toBe(i)
      expect(pg.totalForPerson).toBe(pages.length)
      pg.lines.forEach((l) => expect(l.y).toBeLessThan(pg.height - 70))
    })
  })
  it('paginates unusually long facts and respects story and fact toggles', () => {
    const p = newProject(demoDataset(), '@I1@')
    p.book.ids = ['@I1@']
    p.book.display.notes = true
    p.book.story = false
    p.book.display.birth = false
    p.book.display.occupation = false
    p.dataset.people['@I1@'].notes = Array.from({ length: 700 }, (_, i) => `note${i}`).join(' ')
    const pages = bookPages(p)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.flatMap((p) => p.lines)).toHaveLength(0)
    expect(pages.flatMap((p) => p.facts.flatMap((f) => f.lines)).join(' ')).toBe(
      p.dataset.people['@I1@'].notes,
    )
    pages.forEach((pg) =>
      pg.facts.forEach((f) => expect(f.y + f.lines.length * 19).toBeLessThan(pg.height - 60)),
    )
  })
  it('does not create empty continuation pages for trailing blank paragraphs', () => {
    const p = newProject(demoDataset(), '@I1@')
    p.book.ids = ['@I1@']
    p.dataset.people['@I1@'].story = 'A brief life.\n\n\n'
    expect(bookPages(p)).toHaveLength(1)
  })
  it('keeps the sample story in a GEDCOM round trip', () => {
    const d = demoDataset()
    expect(parseGedcom(exportGedcom(d)).people['@I1@'].story).toBe(d.people['@I1@'].story)
  })
  it('keeps title coordinates and size consistent through every photo placement and continuation', () => {
    for (const photoPosition of ['left', 'right', 'top'] as const) {
      const p = newProject(demoDataset(), '@I1@')
      p.book.ids = ['@I1@']
      p.book.size = 'a5'
      p.book.landscape = true
      p.book.photoPosition = photoPosition
      p.dataset.people['@I1@'].photo = 'data:image/jpeg;base64,test'
      p.dataset.people['@I1@'].story = 'A story of a life well lived. '.repeat(300)
      const pages = bookPages(p)
      expect(pages.length).toBeGreaterThan(1)
      for (const page of pages) {
        expect(page.nameX).toBe(pages[0].nameX)
        expect(page.nameY).toBe(pages[0].nameY)
        expect(page.nameY).toBeGreaterThanOrEqual(125)
        expect(page.lines[0].y - (page.storyTop - 36) - p.book.fontSize).toBeGreaterThanOrEqual(14)
      }
    }
  })
})
