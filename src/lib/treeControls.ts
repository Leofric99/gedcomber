import type { Layout } from './tree'
import type { Project } from './types'

/** Choose a single expansion owner only when visible partners have identical
 * child sets. Different child sets require independent controls. */
export function childExpansionOwners(project: Project, layout: Layout) {
  const visible = new Set(layout.nodes.map((node) => node.id))
  const links = new Map([...visible].map((id) => [id, new Set<string>()]))
  const partners = new Map([...visible].map((id) => [id, new Set<string>()]))
  const children = new Map([...visible].map((id) => [id, new Set<string>()]))
  for (const family of project.dataset.families) {
    const members = [...new Set([...family.parents, ...family.children])].filter((id) =>
      visible.has(id),
    )
    for (const id of members)
      for (const other of members) if (id !== other) links.get(id)!.add(other)
    for (const id of family.parents.filter((id) => visible.has(id))) {
      for (const other of family.parents)
        if (other !== id && visible.has(other)) partners.get(id)!.add(other)
      for (const child of family.children)
        if (project.dataset.people[child]) children.get(id)!.add(child)
    }
  }
  const distance = new Map([[project.primary, 0]])
  const queue = [project.primary]
  for (let i = 0; i < queue.length; i++)
    for (const id of links.get(queue[i]) ?? []) {
      if (distance.has(id)) continue
      distance.set(id, distance.get(queue[i])! + 1)
      queue.push(id)
    }
  const rank = new Map(layout.nodes.map((node, i) => [node.id, i]))
  const keys = new Map([...children].map(([id, ids]) => [id, JSON.stringify([...ids].sort())]))
  const pending = new Set(visible),
    owners = new Set<string>()
  for (const first of visible) {
    if (!pending.delete(first)) continue
    const group = [first]
    for (let i = 0; i < group.length; i++)
      for (const id of partners.get(group[i])!) {
        if (pending.has(id) && keys.get(id) === keys.get(first)) {
          pending.delete(id)
          group.push(id)
        }
      }
    if (!children.get(first)!.size) continue
    group.sort(
      (a, b) =>
        (distance.get(a) ?? Infinity) - (distance.get(b) ?? Infinity) ||
        rank.get(a)! - rank.get(b)!,
    )
    owners.add(group[0])
  }
  return owners
}
