// ─── Data types (matching JSON schema) ────────────────────────────────────────

export interface Skill {
  id: number
  name: string
  profession: string | null
  attribute: string | null
  campaign: 'Core' | 'Prophecies' | 'Factions' | 'Nightfall' | 'Eye of the North'
  elite: boolean
  pvpVariant: boolean
  pveOnly: boolean
  type: string
  energy: number | null
  adrenaline: number | null
  activation: number | null
  recharge: number | null
  sacrifice: number | null
  upkeep: number | null
  overcast: number | null
  description: string
  icon: string
}

export interface Profession {
  id: number
  abbrev: string
  name: string
  campaign: 'Core' | 'Factions' | 'Nightfall'
  primaryAttribute: string
  attributes: string[]
  color: string
  icon: string
}

export interface Attribute {
  id: number
  name: string
  profession: string
  isPrimary: boolean
}

// ─── Build state types ─────────────────────────────────────────────────────────

export interface AttributeAllocation {
  attributeId: number
  rank: number          // base, 0–12
  runeBonus: number     // 0–3
  headgearBonus: number // 0–1
}

export interface Build {
  primaryProfession: number | null
  secondaryProfession: number | null
  attributes: AttributeAllocation[]
  skills: (number | null)[]   // length 8
}

// ─── Project types ─────────────────────────────────────────────────────────────

// A "Bar" is one character's build — alias for Build
export type Bar = Build

export interface BuildProject {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  bars: Bar[]  // 1–8 bars
}

// ─── Codec types ───────────────────────────────────────────────────────────────

export interface DecodedBuild {
  primaryProfessionId: number
  secondaryProfessionId: number
  attributes: Array<{ id: number; rank: number }>
  skillIds: number[]  // exactly 8, 0 = empty
}

export type CodecErrorCode =
  | 'INVALID_BASE64'
  | 'WRONG_TYPE'
  | 'WRONG_VERSION'
  | 'DECODE_ERROR'

export interface CodecError {
  code: CodecErrorCode
  message: string
}

// ─── Validation types ──────────────────────────────────────────────────────────

export interface ValidationError {
  code: string
  message: string
}

export interface ValidationWarning {
  code: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}
