import type { DateFormat, NameFormat, Person, Display } from './types'
export function personName(p: Person, format: NameFormat = 'full') {
  const parts = p.given.trim().split(/\s+/)
  const given =
    format === 'short'
      ? parts[0]
      : format === 'initials'
        ? [parts[0], ...parts.slice(1).map((n) => n.charAt(0) + '.')].join(' ')
        : p.given
  return [given, p.surname, p.suffix].filter(Boolean).join(' ') || 'Unnamed person'
}
const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const longMonths = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const ordinal = (n: number) =>
  n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'))
export function formatDate(date: string, format: DateFormat): string {
  if (!date || format === 'original') return date
  const range = /^(BET|FROM) (.+) (AND|TO) (.+)$/i.exec(date)
  if (range)
    return `${range[1].toUpperCase() === 'BET' ? 'Between' : 'From'} ${formatDate(range[2], format)} ${range[3].toLowerCase()} ${formatDate(range[4], format)}`
  const qualified = /^(ABT|BEF|AFT|CAL|EST) (.+)$/i.exec(date)
  if (qualified)
    return `${{ ABT: 'c.', BEF: 'Before', AFT: 'After', CAL: 'Calculated', EST: 'Estimated' }[qualified[1].toUpperCase()]} ${formatDate(qualified[2], format)}`
  const m = /^(?:(\d{1,2}) )?(?:([A-Za-z]{3}) )?(\d{3,4})$/.exec(date.trim())
  if (!m) return date // Preserve calendars, interpreted dates, and free text verbatim.
  const day = m[1] ? Number(m[1]) : undefined,
    month = m[2] ? months.indexOf(m[2].toUpperCase()) : -1,
    year = m[3]
  if (format === 'year') return year
  if (month < 0) return date
  if (format === 'numeric')
    return [day?.toString().padStart(2, '0'), String(month + 1).padStart(2, '0'), year]
      .filter(Boolean)
      .join(' ')
  if (format === 'iso')
    return [year, String(month + 1).padStart(2, '0'), day?.toString().padStart(2, '0')]
      .filter(Boolean)
      .join('-')
  return [
    day === undefined ? '' : format === 'ordinal' ? ordinal(day) : day,
    longMonths[month],
    year,
  ]
    .filter((v) => v !== '')
    .join(' ')
}
export function personDetails(p: Person, d: Display): string[] {
  const rows: string[] = []
  if (d.birth && (p.birthDate || (d.places && p.birthPlace)))
    rows.push(
      `b. ${[formatDate(p.birthDate, d.dates), d.places && p.birthPlace].filter(Boolean).join(' · ')}`,
    )
  if (d.death && (p.deathDate || (d.places && p.deathPlace)))
    rows.push(
      `d. ${[formatDate(p.deathDate, d.dates), d.places && p.deathPlace].filter(Boolean).join(' · ')}`,
    )
  if (d.occupation && p.occupation) rows.push(p.occupation)
  if (d.burial && p.burialPlace) rows.push('Buried · ' + p.burialPlace)
  if (d.notes && p.notes) rows.push(p.notes)
  return rows
}
export function plainStory(text: string) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\w)\*([^*\n]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s?/gm, '')
}
