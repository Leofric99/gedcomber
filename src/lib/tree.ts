import type { Dataset, Display, Expansion, Project } from './types'
import { personDetails, personName } from './format'
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
  const visited = new Map<string, { level: number; preferred: number }>([
    [project.primary, { level: 0, preferred: 0 }],
  ])
  const queue = [project.primary]
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      pos = visited.get(id)!,
      rel = relatives(data, id),
      expansion = project.expanded[id] ?? {}
    for (const group of ['parents', 'siblings', 'partners', 'children'] as const) {
      if (!expansion[group]) continue
      rel[group].forEach((other, j) => {
        if (visited.has(other)) return
        const level = pos.level + (group === 'parents' ? -1 : group === 'children' ? 1 : 0)
        const offset =
          group === 'siblings'
            ? (j % 2 === 0 ? -1 : 1) * (Math.floor(j / 2) + 1)
            : group === 'partners'
              ? j + 1
              : j - (rel[group].length - 1) / 2
        visited.set(other, { level, preferred: pos.preferred + offset * 330 })
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
  let y = 0
  for (const [, nodes] of [...rows].sort(([a], [b]) => a - b)) {
    nodes.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))
    const preferredCenter = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length
    nodes.forEach((n, i) => {
      n.x = i === 0 ? n.x : Math.max(n.x, nodes[i - 1].x + 330)
      n.y = y
    })
    const actualCenter = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length
    nodes.forEach((n) => (n.x += preferredCenter - actualCenter))
    y += Math.max(...nodes.map((n) => n.height)) + 110
  }
  const nodes = [...rows.values()].flat(),
    root = nodes.find((n) => n.id === project.primary)!
  const dx = root.x,
    dy = root.y
  nodes.forEach((n) => {
    n.x -= dx
    n.y -= dy
  })
  const byId = new Map(nodes.map((n) => [n.id, n])),
    edges: string[] = []
  for (const f of data.families) {
    const parents = f.parents.map((id) => byId.get(id)).filter((n): n is TreeNode => !!n)
    const children = f.children.map((id) => byId.get(id)).filter((n): n is TreeNode => !!n)
    if (parents.length && children.length) {
      const busY = Math.min(...children.map((c) => c.y)) - 48
      const px = parents.reduce((sum, p) => sum + p.x, 0) / parents.length
      const allSameRow = parents.every((p) => p.y === parents[0].y)
      const parentY =
        parents.length === 2 && allSameRow
          ? parents[0].y + 45
          : Math.max(...parents.map((p) => p.y + p.height)) + (parents.length > 1 ? 22 : 0)
      if (parents.length !== 2 || !allSameRow) {
        parents.forEach((p) => edges.push(`M ${p.x} ${p.y + p.height} V ${parentY}`))
        if (parents.length > 1)
          edges.push(
            `M ${Math.min(...parents.map((p) => p.x))} ${parentY} H ${Math.max(...parents.map((p) => p.x))}`,
          )
      }
      edges.push(`M ${px} ${parentY} V ${busY}`)
      const xs = [px, ...children.map((c) => c.x)]
      edges.push(`M ${Math.min(...xs)} ${busY} H ${Math.max(...xs)}`)
      children.forEach((c) => edges.push(`M ${c.x} ${busY} V ${c.y}`))
    } else if (children.length > 1) {
      const top = Math.min(...children.map((n) => n.y)) - 48
      const xs = children.map((n) => n.x)
      edges.push(`M ${Math.min(...xs)} ${top} H ${Math.max(...xs)}`)
      children.forEach((n) => edges.push(`M ${n.x} ${n.y} V ${top}`))
    }
    if (parents.length > 1) {
      for (let i = 1; i < parents.length; i++) {
        const a = parents[i - 1],
          b = parents[i]
        if (a.y === b.y)
          edges.push(
            `M ${a.x + (a.x < b.x ? 125 : -125)} ${a.y + 45} H ${b.x + (b.x > a.x ? -125 : 125)}`,
          )
      }
    }
  }
  const minX = Math.min(...nodes.map((n) => n.x - 125)) - 90,
    minY = Math.min(...nodes.map((n) => n.y)) - 80
  const maxX = Math.max(...nodes.map((n) => n.x + 125)) + 90,
    maxY = Math.max(...nodes.map((n) => n.y + n.height)) + 80
  return { nodes, edges: [...new Set(edges)], minX, minY, width: maxX - minX, height: maxY - minY }
}
