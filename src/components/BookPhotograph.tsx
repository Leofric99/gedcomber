import type { BookPicture } from '../lib/bookPhoto'
import type { Theme } from '../lib/types'

// A photograph is a figure in the page grid, not a decorated card.
export function BookPhotograph({ picture, theme }: { picture: BookPicture; theme: Theme }) {
  const { frame, ruleY, captionLines, number } = picture
  return (
    <g data-photo-treatment={theme.id}>
      <image
        href={picture.src}
        x={picture.x}
        y={picture.y}
        width={picture.width}
        height={picture.height}
        preserveAspectRatio="xMidYMid meet"
      />
      {captionLines.length > 0 && (
        <>
          <path
            d={`M ${frame.x} ${ruleY} H ${frame.x + frame.width}`}
            stroke={theme.line}
            strokeWidth={theme.id === 'modern' ? 1 : 0.5}
          />
          <text
            x={frame.x}
            y={ruleY + 14}
            fontFamily="Inter"
            fontSize={8}
            letterSpacing={1}
            fill={theme.accent}
          >
            {String(number).padStart(2, '0')}
          </text>
          {captionLines.map((line, i) => (
            <text
              key={i}
              x={frame.x + 28}
              y={ruleY + 14 + i * 15}
              fontFamily="Inter"
              fontSize={11}
              fill={theme.ink}
              opacity={0.8}
            >
              {line}
            </text>
          ))}
        </>
      )}
    </g>
  )
}
