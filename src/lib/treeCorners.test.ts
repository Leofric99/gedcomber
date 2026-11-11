import { describe, expect, it } from 'vitest'
import { roundedRelationshipPaths } from './treeCorners'

describe('relationship corners', () => {
  it('rounds a simple elbow while preserving its outer endpoints', () => {
    expect(roundedRelationshipPaths(['M 0 0 H 100', 'M 100 0 V 100'])).toEqual([
      'M 0 0 H 92',
      'M 100 8 V 100',
      'M 92 0 Q 100 0 100 8',
    ])
  })
  it('leaves T junctions and four-way crossings square, including unsplit buses', () => {
    for (const paths of [
      ['M 0 0 H 100', 'M 100 0 V 100', 'M 100 -100 V 0'],
      ['M 0 0 H 100', 'M 100 0 V 100', 'M 50 0 H 150'],
      ['M 0 0 H 100', 'M 100 0 V 100', 'M 100 -100 V 0', 'M 100 0 H 200'],
      ['M 0 0 H 200', 'M 100 -100 V 100'],
    ])
      expect(roundedRelationshipPaths(paths)).toEqual(paths)
  })
  it('limits the radius on short legs and rounds both ends without reversing a line', () => {
    const rounded = roundedRelationshipPaths(['M 0 0 V 10', 'M 0 10 H 6', 'M 6 10 V 20'])
    expect(rounded).toContain('M 3 10 H 3')
    expect(rounded.filter((path) => path.includes(' Q '))).toHaveLength(2)
    expect(rounded).toContain('M 0 7 Q 0 10 3 10')
    expect(rounded).toContain('M 3 10 Q 6 10 6 13')
  })
  it('does not connect deliberate gaps between unrelated routes', () => {
    const paths = ['M 0 0 H 95', 'M 100 5 V 100']
    expect(roundedRelationshipPaths(paths)).toEqual(paths)
  })
})
