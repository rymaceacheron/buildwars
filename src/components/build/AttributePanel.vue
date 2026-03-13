<template>
  <div class="gw-panel p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-gw text-gw-gold text-sm uppercase tracking-wider">Attributes</h3>
      <span class="text-xs" :class="remainingPoints === 0 ? 'text-gw-gold' : 'text-gw-text-muted'">
        {{ store.pointsUsed }} / 200 pts
      </span>
    </div>

    <div v-if="store.availableAttributes.length === 0" class="text-gw-text-muted text-xs">
      Select a profession to allocate attributes.
    </div>

    <div v-else class="space-y-2">
      <!-- Group by profession -->
      <template v-for="group in attributeGroups" :key="group.profName">
        <div class="text-xs text-gw-text-muted uppercase tracking-wide mt-3 mb-1 first:mt-0">
          {{ group.profName }}
        </div>
        <div
          v-for="attr in group.attributes"
          :key="attr.id"
          class="flex items-center gap-2"
        >
          <!-- Attribute name -->
          <div class="flex-1 min-w-0">
            <span
              class="text-xs truncate"
              :class="attr.isPrimary ? 'text-gw-gold' : 'text-gw-text'"
            >
              {{ attr.name }}
              <span v-if="attr.isPrimary" class="text-gw-text-muted">(primary)</span>
            </span>
          </div>

          <!-- Controls -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              class="w-5 h-5 flex items-center justify-center rounded border text-xs
                     border-gw-border text-gw-text-muted
                     hover:border-gw-gold hover:text-gw-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              :disabled="!calc.canDecrement(attr.id, store.build.attributes)"
              @click="adjustRank(attr.id, -1)"
            >
              −
            </button>

            <span class="w-8 text-center text-sm font-gw text-gw-text">
              {{ getRank(attr.id) }}
            </span>

            <button
              class="w-5 h-5 flex items-center justify-center rounded border text-xs
                     border-gw-border text-gw-text-muted
                     hover:border-gw-gold hover:text-gw-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              :disabled="!calc.canIncrement(attr.id, store.build.attributes)"
              @click="adjustRank(attr.id, 1)"
            >
              +
            </button>

            <!-- Effective rank (with bonuses) -->
            <span
              v-if="getEffectiveRank(attr.id) > getRank(attr.id)"
              class="text-xs text-gw-gold ml-1"
              title="Effective rank with rune/headgear bonuses"
            >
              ({{ getEffectiveRank(attr.id) }})
            </span>
          </div>
        </div>
      </template>
    </div>

    <!-- Points remaining bar -->
    <div class="mt-4 pt-3 border-t border-gw-border">
      <div class="flex justify-between text-xs text-gw-text-muted mb-1">
        <span>Points remaining</span>
        <span :class="remainingPoints === 0 ? 'text-gw-gold' : ''">{{ remainingPoints }}</span>
      </div>
      <div class="h-1 bg-gw-dark rounded overflow-hidden">
        <div
          class="h-full bg-gw-gold rounded transition-all"
          :style="{ width: `${(store.pointsUsed / 200) * 100}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBuildStore } from '@/stores/buildStore'
import { useAttributeCalc } from '@/composables/useAttributeCalc'
import type { Attribute } from '@/types'

const store = useBuildStore()
const calc = useAttributeCalc()

const remainingPoints = computed(() => store.remainingPoints)

interface AttributeGroup {
  profName: string
  attributes: Attribute[]
}

const attributeGroups = computed<AttributeGroup[]>(() => {
  const groups = new Map<string, Attribute[]>()
  for (const attr of store.availableAttributes) {
    if (!groups.has(attr.profession)) groups.set(attr.profession, [])
    groups.get(attr.profession)!.push(attr)
  }
  return Array.from(groups.entries()).map(([profName, attributes]) => ({
    profName,
    attributes,
  }))
})

function getRank(attributeId: number): number {
  return store.build.attributes.find(a => a.attributeId === attributeId)?.rank ?? 0
}

function getEffectiveRank(attributeId: number): number {
  const alloc = store.build.attributes.find(a => a.attributeId === attributeId)
  if (!alloc) return 0
  return calc.effectiveRank(alloc)
}

function adjustRank(attributeId: number, delta: number) {
  const current = getRank(attributeId)
  store.setAttributeRank(attributeId, current + delta)
}
</script>
