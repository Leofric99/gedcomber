import { useId } from 'react'
import type { Theme } from '../lib/types'
import { selectBorderArt } from './treeBorderArt'

const leafShapes = [
  'M 0 0 C -13 -2 -22 -15 -16 -25 C -3 -23 5 -9 0 0 Z',
  'M 0 0 C -8 -7 -11 -22 -3 -29 C 6 -21 7 -7 0 0 Z',
  'M 0 0 C -17 1 -28 -8 -25 -18 C -10 -19 1 -11 0 0 Z',
]

/** Select one complete composition for the edge, not a repeated motif strip. */
export function TreeBorder({
  theme,
  width,
  height,
  scale,
  title,
  subtitle,
}: {
  theme: Theme
  width: number
  height: number
  scale: number
  title: string
  subtitle: string
}) {
  const uid = useId().replace(/:/g, '')
  const w = width / scale,
    h = height / scale
  const margin = 34,
    length = w - margin * 2
  const art = selectBorderArt(length)
  const opening =
    title || subtitle
      ? Math.min(
          w / 2 - margin,
          Math.max(100, (title.length * 12) / scale, (subtitle.length * 4.5) / scale),
        )
      : 0

  const composition = (lower: boolean) => {
    if (theme.decoration === 'minimal')
      return (
        <g fill="none" stroke={theme.accent}>
          {art.minimal.map((d, i) => (
            <path
              key={i}
              d={d}
              strokeWidth={i === 3 ? 2.8 : 1.1}
              opacity={i === 3 ? '.85' : '.65'}
            />
          ))}
        </g>
      )
    if (theme.decoration === 'frame')
      return (
        <g fill="none" stroke={theme.accent}>
          {art.frame.map((d, i) => (
            <path key={i} d={d} strokeWidth={i === 1 ? 0.6 : 1.1} opacity={i === 1 ? '.5' : '.8'} />
          ))}
        </g>
      )
    if (theme.decoration === 'stars')
      return (
        <g stroke={theme.accent} fill={theme.accent}>
          <path d={art.constellation} fill="none" strokeWidth=".7" opacity=".45" />
          {art.stars.map(([x, y, radius, pointed], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              {pointed ? (
                <path
                  d={`M 0 ${-radius} Q 1 -1 ${radius * 0.7} 0 Q 1 1 0 ${radius} Q -1 1 ${-radius * 0.7} 0 Q -1 -1 0 ${-radius} Z`}
                  strokeWidth=".4"
                  opacity=".85"
                />
              ) : (
                <circle r={radius} stroke="none" opacity=".65" />
              )}
            </g>
          ))}
        </g>
      )
    return (
      <g stroke={theme.accent} transform="scale(1 .7)">
        <path d={art.vine} fill="none" strokeWidth="1.15" opacity=".75" />
        {art.leaves.map(([x, y, turn, size, shape], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${turn}) scale(${size})`}>
            <path
              d={leafShapes[shape]}
              fill={theme.accent}
              strokeWidth=".4"
              opacity={shape === 1 ? '.32' : '.5'}
            />
            <path d="M 0 0 Q -8 -8 -11 -17" fill="none" strokeWidth=".45" opacity=".5" />
          </g>
        ))}
        {art.flowers.map(([x, y, size], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${size})`}>
            {lower ? (
              <>
                <path
                  d="M 0 -2 C -12 -18 4 -22 3 -7 C 13 -23 22 -9 8 -3 C 25 -5 23 12 8 6 C 19 19 2 25 1 9 C -5 26 -20 16 -7 5 C -25 10 -24 -8 -8 -4 C -23 -16 -6 -25 0 -9 Z"
                  fill={theme.paper}
                  strokeWidth=".75"
                />
                <circle r="3.1" fill={theme.accent} stroke="none" />
              </>
            ) : (
              <>
                <path
                  d="M -3 4 Q -12 -12 -2 -16 Q 9 -9 3 4 Z"
                  fill={theme.paper}
                  strokeWidth=".7"
                />
                <path d="M 0 2 V 11 M -6 5 L 0 9 6 4" fill="none" strokeWidth=".7" />
              </>
            )}
          </g>
        ))}
      </g>
    )
  }

  const edge = (y: number, lower: boolean) => (
    <g transform={`translate(0 ${y})`} data-decoration-edge={lower ? 'bottom' : 'top'}>
      {!lower && opening > 0 && (
        <defs>
          <clipPath id={`${uid}-heading`} clipPathUnits="userSpaceOnUse">
            <rect x={margin} y="-45" width={Math.max(0, w / 2 - opening - margin)} height="90" />
            <rect
              x={w / 2 + opening}
              y="-45"
              width={Math.max(0, w / 2 - opening - margin)}
              height="90"
            />
          </clipPath>
        </defs>
      )}
      <g clipPath={!lower && opening > 0 ? `url(#${uid}-heading)` : undefined}>
        <svg
          x={margin}
          y="-45"
          width={length}
          height="90"
          viewBox={`0 -45 ${art.width} 90`}
          preserveAspectRatio="none"
          overflow="hidden"
          data-border-design={art.name}
          data-artwork-width={art.width}
        >
          <g transform={lower ? `translate(${art.width} 0) scale(-1 -1)` : undefined}>
            {composition(lower)}
          </g>
        </svg>
      </g>
    </g>
  )

  return (
    <g transform={`scale(${scale})`} aria-hidden="true" data-tree-border={theme.decoration}>
      {theme.decoration === 'frame' && (
        <path
          d={`M 21 32 V ${h - 32} M ${w - 21} 32 V ${h - 32}`}
          fill="none"
          stroke={theme.accent}
          strokeWidth=".7"
          opacity=".6"
        />
      )}
      {edge(54, false)}
      {edge(h - 54, true)}
    </g>
  )
}
