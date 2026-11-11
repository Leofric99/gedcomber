export type GedNode = { tag: string; value: string; xref?: string; children: GedNode[] }
export type Person = {
  id: string
  given: string
  surname: string
  suffix: string
  sex: string
  birthDate: string
  birthPlace: string
  deathDate: string
  deathPlace: string
  burialPlace: string
  occupation: string
  notes: string
  story: string
  photo?: string
  photoOriginal?: string
  photoCrop?: { zoom: number; x: number; y: number }
}
export type Family = { id: string; parents: string[]; children: string[] }
export type Dataset = {
  records: GedNode[]
  people: Record<string, Person>
  families: Family[]
  filename: string
}
export type NameFormat = 'full' | 'short' | 'initials'
export type DateFormat = 'long' | 'ordinal' | 'numeric' | 'iso' | 'year' | 'original'
export type Display = {
  names: NameFormat
  dates: DateFormat
  photos: boolean
  birth: boolean
  death: boolean
  places: boolean
  occupation: boolean
  notes: boolean
  burial: boolean
}
export type ThemeId = 'botanical' | 'heritage' | 'modern' | 'midnight'
export type Theme = {
  id: ThemeId
  label: string
  description: string
  paper: string
  ink: string
  accent: string
  line: string
  card: string
  font: string
  decoration: 'leaves' | 'frame' | 'minimal' | 'stars'
}
export type Expansion = {
  parents?: boolean
  siblings?: boolean
  partners?: boolean
  children?: boolean
}
export type BookSettings = {
  ids: string[]
  size: 'a4' | 'a5' | 'letter'
  landscape: boolean
  display: Display
  story: boolean
  photoPosition: 'top' | 'left' | 'right'
  title: string
  fontSize: number
}
export type Project = {
  version: 1
  dataset: Dataset
  primary: string
  expanded: Record<string, Expansion>
  display: Display
  theme: ThemeId
  personBoxes?: boolean
  decorationSize?: number
  colors: Partial<Pick<Theme, 'paper' | 'ink' | 'accent'>>
  title: string
  subtitle: string
  book: BookSettings
  viewport: { x: number; y: number; zoom: number }
}
export const defaultDisplay: Display = {
  names: 'full',
  dates: 'long',
  photos: true,
  birth: true,
  death: true,
  places: true,
  occupation: false,
  notes: false,
  burial: false,
}
export function newProject(dataset: Dataset, primary: string): Project {
  return {
    version: 1,
    dataset,
    primary,
    expanded: {},
    display: { ...defaultDisplay },
    theme: 'botanical',
    personBoxes: true,
    decorationSize: 1,
    colors: {},
    title: 'Our family tree',
    subtitle: 'Every branch has a story',
    book: {
      ids: [],
      size: 'a4',
      landscape: false,
      display: { ...defaultDisplay, occupation: true, burial: true },
      story: true,
      photoPosition: 'right',
      title: 'A family anthology',
      fontSize: 16,
    },
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}
