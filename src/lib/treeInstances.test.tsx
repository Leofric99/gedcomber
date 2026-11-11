import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseGedcom, exportGedcom } from './gedcom'
import { newProject } from './types'
import { layoutTree } from './tree'
import { TreeNodes } from '../components/Artwork'
import { projectTheme } from './themes'
import { spaceTreeFamilies } from './treeSpacing'

describe('intermarried sibling families', () => {
  it('repeats secondary spouses so both sibling families remain consecutive', () => {
    const names = ['Primary', 'Arthur', 'Sarah', 'Eliza', 'Albert', 'Ada', 'William']
    const data = parseGedcom(
      `0 HEAD\n${names.map((name, i) => `0 @${i}@ INDI\n1 NAME ${name} /Example/`).join('\n')}\n0 TRLR`,
    )
    data.families = [
      { id: 'main', parents: ['@1@', '@2@'], children: ['@0@'] },
      { id: 'hodges', parents: [], children: ['@1@', '@3@', '@5@'] },
      { id: 'winsor', parents: [], children: ['@2@', '@4@', '@6@'] },
      { id: 'second', parents: ['@3@', '@4@'], children: [] },
    ]
    const p = newProject(data, '@0@')
    p.expanded = { '@0@': { parents: true }, '@1@': { siblings: true }, '@2@': { siblings: true } }
    const before = exportGedcom(data)
    const layout = layoutTree(p)
    const row = layout.nodes.filter((n) => n.level === -1).sort((a, b) => a.x - b.x)
    expect(row.filter((n) => n.personId)).toHaveLength(2)
    const index = (id: string) => row.findIndex((n) => n.id === id)
    for (const [anchor, partner, siblings] of [
      ['@1@', '@2@', ['@3@', '@5@']],
      ['@2@', '@1@', ['@4@', '@6@']],
    ] as [string, string, string[]][])
      for (const sibling of siblings)
        expect(Math.sign(index(sibling) - index(anchor))).toBe(
          Math.sign(index(anchor) - index(partner)),
        )
    for (const [siblings, allowed] of [
      [
        ['@1@', '@3@', '@5@'],
        ['@1@', '@3@', '@5@', '@2@', '@4@'],
      ],
      [
        ['@2@', '@4@', '@6@'],
        ['@2@', '@4@', '@6@', '@1@', '@3@'],
      ],
    ]) {
      const positions = siblings.map(index)
      expect(
        row
          .slice(Math.min(...positions), Math.max(...positions) + 1)
          .every((n) => allowed.includes(n.personId ?? n.id)),
      ).toBe(true)
    }
    for (const id of ['@3@', '@4@']) {
      const instance = row.find((n) => n.personId === id)!
      const host = instance.spouseOnly!
      expect(Math.abs(row.indexOf(instance) - index(host))).toBe(1)
    }
    const html = renderToStaticMarkup(
      <svg>
        <TreeNodes project={p} layout={layout} theme={projectTheme(p)} interactive />
      </svg>,
    )
    expect(html).toContain('Repeated person: Eliza Example. Same person record.')
    expect(html.match(/data-person-id="@3@"/g)).toHaveLength(2)
    expect(exportGedcom(data)).toBe(before)
    expect(layoutTree(p)).toEqual(layout)
  })
})

describe('multi-generation family spacing', () => {
  it('moves an ancestor chain out of a compact row despite opposing parent and child targets', () => {
    const n = (id: string, x: number, level: number) => ({
      id,
      x,
      level,
      y: level * 220,
      width: 250,
      height: 100,
      name: [],
      details: [],
    })
    const top = [n('ga', -165, -2), n('gb', 165, -2), n('gc', 495, -2), n('gd', 825, -2)]
    const middle = [n('a', -165, -1), n('b', 165, -1), n('c', 495, -1), n('d', 825, -1)]
    const bottom = [n('primary', 0, 0), n('sibling', 4000, 0)]
    const families = [
      { id: 'a', parents: ['a', 'b'], children: ['primary'] },
      { id: 'c', parents: ['c', 'd'], children: ['sibling'] },
      { id: 'ga', parents: ['ga', 'gb'], children: ['a'] },
      { id: 'gc', parents: ['gc', 'gd'], children: ['c'] },
      { id: 'siblings', parents: [], children: ['primary', 'sibling'] },
    ]
    spaceTreeFamilies(
      [
        [-2, top],
        [-1, middle],
        [0, bottom],
      ],
      families,
      'primary',
      new Map([
        ['primary', 0],
        ['sibling', 1],
      ]),
    )
    const mean = (nodes: typeof top) => nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length
    expect(Math.abs(mean(middle.slice(2)) - bottom[1].x)).toBeLessThan(660)
    expect(Math.abs(mean(top.slice(2)) - middle[2].x)).toBeLessThan(660)
    expect(bottom.map((n) => n.x)).toEqual([0, 4000])
    expect(middle[2].x - middle[1].x).toBeGreaterThan(330)
  })
})
