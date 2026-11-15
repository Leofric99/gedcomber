import { useEffect, useRef, useState } from 'react'
import { Pencil, Upload, Trash2, X } from 'lucide-react'
import type { Person, Project } from '../lib/types'
import type { BookFactField, BookPage } from '../lib/book'
import { photoData } from '../lib/storage'
import { projectTheme } from '../lib/themes'
import { plainStory } from '../lib/format'
import { Field } from './Controls'
import { PhotoFramer } from './PhotoFramer'

type TextField = BookFactField | 'name' | 'title'
type Edit = { field: TextField | 'photo'; label: string; y: number }

// This HTML layer belongs only to the workspace. Export uses BookArtwork directly.
export function BookPageEditor({
  page,
  project,
  onPersonChange,
  onTitleChange,
  onError,
}: {
  page: BookPage
  project: Project
  onPersonChange: (patch: Partial<Person>) => void
  onTitleChange: (title: string) => void
  onError: (message: string) => void
}) {
  const [edit, setEdit] = useState<Edit>(),
    [draft, setDraft] = useState(''),
    [name, setName] = useState({ given: '', surname: '', suffix: '' }),
    [framing, setFraming] = useState<string>(),
    [loading, setLoading] = useState(false)
  const form = useRef<HTMLFormElement>(null),
    photoInput = useRef<HTMLInputElement>(null),
    storyOriginal = useRef(''),
    [paperWidth, setPaperWidth] = useState(page.width),
    opener = useRef<HTMLButtonElement | null>(null),
    photoRequest = useRef(0)
  const p = page.person
  useEffect(() => {
    const paper = document.querySelector('.book-paper')
    if (!paper) return
    const observer = new ResizeObserver(() => setPaperWidth(paper.getBoundingClientRect().width))
    observer.observe(paper)
    setPaperWidth(paper.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])
  useEffect(
    () => () => {
      photoRequest.current++
    },
    [],
  )
  useEffect(() => {
    if (edit) {
      const target =
        form.current?.querySelector<HTMLElement>('input:not([type=file]), textarea') ??
        form.current?.querySelector<HTMLElement>('button')
      target?.focus()
    }
  }, [edit])
  const close = () => {
    photoRequest.current++
    setEdit(undefined)
    setFraming(undefined)
    setLoading(false)
    opener.current?.focus()
  }
  const pencil = (field: Edit['field'], label: string, x: number, y: number) => (
    <button
      key={field}
      type="button"
      className="book-pencil"
      style={{ left: `${(x / page.width) * 100}%`, top: `${(y / page.height) * 100}%` }}
      aria-label={`Edit ${label.toLowerCase()}`}
      title={`Edit ${label.toLowerCase()}`}
      onClick={(e) => {
        photoRequest.current++
        opener.current = e.currentTarget
        setDraft(
          field === 'title'
            ? project.book.title
            : field === 'name' || field === 'photo'
              ? ''
              : p[field],
        )
        setName({ given: p.given, surname: p.surname, suffix: p.suffix })
        setFraming(undefined)
        setLoading(false)
        setEdit({ field, label, y })
      }}
    >
      <Pencil size={11} aria-hidden="true" />
    </button>
  )
  const story = plainStory(p.story).trim()
  const storyRegions = page.storyRegions?.length
    ? page.storyRegions
    : [{ x: 52, y: page.storyTop - project.book.fontSize, width: page.width - 104, height: page.height - page.storyTop - 70 }]
  return (
    <div className="book-edit-layer">
      {pencil('title', 'Book title', page.width - 30, 32)}
      {pencil('name', 'Name', page.nameX - 24, page.nameY - 12)}
      {project.book.display.photos &&
        !page.continuation &&
        pencil(
          'photo',
          'Photograph',
          page.photo ? page.photo.x + page.photo.width - 8 : page.width - 65,
          page.photo ? page.photo.y + page.photo.height - 8 : 85,
        )}
      {page.facts.map((fact) => pencil(fact.field, fact.label, 28, fact.y - 5))}
      {project.book.story && storyRegions.map((region, i) => {
        const lines = page.lines.filter((line) =>
          (line.x ?? 52) === region.x && line.y >= region.y && line.y <= region.y + region.height,
        )
        if (!lines.length && (story || i > 0 || page.continuation !== page.totalForPerson - 1)) return null
        const start = lines[0]?.start ?? 0
        const end = lines.at(-1)?.end ?? 0
        const original = story.slice(start, end)
        return (
          <div
            key={i}
            className="book-story-content"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Life story on this page"
            aria-multiline="true"
            data-placeholder="Click here to write the life story"
            onFocus={(event) => { storyOriginal.current = event.currentTarget.innerText }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.currentTarget.innerText = storyOriginal.current
                event.currentTarget.blur()
              }
            }}
            onBlur={(event) => {
              const edited = event.currentTarget.innerText.replace(/\r/g, '')
              if (edited !== original) onPersonChange({ story: story.slice(0, start) + edited + story.slice(end) })
            }}
            style={{
              left: `${(region.x / page.width) * 100}%`,
              top: `${(region.y / page.height) * 100}%`,
              width: `${(region.width / page.width) * 100}%`,
              height: `${(region.height / page.height) * 100}%`,
              fontSize: `${project.book.fontSize * paperWidth / page.width}px`,
              color: projectTheme(project).ink,
            }}
          >{original}</div>
        )
      })}
      {edit && (
        <form
          ref={form}
          className="book-inline-editor"
          aria-label={`Edit ${edit.label.toLowerCase()}`}
          style={{
            top: `${Math.max(4, Math.min((edit.y / page.height) * 100 - 2, edit.field === 'photo' ? 24 : 52))}%`,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              close()
            }
          }}
          onSubmit={(e) => {
            e.preventDefault()
            if (edit.field === 'photo') return
            if (edit.field === 'title') onTitleChange(draft)
            else onPersonChange(edit.field === 'name' ? name : { [edit.field]: draft })
            close()
          }}
        >
          <div className="book-inline-heading">
            <strong>{edit.label}</strong>
            <button type="button" className="icon-btn" aria-label="Cancel editing" onClick={close}>
              <X size={15} />
            </button>
          </div>
          {edit.field === 'photo' ? (
            <>
              <input
                ref={photoInput}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  const request = ++photoRequest.current
                  setLoading(true)
                  try {
                    const photo = await photoData(file)
                    if (request === photoRequest.current) setFraming(photo)
                  } catch (err) {
                    if (request === photoRequest.current) onError((err as Error).message)
                  } finally {
                    if (request === photoRequest.current) setLoading(false)
                  }
                }}
              />
              {framing ? (
                <PhotoFramer
                  key={framing}
                  source={framing}
                  initial={framing === (p.photoOriginal ?? p.photo) ? p.photoCrop : undefined}
                  onError={onError}
                  onCancel={() => setFraming(undefined)}
                  onApply={(photo, photoCrop) => {
                    onPersonChange({ photo, photoOriginal: framing, photoCrop })
                    close()
                  }}
                />
              ) : (
                <>
                  {p.photo && (
                    <img className="book-photo-preview" src={p.photo} alt="Current photograph" />
                  )}
                  <button
                    type="button"
                    className="btn full"
                    disabled={loading}
                    onClick={() => photoInput.current?.click()}
                  >
                    <Upload size={14} />{' '}
                    {loading
                      ? 'Opening photograph…'
                      : p.photo
                        ? 'Replace photograph'
                        : 'Upload photograph'}
                  </button>
                  {p.photo && (
                    <div className="person-actions">
                      <button
                        type="button"
                        className="btn"
                        disabled={loading}
                        onClick={() => setFraming(p.photoOriginal ?? p.photo)}
                      >
                        Adjust framing
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={loading}
                        onClick={() => {
                          onPersonChange({
                            photo: undefined,
                            photoOriginal: undefined,
                            photoCrop: undefined,
                          })
                          close()
                        }}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {edit.field === 'name' ? (
                (['given', 'surname', 'suffix'] as const).map((field) => (
                  <Field
                    key={field}
                    label={
                      field === 'given' ? 'Given names' : field === 'surname' ? 'Surname' : 'Suffix'
                    }
                  >
                    <input
                      value={name[field]}
                      onChange={(e) => setName({ ...name, [field]: e.target.value })}
                    />
                  </Field>
                ))
              ) : (
                <Field label={edit.label}>
                  {edit.field === 'notes' ? (
                    <textarea
                      rows={4}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                  ) : (
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} />
                  )}
                </Field>
              )}
              {(edit.field === 'birthDate' || edit.field === 'deathDate') && (
                <p className="help">Use GEDCOM dates, e.g. 14 MAY 1942 or ABT 1900.</p>
              )}
              <div className="person-actions">
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
                <button type="button" className="btn" onClick={close}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  )
}
