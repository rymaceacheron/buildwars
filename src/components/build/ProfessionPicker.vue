<template>
  <div class="gw-panel p-4">
    <h3 class="font-gw text-gw-gold text-sm mb-3 uppercase tracking-wider">Profession</h3>

    <div class="flex items-center gap-3 mb-4">
      <span class="text-gw-text font-gw text-lg">{{ store.professionLabel }}</span>
    </div>

    <!-- Primary profession -->
    <div class="mb-4">
      <div class="text-xs text-gw-text-muted mb-2 uppercase tracking-wide">Primary</div>
      <div class="grid grid-cols-5 gap-1">
        <button
          v-for="prof in professions"
          :key="prof.id"
          class="profession-btn"
          :class="{
            'border-gw-gold text-gw-gold bg-gw-panel-light': store.build.primaryProfession === prof.id,
            'border-gw-border text-gw-text-muted hover:border-gw-gold hover:text-gw-text': store.build.primaryProfession !== prof.id,
          }"
          :title="prof.name"
          @click="selectPrimary(prof.id)"
        >
          {{ prof.abbrev }}
        </button>
      </div>
    </div>

    <!-- Secondary profession -->
    <div>
      <div class="text-xs text-gw-text-muted mb-2 uppercase tracking-wide">Secondary</div>
      <div class="grid grid-cols-6 gap-1">
        <!-- None option -->
        <button
          class="profession-btn"
          :class="{
            'border-gw-gold text-gw-gold bg-gw-panel-light': store.build.secondaryProfession === null,
            'border-gw-border text-gw-text-muted hover:border-gw-gold hover:text-gw-text': store.build.secondaryProfession !== null,
          }"
          title="No secondary profession"
          @click="selectSecondary(null)"
        >
          —
        </button>
        <button
          v-for="prof in professions"
          :key="prof.id"
          class="profession-btn"
          :class="{
            'border-gw-gold text-gw-gold bg-gw-panel-light': store.build.secondaryProfession === prof.id,
            'opacity-40 cursor-not-allowed': prof.id === store.build.primaryProfession,
            'border-gw-border text-gw-text-muted hover:border-gw-gold hover:text-gw-text': store.build.secondaryProfession !== prof.id && prof.id !== store.build.primaryProfession,
          }"
          :disabled="prof.id === store.build.primaryProfession"
          :title="prof.name"
          @click="selectSecondary(prof.id)"
        >
          {{ prof.abbrev }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBuildStore } from '@/stores/buildStore'
import { useSkillData } from '@/composables/useSkillData'

const store = useBuildStore()
const { professions } = useSkillData()

function selectPrimary(profId: number) {
  // If this matches the current secondary, clear secondary
  const secondary = store.build.secondaryProfession === profId ? null : store.build.secondaryProfession
  store.setProfessions(profId, secondary)
}

function selectSecondary(profId: number | null) {
  if (store.build.primaryProfession === null) return
  store.setProfessions(store.build.primaryProfession, profId)
}
</script>

<style scoped>
.profession-btn {
  @apply border rounded px-1 py-1.5 text-xs font-gw transition-colors text-center;
}
</style>
