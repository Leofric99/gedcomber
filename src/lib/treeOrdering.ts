import type { TreeNode } from './tree'
import type { Family } from './types'

type Unit = TreeNode[]
type Branch = Unit[]

/** Order complete spouse units and sibling branches before routing any lines. */
export function orderTreeRows(
  rows: [number, TreeNode[]][],
  families: Family[],
  distance: Map<string, number>,
) {
  const nodes = rows.flatMap(([, row]) => row)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const visible = (ids: string[]) => ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
  const relations = families.map((family) => ({
    parents: visible(family.parents),
    children: visible(family.children),
  }))
  const priority = new Map(nodes.map((node, i) => [node, i]))
  const closest = (a: TreeNode, b: TreeNode) =>
    distance.get(a.id)! - distance.get(b.id)! || priority.get(a)! - priority.get(b)!
  const siblingRuns = rows.flatMap(([level]) =>
    relations.flatMap(({ children }) => {
      const siblings = children.filter((node) => node.level === level).sort(closest)
      if (siblings.length < 2) return []
      const allowed = new Set(siblings)
      for (const { parents } of relations)
        if (parents.some((node) => siblings.includes(node)))
          parents.forEach((node) => allowed.add(node))
      return [{ level, siblings, anchor: siblings[0], allowed }]
    }),
  )
  const validRuns = (ordered: TreeNode[], level: number) =>
    siblingRuns
      .filter((run) => run.level === level)
      .every(({ siblings, anchor, allowed }) => {
        const positions = siblings.map((node) => ordered.indexOf(node))
        const left = Math.min(...positions),
          right = Math.max(...positions)
        return (
          (ordered[left] === anchor || ordered[right] === anchor) &&
          ordered.slice(left, right + 1).every((node) => allowed.has(node))
        )
      })
  const branches = new Map<number, Branch[]>()
  const centers = new Map(
    rows.map(([level, row]) => [level, row.reduce((sum, n) => sum + n.x, 0) / row.length]),
  )

  for (const [level, row] of rows) {
    let units: Unit[] = row.map((node) => [node])
    // Marriage components are indivisible throughout all subsequent ordering.
    for (const { parents } of relations) {
      const members = units.filter((unit) => unit.some((node) => parents.includes(node)))
      if (members.length < 2) continue
      const joined = members.flat().sort((a, b) => a.x - b.x || closest(a, b))
      units = units.filter((unit) => !members.includes(unit))
      units.push(joined)
    }
    units.sort((a, b) => Math.min(...a.map((n) => n.x)) - Math.min(...b.map((n) => n.x)))
    let groups: Branch[] = units.map((unit) => [unit])
    // Process each sibling family once. Expanding a second sibling must never
    // change the anchor or start another chain on its opposite side.
    for (const { children } of relations) {
      const siblings = children.filter((node) => node.level === level).sort(closest)
      if (siblings.length < 2) continue
      const anchor = siblings[0]
      const members = groups.filter((group) => group.flat().some((node) => siblings.includes(node)))
      if (members.length < 2) continue
      const own = members.find((group) => group.flat().includes(anchor))!
      const unit = own.find((unit) => unit.includes(anchor))!
      const others = [
        ...own.filter((other) => other !== unit),
        ...members.filter((group) => group !== own).flat(),
      ]
      const toRight = unit.indexOf(anchor) > 0
      const joined = toRight ? [unit, ...others] : [...others, unit]
      const at = groups.indexOf(own)
      groups = groups.flatMap((group, i) =>
        i === at ? [joined] : members.includes(group) ? [] : [group],
      )
    }
    // Two spouses can each be the anchor of a different sibling family. Their
    // shared marriage unit does not make either family's other siblings legal
    // members of the other's run. Solve the consecutive-unit constraints for
    // the whole branch rather than flattening one family into the other.
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]
      const rules = siblingRuns
        .filter((run) => run.level === level && group.flat().includes(run.anchor))
        .map((run) => ({
          members: new Set(
            group.flatMap((unit, index) =>
              unit.some((node) => run.siblings.includes(node)) ? [index] : [],
            ),
          ),
          anchor: group.findIndex((unit) => unit.includes(run.anchor)),
        }))
      const used = new Set<number>(),
        failed = new Set<string>()
      const search = (prefix: number[]): number[] | undefined => {
        if (prefix.length === group.length) return prefix
        const key = [...used].sort((a, b) => a - b).join(',')
        if (failed.has(key)) return
        const equivalent = new Set<string>()
        for (let candidate = 0; candidate < group.length; candidate++) {
          if (used.has(candidate)) continue
          const signature = rules
            .map((rule) =>
              rule.anchor === candidate ? 'a' : rule.members.has(candidate) ? 's' : '-',
            )
            .join('')
          if (equivalent.has(signature)) continue
          equivalent.add(signature)
          const legal = rules.every(({ members, anchor }) => {
            const count = [...used].filter((index) => members.has(index)).length
            if (count > 0 && count < members.size && !members.has(candidate)) return false
            return candidate !== anchor || count === 0 || count === members.size - 1
          })
          if (!legal) continue
          used.add(candidate)
          const result = search([...prefix, candidate])
          if (result) return result
          used.delete(candidate)
        }
        failed.add(key)
      }
      const order = search([])
      if (order) groups[i] = order.map((index) => group[index])
    }
    branches.set(level, groups)
  }

  const place = () => {
    for (const [level, row] of rows) {
      const ordered = branches.get(level)!.flat(2)
      row.splice(0, row.length, ...ordered)
      row.forEach((node, i) => {
        node.x = centers.get(level)! + (i - (row.length - 1) / 2) * 330
      })
    }
  }
  place()
  // Establish the parent order from the final child positions, moving entire
  // sibling branches together. This is also a useful starting point for the
  // two-way crossing reduction below.
  for (const [level] of [...rows].reverse()) {
    const groups = branches.get(level)!
    const anchored = groups.flatMap((group, index) => {
      const members = group.flat()
      const children = [
        ...new Set(
          relations.flatMap((relation) =>
            relation.parents.some((parent) => members.includes(parent))
              ? relation.children.filter((child) => child.level === level + 1)
              : [],
          ),
        ),
      ]
      return children.length
        ? [
            {
              group,
              index,
              center: children.reduce((sum, node) => sum + node.x, 0) / children.length,
            },
          ]
        : []
    })
    const sorted = [...anchored].sort((a, b) => a.center - b.center)
    anchored.forEach(({ index }, i) => {
      groups[index] = sorted[i].group
    })
    place()
  }
  const links = relations.filter(({ parents, children }) => parents.length && children.length)
  // Count inversions between complete family connections, including the
  // contradictory bus constraints that otherwise force vertical stems across
  // another family's horizontal line. Length breaks ties while resolving
  // crossings; a crossing-free layout keeps its existing orientation.
  const score = () => {
    const spans = links.map(({ parents, children }) => {
      const x = parents.reduce((sum, n) => sum + n.x, 0) / parents.length
      return {
        parents,
        children,
        x,
        min: Math.min(x, ...children.map((n) => n.x)),
        max: Math.max(x, ...children.map((n) => n.x)),
      }
    })
    let crossings = 0,
      length = 0
    for (let i = 0; i < spans.length; i++) {
      const a = spans[i]
      length += a.children.reduce((sum, n) => sum + Math.abs(n.x - a.x), 0)
      for (let j = i + 1; j < spans.length; j++) {
        const b = spans[j]
        if (
          a.children[0].level !== b.children[0].level ||
          a.parents[0].level !== b.parents[0].level
        )
          continue
        if (
          a.parents.some((n) => b.parents.includes(n)) ||
          a.children.some((n) => b.children.includes(n))
        )
          continue
        for (const childA of a.children)
          for (const childB of b.children) if ((a.x - b.x) * (childA.x - childB.x) < 0) crossings++
        const inside = (x: number, span: typeof a) => x > span.min && x < span.max
        const above = (a: (typeof spans)[number], b: (typeof spans)[number]) =>
          inside(a.x, b) || b.children.some((n) => inside(n.x, a))
        if (above(a, b) && above(b, a)) crossings++
      }
    }
    return [crossings, length] as const
  }
  let best = score()
  const tryChange = (change: () => void, undo: () => void) => {
    change()
    place()
    // Crossing reduction may move or mirror a complete branch, but must never
    // purchase a shorter route by interleaving the spouses' sibling families.
    if (!rows.every(([level, row]) => validRuns(row, level))) {
      undo()
      place()
      return false
    }
    const next = score()
    if (next[0] < best[0] || (best[0] > 0 && next[0] === best[0] && next[1] < best[1] - 0.01)) {
      best = next
      return true
    }
    undo()
    place()
    return false
  }
  // Both directions matter: a newly opened ancestor can require moving a
  // descendant branch as well as reordering the ancestor couples above it.
  for (let pass = 0; pass < 12; pass++) {
    let changed = false
    for (const [level] of pass % 2 ? rows : [...rows].reverse()) {
      const groups = branches.get(level)!
      for (let i = 0; i < groups.length; i++) {
        if (best[0] === 0) return
        for (let j = i + 1; j < groups.length; j++) {
          const swap = () => {
            const first = groups[i]
            groups[i] = groups[j]
            groups[j] = first
          }
          changed = tryChange(swap, swap) || changed
        }
        const group = groups[i]
        const flip = () => {
          group.reverse()
          group.forEach((unit) => unit.reverse())
        }
        changed = tryChange(flip, flip) || changed
        // Sibling spouse units can turn independently, but the anchor's unit
        // stays at the end of the chain.
        for (const unit of group) {
          if (unit.length < 2) continue
          const reverse = () => {
            unit.reverse()
          }
          changed = tryChange(reverse, reverse) || changed
        }
      }
    }
    if (!changed) break
  }
}
