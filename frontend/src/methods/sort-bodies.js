// Returns a sorted copy of the bodies list: the primary body (if given and present) first,
// then the rest alphabetically by name. Never mutates the input, so it's safe to use on
// store data such as loginUser.bodies.
export default function sortBodies (bodies, primaryBodyId = null) {
  return [...(bodies || [])].sort((a, b) => {
    if (primaryBodyId !== null && primaryBodyId !== undefined) {
      if (a.id === primaryBodyId) return -1
      if (b.id === primaryBodyId) return 1
    }

    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  })
}
