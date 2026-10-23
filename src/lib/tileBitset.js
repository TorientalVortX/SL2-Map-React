export function encodeBitset(bits) {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8))
  bits.forEach((bit, i) => {
    if (bit) bytes[i >> 3] |= 1 << (i & 7)
  })
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

export function decodeBitset(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return (i) => i >= 0 && (bytes[i >> 3] & (1 << (i & 7))) !== 0
}

export function createBlankLookup(levels) {
  const lookups = new Map(
    Object.entries(levels).map(([z, level]) => [Number(z), { cols: level.cols, rows: level.rows, has: decodeBitset(level.blank) }])
  )
  return ({ x, y, z }) => {
    const level = lookups.get(z)
    if (!level || x < 0 || y < 0 || x >= level.cols || y >= level.rows) return true
    return level.has(y * level.cols + x)
  }
}
