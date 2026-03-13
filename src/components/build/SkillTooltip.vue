<template>
  <Teleport to="body">
    <div
      v-if="skill"
      ref="tooltipEl"
      class="fixed z-50 pointer-events-none w-72"
      :style="(positionStyle as object)"
    >
      <div class="gw-panel p-3 text-sm">
        <!-- Header -->
        <div class="flex items-start gap-2 mb-2">
          <div class="w-10 h-10 flex-shrink-0 bg-gw-dark border border-gw-border rounded overflow-hidden">
            <img
              v-if="skill.icon"
              :src="`/icons/${skill.icon}`"
              :alt="skill.name"
              class="w-full h-full object-cover"
              @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-gw-text font-gw text-sm leading-tight">{{ skill.name }}</span>
              <span
                v-if="skill.elite"
                class="text-xs text-gw-elite border border-gw-elite px-1 rounded uppercase tracking-wide"
              >Elite</span>
            </div>
            <div class="text-gw-text-muted text-xs mt-0.5">
              {{ skill.type }}
              <span v-if="skill.attribute"> · {{ skill.attribute }}</span>
            </div>
          </div>
        </div>

        <!-- Costs row -->
        <div class="flex gap-3 text-xs text-gw-text-muted mb-2 flex-wrap">
          <span v-if="skill.energy !== null">
            <span class="text-gw-gold">{{ skill.energy }}</span> Energy
          </span>
          <span v-if="skill.adrenaline !== null">
            <span class="text-gw-gold">{{ skill.adrenaline }}</span> Adrenaline
          </span>
          <span v-if="skill.activation !== null">
            <span class="text-gw-gold">{{ skill.activation }}s</span> Activation
          </span>
          <span v-if="skill.recharge !== null">
            <span class="text-gw-gold">{{ skill.recharge }}s</span> Recharge
          </span>
          <span v-if="skill.sacrifice !== null">
            <span class="text-gw-gold">{{ skill.sacrifice }}%</span> Sacrifice
          </span>
          <span v-if="skill.upkeep !== null">
            <span class="text-gw-gold">{{ skill.upkeep }}</span> Upkeep
          </span>
        </div>

        <!-- Description -->
        <p class="text-gw-text text-xs leading-relaxed">{{ skill.description }}</p>

        <!-- Attribute rank info -->
        <div v-if="attributeRank !== undefined" class="mt-2 text-xs text-gw-text-muted border-t border-gw-border pt-2">
          {{ skill.attribute }} rank: <span class="text-gw-gold">{{ attributeRank }}</span>
        </div>

        <!-- Campaign -->
        <div class="mt-1 text-xs text-gw-text-muted">
          {{ skill.campaign }}
          <span v-if="skill.pveOnly"> · PvE Only</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import type { Skill } from '@/types'

interface Props {
  skill: Skill | null
  anchorEl?: HTMLElement | null
  attributeRank?: number
}

const props = defineProps<Props>()

const tooltipEl = ref<HTMLElement | null>(null)
const positionStyle = ref({ top: '0px', left: '-9999px', visibility: 'hidden' as const })

onMounted(async () => {
  await nextTick()
  if (!props.anchorEl || !tooltipEl.value) return

  const anchor = props.anchorEl.getBoundingClientRect()
  const tip = tooltipEl.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const gap = 8
  const tooltipWidth = tip.width || 288

  // Horizontal: prefer right of anchor, flip left if needed
  let left = anchor.right + gap
  if (left + tooltipWidth > vw - gap) {
    left = anchor.left - tooltipWidth - gap
  }
  left = Math.max(gap, left)

  // Vertical: align to top of anchor, shift up if it overflows bottom
  let top = anchor.top
  const tipHeight = tip.height || 200
  if (top + tipHeight > vh - gap) {
    top = vh - tipHeight - gap
  }
  top = Math.max(gap, top)

  positionStyle.value = { top: `${top}px`, left: `${left}px`, visibility: 'visible' as const }
})
</script>
