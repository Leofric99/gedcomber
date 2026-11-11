type Point = { x: number; y: number }
type Line = { a: Point; b: Point }
const key = (p: Point) => `${p.x},${p.y}`
const length = (line: Line) => Math.abs(line.a.x - line.b.x) + Math.abs(line.a.y - line.b.y)
const contains = (line: Line, p: Point) =>
  p.x >= Math.min(line.a.x, line.b.x) &&
  p.x <= Math.max(line.a.x, line.b.x) &&
  p.y >= Math.min(line.a.y, line.b.y) &&
  p.y <= Math.max(line.a.y, line.b.y)

/** Round only isolated two-leg elbows. An endpoint touching another segment's
 * interior is a junction, even when that segment has not been split there. */
export function roundedRelationshipPaths(paths: string[], radius = 8): string[] {
  const lines: Line[] = [],
    unchanged: string[] = []
  for (const path of paths) {
    const match = /^M (-?[\d.e+]+) (-?[\d.e+]+) ([HV]) (-?[\d.e+]+)$/i.exec(path)
    if (!match) {
      unchanged.push(path)
      continue
    }
    const a = { x: Number(match[1]), y: Number(match[2]) }
    const b = match[3] === 'H' ? { x: Number(match[4]), y: a.y } : { x: a.x, y: Number(match[4]) }
    lines.push({ a, b })
  }
  const endpoints = new Map<string, { point: Point; indices: number[] }>()
  lines.forEach((line, index) => {
    for (const point of [line.a, line.b]) {
      const entry = endpoints.get(key(point)) ?? { point, indices: [] }
      entry.indices.push(index)
      endpoints.set(key(point), entry)
    }
  })
  const trimmed = lines.map(({ a, b }) => ({ a: { ...a }, b: { ...b } }))
  const curves: string[] = []
  for (const { point, indices } of endpoints.values()) {
    if (indices.length !== 2) continue
    const [first, second] = indices.map((index) => lines[index])
    if ((first.a.y === first.b.y) === (second.a.y === second.b.y)) continue
    if (lines.some((line, index) => !indices.includes(index) && contains(line, point))) continue
    const r = Math.min(radius, length(first) / 2, length(second) / 2)
    if (r <= 0) continue
    const ends = indices.map((index) => {
      const line = lines[index]
      const end = key(line.a) === key(point) ? 'a' : 'b'
      const other = line[end === 'a' ? 'b' : 'a']
      const inset = {
        x: point.x + Math.sign(other.x - point.x) * r,
        y: point.y + Math.sign(other.y - point.y) * r,
      }
      trimmed[index][end] = inset
      return inset
    })
    curves.push(`M ${ends[0].x} ${ends[0].y} Q ${point.x} ${point.y} ${ends[1].x} ${ends[1].y}`)
  }
  return [
    ...unchanged,
    ...trimmed.map(({ a, b }) =>
      a.y === b.y ? `M ${a.x} ${a.y} H ${b.x}` : `M ${a.x} ${a.y} V ${b.y}`,
    ),
    ...curves,
  ]
}
