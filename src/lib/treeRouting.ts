import type { TreeNode } from './tree'
import type { Family } from './types'

type Point = { x: number; y: number }
type Segment = { from: Point; to: Point }
type Port = Point & { gutter: number }

function segments(points: Point[]): Segment[] {
  return points.slice(1).flatMap((to, i) => {
    const from = points[i]
    return from.x === to.x && from.y === to.y ? [] : [{ from, to }]
  })
}

const horizontal = (s: Segment) => s.from.y === s.to.y
const range = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)] as const

// Return the interval along the first segment occupied by the second.
function intersection(a: Segment, b: Segment) {
  const axis = horizontal(a) ? 'x' : 'y'
  const other = axis === 'x' ? 'y' : 'x'
  const [start, end] = range(a.from[axis], a.to[axis])
  const [bStart, bEnd] = range(b.from[axis], b.to[axis])
  const [bLow, bHigh] = range(b.from[other], b.to[other])
  const low = Math.max(start, bStart),
    high = Math.min(end, bEnd)
  if (low > high || a.from[other] < bLow || a.from[other] > bHigh) return
  return [low, high] as const
}

export function routeTree(nodes: TreeNode[], families: Family[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const rowBottom = new Map<number, number>()
  for (const n of nodes)
    rowBottom.set(n.y, Math.max(rowBottom.get(n.y) ?? -Infinity, n.y + n.height))
  const rowTops = [...rowBottom.keys()].sort((a, b) => a - b)
  const outside = [
    Math.min(...nodes.map((n) => n.x - n.width / 2)) - 42,
    Math.max(...nodes.map((n) => n.x + n.width / 2)) + 42,
  ]
  const channels = [
    ...new Set([
      ...outside,
      ...nodes.flatMap((n) => [n.x - n.width / 2 - 14, n.x + n.width / 2 + 14]),
    ]),
  ]
  const groups: { owner: number; paths: Segment[] }[] = []
  const addGroup = (owner: number, paths: Segment[]) => {
    groups.push({ owner, paths })
  }
  const hitsCard = ({ from, to }: Segment) => {
    const [left, right] = range(from.x, to.x),
      [top, bottom] = range(from.y, to.y)
    return nodes.some(
      (n) =>
        left < n.x + n.width / 2 &&
        right > n.x - n.width / 2 &&
        top < n.y + n.height &&
        bottom > n.y,
    )
  }
  const cost = (path: Segment[], existing: Segment[]) => {
    let total = 0
    for (const s of path) {
      if (hitsCard(s)) return Infinity
      total += Math.abs(s.from.x - s.to.x) + Math.abs(s.from.y - s.to.y) + 12
      for (const other of existing) {
        const hit = intersection(s, other)
        if (hit) total += 2000 + (hit[1] - hit[0]) * 50
      }
    }
    return total
  }
  const visible = (ids: string[]) =>
    ids.flatMap((id) => {
      const node = byId.get(id)
      return node ? [node] : []
    })
  const units = families.map((family, owner) => {
    const parents = visible(family.parents).sort((a, b) => a.x - b.x)
    const children = visible(family.children)
    const [left, right] = parents
    const couple =
      parents.length === 2 &&
      left.y === right.y &&
      !nodes.some((n) => n.y === left.y && n.x > left.x && n.x < right.x)
    if (couple)
      addGroup(
        owner,
        segments([
          { x: left.x + left.width / 2, y: left.y + 45 },
          { x: right.x - right.width / 2, y: left.y + 45 },
        ]),
      )
    return { parents, children, couple, owner }
  })

  function connect(owner: number, anchors: Port[], lanes: number[]) {
    const occupied = groups.flatMap((group) => (group.owner === owner ? [] : group.paths))
    let best: Segment[] = [],
      bestCost = Infinity
    for (const y of lanes) {
      const legs: Segment[] = [],
        ports: number[] = []
      let total = 0
      for (const anchor of anchors) {
        let leg: Segment[] = [],
          legCost = Infinity,
          busX = anchor.x
        const existing = occupied
        for (const offset of [0, -18, 18, -30, 30]) {
          const x = anchor.x + offset
          const start = { x, y: anchor.y }
          const direct = segments([start, { x, y }])
          const directCost = cost(direct, existing) + Math.abs(offset)
          if (directCost < legCost) {
            leg = direct
            legCost = directCost
            busX = x
          }
        }
        if (legCost >= 2000) {
          for (const x of channels) {
            const path = segments([
              anchor,
              { x: anchor.x, y: anchor.gutter },
              { x, y: anchor.gutter },
              { x, y },
            ])
            const pathCost = cost(path, existing)
            if (pathCost < legCost) {
              leg = path
              legCost = pathCost
              busX = x
            }
          }
        }
        total += legCost
        legs.push(...leg)
        ports.push(busX)
      }
      const bus = segments([
        { x: Math.min(...ports), y },
        { x: Math.max(...ports), y },
      ])
      total += cost(bus, occupied)
      if (total < bestCost) {
        bestCost = total
        best = [...legs, ...bus]
      }
    }
    addGroup(owner, best)
  }

  const bottomPort = (n: TreeNode): Port => ({
    x: n.x,
    y: n.y + n.height,
    gutter: rowBottom.get(n.y)! + 22,
  })
  for (const { parents, children, couple, owner } of units) {
    if (!children.length) {
      if (!couple && parents.length > 1) {
        const ports = parents.map(bottomPort)
        const y = Math.max(...ports.map((port) => port.gutter))
        connect(owner, ports, [y, y + 16, y + 32])
      }
      continue
    }
    if (!parents.length && children.length < 2) continue
    const childTop = Math.min(...children.map((n) => n.y))
    const prev = rowTops[rowTops.indexOf(childTop) - 1]
    const lowerBound = prev === undefined ? childTop - 80 : rowBottom.get(prev)! + 12
    const lanes = [48, 64, 36, 80].map((offset) => childTop - offset).filter((y) => y >= lowerBound)
    const starts = couple
      ? [
          {
            x: (parents[0].x + parents[1].x) / 2,
            y: parents[0].y + 45,
            gutter: rowBottom.get(parents[0].y)! + 22,
          },
        ]
      : parents.map(bottomPort)
    connect(
      owner,
      [...starts, ...children.map((n) => ({ x: n.x, y: n.y, gutter: n.y - 36 }))],
      lanes,
    )
  }

  // If the relationships force a crossing, leave a gap in the later route.
  // A continuous stroke through the crossing would look like a family junction.
  const earlier: { owner: number; segment: Segment }[] = []
  return groups.flatMap(({ owner, paths: group }) => {
    const paths = group.flatMap((s) => {
      const axis = horizontal(s) ? 'x' : 'y'
      const [start, end] = range(s.from[axis], s.to[axis])
      const cuts = earlier
        .flatMap((other) => {
          if (other.owner === owner) return []
          const hit = intersection(s, other.segment)
          if (!hit) return []
          return [[hit[0] - 5, hit[1] + 5] as const]
        })
        .sort((a, b) => a[0] - b[0])
      const runs: [number, number][] = []
      let cursor = start
      for (const [low, high] of cuts) {
        if (cursor < low) runs.push([cursor, low])
        cursor = Math.max(cursor, high)
      }
      if (cursor < end) runs.push([cursor, end])
      return runs.map(([a, b]) =>
        axis === 'x' ? `M ${a} ${s.from.y} H ${b}` : `M ${s.from.x} ${a} V ${b}`,
      )
    })
    earlier.push(...group.map((segment) => ({ owner, segment })))
    return paths
  })
}
