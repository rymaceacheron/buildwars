import type { Skill, Attribute, AttributeAllocation, ValidationResult } from '@/types'
import { useAttributeCalc } from './useAttributeCalc'

const { MAX_POINTS, costForRank } = useAttributeCalc()

export function useBuildValidation() {
  function ok(): ValidationResult {
    return { valid: true, errors: [], warnings: [] }
  }

  function fail(code: string, message: string): ValidationResult {
    return { valid: false, errors: [{ code, message }], warnings: [] }
  }

  /** Validate adding a skill to the bar */
  function validateSkillAddition(
    skill: Skill,
    _slotIndex: number,
    currentSkills: (number | null)[],
    primaryProfId: number | null,
    secondaryProfId: number | null,
    getProfName: (id: number) => string | undefined,
  ): ValidationResult {
    // Check profession restriction
    if (skill.profession !== null) {
      const allowed = [
        getProfName(primaryProfId ?? -1),
        getProfName(secondaryProfId ?? -1),
      ].filter(Boolean)
      if (!allowed.includes(skill.profession)) {
        return fail('WRONG_PROFESSION', `${skill.name} requires ${skill.profession}, which is not one of your current professions.`)
      }
    }

    // Check elite limit
    if (skill.elite) {
      const existingEliteCount = currentSkills.filter(id => {
        // We can't check this without the skill index here, so callers must validate
        return id !== null && id === skill.id
      }).length
      // A simpler check: the caller passes the current elite count
      void existingEliteCount
    }

    return ok()
  }

  /** Validate elite rule given current resolved skills */
  function validateEliteLimit(
    newSkill: Skill,
    currentSkills: (Skill | null)[],
    targetSlotIndex: number,
  ): ValidationResult {
    if (!newSkill.elite) return ok()

    const existingEliteIndex = currentSkills.findIndex(
      (s, i) => s !== null && s.elite && i !== targetSlotIndex,
    )
    if (existingEliteIndex !== -1) {
      return fail('DUPLICATE_ELITE', 'You can only equip one elite skill. Remove the existing elite first.')
    }
    return ok()
  }

  /** Validate attribute point allocations */
  function validateAttributeAllocation(
    allocations: AttributeAllocation[],
    availableAttributes: Attribute[],
  ): ValidationResult {
    const availableIds = new Set(availableAttributes.map(a => a.id))
    const errors = []
    const warnings = []

    let totalUsed = 0
    for (const alloc of allocations) {
      if (!availableIds.has(alloc.attributeId)) {
        errors.push({ code: 'UNAVAILABLE_ATTRIBUTE', message: `Attribute ID ${alloc.attributeId} is not available for current professions.` })
      }
      if (alloc.rank < 0 || alloc.rank > 12) {
        errors.push({ code: 'INVALID_RANK', message: `Attribute rank must be 0–12, got ${alloc.rank}.` })
      }
      totalUsed += costForRank(alloc.rank)
    }

    if (totalUsed > MAX_POINTS) {
      errors.push({ code: 'OVER_BUDGET', message: `Total attribute points used (${totalUsed}) exceeds the maximum of ${MAX_POINTS}.` })
    }

    if (totalUsed === MAX_POINTS) {
      warnings.push({ code: 'BUDGET_FULL', message: 'All 200 attribute points are allocated.' })
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /** Determine which skills must be removed when professions change */
  function validateProfessionChange(
    newPrimaryName: string | undefined,
    newSecondaryName: string | undefined,
    currentSkills: (number | null)[],
    getSkill: (id: number) => Skill | undefined,
  ): { skillsToRemove: number[] } {
    const allowed = new Set([newPrimaryName, newSecondaryName, undefined, null].filter(Boolean) as string[])

    const skillsToRemove: number[] = []
    for (const id of currentSkills) {
      if (id === null) continue
      const skill = getSkill(id)
      if (!skill) continue
      if (skill.profession !== null && !allowed.has(skill.profession)) {
        skillsToRemove.push(id)
      }
    }
    return { skillsToRemove }
  }

  return {
    validateSkillAddition,
    validateEliteLimit,
    validateAttributeAllocation,
    validateProfessionChange,
  }
}
