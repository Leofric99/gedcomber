import type { Expansion, Project } from './types'

export function expandAllTree(
  project: Project,
  options: { otherSpouses: boolean; collateralChildren: boolean },
): Project {
  const byChild = new Map<string, typeof project.dataset.families>()
  const byParent = new Map<string, typeof project.dataset.families>()
  for (const family of project.dataset.families) {
    for (const id of family.children) byChild.set(id, [...(byChild.get(id) ?? []), family])
    for (const id of family.parents) byParent.set(id, [...(byParent.get(id) ?? []), family])
  }
  const ancestors = new Set([project.primary]),
    queue = [project.primary]
  for (let i = 0; i < queue.length; i++)
    for (const family of byChild.get(queue[i]) ?? [])
      for (const id of family.parents)
        if (project.dataset.people[id] && !ancestors.has(id)) {
          ancestors.add(id)
          queue.push(id)
        }
  const expanded: Record<string, Expansion> = {}
  const related = new Set(ancestors)
  for (const id of ancestors) {
    expanded[id] = { parents: true, siblings: true, partners: options.otherSpouses }
    for (const family of byChild.get(id) ?? [])
      for (const sibling of family.children)
        if (project.dataset.people[sibling]) related.add(sibling)
  }
  const descendants = options.collateralChildren ? [...related] : [project.primary]
  const seen = new Set(descendants)
  for (let i = 0; i < descendants.length; i++) {
    const id = descendants[i]
    expanded[id] = { ...expanded[id], children: true, partners: options.otherSpouses }
    for (const family of byParent.get(id) ?? [])
      for (const child of family.children)
        if (project.dataset.people[child] && !seen.has(child)) {
          seen.add(child)
          descendants.push(child)
          related.add(child)
        }
  }
  for (const id of related) expanded[id] = { ...expanded[id], partners: options.otherSpouses }
  return { ...project, expanded }
}
