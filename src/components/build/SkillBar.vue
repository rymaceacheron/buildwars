<template>
  <div class="gw-panel p-4">
    <h3 class="font-gw text-gw-gold text-sm mb-3 uppercase tracking-wider">Skill Bar</h3>

    <!-- Elite warning -->
    <div
      v-if="store.eliteCount > 1"
      class="text-xs text-red-400 mb-2"
    >
      Too many elite skills equipped.
    </div>

    <div class="flex gap-2 flex-wrap">
      <SkillSlot
        v-for="(skill, i) in store.resolvedSkills"
        :key="i"
        :skill="skill"
        :index="i"
        :is-selected="store.activeSlotIndex === i"
        :is-drag-over="dragOverIndex === i"
        :attribute-rank="getAttributeRank(skill)"
        @click="handleSlotClick"
        @remove="store.removeSkill"
        @dragstart="onDragStart"
        @dragover="onDragOver"
        @drop="onDrop"
      />
    </div>

    <p class="text-xs text-gw-text-muted mt-3">
      Click a slot to pick a skill &nbsp;·&nbsp; Right-click to remove &nbsp;·&nbsp; Drag to reorder
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Skill } from '@/types'
import { useBuildStore } from '@/stores/buildStore'
import SkillSlot from './SkillSlot.vue'

const store = useBuildStore()

const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function handleSlotClick(index: number) {
  store.setActiveSlot(store.activeSlotIndex === index ? null : index)
  emit('slot-clicked', index)
}

function getAttributeRank(skill: Skill | null): number | undefined {
  if (!skill?.attribute) return undefined
  const attr = store.availableAttributes.find(a => a.name === skill.attribute)
  if (!attr) return undefined
  const alloc = store.build.attributes.find(a => a.attributeId === attr.id)
  return alloc?.rank
}

function onDragStart(index: number) {
  dragFromIndex.value = index
}

function onDragOver(index: number) {
  dragOverIndex.value = index
}

function onDrop(index: number) {
  if (dragFromIndex.value !== null && dragFromIndex.value !== index) {
    store.moveSkill(dragFromIndex.value, index)
  }
  dragFromIndex.value = null
  dragOverIndex.value = null
}

const emit = defineEmits<{
  'slot-clicked': [index: number]
}>()
</script>
