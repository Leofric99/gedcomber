import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TreeBorder } from './TreeBorder'
import { themes } from '../lib/themes'
import { treePrintMetrics } from '../lib/exportSizing'
import { borderArt, selectBorderArt } from './treeBorderArt'

describe('export edge decoration', () => {
  it('extends every theme across both edges on small and panoramic exports', () => {
    for (const theme of themes)
      for (const width of [760, 25000, 100000]) {
        const metrics = treePrintMetrics({ width, height: 1200 }, '', '')
        const markup = renderToStaticMarkup(
          <svg>
            <TreeBorder
              theme={theme}
              width={metrics.width}
              height={metrics.height}
              scale={metrics.decorationScale}
              title=""
              subtitle=""
            />
          </svg>,
        )
        const top = markup
          .split('data-decoration-edge="top"')[1]
          .split('data-decoration-edge="bottom"')[0]
        const bottom = markup.split('data-decoration-edge="bottom"')[1]
        const length = metrics.width / metrics.decorationScale - 68
        // Both edges reach across the artwork, rather than just the corners.
        expect(top).toContain(`x="34" y="-45" width="${length}"`)
        expect(bottom).toContain(`x="34" y="-45" width="${length}"`)
        expect(markup.match(/data-border-design=/g)).toHaveLength(2)
        expect(markup).not.toMatch(/NaN|Infinity/)
        // Keep shapes large enough to read when panoramic artwork is fit to view.
        expect(metrics.width / metrics.decorationScale).toBeLessThanOrEqual(5400)
      }
  })
  it('leaves a centered opening around headings without interrupting the footer', () => {
    const theme = themes[0]
    const markup = renderToStaticMarkup(
      <svg>
        <TreeBorder
          theme={theme}
          width={1000}
          height={800}
          scale={1}
          title="Our family tree"
          subtitle=""
        />
      </svg>,
    )
    const top = markup
      .split('data-decoration-edge="top"')[1]
      .split('data-decoration-edge="bottom"')[0]
    const bottom = markup.split('data-decoration-edge="bottom"')[1]
    expect(top).toContain('clipPathUnits="userSpaceOnUse"')
    expect(top).toContain('x="34" y="-45" width="286"')
    expect(top).toContain('x="680" y="-45" width="286"')
    expect(top).toContain('clip-path="url(')
    expect(bottom).not.toContain('clip-path=')
    expect(bottom).toContain('x="34" y="-45" width="932"')
  })
  it('uses one complete composition per edge instead of adding repetitions as width grows', () => {
    const render = (width: number) =>
      renderToStaticMarkup(
        <svg>
          <TreeBorder
            theme={themes[0]}
            width={width}
            height={1000}
            scale={1}
            title=""
            subtitle=""
          />
        </svg>,
      )
    const small = render(760),
      wide = render(5000),
      wider = render(10000)
    expect(small).toContain('data-border-design="compact"')
    expect(wide).toContain('data-border-design="panoramic"')
    expect(wider).toContain('data-border-design="panoramic"')
    const paths = (svg: string) => svg.match(/<path\b/g)?.length
    expect(paths(wide)).toBe(paths(wider))
    expect(wide.match(/data-border-design=/g)).toHaveLength(2)
    expect(wide).not.toContain('<pattern')
    expect(wide).not.toContain('<use')
  })
  it('chooses the nearest authored length, with distinct compositions for each theme', () => {
    for (const art of borderArt) {
      expect(selectBorderArt(art.width)).toBe(art)
      expect(selectBorderArt(art.width * 1.05)).toBe(art)
    }
    for (const property of ['vine', 'frame', 'minimal', 'constellation'] as const)
      expect(new Set(borderArt.map((art) => JSON.stringify(art[property]))).size).toBe(
        borderArt.length,
      )
    expect(selectBorderArt(550).name).toBe('compact')
    expect(selectBorderArt(1500).name).toBe('wide')
    expect(selectBorderArt(4500).name).toBe('panoramic')
  })
})
