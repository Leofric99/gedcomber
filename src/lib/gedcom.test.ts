import { describe, expect, it } from 'vitest'
import { parseGedcom, exportGedcom, updatePerson } from './gedcom'
import { formatDate, personName } from './format'
import { layoutTree, relatives } from './tree'
import { newProject } from './types'
const ged = `0 HEAD
1 SOUR TEST
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Jane Mary /Smith/
1 SEX F
1 BIRT
2 DATE ABT 1900
2 PLAC London
2 SOUR @S1@
1 NOTE @N1@
1 _CUSTOM Keep this
1 FAMC @F1@
0 @I2@ INDI
1 NAME John /Smith/
0 @I3@ INDI
1 NAME Anne /Jones/
0 @I4@ INDI
1 NAME Sam /Smith/
0 @I5@ INDI
1 NAME Rose /Smith/
0 @I6@ INDI
1 NAME Will /Smith/
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I3@
1 CHIL @I1@
1 CHIL @I4@
1 CHIL @I5@
1 CHIL @I6@
1 MARR
2 DATE 1 JUN 1890
0 @S1@ SOUR
1 TITL Original source
0 @N1@ NOTE Shared note
1 CONT with another line
0 TRLR
`
describe('GEDCOM records and edits', () => {
  it('reads shared notes and keeps unknown records and sources outside editable facts', () => {
    const d = parseGedcom(ged)
    expect(d.people['@I1@'].notes).toBe('Shared note\nwith another line')
    expect(exportGedcom(d).replace(/\r/g, '')).toBe(ged)
  })
  it('exports every individual and preserves unrelated nested event data after editing', () => {
    let d = parseGedcom(ged)
    d = updatePerson(d, {
      ...d.people['@I1@'],
      given: 'Jane Elizabeth',
      birthDate: '2 MAY 1901',
      notes: 'An edited\nnote',
      story: 'A life\nin two lines',
    })
    const out = exportGedcom(d),
      again = parseGedcom(out)
    expect(Object.keys(again.people)).toHaveLength(6)
    expect(again.people['@I1@'].given).toBe('Jane Elizabeth')
    expect(again.people['@I1@'].birthDate).toBe('2 MAY 1901')
    expect(again.people['@I1@'].story).toBe('A life\nin two lines')
    expect(out).toContain('2 SOUR @S1@')
    expect(out).toContain('1 _CUSTOM Keep this')
    expect(out).toContain('2 DATE 1 JUN 1890')
    expect(out).toContain('1 TITL Original source')
    expect(again.people['@I1@'].notes).toBe('An edited\nnote')
  })
  it('handles notes with CONC continuations', () => {
    const d = parseGedcom(ged.replace('1 NOTE @N1@', '1 NOTE Long\n2 CONC er\n2 CONT note'))
    expect(d.people['@I1@'].notes).toBe('Longer\nnote')
  })
  it('rejects malformed hierarchy, duplicate IDs, unsupported encoding and files without people', () => {
    expect(() => parseGedcom('0 HEAD\n2 BAD x')).toThrow('Missing parent')
    expect(() => parseGedcom(ged + '0 @I1@ INDI')).toThrow('Duplicate')
    expect(() => parseGedcom(ged.replace('UTF-8', 'ANSEL'))).toThrow('ANSEL')
    expect(() => parseGedcom('0 HEAD\n0 TRLR')).toThrow('No individuals')
  })
  it('merges individual-only family links and retains multiple parents', () => {
    const d = parseGedcom(
      ged
        .replace('1 HUSB @I2@\n', '')
        .replace('1 NAME John /Smith/', '1 NAME John /Smith/\n1 FAMS @F1@'),
    )
    expect(relatives(d, '@I1@').parents).toContain('@I2@')
  })
})
describe('progressive tree expansion', () => {
  it('starts with only the selected primary person', () => {
    const p = newProject(parseGedcom(ged), '@I1@')
    expect(layoutTree(p).nodes.map((n) => n.id)).toEqual(['@I1@'])
  })
  it('shows only requested relations, balances siblings and hides them when collapsed', () => {
    const p = newProject(parseGedcom(ged), '@I1@')
    p.expanded['@I1@'] = { siblings: true }
    const l = layoutTree(p)
    expect(l.nodes).toHaveLength(4)
    expect(l.nodes.filter((n) => n.x < 0)).toHaveLength(2)
    expect(l.nodes.filter((n) => n.x > 0)).toHaveLength(1)
    p.expanded['@I1@'].siblings = false
    expect(layoutTree(p).nodes).toHaveLength(1)
  })
  it('collapses ancestors transitively without deleting their expansion preferences', () => {
    const p = newProject(parseGedcom(ged), '@I1@')
    p.expanded['@I1@'] = { parents: true }
    p.expanded['@I2@'] = { children: true }
    expect(layoutTree(p).nodes).toHaveLength(6)
    p.expanded['@I1@'].parents = false
    expect(layoutTree(p).nodes).toHaveLength(1)
    expect(p.expanded['@I2@'].children).toBe(true)
  })
  it('terminates when genealogy contains cycles and produces nonoverlapping cards', () => {
    const p = newProject(parseGedcom(ged), '@I1@')
    p.dataset.families.push({ id: 'cycle', parents: ['@I1@'], children: ['@I2@'] })
    Object.keys(p.dataset.people).forEach(
      (id) => (p.expanded[id] = { parents: true, siblings: true, children: true }),
    )
    const l = layoutTree(p)
    expect(l.nodes).toHaveLength(6)
    for (const a of l.nodes)
      for (const b of l.nodes)
        if (a.id !== b.id && a.level === b.level)
          expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(300)
  })
})
describe('display formatting without mutating historical dates', () => {
  it('formats exact and approximate dates while preserving qualifiers', () => {
    expect(formatDate('21 MAY 1900', 'ordinal')).toBe('21st May 1900')
    expect(formatDate('11 MAY 1900', 'ordinal')).toBe('11th May 1900')
    expect(formatDate('ABT 1900', 'year')).toBe('c. 1900')
    expect(formatDate('BET 1 JAN 1900 AND 2 FEB 1901', 'numeric')).toBe(
      'Between 01 01 1900 and 02 02 1901',
    )
    expect(formatDate('@#DJULIAN@ 4 MAR 1700', 'long')).toBe('@#DJULIAN@ 4 MAR 1700')
    expect(formatDate('MAY 1900', 'iso')).toBe('1900-05')
  })
  it('shortens given names independently from the stored name', () => {
    const p = parseGedcom(ged).people['@I1@']
    expect(personName(p, 'short')).toBe('Jane Smith')
    expect(personName(p, 'initials')).toBe('Jane M. Smith')
    expect(p.given).toBe('Jane Mary')
  })
})
