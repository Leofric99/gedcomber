import type { Dataset, Family, GedNode, Person } from './types'
import { relationshipEnded } from './relationships'
const child = (n: GedNode | undefined, tag: string) => n?.children.find((c) => c.tag === tag)
const value = (n: GedNode | undefined, tag: string) => child(n, tag)?.value ?? ''
export function nodeText(n?: GedNode): string {
  if (!n) return ''
  return (
    n.value +
    n.children
      .filter((c) => c.tag === 'CONT' || c.tag === 'CONC')
      .map((c) => (c.tag === 'CONT' ? '\n' : '') + nodeText(c))
      .join('')
  )
}
export function parseGedcom(text: string, filename = 'Family.ged'): Dataset {
  const records: GedNode[] = [],
    stack: GedNode[] = []
  let lineNumber = 0
  for (const line of text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)) {
    lineNumber++
    if (!line.trim()) continue
    const m = /^(\d+)\s+(?:(@[^@]+@)\s+)?([\w]+)(?:\s(.*))?$/.exec(line)
    if (!m) throw new Error(`Invalid GEDCOM at line ${lineNumber}. Expected a level and a tag.`)
    const level = Number(m[1])
    if (level > 0 && !stack[level - 1])
      throw new Error(`Missing parent record at line ${lineNumber}.`)
    const n: GedNode = {
      tag: m[3].toUpperCase(),
      value: m[4] ?? '',
      children: [],
      ...(m[2] ? { xref: m[2] } : {}),
    }
    if (level === 0) records.push(n)
    else stack[level - 1].children.push(n)
    stack[level] = n
    stack.length = level + 1
  }
  if (!records.some((r) => r.tag === 'HEAD'))
    throw new Error('This file has no GEDCOM header (HEAD).')
  const charset = value(
    records.find((r) => r.tag === 'HEAD'),
    'CHAR',
  ).toUpperCase()
  if (charset === 'ANSEL')
    throw new Error(
      'ANSEL encoding is not supported. Please export this file as UTF-8 from your genealogy application.',
    )
  const people: Record<string, Person> = {}
  const ids = new Set<string>()
  for (const r of records) {
    if (r.xref && ids.has(r.xref)) throw new Error(`Duplicate record identifier ${r.xref}.`)
    if (r.xref) ids.add(r.xref)
    if (r.tag !== 'INDI' || !r.xref) continue
    const name = child(r, 'NAME'),
      split = (name?.value ?? '').split('/')
    const given = value(name, 'GIVN') || split[0]?.trim() || ''
    const surname = value(name, 'SURN') || split[1]?.trim() || ''
    const noteTexts = r.children
      .filter((c) => c.tag === 'NOTE')
      .map((n) => {
        const reference = records.find((ref) => ref.tag === 'NOTE' && ref.xref === n.value)
        return nodeText(reference ?? n)
      })
    people[r.xref] = {
      id: r.xref,
      given,
      surname,
      suffix: value(name, 'NSFX') || split[2]?.trim() || '',
      sex: value(r, 'SEX'),
      birthDate: value(child(r, 'BIRT'), 'DATE'),
      birthPlace: value(child(r, 'BIRT'), 'PLAC'),
      deathDate: value(child(r, 'DEAT'), 'DATE'),
      deathPlace: value(child(r, 'DEAT'), 'PLAC'),
      burialPlace: value(child(r, 'BURI'), 'PLAC'),
      occupation: nodeText(child(r, 'OCCU')),
      notes: noteTexts.join('\n\n'),
      story: nodeText(child(r, '_STORY')),
    }
  }
  if (!Object.keys(people).length) throw new Error('No individuals were found in this GEDCOM file.')
  const families: Family[] = records
    .filter((r) => r.tag === 'FAM' && r.xref)
    .map((r) => ({
      id: r.xref!,
      ...(relationshipEnded(r) ? { ended: true } : {}),
      parents: r.children
        .filter((c) => ['HUSB', 'WIFE'].includes(c.tag))
        .map((c) => c.value)
        .filter((id) => people[id]),
      children: r.children
        .filter((c) => c.tag === 'CHIL')
        .map((c) => c.value)
        .filter((id) => people[id]),
    }))
  // Some exporters emit links only on the individual; merge those without losing multiple families.
  for (const r of records.filter((r) => r.tag === 'INDI' && r.xref)) {
    for (const link of r.children.filter((c) => c.tag === 'FAMC' || c.tag === 'FAMS')) {
      let f = families.find((f) => f.id === link.value)
      if (!f) {
        f = { id: link.value, parents: [], children: [] }
        families.push(f)
      }
      const list = link.tag === 'FAMC' ? f.children : f.parents
      if (!list.includes(r.xref!)) list.push(r.xref!)
    }
  }
  return { records, people, families, filename }
}
function makeNode(tag: string, text: string): GedNode {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  return {
    tag,
    value: lines[0] ?? '',
    children: lines.slice(1).map((value) => ({ tag: 'CONT', value, children: [] })),
  }
}
function setField(parent: GedNode, tag: string, text: string) {
  const n = child(parent, tag)
  if (n) {
    const replacement = makeNode(tag, text)
    n.value = replacement.value
    n.children = [
      ...n.children.filter((c) => !['CONT', 'CONC'].includes(c.tag)),
      ...replacement.children,
    ]
  } else if (text) parent.children.push(makeNode(tag, text))
}
function setEvent(parent: GedNode, tag: string, field: string, text: string) {
  let event = child(parent, tag)
  if (!event && text) {
    event = makeNode(tag, '')
    parent.children.push(event)
  }
  if (event) setField(event, field, text)
}
export function updatePerson(dataset: Dataset, person: Person): Dataset {
  const original = dataset.people[person.id]
  if (!original) throw new Error('Individual no longer exists.')
  const records = dataset.records.map((record) => {
    if (record.xref !== person.id || record.tag !== 'INDI') return record
    const r = structuredClone(record)
    if (
      ['given', 'surname', 'suffix'].some(
        (key) => person[key as keyof Person] !== original[key as keyof Person],
      )
    ) {
      setField(
        r,
        'NAME',
        `${person.given} /${person.surname}/${person.suffix ? ' ' + person.suffix : ''}`,
      )
      const n = child(r, 'NAME')!
      setField(n, 'GIVN', person.given)
      setField(n, 'SURN', person.surname)
      setField(n, 'NSFX', person.suffix)
    }
    if (person.sex !== original.sex) setField(r, 'SEX', person.sex)
    for (const [key, tag, field] of [
      ['birthDate', 'BIRT', 'DATE'],
      ['birthPlace', 'BIRT', 'PLAC'],
      ['deathDate', 'DEAT', 'DATE'],
      ['deathPlace', 'DEAT', 'PLAC'],
      ['burialPlace', 'BURI', 'PLAC'],
    ] as const) {
      if (person[key] !== original[key]) setEvent(r, tag, field, person[key])
    }
    if (person.occupation !== original.occupation) setField(r, 'OCCU', person.occupation)
    if (person.notes !== original.notes) {
      r.children = r.children.filter((c) => c.tag !== 'NOTE')
      if (person.notes) r.children.push(makeNode('NOTE', person.notes))
    }
    if (person.story !== original.story) setField(r, '_STORY', person.story)
    return r
  })
  return { ...dataset, records, people: { ...dataset.people, [person.id]: person } }
}
export function exportGedcom(dataset: Dataset): string {
  const lines: string[] = []
  const records = structuredClone(dataset.records)
  const header = records.find((r) => r.tag === 'HEAD')
  if (header) {
    const version = value(child(header, 'GEDC'), 'VERS')
    if (!version.startsWith('7')) setField(header, 'CHAR', 'UTF-8')
  }
  function write(n: GedNode, level: number) {
    lines.push(`${level} ${n.xref ? n.xref + ' ' : ''}${n.tag}${n.value ? ' ' + n.value : ''}`)
    n.children.forEach((c) => write(c, level + 1))
  }
  records.filter((r) => r.tag !== 'TRLR').forEach((r) => write(r, 0))
  lines.push('0 TRLR')
  return lines.join('\r\n') + '\r\n'
}
export async function readGedcomFile(file: File) {
  const buffer = await file.arrayBuffer(),
    bytes = new Uint8Array(buffer)
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? 'utf-16le'
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? 'utf-16be'
        : 'utf-8'
  let text: string
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(buffer)
  } catch {
    throw new Error('This file is not valid UTF-8 or UTF-16. Please re-export it as UTF-8.')
  }
  return parseGedcom(text, file.name)
}
