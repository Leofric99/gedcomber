import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BookArtwork } from './BookArtwork'
import { BookPageEditor } from './BookPageEditor'
import { bookPages, type BookPage } from '../lib/book'
import { demoDataset } from '../lib/demo'
import { newProject, type Project } from '../lib/types'
import { projectTheme } from '../lib/themes'
import { updatePerson, exportGedcom, parseGedcom } from '../lib/gedcom'

beforeAll(() => {
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ font: '', measureText: (text: string) => ({ width: text.length * 8 }) }),
    }),
  })
})
afterAll(() => vi.unstubAllGlobals())

function controls(project: Project, page: BookPage) {
  return renderToStaticMarkup(
    <BookPageEditor
      page={page}
      project={project}
      onPersonChange={vi.fn()}
      onTitleChange={vi.fn()}
      onError={vi.fn()}
    />,
  )
}

describe('editing in the book', () => {
  it('offers pencils for facts, name, title, and empty story and portrait areas', () => {
    const project = newProject(demoDataset(), '@I1@')
    project.book.ids = ['@I1@']
    project.dataset.people['@I1@'].story = ''
    const [page] = bookPages(project)
    const markup = controls(project, page)
    for (const label of [
      'book title',
      'name',
      'born',
      'birthplace',
      'occupation',
      'life story',
      'photograph',
    ])
      expect(markup).toContain(`aria-label="Edit ${label}"`)
    project.book.story = false
    project.book.display.photos = false
    const hidden = controls(project, bookPages(project)[0])
    expect(hidden).not.toContain('Edit life story')
    expect(hidden).not.toContain('Edit photograph')
  })

  it('retains the original editable field when a fact continues on another page', () => {
    const project = newProject(demoDataset(), '@I1@')
    project.book.ids = ['@I1@']
    project.book.display.notes = true
    project.dataset.people['@I1@'].notes = 'A long family memory. '.repeat(500)
    const continued = bookPages(project).find((page) =>
      page.facts.some((fact) => fact.label === 'Notes (cont.)'),
    )!
    expect(continued.facts.find((fact) => fact.label === 'Notes (cont.)')?.field).toBe('notes')
    expect(controls(project, continued)).toContain('Edit notes (cont.)')
  })

  it('exports saved person details without preview pencils or editor forms', () => {
    const project = newProject(demoDataset(), '@I1@')
    project.book.ids = ['@I1@']
    project.dataset = updatePerson(project.dataset, {
      ...project.dataset.people['@I1@'],
      birthPlace: 'A newly corrected birthplace',
      story: 'A newly written life story.',
      photo: 'data:image/jpeg;base64,portrait',
    })
    const [page] = bookPages(project)
    const markup = renderToStaticMarkup(
      <BookArtwork page={page} project={project} theme={projectTheme(project)} index={0} />,
    )
    expect(markup).toContain('A newly corrected birthplace')
    expect(markup).toContain('A newly written life story.')
    expect(markup).toContain('data:image/jpeg;base64,portrait')
    expect(markup).not.toMatch(/book-pencil|book-edit-layer|<button|<form|<foreignObject/)
    const restored = parseGedcom(exportGedcom(project.dataset)).people['@I1@']
    expect(restored.birthPlace).toBe('A newly corrected birthplace')
    expect(restored.story).toBe('A newly written life story.')
  })
})
