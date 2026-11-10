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
    const offsets = [0, -18, 18, -30, 30]
    const busFor = (ports: number[], y: number) =>
      segments([
        { x: Math.min(...ports), y },
        { x: Math.max(...ports), y },
      ])
    const isClear = (path: Segment[]) =>
      path.every((s) => !hitsCard(s) && !occupied.some((other) => intersection(s, other)))

    // Try a single horizontal level before considering any sideways detours.
    // Test the complete bus as well as the legs so a clear leg cannot hide a crossing.
    for (const y of lanes) {
      const ports = anchors.map((anchor) =>
        offsets
          .map((offset) => anchor.x + offset)
          .find((x) =>
            isClear(
              segments([
                { x, y: anchor.y },
                { x, y },
              ]),
            ),
          ),
      )
      if (ports.some((x) => x === undefined)) continue
      const xs = ports as number[]
      const bus = busFor(xs, y)
      if (!isClear(bus)) continue
      addGroup(owner, [
        ...anchors.flatMap((anchor, i) =>
          segments([
            { x: xs[i], y: anchor.y },
            { x: xs[i], y },
          ]),
        ),
        ...bus,
      ])
      return
    }

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
        for (const offset of offsets) {
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
      const bus = busFor(ports, y)
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
  const byChildRow = new Map<number, { owner: number; anchors: Port[]; lanes: number[] }[]>()
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
    const lanes = [48, 64, 36, 80, 56, 72, 88, 96]
      .map((offset) => childTop - offset)
      .filter((y) => y >= lowerBound)
    const starts = couple
      ? [
          {
            x: (parents[0].x + parents[1].x) / 2,
            y: parents[0].y + 45,
            gutter: rowBottom.get(parents[0].y)! + 22,
          },
        ]
      : parents.map(bottomPort)
    const row = byChildRow.get(childTop) ?? []
    row.push({
      owner,
      anchors: [...starts, ...children.map((n) => ({ x: n.x, y: n.y, gutter: n.y - 36 }))],
      lanes,
    })
    byChildRow.set(childTop, row)
  }

  for (const [childTop, row] of byChildRow) {
    const referenceY = childTop - 48
    const spans = row.map(({ anchors }) => ({
      min: Math.min(...anchors.map((anchor) => anchor.x)),
      max: Math.max(...anchors.map((anchor) => anchor.x)),
    }))
    const above = (a: number, b: number) => {
      const inside = (x: number, span: { min: number; max: number }) => x > span.min && x < span.max
      // A parent stem must stop before a lower bus. A child leg must start
      // below an upper bus. These constraints determine the order of the levels.
      return (
        row[a].anchors.some((p) => p.y < referenceY && inside(p.x, spans[b])) ||
        row[b].anchors.some((p) => p.y > referenceY && inside(p.x, spans[a]))
      )
    }
    const followers = row.map((_, a) =>
      row.flatMap((__, b) => (a !== b && above(a, b) && !above(b, a) ? [b] : [])),
    )
    const incoming = row.map(() => 0),
      ranks = row.map(() => 0)
    followers.forEach((next) => next.forEach((b) => incoming[b]++))
    const order = incoming.flatMap((count, i) => (count === 0 ? [i] : []))
    for (let i = 0; i < order.length; i++) {
      const a = order[i]
      for (const b of followers[a]) {
        ranks[b] = Math.max(ranks[b], ranks[a] + 1)
        if (--incoming[b] === 0) order.push(b)
      }
    }
    // Conflicting constraints still go through the obstacle-aware fallback.
    row.forEach((_, i) => {
      if (incoming[i] > 0) order.push(i)
    })
    const levels = [...new Set(row.flatMap(({ lanes }) => lanes))].sort((a, b) => a - b)
    const maxRank = Math.max(...ranks)
    for (const i of order) {
      const { owner, anchors, lanes } = row[i]
      const preferred =
        maxRank === 0 ? referenceY : levels[Math.round((ranks[i] * (levels.length - 1)) / maxRank)]
      const candidates = [...lanes].sort(
        (a, b) => Math.abs(a - preferred) - Math.abs(b - preferred),
      )
      connect(owner, anchors, candidates)
    }
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
