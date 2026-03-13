<template>
  <div
    ref="cardEl"
    class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors border border-transparent"
    :class="{
      'opacity-50 cursor-not-allowed': isDisabled,
      'opacity-70': isInBar,
      'hover:bg-gw-panel-light hover:border-gw-border': !isDisabled,
      'bg-gw-panel-light border-gw-border': isInBar,
    }"
    @click="!isDisabled && emit('select', skill)"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <!-- Icon -->
    <div class="w-8 h-8 flex-shrink-0 bg-gw-dark border rounded overflow-hidden"
         :class="skill.elite ? 'border-gw-elite' : 'border-gw-border'">
      <img
        :src="`/icons/${skill.icon}`"
        :alt="skill.name"
        class="w-full h-full object-cover"
        draggable="false"
        @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
      />
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-gw-text truncate">{{ skill.name }}</span>
        <span
          v-if="skill.elite"
          class="text-[10px] text-gw-elite border border-gw-elite px-0.5 rounded flex-shrink-0"
        >E</span>
        <span
          v-if="isInBar"
          class="text-[10px] text-gw-text-muted flex-shrink-0"
        >[in bar]</span>
      </div>
      <div class="flex gap-2 text-[10px] text-gw-text-muted">
        <span v-if="skill.attribute">{{ skill.attribute }}</span>
        <span v-if="skill.energy !== null">{{ skill.energy }}e</span>
        <span v-if="skill.activation !== null">{{ skill.activation }}s cast</span>
        <span v-if="skill.recharge !== null">{{ skill.recharge }}s recharge</span>
      </div>
    </div>

    <SkillTooltip
      v-if="showTooltip"
      :skill="skill"
      :anchor-el="cardEl"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Skill } from '@/types'
import SkillTooltip from '@/components/build/SkillTooltip.vue'

interface Props {
  skill: Skill
  isInBar?: boolean
  isDisabled?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  select: [skill: Skill]
}>()

const cardEl = ref<HTMLElement | null>(null)
const showTooltip = ref(false)
</script>
