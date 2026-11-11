import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseGedcom } from './gedcom'
import { newProject } from './types'
import { layoutTree } from './tree'
import { CONNECTOR_SPACING, routeTree, treeGenerationGaps } from './treeRouting'
import { projectTheme } from './themes'
import { TreeNodes, TreePrint } from '../components/Artwork'
import { personDetails } from './format'
import { orderTreeRows } from './treeOrdering'
import { spaceTreeFamilies } from './treeSpacing'

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
  it('shows the child arrow on the closest partner, retaining both for separate children', () => {
    const project = familyProject()
    project.dataset.families = [
      { id: 'siblings', parents: [], children: ['@I0@', '@I4@'] },
      { id: 'couple', parents: ['@I4@', '@I5@'], children: ['@I6@'] },
    ]
    project.expanded = { '@I0@': { siblings: true } }
    const render = () =>
      renderToStaticMarkup(
        <TreeNodes
          project={project}
          layout={layoutTree(project)}
          theme={projectTheme(project)}
          interactive
        />,
      )
    expect(render()).toContain('Show children of Robert White')
    expect(render()).not.toContain('Show children of Emily Kirby')
    // An additional family record for the same couple is still shared children.
    project.dataset.families.push({
      id: 'more-shared',
      parents: ['@I4@', '@I5@'],
      children: ['@I7@'],
    })
    expect(render()).not.toContain('Show children of Emily Kirby')
    project.dataset.families.pop()
    project.dataset.families.push({ id: 'separate', parents: ['@I5@'], children: ['@I7@'] })
    expect(render()).toContain('Show children of Robert White')
    expect(render()).toContain('Show children of Emily Kirby')
    project.dataset.families.pop()
    project.primary = '@I5@'
    project.expanded = {}
    expect(render()).toContain('Show children of Emily Kirby')
    expect(render()).not.toContain('Show children of Robert White')
    project.expanded['@I5@'] = { children: true }
    expect(render()).toContain('Hide children of Emily Kirby')
  })

  it('hides redundant child and sibling expansion controls while retaining collapse controls', () => {
    const project = familyProject()
    project.dataset.families = [
      { id: 'origin', parents: ['@I2@', '@I3@'], children: ['@I0@', '@I4@', '@I6@'] },
      { id: 'main', parents: ['@I0@', '@I1@'], children: ['@I7@'] },
      { id: 'sibling', parents: ['@I4@', '@I5@'], children: [] },
    ]
    project.expanded = { '@I0@': { parents: true } }
    const render = () =>
      renderToStaticMarkup(
        <TreeNodes
          project={project}
          layout={layoutTree(project)}
          theme={projectTheme(project)}
          interactive
        />,
      )
    let html = render()
    expect(html).not.toContain('Show children of Harold Hodges')
    expect(html).not.toContain('Show children of Beryl Gearing')
    expect(html).toContain('Show children of Colin Hodges')
    expect(html).toContain('Show siblings to the left of Colin Hodges')
    project.expanded['@I0@'].siblings = true
    html = render()
    expect(html).toContain('Hide siblings to the left of Colin Hodges')
    expect(html).not.toMatch(/Show siblings [^"]* of (Robert White|Doris White)/)
    expect(html).not.toContain('children of Robert White')
    project.expanded['@I0@'].children = true
    expect(render()).toContain('Hide children of Colin Hodges')
    project.expanded['@I0@'].siblings = false
    expect(render()).toContain('Show siblings to the left of Colin Hodges')
  })

  it('separates independent ancestor couples above a wide sibling row to shorten their links', () => {
    const ids = [
      'primary',
      ...Array.from({ length: 9 }, (_, i) => [`sibling-${i}`, `spouse-${i}`]).flat(),
      ...[0, 4, 8].flatMap((i) => [`father-${i}`, `mother-${i}`]),
    ]
    const dataset = parseGedcom(
      `0 HEAD\n${ids.map((id) => `0 @${id}@ INDI\n1 NAME ${id} /Example/`).join('\n')}\n0 TRLR`,
    )
    dataset.families = [
      { id: 'primary-parents', parents: ['@sibling-4@', '@spouse-4@'], children: ['@primary@'] },
      {
        id: 'siblings',
        parents: [],
        children: Array.from({ length: 9 }, (_, i) => `@sibling-${i}@`),
      },
      ...Array.from({ length: 9 }, (_, i) => ({
        id: `couple-${i}`,
        parents: [`@sibling-${i}@`, `@spouse-${i}@`],
        children: [],
      })),
      ...[0, 4, 8].map((i) => ({
        id: `ancestors-${i}`,
        parents: [`@father-${i}@`, `@mother-${i}@`],
        children: [`@spouse-${i}@`],
      })),
    ]
    const project = newProject(dataset, '@primary@')
    project.expanded = { '@primary@': { parents: true }, '@sibling-4@': { siblings: true } }
    for (const i of [0, 4, 8]) project.expanded[`@spouse-${i}@`] = { parents: true }
    const layout = layoutTree(project)
    const node = (id: string) => layout.nodes.find((n) => n.id === `@${id}@`)!
    const top = layout.nodes.filter((n) => n.level === -2).sort((a, b) => a.x - b.x)
    expect(top).toHaveLength(6)
    expect(Math.max(top[2].x - top[1].x, top[4].x - top[3].x)).toBeGreaterThan(660)
    for (const i of [0, 4, 8]) {
      expect(Math.abs(node(`father-${i}`).x - node(`mother-${i}`).x)).toBe(330)
      expect((node(`father-${i}`).x + node(`mother-${i}`).x) / 2).toBeCloseTo(node(`spouse-${i}`).x)
    }
    const middle = layout.nodes.filter((n) => n.level === -1).sort((a, b) => a.x - b.x)
    for (let i = 1; i < middle.length; i++) expect(middle[i].x - middle[i - 1].x).toBe(330)
    expect((node('sibling-4').x + node('spouse-4').x) / 2).toBeCloseTo(node('primary').x)
    // Spacing must be stable on repeated renders, including exported layouts.
    expect(layoutTree(project)).toEqual(layout)
  })

  it('keeps ordinary generations compact when their links are already short', () => {
    const makeNode = (id: string, x: number, level: number) => ({
      id,
      x,
      y: level * 220,
      level,
      width: 250,
      height: 100,
      name: [],
      details: [],
    })
    const parents = [makeNode('a-parent', 0, -1), makeNode('b-parent', 330, -1)]
    const children = [makeNode('a', 100, 0), makeNode('b', 430, 0)]
    const rows: [number, typeof parents][] = [
      [-1, parents],
      [0, children],
    ]
    const before = rows.flatMap(([, row]) => row.map((node) => node.x))
    spaceTreeFamilies(
      rows,
      [
        { id: 'a', parents: ['a-parent'], children: ['a'] },
        { id: 'b', parents: ['b-parent'], children: ['b'] },
      ],
      'a',
      new Map([
        ['a', 0],
        ['a-parent', 1],
        ['b', 2],
        ['b-parent', 3],
      ]),
    )
    expect(rows.flatMap(([, row]) => row.map((node) => node.x))).toEqual(before)
  })

  it('removes only the person boxes in canvas and print views', () => {
    const project = familyProject()
    project.dataset.people['@I0@'].photo = 'data:image/jpeg;base64,AA=='
    const layout = layoutTree(project)
    const theme = projectTheme(project)
    const boxed = renderToStaticMarkup(
      <svg>
        <TreeNodes project={project} layout={layout} theme={theme} interactive />
      </svg>,
    )
    project.personBoxes = false
    const skeletal = renderToStaticMarkup(
      <svg>
        <TreeNodes
          project={project}
          layout={layout}
          theme={theme}
          interactive
          selected={project.primary}
        />
      </svg>,
    )
    expect(layoutTree(project)).toEqual(layout)
    const boxes = skeletal.match(/<rect\b[^>]*>/g)!
    expect(boxes).toHaveLength(layout.nodes.length)
    expect(
      boxes.every((rect) => rect.includes('fill="transparent"') && rect.includes('stroke="none"')),
    ).toBe(true)
    for (const pattern of [
      /<text\b[^>]*>[\s\S]*?<\/text>/g,
      /<image\b[^>]*>/g,
      /<path\b[^>]*>/g,
      /aria-label="[^"]*"/g,
    ])
      expect(skeletal.match(pattern)).toEqual(boxed.match(pattern))
    const printed = renderToStaticMarkup(
      <TreePrint project={project} layout={layout} theme={theme} title="" subtitle="" />,
    )
    expect(printed.match(/fill="transparent" stroke="none"/g)).toHaveLength(layout.nodes.length)
    delete project.personBoxes
    const legacy = renderToStaticMarkup(
      <svg>
        <TreeNodes project={project} layout={layout} theme={theme} interactive />
      </svg>,
    )
    expect(legacy).toBe(boxed)
  })

  it('centers the primary person under their parents without centering an asymmetric export on them', () => {
    const project = familyProject()
    project.dataset.families = [
      { id: 'origin', parents: ['@I2@', '@I3@'], children: ['@I0@', '@I4@'] },
      { id: 'primary-couple', parents: ['@I0@', '@I1@'], children: [] },
      { id: 'sibling-couple', parents: ['@I4@', '@I5@'], children: [] },
    ]
    project.expanded = { '@I0@': { parents: true, siblings: true } }
    const layout = layoutTree(project)
    const node = (id: string) => layout.nodes.find((node) => node.id === id)!
    const midpoint = (node('@I2@').x + node('@I3@').x) / 2
    expect(node(project.primary).x).toBeCloseTo(midpoint)
    expect(node(project.primary).y).toBeGreaterThan(node('@I2@').y)
    expect(Math.abs(layout.minX + layout.width / 2 - node(project.primary).x)).toBeGreaterThan(1)
    const width = Math.max(760, layout.width)
    const translation = (width - layout.width) / 2 - layout.minX
    const printed = renderToStaticMarkup(
      <TreePrint
        project={project}
        layout={layout}
        theme={projectTheme(project)}
        title=""
        subtitle=""
      />,
    )
    expect(printed).toContain(`translate(${translation} ${35 - layout.minY})`)
    expect(Math.abs(node(project.primary).x + translation - width / 2)).toBeGreaterThan(1)
  })

  it('keeps Eleanor and Robin consecutive without Lee’s siblings between them', () => {
    const names = [
      'Lee',
      'Eleanor',
      'Sharon',
      'Andrew',
      'Clark',
      'Robin',
      'Colin',
      'Margaret',
      'Allan',
      'Susan',
    ]
    const records = names.map((name, i) => `0 @I${i}@ INDI\n1 NAME ${name} /Example/`).join('\n')
    const dataset = parseGedcom(`0 HEAD\n${records}\n0 TRLR`)
    const families = [
      { id: 'lee-parents', parents: ['@I6@', '@I7@'], children: ['@I0@', '@I2@', '@I4@'] },
      { id: 'eleanor-parents', parents: ['@I8@', '@I9@'], children: ['@I1@', '@I5@'] },
      { id: 'couple', parents: ['@I0@', '@I1@'], children: [] },
      { id: 'sharon-couple', parents: ['@I2@', '@I3@'], children: [] },
    ]
    // Family record order and the person used to open a branch must not change
    // either sibling group's adjacency guarantees.
    const permutations = (items: typeof families): (typeof families)[] =>
      items.length < 2
        ? [items]
        : items.flatMap((item, index) =>
            permutations(items.filter((_, i) => i !== index)).map((rest) => [item, ...rest]),
          )
    for (const order of permutations(families)) {
      dataset.families = order
      for (const primary of ['@I0@', '@I1@']) {
        const project = newProject(dataset, primary)
        project.expanded = {
          '@I0@': { parents: true, siblings: true },
          '@I1@': { parents: true, siblings: true },
          '@I2@': { siblings: true },
        }
        const row = layoutTree(project)
          .nodes.filter((n) => n.level === 0)
          .sort((a, b) => a.x - b.x)
        const ids = row.map((n) => n.id)
        const assertSiblingRun = (siblings: string[], spouses: string[], anchor: string) => {
          const positions = siblings.map((id) => ids.indexOf(id))
          const low = Math.min(...positions),
            high = Math.max(...positions)
          expect([low, high]).toContain(ids.indexOf(anchor))
          expect(
            ids.slice(low, high + 1).every((id) => [...siblings, ...spouses].includes(id)),
          ).toBe(true)
        }
        assertSiblingRun(['@I0@', '@I2@', '@I4@'], ['@I1@', '@I3@'], '@I0@')
        assertSiblingRun(['@I1@', '@I5@'], ['@I0@'], '@I1@')
        const lee = ids.indexOf('@I0@'),
          eleanor = ids.indexOf('@I1@')
        for (const sibling of ['@I2@', '@I4@'])
          expect(Math.sign(ids.indexOf(sibling) - lee)).toBe(Math.sign(lee - eleanor))
        expect(Math.sign(ids.indexOf('@I5@') - eleanor)).toBe(Math.sign(eleanor - lee))
        expect(Math.abs(ids.indexOf('@I0@') - ids.indexOf('@I1@'))).toBe(1)
        expect(Math.abs(ids.indexOf('@I2@') - ids.indexOf('@I3@'))).toBe(1)
      }
    }
  })

  it('anchors a sibling chain at the primary person even when siblings are revealed through parents', () => {
    const project = familyProject()
    project.dataset.families = [
      { id: 'siblings', parents: ['@I6@', '@I7@'], children: ['@I2@', '@I0@', '@I4@'] },
      { id: 'main', parents: ['@I0@', '@I1@'], children: [] },
      { id: 'first', parents: ['@I2@', '@I3@'], children: [] },
      { id: 'last', parents: ['@I4@', '@I5@'], children: [] },
    ]
    project.expanded = { '@I0@': { parents: true }, '@I6@': { children: true } }
    for (const expanded of [false, true]) {
      project.expanded['@I2@'] = { siblings: expanded }
      project.expanded['@I4@'] = { siblings: expanded }
      const row = layoutTree(project)
        .nodes.filter((node) => node.level === 0)
        .sort((a, b) => a.x - b.x)
      const index = (id: string) => row.findIndex((node) => node.id === id)
      const direction = Math.sign(index('@I2@') - index('@I0@'))
      expect(Math.sign(index('@I4@') - index('@I0@'))).toBe(direction)
      for (const [a, b] of [
        ['@I0@', '@I1@'],
        ['@I2@', '@I3@'],
        ['@I4@', '@I5@'],
      ])
        expect(Math.abs(index(a) - index(b))).toBe(1)
    }
  })

  it('turns a whole sibling branch when its two ancestor connections would cross', () => {
    const node = (id: string, x: number, level: number) => ({
      id,
      x,
      level,
      y: level * 220,
      width: 250,
      height: 100,
      name: [],
      details: [],
    })
    const top = [node('grandparent', 0, -2)]
    const middle = [node('a-parent', -330, -1), node('b-parent', 330, -1)]
    const bottom = [node('a', -330, 0), node('b', 330, 0)]
    const families = [
      { id: 'parent-siblings', parents: ['grandparent'], children: ['a-parent', 'b-parent'] },
      { id: 'a-family', parents: ['a-parent'], children: ['a'] },
      { id: 'b-family', parents: ['b-parent'], children: ['b'] },
    ]
    const rows: [number, typeof top][] = [
      [-2, top],
      [-1, middle],
      [0, bottom],
    ]
    orderTreeRows(
      rows,
      families,
      new Map([
        ['a', 0],
        ['b', 3],
        ['a-parent', 1],
        ['b-parent', 2],
        ['grandparent', 2],
      ]),
    )
    const x = (id: string) => rows.flatMap(([, row]) => row).find((node) => node.id === id)!.x
    // Test the placement itself, before the router can hide crossings with gaps.
    expect((x('a-parent') - x('b-parent')) * (x('a') - x('b'))).toBeGreaterThan(0)
  })

  it('places siblings together on the right when the spouse is on the left', () => {
    const project = familyProject()
    project.expanded = {
      '@I0@': { parents: true },
      '@I1@': { parents: true },
      '@I5@': { siblings: true },
    }
    project.dataset.people.extra = { ...project.dataset.people['@I6@'], id: 'extra' }
    project.dataset.families.push({
      id: 'emily-siblings',
      parents: [],
      children: ['@I5@', '@I6@', 'extra'],
    })
    const layout = layoutTree(project)
    const row = layout.nodes.filter((node) => node.level === -1).map((node) => node.id)
    const emily = row.indexOf('@I5@')
    expect(row[emily - 1]).toBe('@I4@')
    expect(
      row
        .slice(emily + 1)
        .filter((id) => id !== '@I7@')
        .sort(),
    ).toEqual(['@I6@', 'extra'])
    expect(Math.abs(row.indexOf('@I6@') - row.indexOf('@I7@'))).toBe(1)
    const html = renderToStaticMarkup(
      <TreeNodes project={project} layout={layout} theme={projectTheme(project)} interactive />,
    )
    expect(html).toContain('Hide siblings to the right of Emily Kirby')
  })

  it('gives three overlapping spans one horizontal level each without stepping', () => {
    const node = (id: string, x: number, y: number) => ({
      id,
      x,
      y,
      width: 250,
      height: 210,
      level: y === 0 ? -1 : 0,
      name: [],
      details: [],
    })
    const relationships = [
      { id: 'frances', parentX: 2310, childX: 1155 },
      { id: 'vanessa', parentX: 990, childX: 495 },
      { id: 'harold', parentX: 1650, childX: 825 },
    ]
    const nodes = relationships.flatMap(({ id, parentX, childX }) => [
      node(id + '-left', parentX - 165, 0),
      node(id + '-right', parentX + 165, 0),
      node(id, childX, 320),
    ])
    const families = relationships.map(({ id }) => ({
      id,
      parents: [id + '-left', id + '-right'],
      children: [id],
    }))
    const gap = treeGenerationGaps(nodes, families).get(0)!
    expect(gap).toBeGreaterThan(110)
    nodes
      .filter((node) => node.level === 0)
      .forEach((node) => {
        node.y = 210 + gap
      })
    const edges = routeTree(nodes, families)
    const buses = edges.flatMap((edge) => {
      const [, x, y, direction, end] = edge.split(' ')
      return direction === 'H' && Number(y) > 210 ? [{ x: +x, y: +y, end: +end }] : []
    })
    expect(buses).toHaveLength(3)
    const heights = [495, 825, 1155].map((x) => buses.find((bus) => bus.x === x)!.y)
    expect(heights[0]).toBeLessThan(heights[1])
    expect(heights[1]).toBeLessThan(heights[2])
    expect(heights[1] - heights[0]).toBeGreaterThanOrEqual(CONNECTOR_SPACING)
    expect(heights[2] - heights[1]).toBeGreaterThanOrEqual(CONNECTOR_SPACING)
    expect(buses.map((bus) => bus.end).sort((a, b) => a - b)).toEqual([990, 1650, 2310])
    // A separate, simple generation should retain the normal compact gap.
    expect(treeGenerationGaps(nodes, [families[0]]).get(0)).toBe(110)
  })

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
    // Doris and Robert are siblings. Doris's spouse may sit between them, but
    // no unrelated branch may split their sibling run.
    const siblingGap = row.findIndex((n) => n.id === '@I4@') - row.findIndex((n) => n.id === '@I6@')
    expect(siblingGap).toBeGreaterThan(0)
    expect(siblingGap).toBeLessThanOrEqual(2)
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
  it('keeps every married sibling beside their spouse without splitting the sibling run', () => {
    const records = ['Ada', 'Bea', 'Cy', 'Alex', 'Ben', 'Cara']
      .map((name, i) => `0 @I${i}@ INDI\n1 NAME ${name} /Example/`)
      .join('\n')
    const project = newProject(
      parseGedcom(`0 HEAD
${records}
0 @FS@ FAM
1 CHIL @I0@
1 CHIL @I1@
1 CHIL @I2@
0 @FA@ FAM
1 HUSB @I0@
1 WIFE @I3@
0 @FB@ FAM
1 HUSB @I1@
1 WIFE @I4@
0 @FC@ FAM
1 HUSB @I2@
1 WIFE @I5@
0 TRLR`),
      '@I0@',
    )
    project.expanded['@I0@'] = { siblings: true }

    const row = layoutTree(project).nodes.sort((a, b) => a.x - b.x)
    for (const [sibling, spouse] of [
      ['@I0@', '@I3@'],
      ['@I1@', '@I4@'],
      ['@I2@', '@I5@'],
    ]) {
      expect(
        Math.abs(
          row.findIndex((node) => node.id === sibling) -
            row.findIndex((node) => node.id === spouse),
        ),
      ).toBe(1)
    }
    const siblingPositions = ['@I0@', '@I1@', '@I2@']
      .map((id) => row.findIndex((node) => node.id === id))
      .sort((a, b) => a - b)
    expect(siblingPositions[1] - siblingPositions[0]).toBe(2)
    expect(siblingPositions[2] - siblingPositions[1]).toBe(2)
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
