<template>
  <div
    ref="slotEl"
    class="skill-slot select-none"
    :class="{
      'elite': skill?.elite,
      'empty': !skill,
      'ring-2 ring-gw-gold': isSelected,
      'opacity-60': isDragOver,
    }"
    draggable="true"
    @click="emit('click', index)"
    @contextmenu.prevent="skill && emit('remove', index)"
    @dragstart="emit('dragstart', index)"
    @dragover.prevent="emit('dragover', index)"
    @drop.prevent="emit('drop', index)"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <!-- Filled slot -->
    <template v-if="skill">
      <img
        :src="`/icons/${skill.icon}`"
        :alt="skill.name"
        class="w-full h-full object-cover"
        draggable="false"
        @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
      />
      <!-- Elite indicator -->
      <div
        v-if="skill.elite"
        class="absolute inset-0 border-2 border-gw-elite rounded pointer-events-none"
      />
      <!-- Slot number badge -->
      <div class="absolute top-0 left-0 w-4 h-4 bg-black/50 text-gw-text-muted text-[10px] flex items-center justify-center rounded-br">
        {{ index + 1 }}
      </div>
    </template>

    <!-- Empty slot -->
    <template v-else>
      <span class="text-gw-text-muted text-xs font-gw">{{ index + 1 }}</span>
    </template>

    <!-- Tooltip -->
    <SkillTooltip
      v-if="showTooltip && skill"
      :skill="skill"
      :anchor-el="slotEl"
      :attribute-rank="attributeRank"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Skill } from '@/types'
import SkillTooltip from './SkillTooltip.vue'

interface Props {
  skill: Skill | null
  index: number
  isSelected?: boolean
  isDragOver?: boolean
  attributeRank?: number
}

defineProps<Props>()

const emit = defineEmits<{
  click: [index: number]
  remove: [index: number]
  dragstart: [index: number]
  dragover: [index: number]
  drop: [index: number]
}>()

const slotEl = ref<HTMLElement | null>(null)
const showTooltip = ref(false)
</script>
