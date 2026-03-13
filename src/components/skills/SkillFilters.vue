<template>
  <div class="flex flex-wrap gap-2 items-center">
    <!-- Search -->
    <input
      :value="modelValue.query"
      class="gw-input text-xs w-36"
      placeholder="Search skills…"
      @input="update('query', ($event.target as HTMLInputElement).value)"
    />

    <!-- Attribute -->
    <select
      :value="modelValue.attribute"
      class="gw-input text-xs"
      @change="update('attribute', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">All attributes</option>
      <option v-for="attr in availableAttributes" :key="attr" :value="attr">{{ attr }}</option>
    </select>

    <!-- Type -->
    <select
      :value="modelValue.type"
      class="gw-input text-xs"
      @change="update('type', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">All types</option>
      <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
    </select>

    <!-- Elite only -->
    <label class="flex items-center gap-1.5 cursor-pointer text-xs text-gw-text-muted hover:text-gw-text">
      <input
        type="checkbox"
        :checked="modelValue.eliteOnly"
        class="accent-gw-gold"
        @change="update('eliteOnly', ($event.target as HTMLInputElement).checked)"
      />
      Elite only
    </label>

    <!-- Hide PvE-only (Asura, Norn, Sunspear, etc.) -->
    <label class="flex items-center gap-1.5 cursor-pointer text-xs text-gw-text-muted hover:text-gw-text">
      <input
        type="checkbox"
        :checked="modelValue.hidePveOnly"
        class="accent-gw-gold"
        @change="update('hidePveOnly', ($event.target as HTMLInputElement).checked)"
      />
      Hide PvE-only
    </label>

    <!-- PvE / PvP toggle -->
    <div class="flex rounded border border-gw-border overflow-hidden text-xs">
      <button
        v-for="opt in pvpOptions"
        :key="opt.value"
        class="px-2 py-0.5 transition-colors"
        :class="modelValue.pvpFilter === opt.value
          ? 'bg-gw-border text-gw-gold'
          : 'bg-gw-dark text-gw-text-muted hover:text-gw-text'"
        @click="update('pvpFilter', opt.value)"
      >{{ opt.label }}</button>
    </div>

    <!-- Clear -->
    <button
      v-if="hasActiveFilters"
      class="gw-btn text-xs py-0.5 px-2"
      @click="clearFilters"
    >
      Clear
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface SkillFilterState {
  query: string
  attribute: string | null
  type: string | null
  eliteOnly: boolean
  hidePveOnly: boolean
  campaign: string | null
  pvpFilter: 'all' | 'pve' | 'pvp'
}

interface Props {
  modelValue: SkillFilterState
  availableAttributes: string[]
  availableTypes: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: SkillFilterState]
}>()


const pvpOptions: { label: string; value: SkillFilterState['pvpFilter'] }[] = [
  { label: 'All', value: 'all' },
  { label: 'PvE', value: 'pve' },
  { label: 'PvP', value: 'pvp' },
]

const hasActiveFilters = computed(() =>
  props.modelValue.query ||
  props.modelValue.attribute ||
  props.modelValue.type ||
  props.modelValue.eliteOnly ||
  props.modelValue.hidePveOnly ||
  props.modelValue.campaign ||
  props.modelValue.pvpFilter !== 'all',
)

function update<K extends keyof SkillFilterState>(key: K, value: SkillFilterState[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function clearFilters() {
  emit('update:modelValue', {
    query: '', attribute: null, type: null,
    eliteOnly: false, hidePveOnly: false,
    campaign: null, pvpFilter: 'all',
  })
}
</script>
