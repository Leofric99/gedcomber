import type { TreeNode } from './tree'
import type { Family } from './types'

/** Linked display instances break cycles formed by intermarried sibling families.
 * The GEDCOM and all editable person records retain their original identities. */
export function separateIntermarriedFamilies(
  rows: [number, TreeNode[]][],
  families: Family[],
  distance: Map<string, number>,
): Family[] {
  const nodes = rows.flatMap(([, row]) => row)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const roots = new Map(nodes.map((node) => [node.id, node.id]))
  const root = (id: string): string => {
    const parent = roots.get(id)!
    if (parent === id) return id
    const value = root(parent)
    roots.set(id, value)
    return value
  }
  const join = (a: string, b: string) => roots.set(root(a), root(b))
  for (const family of families) {
    const children = family.children.filter((id) => byId.has(id))
    for (const id of children.slice(1))
      if (byId.get(id)!.level === byId.get(children[0])!.level) join(children[0], id)
  }
  const siblingRoots = new Map(nodes.map((node) => [node.id, root(node.id)]))
  const priority = (family: Family) =>
    Math.min(
      ...family.children.filter((id) => byId.has(id)).map((id) => distance.get(id) ?? Infinity),
    )
  const ordered = [...families].sort(
    (a, b) =>
      priority(a) - priority(b) ||
      Math.min(...a.parents.map((id) => distance.get(id) ?? Infinity)) -
        Math.min(...b.parents.map((id) => distance.get(id) ?? Infinity)),
  )
  const replacements = new Map<string, Family[]>()
  const pairViews = new Map<string, { left: string[]; right?: string[] }>()
  const copy = (person: TreeNode, host: TreeNode, family: Family) => {
    const id = `${person.id}::spouse:${family.id}:${host.id}`
    const instance = {
      ...person,
      id,
      personId: person.personId ?? person.id,
      repeated: true,
      spouseOnly: host.id,
      x: host.x + 330,
    }
    person.repeated = true
    rows.find(([level]) => level === host.level)![1].push(instance)
    distance.set(id, (distance.get(host.id) ?? 0) + 1)
    return id
  }
  for (const family of ordered) {
    if (family.parents.length !== 2) continue
    const [a, b] = family.parents.map((id) => byId.get(id))
    if (!a || !b || a.level !== b.level) continue
    const key = JSON.stringify([...family.parents].sort())
    let view = pairViews.get(key)
    if (!view) {
      if (root(a.id) === root(b.id) && siblingRoots.get(a.id) !== siblingRoots.get(b.id)) {
        const [host, partner] =
          (distance.get(a.id) ?? Infinity) <= (distance.get(b.id) ?? Infinity) ? [a, b] : [b, a]
        view = {
          left: [host.id, copy(partner, host, family)],
          right: [copy(host, partner, family), partner.id],
        }
      } else {
        join(a.id, b.id)
        view = { left: family.parents }
      }
      pairViews.set(key, view)
    }
    if (view.right)
      replacements.set(family.id, [
        { ...family, parents: view.left },
        { ...family, id: `${family.id}::repeat`, parents: view.right, children: [] },
      ])
  }
  return families.flatMap((family) => replacements.get(family.id) ?? [family])
}
