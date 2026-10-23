export function parseViewHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const [x, y, z] = ['x', 'y', 'z'].map((key) => (params.has(key) ? Number(params.get(key)) : NaN))
  const view = [x, y, z].every(Number.isFinite) ? { x, y, z } : null
  return { view, locationId: params.get('loc') || null }
}

export function formatViewHash({ x, y, z }, locationId = null) {
  const params = new URLSearchParams({ x: String(Math.round(x)), y: String(Math.round(y)), z: z.toFixed(2) })
  if (locationId != null) params.set('loc', String(locationId))
  return `#${params}`
}
