import type { TreeNode } from './tree'
import type { Family } from './types'

/** Let independent family groups follow their relatives instead of packing
 * every generation into a single, centered strip of cards. */
export function spaceTreeFamilies(
  rows: [number, TreeNode[]][],
  families: Family[],
  primaryId: string,
  distance: Map<string, number>,
) {
  const nodes = rows.flatMap(([, row]) => row)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const visible = (ids: string[]) => ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
  const relations = families.map((family) => ({
    parents: visible(family.parents),
    children: visible(family.children),
  }))
  const links = relations.flatMap(({ parents, children }) => {
    if (!parents.length || !children.length) return []
    const anchor = [...children].sort(
      (a, b) => (distance.get(a.id) ?? Infinity) - (distance.get(b.id) ?? Infinity),
    )[0]
    if (parents.some((node) => node.level >= anchor.level)) return []
    return [{ parents, children, anchor }]
  })
  const primary = byId.get(primaryId)!
  const primaryParents = links
    .filter((link) => link.anchor === primary)
    .sort((a, b) => b.parents.length - a.parents.length)[0]
  const midpoint = (members: TreeNode[]) =>
    members.reduce((sum, node) => sum + node.x, 0) / members.length
  const groups = rows.map(([level, row]) => {
    let blocks = row.map((node) => [node])
    for (const relation of relations) {
      for (const ids of [relation.parents, relation.children]) {
        const members = blocks.filter((block) => block.some((node) => ids.includes(node)))
        if (members.length < 2) continue
        blocks = [...blocks.filter((block) => !members.includes(block)), members.flat()]
      }
    }
    blocks.forEach((block) => block.sort((a, b) => a.x - b.x))
    blocks.sort((a, b) => a[0].x - b[0].x)
    return { level, blocks }
  })
  const cost = () =>
    links.reduce((sum, { parents, children, anchor }) => {
      const x = midpoint(parents)
      const span =
        Math.max(x, ...children.map((node) => node.x)) -
        Math.min(x, ...children.map((node) => node.x))
      return sum + Math.abs(x - anchor.x) + span / 4
    }, 0)

  for (let pass = 0; pass < 6; pass++) {
    let changed = false
    for (const { blocks } of pass % 2 ? groups : [...groups].reverse()) {
      const original = blocks.map((block) => midpoint(block))
      const offsets: number[] = []
      const targets = blocks.map((block, index) => {
        // Offsets account for each block's full width. Isotonic fitting below
        // keeps their established order and at least the normal card spacing.
        offsets[index] =
          index === 0 ? 0 : offsets[index - 1] + (blocks[index - 1].length + block.length) * 165
        const shifts = links
          .flatMap(({ parents, anchor }) => {
            if (parents.every((node) => block.includes(node))) return [anchor.x - midpoint(parents)]
            if (block.includes(anchor)) return [midpoint(parents) - anchor.x]
            return []
          })
          .sort((a, b) => a - b)
        const shift = shifts.length ? shifts[Math.floor(shifts.length / 2)] : 0
        // Keep the primary person and their parents aligned even when adjacent
        // independent groups need to move farther away to make room.
        const fixed =
          block.includes(primary) || !!primaryParents?.parents.every((node) => block.includes(node))
        return {
          target: original[index] + (fixed ? 0 : shift) - offsets[index],
          weight: Math.max(1, shifts.length),
          fixed,
        }
      })
      type Pool = { from: number; to: number; mean: number; weight: number; fixed: boolean }
      const pools: Pool[] = []
      targets.forEach(({ target, weight, fixed }, index) => {
        pools.push({ from: index, to: index, mean: target, weight, fixed })
        while (pools.length > 1 && pools[pools.length - 2].mean > pools[pools.length - 1].mean) {
          const right = pools.pop()!,
            left = pools.pop()!
          pools.push({
            from: left.from,
            to: right.to,
            mean: left.fixed
              ? left.mean
              : right.fixed
                ? right.mean
                : (left.mean * left.weight + right.mean * right.weight) /
                  (left.weight + right.weight),
            weight: left.weight + right.weight,
            fixed: left.fixed || right.fixed,
          })
        }
      })
      const fitted: number[] = []
      for (const pool of pools)
        for (let index = pool.from; index <= pool.to; index++)
          fitted[index] = pool.mean + offsets[index]
      const shifts = fitted.map((center, i) => center - original[i])
      if (Math.max(...shifts.map(Math.abs)) < 330) continue
      const before = cost()
      blocks.forEach((block, index) =>
        block.forEach((node) => {
          node.x += shifts[index]
        }),
      )
      // Compact placement is the default. Introduce gaps only for a meaningful
      // reduction in relationship lengths, not for incidental small offsets.
      if (before - cost() >= 330) changed = true
      else
        blocks.forEach((block, index) =>
          block.forEach((node) => {
            node.x -= shifts[index]
          }),
        )
    }
    if (!changed) break
  }
}
