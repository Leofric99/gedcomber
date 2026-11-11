import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseGedcom, exportGedcom } from './gedcom'
import { newProject } from './types'
import { expandAllTree } from './expandTree'
import { layoutTree } from './tree'
import { TreeNodes } from '../components/Artwork'
import { projectTheme } from './themes'

function project() {
  const ids = ['p', 'a', 'b', 'gp', 'gm', 'u', 'w', 'c', 'cc', 'x', 'y', 'z', 'r', 'd', 'q']
  const data = parseGedcom(
    `0 HEAD\n${ids.map((id) => `0 @${id}@ INDI\n1 NAME ${id} /Example/`).join('\n')}\n0 TRLR`,
  )
  data.families = [
    { id: 'parents', parents: ['@a@', '@b@'], children: ['@p@'] },
    { id: 'grandparents', parents: ['@gp@', '@gm@'], children: ['@a@', '@u@'] },
    { id: 'uncle', parents: ['@u@', '@w@'], children: ['@c@'] },
    { id: 'cousin', parents: ['@c@'], children: ['@cc@'] },
    { id: 'extra', parents: ['@a@', '@x@'], children: [] },
    { id: 'extra-family', parents: ['@x@', '@y@'], children: ['@z@'] },
    { id: 'descendants', parents: ['@p@', '@r@'], children: ['@d@'] },
  ]
  return newProject(data, '@p@')
}

describe('expand all', () => {
  it('independently controls additional spouses and collateral descendants', () => {
    for (const otherSpouses of [false, true])
      for (const collateralChildren of [false, true]) {
        const p = project(),
          before = structuredClone(p)
        const next = expandAllTree(p, { otherSpouses, collateralChildren })
        const ids = layoutTree(next).nodes.map((node) => node.id)
        expect(ids).toEqual(
          expect.arrayContaining(['@p@', '@a@', '@b@', '@gp@', '@gm@', '@u@', '@w@', '@d@']),
        )
        expect(ids.includes('@x@')).toBe(otherSpouses)
        expect(ids.includes('@c@')).toBe(collateralChildren)
        expect(ids.includes('@cc@')).toBe(collateralChildren)
        expect(ids).not.toContain('@y@')
        expect(ids).not.toContain('@z@')
        expect(ids).not.toContain('@q@')
        expect(p).toEqual(before)
      }
  })
  it('terminates on cyclic genealogy and replaces prior expansion choices', () => {
    const p = project()
    p.dataset.families.push({ id: 'cycle', parents: ['@p@'], children: ['@gp@'] })
    p.expanded['@q@'] = { parents: true, children: true }
    const next = expandAllTree(p, { otherSpouses: false, collateralChildren: true })
    expect(next.expanded['@q@']).toBeUndefined()
    expect(Object.keys(next.expanded).length).toBeLessThanOrEqual(
      Object.keys(p.dataset.people).length,
    )
  })
})

describe('ended relationship lines', () => {
  const ged = (event: string) =>
    `0 HEAD\n0 @p@ INDI\n1 NAME Child /Example/\n0 @a@ INDI\n1 NAME First /Example/\n0 @b@ INDI\n1 NAME Second /Example/\n0 @f@ FAM\n1 HUSB @a@\n1 WIFE @b@\n1 CHIL @p@\n${event}0 TRLR\n`
  it('dots only the marriage connector for divorce, annulment, and separation', () => {
    for (const event of [
      '1 DIV Y\n',
      '1 ANUL\n2 DATE 2000\n',
      '1 EVEN\n2 TYPE Separation\n',
      '1 _SEPR Y\n',
      '1 EVEN\n2 TYPE Dissolution\n',
    ]) {
      const data = parseGedcom(ged(event)),
        p = newProject(data, '@p@')
      p.expanded[p.primary] = { parents: true }
      // Stored backups can predate the parsed ended flag.
      delete data.families[0].ended
      const layout = layoutTree(p)
      expect(layout.dottedEdges).toHaveLength(1)
      expect(layout.edges.length).toBeGreaterThan(layout.dottedEdges!.length)
      const html = renderToStaticMarkup(
        <svg>
          <TreeNodes project={p} layout={layout} theme={projectTheme(p)} />
        </svg>,
      )
      expect(html.match(/stroke-dasharray="0.1 5"/g)).toHaveLength(1)
      expect(exportGedcom(data).replace(/\r/g, '')).toBe(
        ged(event).replace('0 HEAD\n', '0 HEAD\n1 CHAR UTF-8\n'),
      )
    }
  })
  it('does not treat a divorce filing, a negative event, or a death as an ended marriage', () => {
    for (const event of ['1 DIVF Y\n', '1 DIV N\n', '1 EVEN\n2 TYPE Widowed\n', ''])
      expect(parseGedcom(ged(event)).families[0].ended).not.toBe(true)
  })
})
