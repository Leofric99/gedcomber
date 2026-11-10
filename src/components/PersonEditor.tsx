import { useRef, useState } from 'react'
import { X, Camera, FileText, Upload, Trash2, BookPlus, Focus } from 'lucide-react'
import type { Person } from '../lib/types'
import { personName } from '../lib/format'
import { Field, Section } from './Controls'
import { photoData } from '../lib/storage'
import { PhotoFramer } from './PhotoFramer'
export function PersonEditor({
  person,
  onChange,
  onClose,
  onPrimary,
  onBook,
  inBook,
  onError,
}: {
  person: Person
  onChange: (p: Person) => void
  onClose: () => void
  onPrimary: () => void
  onBook: () => void
  inBook: boolean
  onError: (s: string) => void
}) {
  const photoRef = useRef<HTMLInputElement>(null),
    storyRef = useRef<HTMLInputElement>(null)
  const latest = useRef(person)
  const [framing, setFraming] = useState<string>()
  latest.current = person
  const set = (key: keyof Person, value: string) => onChange({ ...latest.current, [key]: value })
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <span className="eyebrow">PERSON DETAILS</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close person editor">
          <X size={17} />
        </button>
      </div>
      <div className="inspector-scroll">
        <div className="person-heading">
          <button
            className="photo-upload"
            aria-label="Upload photograph"
            onClick={() => photoRef.current?.click()}
          >
            {person.photo ? (
              <img src={person.photo} alt={personName(person)} />
            ) : (
              <Camera size={25} />
            )}
            <span>
              <Upload size={12} />
            </span>
          </button>
          <h2>{personName(person)}</h2>
          <p>Changes save automatically</p>
        </div>
        <input
          ref={photoRef}
          className="hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f)
              try {
                const photo = await photoData(f)
                setFraming(photo)
              } catch (err) {
                onError((err as Error).message)
              }
          }}
        />
        {person.photo && (
          <button
            className="text-btn center"
            onClick={() => setFraming(person.photoOriginal ?? person.photo)}
          >
            <Focus size={12} /> Adjust photograph
          </button>
        )}
        {framing && (
          <PhotoFramer
            source={framing}
            initial={
              framing === (person.photoOriginal ?? person.photo) ? person.photoCrop : undefined
            }
            onCancel={() => setFraming(undefined)}
            onError={onError}
            onApply={(photo, photoCrop) => {
              onChange({ ...latest.current, photo, photoOriginal: framing, photoCrop })
              setFraming(undefined)
            }}
          />
        )}
        {person.photo && (
          <button
            className="text-btn center"
            onClick={() => {
              setFraming(undefined)
              onChange({
                ...person,
                photo: undefined,
                photoOriginal: undefined,
                photoCrop: undefined,
              })
            }}
          >
            <Trash2 size={12} />
            Remove photograph
          </button>
        )}
        <div className="person-actions">
          <button className="btn" onClick={onPrimary}>
            <Focus size={14} />
            Make primary
          </button>
          <button className={`btn ${inBook ? 'active' : ''}`} onClick={onBook}>
            <BookPlus size={14} />
            {inBook ? 'In book' : 'Add to book'}
          </button>
        </div>
        <Section title="Identity">
          <Field label="Given names">
            <input value={person.given} onChange={(e) => set('given', e.target.value)} />
          </Field>
          <div className="two-fields">
            <Field label="Surname">
              <input value={person.surname} onChange={(e) => set('surname', e.target.value)} />
            </Field>
            <Field label="Suffix">
              <input value={person.suffix} onChange={(e) => set('suffix', e.target.value)} />
            </Field>
          </div>
          <Field label="Sex (GEDCOM)">
            <select value={person.sex} onChange={(e) => set('sex', e.target.value)}>
              <option value="">Unspecified</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
              <option value="X">Non-binary / X</option>
              <option value="U">Unknown</option>
              {!['', 'F', 'M', 'X', 'U'].includes(person.sex) && <option>{person.sex}</option>}
            </select>
          </Field>
        </Section>
        <Section title="Life details">
          <Field label="Date of birth">
            <input
              placeholder="e.g. 14 MAY 1942"
              value={person.birthDate}
              onChange={(e) => set('birthDate', e.target.value)}
            />
          </Field>
          <Field label="Place of birth">
            <input value={person.birthPlace} onChange={(e) => set('birthPlace', e.target.value)} />
          </Field>
          <Field label="Date of death">
            <input
              placeholder="e.g. ABT 2000"
              value={person.deathDate}
              onChange={(e) => set('deathDate', e.target.value)}
            />
          </Field>
          <Field label="Place of death">
            <input value={person.deathPlace} onChange={(e) => set('deathPlace', e.target.value)} />
          </Field>
          <Field label="Occupation">
            <input value={person.occupation} onChange={(e) => set('occupation', e.target.value)} />
          </Field>
          <Field label="Burial location">
            <input
              value={person.burialPlace}
              onChange={(e) => set('burialPlace', e.target.value)}
            />
          </Field>
          <p className="help">
            Dates use GEDCOM notation. Approximate dates such as ABT 1900 and ranges such as BET
            1900 AND 1910 are preserved.
          </p>
        </Section>
        <Section title="Custom notes">
          <textarea
            rows={4}
            aria-label="Custom notes"
            placeholder="A small detail worth remembering…"
            value={person.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Section>
        <Section title="Life story" aside={<FileText size={15} />}>
          <p className="help">
            Add the story that will appear in your ancestry book. Upload .txt or .md, or write it
            here.
          </p>
          <button className="btn full" onClick={() => storyRef.current?.click()}>
            <Upload size={14} />
            Upload life story
          </button>
          <input
            className="hidden"
            type="file"
            accept=".txt,.md,.markdown,text/plain,text/markdown"
            ref={storyRef}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                if (!/\.(txt|md|markdown)$/i.test(f.name))
                  throw new Error('Choose a plain text or Markdown file.')
                if (f.size > 2 * 1024 * 1024)
                  throw new Error('Please choose a story smaller than 2 MB.')
                const text = await f.text()
                set('story', text)
              } catch (err) {
                onError((err as Error).message)
              }
            }}
          />
          <textarea
            className="story-input"
            rows={10}
            aria-label="Life story"
            value={person.story}
            onChange={(e) => set('story', e.target.value)}
            placeholder="Every life has a story…"
          />
          <span className="help">
            {person.story.trim() ? person.story.trim().split(/\s+/).length : 0} words · Markdown
            imports as readable text
          </span>
        </Section>
      </div>
    </aside>
  )
}
