<template>
  <div class="gw-panel flex flex-col h-full">
    <div class="p-3 border-b border-gw-border">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-gw text-gw-gold text-sm uppercase tracking-wider">
          Skill Browser
          <span v-if="targetSlotIndex !== null" class="text-gw-text-muted font-sans normal-case text-xs ml-1">
            → Slot {{ targetSlotIndex + 1 }}
          </span>
        </h3>
        <span class="text-xs text-gw-text-muted">
          <template v-if="hasMore">{{ DISPLAY_LIMIT }} of {{ totalMatches }} — refine to see more</template>
          <template v-else>{{ totalMatches }} skill{{ totalMatches !== 1 ? 's' : '' }}</template>
        </span>
      </div>

      <SkillFilters
        v-model="filters"
        :available-attributes="availableAttributeNames"
        :available-types="availableTypes"
      />
    </div>

    <!-- Skill list -->
    <div
      ref="listEl"
      class="flex-1 overflow-y-auto p-2"
    >
      <div v-if="store.build.primaryProfession === null" class="text-gw-text-muted text-xs p-2">
        Select a profession to browse skills.
      </div>

      <div v-else-if="filteredSkills.length === 0" class="text-gw-text-muted text-xs p-2">
        No skills match the current filters.
      </div>

      <SkillCard
        v-for="skill in filteredSkills"
        :key="skill.id"
        :skill="skill"
        :is-in-bar="isSkillInBar(skill.id)"
        :is-disabled="isSkillDisabled(skill)"
        @select="handleSelect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Skill } from '@/types'
import { useBuildStore } from '@/stores/buildStore'
import { useSkillData } from '@/composables/useSkillData'
import SkillFilters from './SkillFilters.vue'
import SkillCard from './SkillCard.vue'
import type { SkillFilterState } from './SkillFilters.vue'

interface Props {
  targetSlotIndex: number | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'skill-selected': [skill: Skill, slotIndex: number]
}>()

const store = useBuildStore()
const { filterSkills } = useSkillData()

const listEl = ref<HTMLElement | null>(null)

const DISPLAY_LIMIT = 50

const filters = ref<SkillFilterState>({
  query: '',
  attribute: null,
  type: null,
  eliteOnly: false,
  hidePveOnly: false,
  campaign: null,
  pvpFilter: 'all',
})

const activeProfessionIds = computed(() => {
  const ids: number[] = []
  if (store.build.primaryProfession !== null) ids.push(store.build.primaryProfession)
  if (store.build.secondaryProfession !== null) ids.push(store.build.secondaryProfession)
  return ids
})

const availableAttributeNames = computed(() => {
  return store.availableAttributes.map(a => a.name)
})

// Derive type list from skills actually available to the current profession
const availableTypes = computed(() => {
  if (activeProfessionIds.value.length === 0) return []
  const base = filterSkills({ professions: activeProfessionIds.value, includePveOnly: true })
  return [...new Set(base.map(s => s.type).filter(Boolean))].sort()
})

const allMatchingSkills = computed(() => {
  if (activeProfessionIds.value.length === 0) return []

  const pvp = filters.value.pvpFilter
  // PvP mode and hidePveOnly both suppress pveOnly skills
  const includePveOnly = pvp !== 'pvp' && !filters.value.hidePveOnly

  const results = filterSkills({
    professions: activeProfessionIds.value,
    query: filters.value.query || undefined,
    attribute: filters.value.attribute,
    type: filters.value.type,
    eliteOnly: filters.value.eliteOnly,
    campaign: filters.value.campaign,
    includePveOnly,
  })

  if (pvp === 'pve') return results.filter(s => !s.pvpVariant)
  if (pvp === 'pvp') return results.filter(s => s.pvpVariant || !s.pveOnly)
  return results
})

const filteredSkills = computed(() => allMatchingSkills.value.slice(0, DISPLAY_LIMIT))

const totalMatches = computed(() => allMatchingSkills.value.length)
const hasMore = computed(() => totalMatches.value > DISPLAY_LIMIT)

function isSkillInBar(skillId: number): boolean {
  return store.build.skills.includes(skillId)
}

function isSkillDisabled(skill: Skill): boolean {
  if (!skill.elite) return false
  // Disable if there's already an elite in a *different* slot
  if (props.targetSlotIndex === null) return store.eliteCount >= 1
  const currentInSlotSkill = store.resolvedSkills[props.targetSlotIndex]
  if (currentInSlotSkill?.elite) return false // Replacing existing elite is fine
  return store.eliteCount >= 1
}

function handleSelect(skill: Skill) {
  const slot = props.targetSlotIndex ?? store.activeSlotIndex
  if (slot === null) return
  emit('skill-selected', skill, slot)
}
</script>
