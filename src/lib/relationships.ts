import type { GedNode } from './types'

export function relationshipEnded(record: GedNode | undefined): boolean {
  return !!record?.children.some((event) => {
    if (['DIV', 'ANUL', '_SEPR', '_SEPARATION', '_DIV'].includes(event.tag))
      return event.value.trim().toUpperCase() !== 'N'
    const type = event.children.find((node) => node.tag === 'TYPE')?.value ?? ''
    return (
      ['EVEN', '_STAT', '_STATUS'].includes(event.tag) &&
      /^(divorc(?:e|ed)|separat(?:ion|ed)|annul(?:ment|led)|dissolved|dissolution)$/i.test(
        type.trim() || event.value.trim(),
      )
    )
  })
}
