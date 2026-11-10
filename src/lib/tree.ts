import type { Dataset, Display, Expansion, Project } from './types'
import { personDetails, personName } from './format'
import { routeTree } from './treeRouting'
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
  const orderedRows = [...rows].sort(([a], [b]) => a - b)
  const byId = new Map([...rows.values()].flat().map((node) => [node.id, node]))
  const childrenByParent = new Map<string, Set<TreeNode>>()
  for (const family of data.families) {
    for (const parent of family.parents) {
      if (!byId.has(parent)) continue
      const children = childrenByParent.get(parent) ?? new Set<TreeNode>()
      for (const id of family.children) {
        const child = byId.get(id)
        if (child) children.add(child)
      }
      childrenByParent.set(parent, children)
    }
  }
  for (const [level, nodes] of [...orderedRows].reverse()) {
    // Lay out connected spouse units as blocks, so sibling insertion can never
    // put an unrelated card across a marriage connector.
    const pending = new Set(nodes)
    const blocks: TreeNode[][] = []
    while (pending.size) {
      const first = pending.values().next().value!
      pending.delete(first)
      const block = [first]
      for (let i = 0; i < block.length; i++) {
        const partners = relatives(data, block[i].id).partners
        for (const n of pending) {
          if (partners.includes(n.id)) {
            pending.delete(n)
            block.push(n)
          }
        }
      }
      block.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))
      blocks.push(block)
    }
    blocks.sort((a, b) => Math.min(...a.map((n) => n.x)) - Math.min(...b.map((n) => n.x)))
    nodes.splice(0, nodes.length, ...blocks.flat())
    const preferredCenter = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length
    nodes.forEach((n, i) => {
      n.x = i === 0 ? n.x : Math.max(n.x, nodes[i - 1].x + 330)
    })
    const actualCenter = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length
    nodes.forEach((n) => (n.x += preferredCenter - actualCenter))
    // Use the child row's final order. The discovery order can invert two
    // parent couples even when each couple is kept together.
    const anchored = blocks.flatMap((block, index) => {
      const children = new Set(block.flatMap((n) => [...(childrenByParent.get(n.id) ?? [])]))
      const nextRow = [...children].filter((child) => child.level === level + 1)
      if (!nextRow.length) return []
      const center = nextRow.reduce((sum, child) => sum + child.x, 0) / nextRow.length
      return [{ block, index, center }]
    })
    const positions = nodes.map((node) => node.x)
    const byChildPosition = [...anchored].sort((a, b) => a.center - b.center)
    anchored.forEach(({ index }, i) => (blocks[index] = byChildPosition[i].block))
    nodes.splice(0, nodes.length, ...blocks.flat())
    nodes.forEach((node, i) => (node.x = positions[i]))
  }
  let y = 0
  for (const [, nodes] of orderedRows) {
    nodes.forEach((node) => (node.y = y))
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
  const edges = routeTree(nodes, data.families)
  const minX = Math.min(...nodes.map((n) => n.x - n.width / 2)) - 90,
    minY = Math.min(...nodes.map((n) => n.y)) - 80
  const maxX = Math.max(...nodes.map((n) => n.x + n.width / 2)) + 90,
    maxY = Math.max(...nodes.map((n) => n.y + n.height)) + 80
  return { nodes, edges: [...new Set(edges)], minX, minY, width: maxX - minX, height: maxY - minY }
}
