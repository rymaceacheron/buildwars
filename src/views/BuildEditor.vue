<template>
  <div class="flex flex-col h-full">

    <!-- Editor top bar -->
    <div class="border-b border-gw-border bg-gw-panel px-4 py-2 flex items-center gap-4">
      <RouterLink to="/" class="text-gw-text-muted hover:text-gw-gold text-sm transition-colors">
        ← Builds
      </RouterLink>

      <div class="flex-1" v-if="project">
        <input
          v-model="projectName"
          class="gw-input font-gw text-sm w-full max-w-xs"
          placeholder="Build name"
          @blur="saveName"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </div>

      <div v-if="project" class="hidden md:flex items-center gap-2">
        <span class="text-gw-text-muted text-xs">Template:</span>
        <code class="text-gw-gold text-xs font-mono bg-gw-dark px-2 py-0.5 rounded border border-gw-border select-all">
          {{ activeTemplateCode || '—' }}
        </code>
        <button v-if="activeTemplateCode" class="gw-btn px-2 py-0.5 text-xs" @click="copyCode">
          {{ copied ? '✓' : 'Copy' }}
        </button>
      </div>
    </div>

    <!-- Main layout -->
    <div v-if="project" class="flex flex-1 overflow-hidden">

      <!-- Bar sidebar -->
      <div class="w-24 shrink-0 border-r border-gw-border bg-gw-panel flex flex-col">
        <div class="flex-1 overflow-y-auto py-2 space-y-1 px-2">
          <button
            v-for="(bar, i) in project.bars"
            :key="i"
            class="w-full flex flex-col items-center py-2 px-1 rounded border text-xs transition-all relative group"
            :class="i === activeBarIndex
              ? 'border-gw-gold bg-gw-panel-light text-gw-gold'
              : 'border-gw-border text-gw-text-muted hover:border-gw-gold hover:text-gw-text'"
            @click="switchBar(i)"
          >
            <span class="text-[10px] text-gw-text-muted mb-0.5">{{ i + 1 }}</span>
            <span class="font-gw font-bold text-xs leading-none">{{ barLabel(bar) }}</span>
            <button
              v-if="project.bars.length > 1"
              class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gw-dark border border-gw-border
                     text-gw-text-muted text-[10px] flex items-center justify-center
                     opacity-0 group-hover:opacity-100 hover:border-red-500 hover:text-red-400 transition-all"
              @click.stop="removeBar(i)"
            >✕</button>
          </button>
        </div>
        <div class="p-2 border-t border-gw-border">
          <button
            class="w-full gw-btn py-1.5 text-xs text-center"
            :disabled="project.bars.length >= 8"
            :class="project.bars.length >= 8 ? 'opacity-40 cursor-not-allowed' : ''"
            @click="addBar"
          >+ Bar</button>
        </div>
      </div>

      <!-- Active bar editor -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-7xl mx-auto px-4 py-4">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <ProfessionPicker />
            <TemplateCode />
          </div>
          <div class="mb-4">
            <SkillBar @slot-clicked="onSlotClicked" />
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AttributePanel />
            <div class="lg:col-span-2 min-h-[500px]">
              <SkillBrowser
                :target-slot-index="buildStore.activeSlotIndex"
                @skill-selected="onSkillSelected"
              />
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Not found -->
    <div v-else class="flex flex-col items-center justify-center flex-1 gap-4 text-gw-text-muted">
      <p>Build not found.</p>
      <RouterLink to="/" class="gw-btn px-4 py-2 text-sm">← Back to Builds</RouterLink>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import type { Skill } from '@/types'
import { useProjectsStore } from '@/stores/projectsStore'
import { useBuildStore } from '@/stores/buildStore'
import { useSkillData } from '@/composables/useSkillData'

import ProfessionPicker from '@/components/build/ProfessionPicker.vue'
import SkillBar from '@/components/build/SkillBar.vue'
import AttributePanel from '@/components/build/AttributePanel.vue'
import TemplateCode from '@/components/build/TemplateCode.vue'
import SkillBrowser from '@/components/skills/SkillBrowser.vue'
import professions from '@/assets/data/professions.json'

interface Props { id: string }
const props = defineProps<Props>()

const router = useRouter()
const projectsStore = useProjectsStore()
const buildStore = useBuildStore()
const { init } = useSkillData()

const activeBarIndex = ref(0)
const copied = ref(false)

const project = computed(() => projectsStore.getProjectById(props.id))

const projectName = ref('')
watch(project, p => { if (p) projectName.value = p.name }, { immediate: true })
function saveName() {
  if (project.value) projectsStore.renameProject(props.id, projectName.value)
}

const profMap = new Map(professions.map((p: { id: number; abbrev: string }) => [p.id, p]))
function barLabel(bar: { primaryProfession: number | null; secondaryProfession: number | null }): string {
  const pri = bar.primaryProfession ? profMap.get(bar.primaryProfession)?.abbrev : null
  const sec = bar.secondaryProfession ? profMap.get(bar.secondaryProfession)?.abbrev : null
  if (!pri) return '?'
  return sec ? `${pri}/${sec}` : pri
}

function syncBarToProject() {
  if (!project.value) return
  projectsStore.updateBar(props.id, activeBarIndex.value, {
    primaryProfession: buildStore.build.primaryProfession,
    secondaryProfession: buildStore.build.secondaryProfession,
    attributes: buildStore.build.attributes,
    skills: [...buildStore.build.skills],
  })
}

function loadBar(index: number) {
  if (!project.value) return
  const bar = project.value.bars[index]
  if (!bar) return
  buildStore.loadBuild({
    primaryProfession: bar.primaryProfession,
    secondaryProfession: bar.secondaryProfession,
    attributes: [...bar.attributes],
    skills: [...bar.skills],
  })
  buildStore.setActiveSlot(null)
}

function switchBar(index: number) {
  if (index === activeBarIndex.value) return
  syncBarToProject()
  activeBarIndex.value = index
  loadBar(index)
}

function addBar() {
  syncBarToProject()
  const newIndex = projectsStore.addBar(props.id)
  if (newIndex >= 0) {
    activeBarIndex.value = newIndex
    loadBar(newIndex)
  }
}

function removeBar(index: number) {
  if (!project.value || project.value.bars.length <= 1) return
  syncBarToProject()
  projectsStore.removeBar(props.id, index)
  const newIndex = Math.min(index, project.value.bars.length - 1)
  activeBarIndex.value = newIndex
  loadBar(newIndex)
}

watch(() => buildStore.isDirty, dirty => { if (dirty) syncBarToProject() })

const activeTemplateCode = computed(() => buildStore.templateCode)

async function copyCode() {
  if (!activeTemplateCode.value) return
  await navigator.clipboard.writeText(activeTemplateCode.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

function onSlotClicked(index: number) {
  buildStore.setActiveSlot(buildStore.activeSlotIndex === index ? null : index)
}

function onSkillSelected(skill: Skill, slotIndex: number) {
  buildStore.setSkill(slotIndex, skill.id)
  buildStore.setActiveSlot(null)
}

onMounted(async () => {
  await init()
  if (!project.value) { router.replace('/'); return }
  activeBarIndex.value = 0
  loadBar(0)
})

onBeforeUnmount(() => {
  syncBarToProject()
})
</script>
