import { beforeAll, describe, expect, it, vi } from 'vitest'
import { assembledBookPages, bookPages } from './book'
import { demoDataset } from './demo'
import { bookPhotoArrangements, newProject } from './types'
import { themes } from './themes'

beforeAll(() =>
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ font: '', measureText: (text: string) => ({ width: text.length * 8 }) }),
    }),
  }),
)

describe('book sections and illustrated pages', () => {
  it('indexes the actual first person and section pages with and without dividers', () => {
    for (const dividers of [false, true]) {
      const p = newProject(demoDataset(), '@I1@')
      p.book.ids = ['@I1@', '@I2@', '@I3@']
      p.book.dividers = dividers
      p.dataset.people['@I1@'].story = 'A family story. '.repeat(900)
      const pages = assembledBookPages(p)
      const entries = pages.filter((p) => p.kind === 'contents').flatMap((p) => p.entries!)
      expect(entries.filter((e) => e.section).map((e) => e.label)).toEqual(['Ashford', 'Whitmore'])
      for (const entry of entries) {
        const target = pages[entry.page - 1]
        if (entry.section) {
          expect(target.person.surname).toBe(entry.label)
          expect(target.kind).toBe(dividers ? 'divider' : undefined)
        } else {
          expect(`${target.person.given} ${target.person.surname}`).toBe(entry.label)
          expect(target.continuation).toBe(0)
          expect(target.kind).toBeUndefined()
        }
      }
    }
  })
  it('keeps all story words and avoids extra photographs in every layout', () => {
    for (const landscape of [false, true])
      for (const theme of themes)
        for (const layout of bookPhotoArrangements)
          for (const ratios of [
            [1, 1],
            [0.15, 6],
            [4, 0.25],
          ])
            for (const imageCount of [1, 2] as const) {
              const p = newProject(demoDataset(), '@I1@')
              p.book.landscape = landscape
              p.theme = theme.id
              p.book.ids = ['@I1@']
              p.book.size = 'a5'
              const story = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ')
              p.dataset.people['@I1@'].story = story
              p.book.pageLayouts = {
                '@I1@:0': {
                  layout,
                  ratios,
                  captions: [
                    'A quiet afternoon, remembered by the family.',
                    'Together again in the garden.',
                  ],
                  imageCount,
                  photos: ['data:image/jpeg;base64,test', 'data:image/jpeg;base64,test'],
                },
              }
              const pages = bookPages(p)
              expect(pages[0].pictures).toHaveLength(imageCount)
              pages[0].pictures!.forEach((photo, i) => {
                expect(photo.width / photo.height).toBeCloseTo(ratios[i])
                expect(photo.frame.x).toBeGreaterThanOrEqual(52)
                expect(photo.frame.x + photo.frame.width).toBeLessThanOrEqual(
                  pages[0].width - 52 + 1e-8,
                )
                expect(photo.frame.y + photo.frame.height).toBeLessThan(pages[0].height - 70)
              })
              expect(pages.flatMap((p) => p.lines.map((l) => l.text)).join(' ')).toBe(story)
              for (const page of pages)
                for (const line of page.lines) {
                  expect(line.y).toBeLessThan(page.height - 70)
                  expect(
                    page.storyRegions?.some(
                      (region) =>
                        line.x === region.x &&
                        line.y >= region.y &&
                        line.y + 4 <= region.y + region.height,
                    ),
                  ).toBe(true)
                  for (const picture of page.pictures ?? []) {
                    const photo = picture.frame
                    if (line.y > photo.y && line.y - p.book.fontSize < photo.y + photo.height)
                      expect(
                        line.x! >= photo.x + photo.width ||
                          line.x! + line.text.length * 8 <= photo.x,
                      ).toBe(true)
                  }
                }
            }
  })
})
