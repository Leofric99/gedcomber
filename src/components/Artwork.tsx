import { useId, useMemo } from 'react'
import type { Theme, Project, Expansion } from '../lib/types'
import type { Layout } from '../lib/tree'
import { relatives } from '../lib/tree'
import { childExpansionOwners } from '../lib/treeControls'
import { roundedRelationshipPaths } from '../lib/treeCorners'
import { treePrintMetrics } from '../lib/exportSizing'
import { TreeBorder } from './TreeBorder'
export function Ornament({
  theme,
  width,
  height,
  borderless = false,
  scale = 1,
}: {
  theme: Theme
  width: number
  height: number
  borderless?: boolean
  scale?: number
}) {
  if (scale !== 1)
    return (
      <g transform={`scale(${scale})`}>
        <Ornament
          theme={theme}
          width={width / scale}
          height={height / scale}
          borderless={borderless}
        />
      </g>
    )
  if (theme.decoration === 'minimal')
    return (
      <>
        <path
          d={`M 34 52 H 115 M 34 52 V 100 M ${width - 34} ${height - 52} h -81 m 81 0 v -48`}
          fill="none"
          stroke={theme.accent}
          strokeWidth="3"
        />
      </>
    )
  if (theme.decoration === 'frame')
    return (
      <>
        {!borderless && (
          <rect
            x="19"
            y="19"
            width={width - 38}
            height={height - 38}
            fill="none"
            stroke={theme.accent}
            strokeWidth="1"
          />
        )}
        {!borderless && (
          <rect
            x="26"
            y="26"
            width={width - 52}
            height={height - 52}
            fill="none"
            stroke={theme.accent}
            strokeWidth=".4"
          />
        )}
        {[
          [42, 42],
          [width - 42, 42],
          [42, height - 42],
          [width - 42, height - 42],
        ].map(([x, y], i) => (
          <path key={i} d={`M ${x} ${y - 9} l 9 9 -9 9 -9 -9 Z`} fill={theme.accent} />
        ))}
      </>
    )
  if (theme.decoration === 'stars')
    return (
      <g fill={theme.accent} opacity=".65">
        {Array.from({ length: 26 }, (_, i) => {
          const x = i % 2 ? width - 35 - ((i * 31) % 110) : 35 + ((i * 37) % 110),
            y = 30 + ((i * 97) % (height - 60))
          return (
            <path
              key={i}
              d={`M ${x - 4} ${y} h 8 M ${x} ${y - 4} v 8`}
              stroke={theme.accent}
              strokeWidth={i % 3 === 0 ? 1.3 : 0.6}
            />
          )
        })}
      </g>
    )
  return (
    <g opacity=".75">
      {[
        { x: 8, y: 0, r: 0 },
        { x: width - 8, y: height, r: 180 },
      ].map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.r}) scale(.9)`}>
          <path
            d="M 0 230 C 72 168 26 83 155 4 M 39 179 Q 100 149 126 100 M 55 122 Q 25 87 15 51 M 89 60 Q 144 65 179 29"
            stroke={theme.accent}
            strokeWidth="1.5"
            fill="none"
          />
          {[
            [21, 203, -30],
            [36, 166, 25],
            [53, 135, -37],
            [51, 109, -95],
            [77, 78, -25],
            [110, 39, -32],
            [142, 13, -27],
            [83, 154, 10],
            [106, 128, -25],
            [126, 99, -33],
            [29, 83, -100],
            [14, 52, -105],
            [126, 56, 35],
            [159, 40, 8],
          ].map(([x, y, r], j) => (
            <g key={j} transform={`translate(${x} ${y}) rotate(${r})`}>
              <path
                d="M 0 0 Q -14 -27 0 -43 Q 16 -24 0 0"
                fill={theme.accent}
                opacity={0.3 + (j % 3) * 0.16}
              />
              <path d="M 0 0 L 0 -36" stroke={theme.ink} strokeWidth=".5" opacity=".35" />
            </g>
          ))}
          {[
            [66, 98],
            [133, 39],
            [103, 140],
          ].map(([x, y], j) => (
            <g key={j} transform={`translate(${x} ${y})`}>
              {[0, 72, 144, 216, 288].map((r) => (
                <ellipse
                  key={r}
                  cy="-6"
                  rx="4"
                  ry="7"
                  transform={`rotate(${r})`}
                  fill={theme.card}
                  stroke={theme.line}
                  strokeWidth=".5"
                />
              ))}
              <circle r="2.2" fill="#c3a35e" />
            </g>
          ))}
        </g>
      ))}
    </g>
  )
}
type Props = {
  project: Project
  layout: Layout
  theme: Theme
  selected?: string
  onSelect?: (id: string) => void
  onToggle?: (id: string, group: keyof Expansion) => void
  interactive?: boolean
}
export function TreeNodes({
  project,
  layout,
  theme,
  selected,
  onSelect,
  onToggle,
  interactive = false,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const nodesById = new Map(layout.nodes.map((node) => [node.id, node]))
  const relationshipPaths = useMemo(() => roundedRelationshipPaths(layout.edges), [layout.edges])
  const childControls = interactive ? childExpansionOwners(project, layout) : new Set<string>()
  return (
    <g>
      {relationshipPaths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={theme.line} strokeWidth="1.4" />
      ))}
      {layout.nodes.map((n) => {
        const person = project.dataset.people[n.id],
          photo = project.display.photos && person.photo,
          textTop = photo ? 110 : 32,
          rel = interactive ? relatives(project.dataset, n.id) : null
        const partner = rel?.partners
          .map((id) => nodesById.get(id))
          .find((p) => p?.level === n.level)
        const sibling = rel?.siblings
          .map((id) => nodesById.get(id))
          .find((p) => p?.level === n.level)
        const siblingsRight = sibling ? sibling.x > n.x : partner !== undefined && partner.x < n.x
        const controls: {
          group: keyof Expansion
          x: number
          y: number
          symbol: string
          label: string
        }[] = [
          { group: 'parents', x: 0, y: -19, symbol: '↑', label: 'parents' },
          {
            group: 'siblings',
            x: siblingsRight ? 145 : -145,
            y: 44,
            symbol: siblingsRight ? '→' : '←',
            label: siblingsRight ? 'siblings to the right' : 'siblings to the left',
          },
          {
            group: 'partners',
            x: siblingsRight ? -145 : 145,
            y: 44,
            symbol: '♡',
            label: 'partners',
          },
          { group: 'children', x: 0, y: n.height + 19, symbol: '↓', label: 'children' },
        ]
        return (
          <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
            <g
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              data-person-id={interactive ? n.id : undefined}
              aria-label={interactive ? `Edit ${person.given} ${person.surname}` : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect?.(n.id)
                }
              }}
              style={{ cursor: interactive ? 'pointer' : undefined }}
            >
              <rect
                x="-125"
                width="250"
                height={n.height}
                rx={theme.id === 'modern' ? 3 : 8}
                fill={project.personBoxes === false ? 'transparent' : theme.card}
                stroke={
                  project.personBoxes === false
                    ? 'none'
                    : selected === n.id && interactive
                      ? theme.accent
                      : theme.line
                }
                strokeWidth={selected === n.id && interactive ? 2.5 : 0.7}
              />
              {n.id === project.primary && (
                <path d="M -20 0 H 20" stroke={theme.accent} strokeWidth="3" />
              )}
              {photo && (
                <>
                  <defs>
                    <clipPath id={`${uid}-${n.id.replace(/[^a-z0-9]/gi, '')}`}>
                      <circle cy="48" r="30" />
                    </clipPath>
                  </defs>
                  <image
                    href={person.photo}
                    x="-30"
                    y="18"
                    width="60"
                    height="60"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#${uid}-${n.id.replace(/[^a-z0-9]/gi, '')})`}
                  />
                </>
              )}
              <text
                textAnchor="middle"
                fill={theme.ink}
                fontFamily={theme.font}
                fontSize={theme.id === 'modern' ? 18 : 23}
                fontWeight="500"
              >
                {n.name.map((line, i) => (
                  <tspan key={i} x="0" y={textTop + i * 25}>
                    {line}
                  </tspan>
                ))}
              </text>
              {!!n.details.length && (
                <path
                  d={`M -20 ${textTop + n.name.length * 25 - 12} H 20`}
                  stroke={theme.accent}
                  strokeWidth=".6"
                  opacity=".7"
                />
              )}
              <text
                textAnchor="middle"
                fill={theme.ink}
                opacity=".75"
                fontFamily="Inter, sans-serif"
                fontSize="10.5"
              >
                {n.details.map((line, i) => (
                  <tspan key={i} x="0" y={textTop + n.name.length * 25 + 9 + i * 18}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
            {interactive &&
              controls
                .filter((c) => {
                  if (c.group === 'partners') return rel!.partners.length > 1
                  if (!rel![c.group].length) return false
                  // Keep the owner of an open branch available for collapsing.
                  if (project.expanded[n.id]?.[c.group]) return true
                  if (c.group === 'children')
                    return childControls.has(n.id) && !rel!.children.some((id) => nodesById.has(id))
                  if (c.group === 'siblings')
                    return !(
                      rel!.siblings.every((id) => nodesById.has(id)) &&
                      rel!.siblings.some(
                        (id) => nodesById.has(id) && project.expanded[id]?.siblings,
                      )
                    )
                  return true
                })
                .map((c) => (
                  <g
                    key={c.group}
                    role="button"
                    tabIndex={0}
                    aria-label={`${project.expanded[n.id]?.[c.group] ? 'Hide' : 'Show'} ${c.label} of ${person.given} ${person.surname}`}
                    onClick={() => onToggle?.(n.id, c.group)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onToggle?.(n.id, c.group)
                      }
                    }}
                    className="branch-control"
                    transform={`translate(${c.x} ${c.y})`}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <circle
                      r="12"
                      fill={project.expanded[n.id]?.[c.group] ? theme.accent : theme.card}
                      stroke={theme.accent}
                      strokeWidth=".8"
                    />
                    <text
                      textAnchor="middle"
                      y="4"
                      fontFamily="Inter, sans-serif"
                      fontSize="13"
                      fill={project.expanded[n.id]?.[c.group] ? theme.paper : theme.ink}
                    >
                      {project.expanded[n.id]?.[c.group] ? '−' : c.symbol}
                    </text>
                    <title>
                      {`${project.expanded[n.id]?.[c.group] ? 'Hide' : 'Show'} ${c.label} (${rel![c.group].length})`}
                    </title>
                  </g>
                ))}
          </g>
        )
      })}
    </g>
  )
}
export function TreePrint({
  project,
  layout,
  theme,
  title,
  subtitle,
  fontCSS = '',
}: Props & { title: string; subtitle: string; fontCSS?: string }) {
  const { width, height, top, decorationScale } = treePrintMetrics(
    layout,
    title,
    subtitle,
    project.decorationSize,
  )
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <style>{fontCSS}</style>
      <rect width={width} height={height} fill={theme.paper} />
      <TreeBorder
        theme={theme}
        width={width}
        height={height}
        scale={decorationScale}
        title={title}
        subtitle={subtitle}
      />
      {title && (
        <text
          x={width / 2}
          y={top - 85}
          textAnchor="middle"
          fontFamily={theme.font}
          fontSize="38"
          fill={theme.ink}
        >
          {title}
        </text>
      )}
      {subtitle && (
        <text
          x={width / 2}
          y={top - (title ? 52 : 85)}
          textAnchor="middle"
          fontFamily="Inter"
          fontSize="12"
          letterSpacing="2"
          fill={theme.accent}
        >
          {subtitle}
        </text>
      )}
      <g transform={`translate(${(width - layout.width) / 2 - layout.minX} ${top - layout.minY})`}>
        <TreeNodes project={project} layout={layout} theme={theme} />
      </g>
    </svg>
  )
}
