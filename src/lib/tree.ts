import type { Dataset, Display, Expansion, Project } from './types'
import { personDetails, personName } from './format'
import { routeTree, treeGenerationGaps } from './treeRouting'
import { orderTreeRows } from './treeOrdering'
import { spaceTreeFamilies } from './treeSpacing'
export function relatives(data: Dataset, id: string): Record<keyof Expansion, string[]> {
  const parents: string[] = [],
    siblings: string[] = [],
    partners: string[] = [],
    children: string[] = []
  for (const f of data.families) {
    if (f.children.includes(id)) {
      parents.push(...f.parents)
      siblings.push(...f.children.filter((x) => x !== id))
    }
    if (f.parents.includes(id)) {
      partners.push(...f.parents.filter((x) => x !== id))
      children.push(...f.children)
    }
  }
  return Object.fromEntries(
    Object.entries({ parents, siblings, partners, children }).map(([k, ids]) => [
      k,
      [...new Set(ids)].filter((x) => data.people[x]),
    ]),
  ) as Record<keyof Expansion, string[]>
}
export type TreeNode = {
  id: string
  x: number
  y: number
  width: number
  height: number
  level: number
  name: string[]
  details: string[]
}
export type Layout = {
  nodes: TreeNode[]
  edges: string[]
  width: number
  height: number
  minX: number
  minY: number
}
export function wrapText(text: string, limit: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      if (line && line.length + word.length + 1 > limit) {
        lines.push(line)
        line = ''
      }
      if (word.length > limit) {
        if (line) {
          lines.push(line)
          line = ''
        }
        for (let i = 0; i < word.length; i += limit) {
          const part = word.slice(i, i + limit)
          if (part.length === limit) lines.push(part)
          else line = part
        }
      } else line += (line ? ' ' : '') + word
    }
    if (line || !paragraph) lines.push(line)
  }
  return lines
}
export function cardText(data: Dataset, id: string, display: Display) {
  const p = data.people[id]
  return {
    name: wrapText(personName(p, display.names), 22),
    details: personDetails(p, display).flatMap((t) => wrapText(t, 34)),
  }
}
export function layoutTree(project: Project): Layout {
  const data = project.dataset
  const visited = new Map<string, { level: number; preferred: number; distance: number }>([
    [project.primary, { level: 0, preferred: 0, distance: 0 }],
  ])
  const queue = [project.primary]
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      pos = visited.get(id)!,
      rel = relatives(data, id),
      expansion = project.expanded[id] ?? {}
    for (const group of ['parents', 'siblings', 'partners', 'children'] as const) {
      // A person's first spouse is part of their family unit. The control reveals
      // additional partners; a single-spouse family needs no partner control.
      if (!expansion[group] && group !== 'partners') continue
      const members =
        group === 'partners' && !expansion.partners ? rel.partners.slice(0, 1) : rel[group]
      members.forEach((other, j) => {
        if (visited.has(other)) return
        const level = pos.level + (group === 'parents' ? -1 : group === 'children' ? 1 : 0)
        const offset =
          group === 'siblings'
            ? -(j + 1)
            : group === 'partners'
              ? j + 1
              : j - (rel[group].length - 1) / 2
        visited.set(other, {
          level,
          preferred: pos.preferred + offset * 330,
          distance: pos.distance + 1,
        })
        queue.push(other)
      })
    }
  }
  const rows = new Map<number, TreeNode[]>()
  for (const [id, pos] of visited) {
    const text = cardText(data, id, project.display)
    const node: TreeNode = {
      id,
      level: pos.level,
      x: pos.preferred,
      y: 0,
      width: 250,
      height:
        52 +
        text.name.length * 25 +
        text.details.length * 18 +
        (project.display.photos && data.people[id].photo ? 78 : 0),
      ...text,
    }
    const row = rows.get(pos.level) ?? []
    row.push(node)
    rows.set(pos.level, row)
  }
  const orderedRows = [...rows].sort(([a], [b]) => a - b)
  orderTreeRows(
    orderedRows,
    data.families,
    new Map([...visited].map(([id, pos]) => [id, pos.distance])),
  )
  // Align the primary person's row with their own parents, rather than the
  // center of all visible relatives. Translate descendants together so their
  // existing spouse/sibling order and relative connections are preserved.
  const visibleNodes = [...rows.values()].flat()
  const visibleById = new Map(visibleNodes.map((node) => [node.id, node]))
  const primary = visibleById.get(project.primary)!
  const parents =
    data.families
      .filter((family) => family.children.includes(primary.id))
      .map((family) =>
        family.parents.flatMap((id) => {
          const node = visibleById.get(id)
          return node && node.level < primary.level ? [node] : []
        }),
      )
      .sort((a, b) => b.length - a.length)[0] ?? []
  if (parents.length) {
    const offset = parents.reduce((sum, parent) => sum + parent.x, 0) / parents.length - primary.x
    visibleNodes.forEach((node) => {
      if (node.level >= primary.level) node.x += offset
    })
  }
  spaceTreeFamilies(
    orderedRows,
    data.families,
    project.primary,
    new Map([...visited].map(([id, pos]) => [id, pos.distance])),
  )
  const generationGaps = treeGenerationGaps([...rows.values()].flat(), data.families)
  let y = 0
  for (let i = 0; i < orderedRows.length; i++) {
    const [, nodes] = orderedRows[i]
    nodes.forEach((node) => (node.y = y))
    const nextLevel = orderedRows[i + 1]?.[0]
    y += Math.max(...nodes.map((n) => n.height)) + (generationGaps.get(nextLevel) ?? 110)
  }
  const nodes = [...rows.values()].flat(),
    root = nodes.find((n) => n.id === project.primary)!
  const dx = root.x,
    dy = root.y
  nodes.forEach((n) => {
    n.x -= dx
    n.y -= dy
  })
  const edges = routeTree(nodes, data.families)
  // Wider routing lanes can extend above the first generation or around the
  // outside of a row. Include them in fitting and export bounds.
  const edgePoints = edges.flatMap((edge) => {
    const [, x, y, direction, end] = edge.split(' ')
    return [
      { x: +x, y: +y },
      { x: direction === 'H' ? +end : +x, y: direction === 'V' ? +end : +y },
    ]
  })
  const minX = Math.min(
      ...nodes.map((n) => n.x - n.width / 2 - 90),
      ...edgePoints.map((p) => p.x - 20),
    ),
    minY = Math.min(...nodes.map((n) => n.y - 80), ...edgePoints.map((p) => p.y - 20))
  const maxX = Math.max(
      ...nodes.map((n) => n.x + n.width / 2 + 90),
      ...edgePoints.map((p) => p.x + 20),
    ),
    maxY = Math.max(...nodes.map((n) => n.y + n.height + 80), ...edgePoints.map((p) => p.y + 20))
  return { nodes, edges: [...new Set(edges)], minX, minY, width: maxX - minX, height: maxY - minY }
}
