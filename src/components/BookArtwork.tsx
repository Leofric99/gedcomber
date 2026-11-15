import type { Project, Theme } from '../lib/types'
import type { BookPage } from '../lib/book'
import { Ornament } from './Artwork'
import { storyFont } from '../lib/bookPhoto'
import { BookPhotograph } from './BookPhotograph'
export function BookArtwork({
  page,
  project,
  theme,
  index,
  fontCSS = '',
}: {
  page: BookPage
  project: Project
  theme: Theme
  index: number
  fontCSS?: string
}) {
  const { width: w, height: h, person: p } = page,
    b = project.book,
    m = 52
  const headerX = page.nameX,
    nameY = page.nameY
  if (page.kind)
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={page.kind === 'contents' ? 'Contents' : `${page.section} section`}
      >
        <style>{fontCSS}</style>
        <rect width={w} height={h} fill={theme.paper} />
        <Ornament theme={theme} width={w} height={h} scale={page.kind === 'contents' ? 0.3 : 1} />
        {page.kind === 'contents' && (
          <rect x={40} y={60} width={w - 80} height={h - 108} fill={theme.paper} />
        )}

        {page.kind === 'divider' ? (
          <>
            <rect
              x={32}
              y={32}
              width={w - 64}
              height={h - 64}
              rx={2}
              fill="none"
              stroke={theme.accent}
              opacity={0.45}
            />
            <path
              d={`M ${w / 2 - 60} ${h / 2 - 65} Q ${w / 2} ${h / 2 - 95} ${w / 2 + 60} ${h / 2 - 65}`}
              fill="none"
              stroke={theme.accent}
            />
            <text
              x={w / 2}
              y={h / 2}
              textAnchor="middle"
              fontFamily="Cormorant Garamond"
              fontSize={44}
              fill={theme.ink}
              textLength={(page.section?.length ?? 0) > 20 ? w - 120 : undefined}
              lengthAdjust="spacingAndGlyphs"
            >
              {page.section}
            </text>
            <text
              x={w / 2}
              y={h / 2 + 42}
              textAnchor="middle"
              fontFamily="Cormorant Garamond"
              fontSize={20}
              fill={theme.accent}
              textLength={
                (project.book.sectionSubheadings?.[page.section!]?.length ?? 0) > 45
                  ? w - 120
                  : undefined
              }
              lengthAdjust="spacingAndGlyphs"
            >
              {project.book.sectionSubheadings?.[page.section!]}
            </text>
          </>
        ) : (
          <>
            <text x={64} y={100} fontFamily="Cormorant Garamond" fontSize={34} fill={theme.ink}>
              Contents
            </text>
            {page.entries?.map((entry, i) => (
              <g
                key={i}
                fill={entry.section ? theme.accent : theme.ink}
                fontFamily="Cormorant Garamond"
                fontSize={17}
                fontWeight={entry.section ? 600 : 400}
              >
                <text x={entry.section ? 64 : 82} y={154 + i * 28}>
                  {entry.label}
                </text>
                <text x={w - 64} y={154 + i * 28} textAnchor="end">
                  {entry.page}
                </text>
              </g>
            ))}
            <text
              x={w / 2}
              y={h - 30}
              textAnchor="middle"
              fontFamily="Inter"
              fontSize={9}
              fill={theme.accent}
            >
              {index + 1}
            </text>
          </>
        )}
      </svg>
    )
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Book page ${index + 1} for ${p.given} ${p.surname}`}
    >
      <style>{fontCSS}</style>
      <rect width={w} height={h} fill={theme.paper} />
      <g
        opacity={theme.decoration === 'leaves' ? 0.65 : 1}
        transform={theme.decoration === 'leaves' ? `translate(${w} 0) scale(-.35 .35)` : undefined}
      >
        <Ornament
          theme={theme}
          scale={theme.decoration === 'stars' ? 0.3 : 1}
          width={theme.decoration === 'leaves' ? w / 0.35 : w}
          height={theme.decoration === 'leaves' ? h / 0.35 : h}
        />
      </g>
      <text
        x={w / 2}
        y="35"
        textAnchor="middle"
        fontFamily="Inter"
        fontSize="8"
        letterSpacing="2.5"
        fill={theme.accent}
      >
        {b.title}
      </text>
      <text
        x={headerX}
        y={nameY - 55}
        fill={theme.accent}
        fontFamily="Inter"
        fontSize="8"
        letterSpacing="2"
      >
        {page.continuation ? 'THE STORY CONTINUES' : 'A LIFE REMEMBERED'}
      </text>
      <text fontFamily={theme.font} fontSize={34} fill={theme.ink}>
        {page.nameLines.map((line, i) => (
          <tspan key={i} x={headerX} y={nameY + i * 38}>
            {line}
          </tspan>
        ))}
      </text>
      {page.photo && (
        <>
          <rect
            x={page.photo.x - 4}
            y={page.photo.y - 4}
            width={page.photo.width + 8}
            height={page.photo.height + 8}
            fill="none"
            stroke={theme.line}
            strokeWidth=".8"
          />
          <image href={p.photo} {...page.photo} preserveAspectRatio="xMidYMid slice" />
        </>
      )}
      {page.facts.map((fact, i) => (
        <g key={i}>
          <text
            x={m}
            y={fact.y}
            fontFamily="Inter"
            fontSize="9"
            fill={theme.accent}
            letterSpacing=".8"
          >
            {fact.label.toUpperCase()}
          </text>
          <text fill={theme.ink} fontFamily="Inter" fontSize="13">
            {fact.lines.map((line, j) => (
              <tspan key={j} x={m + 120} y={fact.y + j * 19}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      ))}
      {page.pictures?.map((picture, i) => (
        <BookPhotograph key={i} picture={picture} theme={theme} />
      ))}
      {page.lines.length > 0 && (
        <>
          <path
            d={`M ${m} ${page.storyTop - 36} H ${m + 42}`}
            stroke={theme.accent}
            strokeWidth="1"
          />
          <text className="book-story-print" fill={theme.ink} fontFamily={storyFont} fontSize={b.fontSize}>
            {page.lines.map((line, i) => (
              <tspan key={i} x={line.x ?? m} y={line.y}>
                {line.text}
              </tspan>
            ))}
          </text>
        </>
      )}
      <path d={`M ${m} ${h - 48} H ${w - m}`} stroke={theme.line} strokeWidth=".6" />
      <text x={m} y={h - 30} fontFamily="Inter" fontSize="8" fill={theme.accent}>
        {page.totalForPerson > 1 ? `${page.continuation + 1} / ${page.totalForPerson} · ` : ''}
        {p.surname.toUpperCase()}
      </text>
      <text
        x={w - m}
        y={h - 30}
        textAnchor="end"
        fontFamily="Inter"
        fontSize="9"
        fill={theme.accent}
      >
        {String(index + 1).padStart(2, '0')}
      </text>
    </svg>
  )
}
