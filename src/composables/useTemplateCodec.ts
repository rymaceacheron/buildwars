import type { DecodedBuild, CodecError } from '@/types'

// Standard Base64 alphabet (NOT URL-safe)
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function charToVal(char: string): number {
  return BASE64_CHARS.indexOf(char)
}

/** Push `width` bits of `value` (LSB first) onto the bit array */
function pushBits(bits: number[], value: number, width: number): void {
  for (let i = 0; i < width; i++) {
    bits.push((value >> i) & 1)
  }
}

/** Read `width` bits (LSB first) from `bits` starting at `pos` */
function readBits(bits: number[], pos: { v: number }, width: number): number {
  let val = 0
  for (let i = 0; i < width; i++) {
    val |= (bits[pos.v] ?? 0) << i
    pos.v++
  }
  return val
}

function profBitWidth(maxProfId: number): { code: number; width: number } {
  for (let code = 0; code <= 3; code++) {
    const width = code * 2 + 4
    if ((1 << width) > maxProfId) return { code, width }
  }
  return { code: 3, width: 10 }
}

function attrIdBitWidth(maxAttrId: number): { code: number; width: number } {
  for (let code = 0; code <= 15; code++) {
    const width = code + 4
    if ((1 << width) > maxAttrId) return { code, width }
  }
  return { code: 15, width: 19 }
}

function skillIdBitWidth(maxSkillId: number): { code: number; width: number } {
  for (let code = 0; code <= 15; code++) {
    const width = code + 8
    if ((1 << width) > maxSkillId) return { code, width }
  }
  return { code: 15, width: 23 }
}

export function useTemplateCodec() {
  function encode(build: DecodedBuild): string {
    const bits: number[] = []

    const maxProfId = Math.max(build.primaryProfessionId, build.secondaryProfessionId, 1)
    const maxAttrId = build.attributes.length > 0
      ? Math.max(...build.attributes.map(a => a.id))
      : 0
    const maxSkillId = Math.max(...build.skillIds.filter(id => id > 0), 1)

    const { code: pCode, width: pWidth } = profBitWidth(maxProfId)
    const { code: aCode, width: aWidth } = attrIdBitWidth(maxAttrId)
    const { code: sCode, width: sWidth } = skillIdBitWidth(maxSkillId)

    // Header
    pushBits(bits, 14, 4)  // type = 14
    pushBits(bits, 0, 4)   // version = 0

    // Professions
    pushBits(bits, pCode, 2)
    pushBits(bits, build.primaryProfessionId, pWidth)
    pushBits(bits, build.secondaryProfessionId, pWidth)

    // Attributes
    pushBits(bits, build.attributes.length, 4)
    pushBits(bits, aCode, 4)
    for (const attr of build.attributes) {
      pushBits(bits, attr.id, aWidth)
      pushBits(bits, attr.rank, 4)
    }

    // Skills
    pushBits(bits, sCode, 4)
    for (const skillId of build.skillIds) {
      pushBits(bits, skillId ?? 0, sWidth)
    }

    // Pad to 6-bit boundary
    while (bits.length % 6 !== 0) bits.push(0)

    // Convert 6-bit groups to Base64 chars
    let result = ''
    for (let i = 0; i < bits.length; i += 6) {
      let val = 0
      for (let j = 0; j < 6; j++) val |= (bits[i + j] ?? 0) << j
      result += BASE64_CHARS[val]
    }
    return result
  }

  function decode(templateCode: string): { data: DecodedBuild } | { error: CodecError } {
    // Validate characters
    if (!/^[A-Za-z0-9+/]+$/.test(templateCode)) {
      return { error: { code: 'INVALID_BASE64', message: 'Template code contains invalid characters.' } }
    }

    // Expand each Base64 char to 6 bits (LSB first)
    const bits: number[] = []
    for (const char of templateCode) {
      const val = charToVal(char)
      for (let i = 0; i < 6; i++) bits.push((val >> i) & 1)
    }

    const pos = { v: 0 }

    try {
      const type = readBits(bits, pos, 4)
      if (type !== 14) {
        return { error: { code: 'WRONG_TYPE', message: `Expected type 14, got ${type}. Not a skill template.` } }
      }

      const version = readBits(bits, pos, 4)
      if (version !== 0) {
        return { error: { code: 'WRONG_VERSION', message: `Unsupported template version: ${version}.` } }
      }

      // Professions
      const pCode = readBits(bits, pos, 2)
      const pWidth = pCode * 2 + 4
      const primaryProfessionId = readBits(bits, pos, pWidth)
      const secondaryProfessionId = readBits(bits, pos, pWidth)

      // Attributes
      const numAttrs = readBits(bits, pos, 4)
      const aCode = readBits(bits, pos, 4)
      const aWidth = aCode + 4
      const attributes: Array<{ id: number; rank: number }> = []
      for (let i = 0; i < numAttrs; i++) {
        const id = readBits(bits, pos, aWidth)
        const rank = readBits(bits, pos, 4)
        attributes.push({ id, rank })
      }

      // Skills
      const sCode = readBits(bits, pos, 4)
      const sWidth = sCode + 8
      const skillIds: number[] = []
      for (let i = 0; i < 8; i++) {
        skillIds.push(readBits(bits, pos, sWidth))
      }

      return {
        data: { primaryProfessionId, secondaryProfessionId, attributes, skillIds },
      }
    } catch {
      return { error: { code: 'DECODE_ERROR', message: 'Failed to decode template code. It may be truncated or corrupted.' } }
    }
  }

  function isValidCode(code: string): boolean {
    if (!/^[A-Za-z0-9+/]+$/.test(code)) return false
    const result = decode(code)
    return 'data' in result
  }

  return { encode, decode, isValidCode }
}
