import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseGedcom } from './gedcom'
import { newProject } from './types'
import { layoutTree } from './tree'
import { routeTree } from './treeRouting'
import { projectTheme } from './themes'
import { TreeNodes } from '../components/Artwork'
import { personDetails } from './format'

function familyProject() {
  const names = [
    'Colin Hodges',
    'Margaret White',
    'Harold Hodges',
    'Beryl Gearing',
    'Robert White',
    'Emily Kirby',
    'Doris White',
    'Reginald Bartlett',
  ]
  const records = names
    .map((name, i) => `0 @I${i}@ INDI\n1 NAME ${name.replace(' ', ' /')}/`)
    .join('\n')
  const dataset = parseGedcom(`0 HEAD\n${records}
0 @F1@ FAM
1 HUSB @I0@
1 WIFE @I1@
0 @F2@ FAM
1 HUSB @I2@
1 WIFE @I3@
1 CHIL @I0@
0 @F3@ FAM
1 HUSB @I4@
1 WIFE @I5@
1 CHIL @I1@
0 @F4@ FAM
1 CHIL @I4@
1 CHIL @I6@
0 @F5@ FAM
1 HUSB @I7@
1 WIFE @I6@
0 TRLR`)
  const project = newProject(dataset, '@I0@')
  project.expanded = {
    '@I0@': { parents: true },
    '@I1@': { parents: true },
    '@I4@': { siblings: true },
  }
  return project
}

describe('family units', () => {
  it('orders parent couples by the displayed positions of Emily and Reginald', () => {
    const project = familyProject()
    project.dataset.families = [
      { id: 'root', parents: ['@I4@', '@I5@'], children: ['@I0@'] },
      { id: 'siblings', parents: [], children: ['@I5@', '@I7@'] },
      { id: 'reginald-parents', parents: ['@I1@', '@I2@'], children: ['@I7@'] },
      { id: 'emily-parents', parents: ['@I3@', '@I6@'], children: ['@I5@'] },
    ]
    project.expanded = {
      '@I0@': { parents: true },
      '@I5@': { parents: true, siblings: true },
      '@I7@': { parents: true },
    }
    const { nodes } = layoutTree(project)
    const x = (id: string) => nodes.find((node) => node.id === id)!.x
    expect(x('@I5@')).toBeLessThan(x('@I7@'))
    expect(Math.max(x('@I3@'), x('@I6@'))).toBeLessThan(Math.min(x('@I1@'), x('@I2@')))
  })

  it('routes a parent stem around an intervening card without losing its endpoints', () => {
    const node = (id: string, x: number, y: number) => ({
      id,
      x,
      y,
      width: 250,
      height: 100,
      level: 0,
      name: [],
      details: [],
    })
    const nodes = [
      node('left-parent', -165, 0),
      node('right-parent', 165, 0),
      node('intervening', 0, 210),
      node('child', 0, 420),
    ]
    const edges = routeTree(nodes, [
      { id: 'family', parents: ['left-parent', 'right-parent'], children: ['child'] },
    ])
    const geometry = edges.map((edge) => {
      const [, x, y, direction, end] = edge.split(' ')
      return {
        x: Number(x),
        y: Number(y),
        endX: direction === 'H' ? Number(end) : Number(x),
        endY: direction === 'V' ? Number(end) : Number(y),
      }
    })
    expect(geometry.some((s) => s.y === 45 && s.endY > 45 && Math.abs(s.x) < 40)).toBe(true)
    expect(geometry.some((s) => s.endY === 420 && Math.abs(s.endX) < 125)).toBe(true)
    expect(geometry.some((s) => s.x < 125 && s.endX > -125 && s.y < 310 && s.endY > 210)).toBe(
      false,
    )
  })
  it('keeps each couple adjacent when a sibling and their spouse expand', () => {
    const project = familyProject()
    project.dataset.people['@I0@'].photo = 'photo'
    const layout = layoutTree(project)
    const row = layout.nodes.filter((n) => n.level === -1).sort((a, b) => a.x - b.x)
    expect(new Set(layout.nodes.map((n) => n.height)).size).toBeGreaterThan(1)
    for (const pair of [
      ['@I2@', '@I3@'],
      ['@I4@', '@I5@'],
      ['@I6@', '@I7@'],
    ]) {
      expect(
        Math.abs(row.findIndex((n) => n.id === pair[0]) - row.findIndex((n) => n.id === pair[1])),
      ).toBe(1)
    }
    expect(row.findIndex((n) => n.id === '@I6@')).toBeLessThan(
      row.findIndex((n) => n.id === '@I4@'),
    )
    const harold = row.find((n) => n.id === '@I2@')!,
      beryl = row.find((n) => n.id === '@I3@')!
    const doris = row.find((n) => n.id === '@I6@')!
    expect(doris.x < Math.min(harold.x, beryl.x) || doris.x > Math.max(harold.x, beryl.x)).toBe(
      true,
    )
    const horizontal = layout.edges.flatMap((edge) => {
      const match = /^M (-?[\d.]+) (-?[\d.]+) H (-?[\d.]+)$/.exec(edge)
      if (!match) return []
      const x1 = Number(match[1]),
        y = Number(match[2]),
        x2 = Number(match[3])
      return [{ y, min: Math.min(x1, x2), max: Math.max(x1, x2) }]
    })
    for (let i = 0; i < horizontal.length; i++)
      for (let j = i + 1; j < horizontal.length; j++)
        if (horizontal[i].y === horizontal[j].y)
          expect(Math.max(horizontal[i].min, horizontal[j].min)).toBeGreaterThanOrEqual(
            Math.min(horizontal[i].max, horizontal[j].max),
          )
    const segments = layout.edges.flatMap((edge) => {
      const tokens = edge.split(/\s+/),
        result: { kind: 'h' | 'v'; x1: number; x2: number; y1: number; y2: number }[] = []
      let x = Number(tokens[1]),
        y = Number(tokens[2])
      for (let i = 3; i < tokens.length; i += 2) {
        const command = tokens[i],
          value = Number(tokens[i + 1])
        if (command === 'V') {
          result.push({ kind: 'v', x1: x, x2: x, y1: y, y2: value })
          y = value
        } else if (command === 'H') {
          result.push({ kind: 'h', x1: x, x2: value, y1: y, y2: y })
          x = value
        }
      }
      return result
    })
    const horizontalSegments = segments.filter((segment) => segment.kind === 'h')
    const verticalSegments = segments.filter((segment) => segment.kind === 'v')
    for (const horizontalSegment of horizontalSegments)
      for (const verticalSegment of verticalSegments)
        if (
          verticalSegment.x1 > Math.min(horizontalSegment.x1, horizontalSegment.x2) &&
          verticalSegment.x1 < Math.max(horizontalSegment.x1, horizontalSegment.x2) &&
          horizontalSegment.y1 > Math.min(verticalSegment.y1, verticalSegment.y2) &&
          horizontalSegment.y1 < Math.max(verticalSegment.y1, verticalSegment.y2)
        )
          throw new Error(`Crossing connector at ${verticalSegment.x1},${horizontalSegment.y1}`)
    for (let i = 0; i < verticalSegments.length; i++)
      for (let j = i + 1; j < verticalSegments.length; j++)
        if (
          Math.abs(verticalSegments[i].x1 - verticalSegments[j].x1) < 2 &&
          Math.min(verticalSegments[i].y2, verticalSegments[j].y2) -
            Math.max(verticalSegments[i].y1, verticalSegments[j].y1) >
            2
        )
          throw new Error(`Overlapping vertical connectors at ${verticalSegments[i].x1}`)
  })
  it('uses symbols for birth and death details', () => {
    const project = familyProject()
    const person = project.dataset.people['@I0@']
    person.birthDate = '1 JAN 1900'
    person.deathDate = '2 FEB 1980'
    expect(personDetails(person, project.display)).toEqual([
      '✦ 1 January 1900',
      '✝ 2 February 1980',
    ])
    person.birthPlace = 'London'
    expect(personDetails(person, project.display).slice(0, 2)).toEqual([
      '✦ 1 January 1900',
      'London',
    ])
  })
  it('automatically includes a single spouse and omits their partner control', () => {
    const project = familyProject()
    project.dataset.people['@I0@'].birthDate = '1 JAN 1900'
    project.expanded = {}
    const layout = layoutTree(project)
    expect(layout.nodes.map((n) => n.id)).toEqual(['@I0@', '@I1@'])
    const html = renderToStaticMarkup(
      <TreeNodes project={project} layout={layout} theme={projectTheme(project)} interactive />,
    )
    expect(html).not.toContain('Show partners')
    project.dataset.families.push({ id: 'second', parents: ['@I0@', '@I7@'], children: [] })
    const expanded = layoutTree(project)
    expect(expanded.nodes.some((n) => n.id === '@I7@')).toBe(false)
    expect(
      renderToStaticMarkup(
        <TreeNodes project={project} layout={expanded} theme={projectTheme(project)} interactive />,
      ),
    ).toContain('Show partners')
    project.expanded['@I0@'] = { partners: true }
    expect(layoutTree(project).nodes.some((n) => n.id === '@I7@')).toBe(true)
  })
})
