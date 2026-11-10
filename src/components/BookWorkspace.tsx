import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  X,
  Search,
  UserRound,
} from 'lucide-react'
import type { Project } from '../lib/types'
import { bookPages } from '../lib/book'
import { projectTheme } from '../lib/themes'
import { personName } from '../lib/format'
import { BookArtwork } from './BookArtwork'
import { CheckBox, Field, FormatControls, Section, Toggle } from './Controls'
export function BookSidebar({
  project,
  onChange,
  onToggle,
}: {
  project: Project
  onChange: (p: Project) => void
  onToggle: (id: string) => void
}) {
  const [tab, setTab] = useState<'people' | 'format'>('people'),
    [search, setSearch] = useState('')
  const b = project.book,
    set = (part: Partial<Project['book']>) => onChange({ ...project, book: { ...b, ...part } })
  const people = Object.values(project.dataset.people)
    .filter((p) => personName(p).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => personName(a).localeCompare(personName(b)))
  const move = (i: number, dir: number) => {
    const ids = [...b.ids]
    ;[ids[i], ids[i + dir]] = [ids[i + dir], ids[i]]
    set({ ids })
  }
  return (
    <aside className="sidebar">
      <div className="sidebar-title">
        <BookOpen size={17} />
        <h2>Ancestry book</h2>
        <span className="count-badge">{b.ids.length}/100</span>
      </div>
      <div className="segmented">
        <button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
          People
        </button>
        <button className={tab === 'format' ? 'active' : ''} onClick={() => setTab('format')}>
          Formatting
        </button>
      </div>
      <div className="sidebar-scroll">
        {tab === 'people' ? (
          <>
            <Section title="Your chapters">
              <p className="help">Choose up to 100 people. Each person starts on a new page.</p>
              {b.ids.length === 0 ? (
                <div className="empty-small">
                  Your book begins with a person.
                  <br />
                  Select someone below.
                </div>
              ) : (
                <div className="chapter-list">
                  {b.ids.map((id, i) => (
                    <div className="chapter" key={id}>
                      <span className="chapter-number">{String(i + 1).padStart(2, '0')}</span>
                      <span className="truncate">
                        {personName(project.dataset.people[id], 'short')}
                      </span>
                      <button
                        className="tiny-btn"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        aria-label={`Move ${personName(project.dataset.people[id])} earlier`}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        className="tiny-btn"
                        disabled={i === b.ids.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label={`Move ${personName(project.dataset.people[id])} later`}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        className="tiny-btn"
                        onClick={() => onToggle(id)}
                        aria-label={`Remove ${personName(project.dataset.people[id])} from book`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
            <Section title="Add people">
              <div className="search-input">
                <Search size={14} />
                <input
                  placeholder="Search your family…"
                  aria-label="Search people for book"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="book-person-list">
                {people.slice(0, 200).map((p) => (
                  <button
                    className="book-person"
                    key={p.id}
                    onClick={() => onToggle(p.id)}
                    disabled={b.ids.length >= 100 && !b.ids.includes(p.id)}
                  >
                    <CheckBox checked={b.ids.includes(p.id)} />
                    <span>
                      <strong>{personName(p)}</strong>
                      <small>{p.story ? 'Life story added' : 'No life story yet'}</small>
                    </span>
                  </button>
                ))}
                {people.length > 200 && (
                  <p className="help">Showing the first 200 matches. Search to find others.</p>
                )}
                {!people.length && <p className="help">No matching people.</p>}
              </div>
            </Section>
          </>
        ) : (
          <>
            <Section title="Page layout">
              <Field label="Book title">
                <input value={b.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Page size">
                <select
                  value={b.size}
                  onChange={(e) => set({ size: e.target.value as typeof b.size })}
                >
                  <option value="a4">A4 · 210 × 297 mm</option>
                  <option value="a5">A5 · 148 × 210 mm</option>
                  <option value="letter">US Letter · 8.5 × 11 in</option>
                </select>
              </Field>
              <div className="segmented">
                <button
                  className={!b.landscape ? 'active' : ''}
                  onClick={() => set({ landscape: false })}
                >
                  Portrait
                </button>
                <button
                  className={b.landscape ? 'active' : ''}
                  onClick={() => set({ landscape: true })}
                >
                  Landscape
                </button>
              </div>
              <Field label="Photo placement">
                <select
                  value={b.photoPosition}
                  onChange={(e) => set({ photoPosition: e.target.value as typeof b.photoPosition })}
                >
                  <option value="right">Upper right</option>
                  <option value="left">Upper left</option>
                  <option value="top">Centred above name</option>
                </select>
              </Field>
              <Field label={`Story text size · ${b.fontSize} px`}>
                <input
                  type="range"
                  min="12"
                  max="22"
                  value={b.fontSize}
                  onChange={(e) => set({ fontSize: Number(e.target.value) })}
                />
              </Field>
              <Toggle
                label="Include life stories"
                checked={b.story}
                onChange={(v) => set({ story: v })}
              />
            </Section>
            <Section title="Person formatting">
              <FormatControls display={b.display} onChange={(v) => set({ display: v })} book />
            </Section>
          </>
        )}
      </div>
      <div className="sidebar-foot">
        <UserRound size={13} />
        Edit people and stories in Tree view
      </div>
    </aside>
  )
}
export function BookWorkspace({ project, onTree }: { project: Project; onTree: () => void }) {
  const [page, setPage] = useState(0),
    [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    void document.fonts.ready.then(() => setFontsReady(true))
  }, [])
  const pages = useMemo(() => bookPages(project), [project, fontsReady]),
    index = Math.min(page, Math.max(0, pages.length - 1)),
    theme = projectTheme(project)
  return (
    <main className="book-stage">
      <div className="book-top">
        <div>
          <span className="eyebrow">PRINT PREVIEW</span>
          <h2>{project.book.title || 'Your ancestry book'}</h2>
        </div>
        <span>
          {project.book.ids.length} people · {pages.length} pages
        </span>
      </div>
      {pages.length ? (
        <>
          <div className="book-paper-wrap">
            <div className={`book-paper ${project.book.landscape ? 'landscape' : ''}`}>
              <BookArtwork page={pages[index]} project={project} theme={theme} index={index} />
            </div>
          </div>
          <div className="book-pagination">
            <button
              className="icon-btn"
              disabled={!index}
              onClick={() => setPage(index - 1)}
              aria-label="Previous book page"
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              Page {index + 1} of {pages.length}
            </span>
            <button
              className="icon-btn"
              disabled={index === pages.length - 1}
              onClick={() => setPage(index + 1)}
              aria-label="Next book page"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <p className="book-note">
            Preview matches the exported PDF. Long stories continue automatically.
          </p>
        </>
      ) : (
        <div className="book-empty">
          <BookOpen size={48} strokeWidth={1} />
          <h2>
            A collection of lives.
            <br />A story to keep.
          </h2>
          <p>
            Select people from the left to begin your book.
            <br />
            Your tree’s theme carries through to every page.
          </p>
          <button className="btn" onClick={onTree}>
            Return to the tree
          </button>
        </div>
      )}
    </main>
  )
}
