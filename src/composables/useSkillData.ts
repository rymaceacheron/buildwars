import { shallowRef, readonly } from 'vue'
import type { Skill, Profession, Attribute } from '@/types'

// Module-level singleton cache — loaded once, shared across all components
const skills = shallowRef<Skill[]>([])
const professions = shallowRef<Profession[]>([])
const attributes = shallowRef<Attribute[]>([])
let skillIndex: Map<number, Skill> | null = null
let initialized = false
let initPromise: Promise<void> | null = null

async function init(): Promise<void> {
  if (initialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    const [skillsData, professionsData, attributesData] = await Promise.all([
      import('@/assets/data/skills.json').catch(() => ({ default: [] })),
      import('@/assets/data/professions.json'),
      import('@/assets/data/attributes.json'),
    ])

    skills.value = skillsData.default as Skill[]
    professions.value = professionsData.default as Profession[]
    attributes.value = attributesData.default as Attribute[]

    skillIndex = new Map(skills.value.map(s => [s.id, s]))
    initialized = true
  })()

  return initPromise
}

export function useSkillData() {
  function getSkillById(id: number): Skill | undefined {
    return skillIndex?.get(id)
  }

  function getSkillsByProfession(profId: number): Skill[] {
    const prof = professions.value.find(p => p.id === profId)
    if (!prof) return []
    return skills.value.filter(s => s.profession === prof.name)
  }

  function getProfessionById(id: number): Profession | undefined {
    return professions.value.find(p => p.id === id)
  }

  function getProfessionByAbbrev(abbrev: string): Profession | undefined {
    return professions.value.find(p => p.abbrev === abbrev)
  }

  function getAttributeById(id: number): Attribute | undefined {
    return attributes.value.find(a => a.id === id)
  }

  function getAttributesByProfession(profId: number): Attribute[] {
    const prof = professions.value.find(p => p.id === profId)
    if (!prof) return []
    return attributes.value.filter(a => prof.attributes.includes(a.name))
  }

  function filterSkills(options: {
    professions: number[]
    query?: string
    attribute?: string | null
    type?: string | null
    eliteOnly?: boolean
    campaign?: string | null
    includePveOnly?: boolean
  }): Skill[] {
    const profNames = options.professions
      .map(id => getProfessionById(id)?.name)
      .filter(Boolean) as string[]

    return skills.value.filter(skill => {
      // Profession filter: must belong to one of the selected professions, or be common
      if (skill.profession !== null && !profNames.includes(skill.profession)) return false

      // PvE-only filter
      if (skill.pveOnly && !options.includePveOnly) return false

      // PvP variant filter — exclude duplicate PvP versions by default
      if (skill.pvpVariant) return false

      // Attribute filter
      if (options.attribute && skill.attribute !== options.attribute) return false

      // Type filter
      if (options.type && skill.type !== options.type) return false

      // Elite filter
      if (options.eliteOnly && !skill.elite) return false

      // Campaign filter
      if (options.campaign && skill.campaign !== options.campaign) return false

      // Name search
      if (options.query) {
        const q = options.query.toLowerCase()
        if (!skill.name.toLowerCase().includes(q)) return false
      }

      return true
    })
  }

  function getSkillIndex(): Map<number, Skill> {
    return skillIndex ?? new Map()
  }

  return {
    skills: readonly(skills),
    professions: readonly(professions),
    attributes: readonly(attributes),
    init,
    getSkillById,
    getSkillsByProfession,
    getProfessionById,
    getProfessionByAbbrev,
    getAttributeById,
    getAttributesByProfession,
    filterSkills,
    getSkillIndex,
  }
}
