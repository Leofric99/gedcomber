import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Shuffle, ArrowLeftRight, X } from 'lucide-react'
import type { BookPage } from '../lib/book'
import { type BookPageLayout, type Project } from '../lib/types'
import { personName } from '../lib/format'
import { editorialArrangement, editorialArrangements } from '../lib/bookPhoto'
import { photoData } from '../lib/storage'

export function PageLayoutControls({
  page,
  project,
  onChange,
  onError,
}: {
  page: BookPage
  project: Project
  onChange: (project: Project) => void
  onError: (message: string) => void
}) {
  const key = `${page.person.id}:${page.continuation}`
  const config = project.book.pageLayouts?.[key] ?? { layout: 'feature', photos: [] }
  const count = config.imageCount ?? (config.photos.length === 2 ? 2 : 1)
  const latest = useRef(project),
    request = useRef(0),
    input = useRef<HTMLInputElement>(null),
    slot = useRef(0)
  const [loading, setLoading] = useState(false)
  latest.current = project
  useEffect(
    () => () => {
      request.current++
    },
    [],
  )
  const set = (patch: Partial<BookPageLayout>) => {
    const p = latest.current
    onChange({
      ...p,
      book: {
        ...p.book,
        pageLayouts: {
          ...p.book.pageLayouts,
          [key]: { ...config, ...p.book.pageLayouts?.[key], ...patch },
        },
      },
    })
  }
  useEffect(() => {
    if (!config.photos.some((src, i) => src && !config.ratios?.[i])) return
    let cancelled = false
    void Promise.all(
      config.photos.map(async (src, i) => {
        if (!src || config.ratios?.[i]) return config.ratios?.[i] ?? 1.5
        const img = new Image()
        img.src = src
        await img.decode()
        return img.naturalWidth / img.naturalHeight
      }),
    )
      .then((ratios) => {
        if (!cancelled && latest.current.book.pageLayouts?.[key]?.photos === config.photos)
          set({ ratios })
      })
      .catch(() => {
        /* Older photos still fit safely using preserveAspectRatio. */
      })
    return () => {
      cancelled = true
    }
  }, [config.photos, config.ratios])
  const upload = (i: number) => {
    slot.current = i
    input.current?.click()
  }
  return (
    <div className="book-layout-controls">
      <p className="page-photo-person">
        {personName(page.person)}
        <small>Person’s page {page.continuation + 1}</small>
      </p>
      <div className="segmented" aria-label="Number of page photos">
        {([1, 2] as const).map((n) => (
          <button
            key={n}
            disabled={loading}
            aria-pressed={count === n}
            className={count === n ? 'active' : ''}
            onClick={() => set({ imageCount: n })}
          >
            {n === 1 ? 'One image' : 'Two images'}
          </button>
        ))}
      </div>
      <input
        ref={input}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={async (e) => {
          const file = e.target.files?.[0],
            i = slot.current
          e.target.value = ''
          if (!file) return
          const token = ++request.current
          setLoading(true)
          try {
            const photo = await photoData(file)
            const img = new Image()
            img.src = photo
            await img.decode()
            if (token !== request.current) return
            const current = latest.current.book.pageLayouts?.[key] ?? config
            const photos = Array.from(
                { length: Math.max(i + 1, current.photos.length) },
                (_, j) => current.photos[j] ?? '',
              ),
              ratios = Array.from(
                { length: Math.max(i + 1, current.photos.length) },
                (_, j) => current.ratios?.[j] ?? 1.5,
              )
            photos[i] = photo
            ratios[i] = img.naturalWidth / img.naturalHeight
            set({
              photos,
              ratios,
              layout:
                current.photos.some(Boolean) && current.layout !== 'text'
                  ? current.layout
                  : 'feature',
            })
          } catch (error) {
            if (token === request.current) onError((error as Error).message)
          } finally {
            if (token === request.current) setLoading(false)
          }
        }}
      />
      <div className="page-photo-slots">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="page-photo-slot">
            <button
              className="page-photo-upload"
              disabled={loading}
              onClick={() => upload(i)}
              aria-label={`${config.photos[i] ? 'Replace' : 'Add'} image ${i + 1}`}
            >
              {config.photos[i] ? (
                <img src={config.photos[i]} alt={`Page image ${i + 1}`} />
              ) : (
                <ImagePlus size={22} />
              )}
              <span>{config.photos[i] ? 'Replace image' : `Add image ${i + 1}`}</span>
            </button>
            {config.photos[i] && (
              <label className="page-photo-caption">
                Caption <span>optional</span>
                <textarea
                  rows={2}
                  maxLength={240}
                  placeholder="A place, a date, a memory…"
                  value={config.captions?.[i] ?? ''}
                  onChange={(e) => {
                    const captions = Array.from(
                      { length: Math.max(i + 1, config.captions?.length ?? 0) },
                      (_, j) => config.captions?.[j] ?? '',
                    )
                    captions[i] = e.target.value
                    set({ captions })
                  }}
                />
              </label>
            )}
            {config.photos[i] && (
              <button
                className="icon-btn page-photo-remove"
                disabled={loading}
                aria-label={`Remove image ${i + 1}`}
                onClick={() => {
                  const photos = [...config.photos]
                  photos[i] = ''
                  set({ photos })
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      {config.photos.slice(0, count).some(Boolean) && (
        <div className="page-composition-name">
          <span>PAGE COMPOSITION</span>
          <strong>{page.composition ?? 'Photographs & story'}</strong>
        </div>
      )}
      {count === 2 && config.photos.filter(Boolean).length === 2 && (
        <button
          className="text-btn"
          disabled={loading}
          onClick={() =>
            set({
              photos: [...config.photos].reverse(),
              ratios: config.ratios ? [...config.ratios].reverse() : undefined,
              captions: [config.captions?.[1] ?? '', config.captions?.[0] ?? ''],
            })
          }
        >
          <ArrowLeftRight size={14} /> Swap photographs
        </button>
      )}
      <button
        className="btn full"
        disabled={loading || !config.photos.slice(0, count).some(Boolean)}
        onClick={() =>
          set({
            layout:
              editorialArrangements[
                (editorialArrangements.indexOf(editorialArrangement(config.layout)) + 1) %
                  (count === 1 ? 3 : editorialArrangements.length)
              ],
          })
        }
      >
        <Shuffle size={14} /> Recompose page
      </button>
      <p className="help">
        {loading
          ? 'Preparing photograph…'
          : 'A composed page, made for your photographs. Recompose to explore another design.'}
      </p>
      {config.photos.slice(0, count).some(Boolean) && !page.pictures?.length && (
        <p className="help">
          There isn’t room for photos beneath this page’s details. Try a page with more space.
        </p>
      )}
    </div>
  )
}
