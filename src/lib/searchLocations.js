function rankLocation(location, query) {
  const name = location.name.toLowerCase()
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.includes(query)) return 2
  if (location.type.toLowerCase() === query) return 3
  if ((location.description || '').toLowerCase().includes(query)) return 4
  return -1
}

export function searchLocations(locations, rawQuery, limit = 8) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return []
  return locations
    .map((location) => ({ location, rank: rankLocation(location, query) }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.location.name.localeCompare(b.location.name))
    .slice(0, limit)
    .map(({ location }) => location)
}
