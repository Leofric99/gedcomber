import { describe, expect, it } from 'vitest'
import { validateProject } from './storage'
import { newProject } from './types'
import { demoDataset } from './demo'
describe('project backups', () => {
  it('round trips tree expansion, book settings, stories, and photos', () => {
    const p = newProject(demoDataset(), '@I1@')
    p.expanded['@I1@'] = { parents: true, siblings: true }
    p.book.ids = ['@I1@']
    p.personBoxes = false
    p.decorationSize = 1.5
    p.dataset.people['@I1@'].photo = 'data:image/jpeg;base64,AA=='
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })
  it('accepts older backups without the box setting and rejects invalid values', () => {
    const p = newProject(demoDataset(), '@I1@')
    delete p.personBoxes
    delete p.decorationSize
    expect(validateProject(p).personBoxes).toBeUndefined()
    p.personBoxes = 'off' as never
    expect(() => validateProject(p)).toThrow('display or book settings')
    p.personBoxes = false
    p.decorationSize = Infinity
    expect(() => validateProject(p)).toThrow('display or book settings')
  })
  it('rejects invalid book limits, page sizes, and unsafe photo references', () => {
    const p = newProject(demoDataset(), '@I1@')
    p.book.ids = Array(101).fill('@I1@')
    expect(() => validateProject(p)).toThrow('book selection')
    p.book.ids = []
    p.book.size = 'invalid' as 'a4'
    expect(() => validateProject(p)).toThrow('book settings')
    p.book.size = 'a4'
    p.dataset.people['@I1@'].photo = 'https://example.com/photo.jpg'
    expect(() => validateProject(p)).toThrow('photograph')
  })
  it('rejects malformed nested records and invalid family references before replacing the workspace', () => {
    const p = newProject(demoDataset(), '@I1@')
    p.dataset.families[0].parents.push('@MISSING@')
    expect(() => validateProject(p)).toThrow('family links')
    p.dataset.families[0].parents.pop()
    p.dataset.records[0].children = undefined as never
    expect(() => validateProject(p)).toThrow('GEDCOM records')
  })
})
