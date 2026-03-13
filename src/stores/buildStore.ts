import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { Build, AttributeAllocation, Skill, Profession, Attribute } from '@/types'
import { useSkillData } from '@/composables/useSkillData'
import { useAttributeCalc } from '@/composables/useAttributeCalc'
import { useTemplateCodec } from '@/composables/useTemplateCodec'
import { useBuildValidation } from '@/composables/useBuildValidation'

function emptyBuild(): Build {
  return {
    primaryProfession: null,
    secondaryProfession: null,
    attributes: [],
    skills: [null, null, null, null, null, null, null, null],
  }
}

const STORAGE_KEY = 'gw1-build'

export const useBuildStore = defineStore('build', {
  state: () => ({
    build: emptyBuild() as Build,
    activeSlotIndex: null as number | null,
    isDirty: false,
  }),

  getters: {
    primary(state): Profession | null {
      if (state.build.primaryProfession === null) return null
      const { getProfessionById } = useSkillData()
      return getProfessionById(state.build.primaryProfession) ?? null
    },

    secondary(state): Profession | null {
      if (state.build.secondaryProfession === null) return null
      const { getProfessionById } = useSkillData()
      return getProfessionById(state.build.secondaryProfession) ?? null
    },

    availableAttributes(state): Attribute[] {
      const { getAttributesByProfession } = useSkillData()
      const primary = state.build.primaryProfession
        ? getAttributesByProfession(state.build.primaryProfession)
        : []
      const secondary = state.build.secondaryProfession
        ? getAttributesByProfession(state.build.secondaryProfession).filter(a => !a.isPrimary)
        : []
      return [...primary, ...secondary]
    },

    pointsUsed(state): number {
      const { totalPointsUsed } = useAttributeCalc()
      return totalPointsUsed(state.build.attributes)
    },

    remainingPoints(): number {
      return 200 - (this.pointsUsed as number)
    },

    resolvedSkills(state): (Skill | null)[] {
      const { getSkillById } = useSkillData()
      return state.build.skills.map(id => (id !== null ? (getSkillById(id) ?? null) : null))
    },

    hasElite(): boolean {
      return (this.resolvedSkills as (Skill | null)[]).some(s => s?.elite === true)
    },

    eliteCount(): number {
      return (this.resolvedSkills as (Skill | null)[]).filter(s => s?.elite === true).length
    },

    templateCode(state): string {
      const { encode } = useTemplateCodec()
      const attrs = state.build.attributes
        .filter(a => a.rank > 0)
        .map(a => ({ id: a.attributeId, rank: a.rank }))

      if (state.build.primaryProfession === null) return ''

      return encode({
        primaryProfessionId: state.build.primaryProfession,
        secondaryProfessionId: state.build.secondaryProfession ?? 0,
        attributes: attrs,
        skillIds: state.build.skills.map(id => id ?? 0),
      })
    },

    professionLabel(): string {
      const primary = this.primary as Profession | null
      const secondary = this.secondary as Profession | null
      if (!primary) return '—'
      return secondary ? `${primary.abbrev}/${secondary.abbrev}` : primary.abbrev
    },
  },

  actions: {
    setProfessions(primaryId: number, secondaryId: number | null) {
      const { getProfessionById, getSkillById } = useSkillData()
      const { validateProfessionChange } = useBuildValidation()

      const newPrimary = getProfessionById(primaryId)
      const newSecondary = secondaryId ? getProfessionById(secondaryId) : undefined

      // Find skills that must be removed
      const { skillsToRemove } = validateProfessionChange(
        newPrimary?.name,
        newSecondary?.name,
        this.build.skills,
        (id) => getSkillById(id),
      )

      // Remove invalid skills
      this.build.skills = this.build.skills.map(id =>
        id !== null && skillsToRemove.includes(id) ? null : id,
      )

      // Remove attributes that don't belong to new professions
      const primaryAttrs = newPrimary?.attributes ?? []
      const secondaryAttrs = newSecondary?.attributes.filter(
        name => name !== newSecondary?.primaryAttribute,
      ) ?? []
      const allowed = new Set([...primaryAttrs, ...secondaryAttrs])

      const { getAttributeById } = useSkillData()
      this.build.attributes = this.build.attributes.filter(a => {
        const attr = getAttributeById(a.attributeId)
        return attr && allowed.has(attr.name)
      })

      this.build.primaryProfession = primaryId
      this.build.secondaryProfession = secondaryId
      this.isDirty = true
    },

    setAttributeRank(attributeId: number, rank: number) {
      const { canIncrement, canDecrement, costForRank } = useAttributeCalc()
      const clampedRank = Math.max(0, Math.min(12, rank))

      const existing = this.build.attributes.find(a => a.attributeId === attributeId)
      const currentRank = existing?.rank ?? 0

      // Validate direction
      if (clampedRank > currentRank) {
        // Going up — check each step
        const tempAllocs = this.build.attributes.filter(a => a.attributeId !== attributeId)
        const otherPoints = tempAllocs.reduce((sum, a) => sum + costForRank(a.rank), 0)
        if (otherPoints + costForRank(clampedRank) > 200) return
        void canIncrement  // referenced above via manual check
      } else {
        void canDecrement
      }

      if (clampedRank === 0) {
        this.build.attributes = this.build.attributes.filter(a => a.attributeId !== attributeId)
      } else if (existing) {
        existing.rank = clampedRank
      } else {
        this.build.attributes.push({
          attributeId,
          rank: clampedRank,
          runeBonus: 0,
          headgearBonus: 0,
        })
      }
      this.isDirty = true
    },

    setAttributeBonus(attributeId: number, runeBonus: number, headgearBonus: number) {
      const alloc = this.build.attributes.find(a => a.attributeId === attributeId)
      if (alloc) {
        alloc.runeBonus = Math.max(0, Math.min(3, runeBonus))
        alloc.headgearBonus = Math.max(0, Math.min(1, headgearBonus))
        this.isDirty = true
      }
    },

    setSkill(slotIndex: number, skillId: number | null) {
      if (slotIndex < 0 || slotIndex > 7) return
      const { getSkillById } = useSkillData()
      const { validateEliteLimit } = useBuildValidation()

      if (skillId !== null) {
        const skill = getSkillById(skillId)
        if (!skill) return

        // Elite check
        if (skill.elite) {
          const resolvedCurrent = this.build.skills.map(id =>
            id !== null ? (getSkillById(id) ?? null) : null,
          )
          const result = validateEliteLimit(skill, resolvedCurrent, slotIndex)
          if (!result.valid) return
        }
      }

      this.build.skills[slotIndex] = skillId
      this.isDirty = true
    },

    moveSkill(fromIndex: number, toIndex: number) {
      if (fromIndex === toIndex) return
      const temp = this.build.skills[fromIndex]
      this.build.skills[fromIndex] = this.build.skills[toIndex]
      this.build.skills[toIndex] = temp
      this.isDirty = true
    },

    removeSkill(slotIndex: number) {
      this.build.skills[slotIndex] = null
      this.isDirty = true
    },

    setActiveSlot(index: number | null) {
      this.activeSlotIndex = index
    },

    loadBuild(build: Build) {
      this.build = build
      this.isDirty = false
    },

    resetBuild() {
      this.build = emptyBuild()
      this.activeSlotIndex = null
      this.isDirty = false
    },

    saveToLocalStorage() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.build))
        this.isDirty = false
      } catch {
        // localStorage unavailable
      }
    },

    loadFromLocalStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as Build
        // Basic shape validation
        if (Array.isArray(parsed.skills) && parsed.skills.length === 8) {
          this.build = parsed
        }
      } catch {
        // Corrupted data — ignore
      }
    },

    loadFromDecodedBuild(decoded: {
      primaryProfessionId: number
      secondaryProfessionId: number
      attributes: Array<{ id: number; rank: number }>
      skillIds: number[]
    }) {
      const attrs: AttributeAllocation[] = decoded.attributes
        .filter(a => a.rank > 0)
        .map(a => ({ attributeId: a.id, rank: a.rank, runeBonus: 0, headgearBonus: 0 }))

      this.build = {
        primaryProfession: decoded.primaryProfessionId || null,
        secondaryProfession: decoded.secondaryProfessionId || null,
        attributes: attrs,
        skills: decoded.skillIds.map(id => id || null) as (number | null)[],
      }
      this.isDirty = false
    },

    // Auto-save watcher (call from a component or app setup)
    autosave() {
      if (this.isDirty) this.saveToLocalStorage()
    },
  },
})

// Computed helper for template code — exported for use in TemplateCode component
export function useBuildTemplateCode() {
  const store = useBuildStore()
  return computed(() => store.templateCode)
}
