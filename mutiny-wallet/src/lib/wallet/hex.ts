export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim()

  if (normalized.length % 2 !== 0) {
    throw new Error("Hex string must have an even length")
  }

  const bytes = new Uint8Array(normalized.length / 2)

  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16)
  }

  return bytes
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  )
}
