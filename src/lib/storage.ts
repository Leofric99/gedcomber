import { get, set } from 'idb-keyval'
import type { Project } from './types'
const KEY = 'gedcomber-project-v1'
let pending: Project | undefined
let flushing: Promise<void> | undefined
export const loadProject = () => get<Project>(KEY)
export const hasPendingSaves = () => !!flushing
export function saveProject(project: Project): Promise<void> {
  pending = project
  // Coalesce rapid edits while a write is in flight; the newest revision always wins.
  if (!flushing)
    flushing = (async () => {
      try {
        while (pending) {
          const next = pending
          pending = undefined
          await set(KEY, next)
        }
      } finally {
        flushing = undefined
      }
    })()
  return flushing
}
export function download(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
export function backupProject(p: Project) {
  download(
    JSON.stringify(p),
    `${p.dataset.filename.replace(/\.[^.]+$/, '')}.gedcomber`,
    'application/json',
  )
}
export function validateProject(value: unknown): Project {
  const p = value as Project
  if (
    !p ||
    p.version !== 1 ||
    !p.dataset?.records?.length ||
    !p.dataset?.people?.[p.primary] ||
    !Array.isArray(p.dataset.families) ||
    !p.book ||
    !p.display ||
    !p.expanded ||
    !['botanical', 'heritage', 'modern', 'midnight'].includes(p.theme)
  )
    throw new Error('This is not a valid Gedcomber project backup.')
  const ids = new Set(Object.keys(p.dataset.people))
  for (const [id, person] of Object.entries(p.dataset.people)) {
    if (
      person.id !== id ||
      [
        'given',
        'surname',
        'birthDate',
        'deathDate',
        'birthPlace',
        'deathPlace',
        'burialPlace',
        'occupation',
        'notes',
        'story',
        'suffix',
        'sex',
      ].some((k) => typeof person[k as keyof typeof person] !== 'string')
    )
      throw new Error('The backup contains an invalid person record.')
    if (
      [person.photo, person.photoOriginal].some(
        (photo) => photo && !/^data:image\/(png|jpeg|webp);base64,/.test(photo),
      )
    )
      throw new Error('The backup contains an unsupported photograph.')
    if (
      person.photoCrop &&
      (!Object.values(person.photoCrop).every(Number.isFinite) ||
        person.photoCrop.zoom < 1 ||
        person.photoCrop.zoom > 5 ||
        Math.abs(person.photoCrop.x) > 1 ||
        Math.abs(person.photoCrop.y) > 1)
    )
      throw new Error('The backup contains invalid photograph framing.')
  }
  if (
    !Array.isArray(p.book.ids) ||
    p.book.ids.length > 100 ||
    p.book.ids.some((id) => !ids.has(id))
  )
    throw new Error('The book selection in this backup is invalid.')
  if (
    typeof p.title !== 'string' ||
    typeof p.subtitle !== 'string' ||
    !p.viewport ||
    ![p.viewport.x, p.viewport.y, p.viewport.zoom].every(Number.isFinite)
  )
    throw new Error('The backup has invalid view settings.')
  const validDisplay = (d: Project['display']) =>
    d &&
    ['full', 'short', 'initials'].includes(d.names) &&
    ['long', 'ordinal', 'numeric', 'iso', 'year', 'original'].includes(d.dates) &&
    ['photos', 'birth', 'death', 'places', 'occupation', 'notes', 'burial'].every(
      (k) => typeof d[k as keyof typeof d] === 'boolean',
    )
  if (
    !validDisplay(p.display) ||
    (p.personBoxes !== undefined && typeof p.personBoxes !== 'boolean') ||
    (p.decorationSize !== undefined &&
      (!Number.isFinite(p.decorationSize) || p.decorationSize < 0.5 || p.decorationSize > 2)) ||
    !validDisplay(p.book.display) ||
    !['a4', 'a5', 'letter'].includes(p.book.size) ||
    typeof p.book.landscape !== 'boolean' ||
    typeof p.book.story !== 'boolean' ||
    typeof p.book.title !== 'string' ||
    !['top', 'left', 'right'].includes(p.book.photoPosition) ||
    !Number.isFinite(p.book.fontSize) ||
    p.book.fontSize < 12 ||
    p.book.fontSize > 22
  )
    throw new Error('The backup has invalid display or book settings.')
  if (new Set(p.book.ids).size !== p.book.ids.length)
    throw new Error('The book contains duplicate selections.')
  if (p.viewport.zoom < 0.01 || p.viewport.zoom > 3)
    throw new Error('The backup has an invalid zoom level.')
  if (
    !p.colors ||
    Object.entries(p.colors).some(
      ([key, v]) =>
        !['paper', 'ink', 'accent'].includes(key) ||
        typeof v !== 'string' ||
        !/^#[0-9a-f]{6}$/i.test(v),
    )
  )
    throw new Error('The backup has invalid theme colours.')
  if (
    Object.entries(p.expanded).some(
      ([id, groups]) =>
        !ids.has(id) ||
        !groups ||
        Object.entries(groups).some(
          ([key, v]) =>
            !['parents', 'siblings', 'partners', 'children'].includes(key) ||
            typeof v !== 'boolean',
        ),
    )
  )
    throw new Error('The backup has invalid expansion settings.')
  if (
    p.dataset.families.some(
      (f) =>
        typeof f.id !== 'string' ||
        !Array.isArray(f.parents) ||
        !Array.isArray(f.children) ||
        [...f.parents, ...f.children].some((id) => !ids.has(id)),
    )
  )
    throw new Error('The backup contains invalid family links.')
  const checkNodes = (nodes: Project['dataset']['records'], depth = 0): boolean =>
    depth < 100 &&
    Array.isArray(nodes) &&
    nodes.every(
      (n) =>
        n &&
        typeof n.tag === 'string' &&
        /^\w+$/.test(n.tag) &&
        typeof n.value === 'string' &&
        (!n.xref || typeof n.xref === 'string') &&
        checkNodes(n.children, depth + 1),
    )
  if (!checkNodes(p.dataset.records) || typeof p.dataset.filename !== 'string')
    throw new Error('The backup contains invalid GEDCOM records.')
  return p
}
export async function photoData(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Please choose a JPEG, PNG, or WebP photograph.')
  if (file.size > 25 * 1024 * 1024)
    throw new Error('Please choose a photograph smaller than 25 MB.')
  const bitmap = await createImageBitmap(file),
    canvas = document.createElement('canvas')
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.9)
}
