<template>
  <div class="max-w-6xl mx-auto px-4 py-8">

    <!-- Page header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-gw text-gw-gold">Builds</h1>
        <p class="text-gw-text-muted text-sm mt-1">{{ store.projects.length }} build{{ store.projects.length !== 1 ? 's' : '' }}</p>
      </div>
      <button class="gw-btn-primary px-5 py-2 text-sm" @click="createBuild">
        + New Build
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="store.projects.length === 0" class="gw-panel flex flex-col items-center justify-center py-24 text-center">
      <p class="text-gw-text-muted text-lg mb-2">No builds yet</p>
      <p class="text-gw-text-muted text-sm mb-6">Create your first build to get started</p>
      <button class="gw-btn-primary px-6 py-2" @click="createBuild">Create Build</button>
    </div>

    <!-- Build cards grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="project in store.sortedProjects"
        :key="project.id"
        class="gw-panel flex flex-col hover:border-gw-gold transition-colors cursor-pointer group"
        @click="openBuild(project.id)"
      >
        <!-- Card header -->
        <div class="p-4 flex-1">
          <div class="flex items-start justify-between gap-2 mb-3">
            <!-- Name (double-click to rename) -->
            <div class="flex-1 min-w-0" @click.stop>
              <input
                v-if="renamingId === project.id"
                :ref="el => { if (el) (el as HTMLInputElement).focus() }"
                v-model="renameValue"
                class="gw-input w-full text-sm font-gw"
                @blur="commitRename(project.id)"
                @keydown.enter="commitRename(project.id)"
                @keydown.escape="cancelRename"
                @click.stop
              />
              <h3
                v-else
                class="text-gw-gold font-gw text-sm truncate group-hover:text-gw-gold-light transition-colors"
                :title="project.name"
                @dblclick.stop="startRename(project)"
              >
                {{ project.name }}
              </h3>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 shrink-0" @click.stop>
              <button
                class="gw-btn px-2 py-1 text-xs"
                title="Duplicate"
                @click="duplicateBuild(project.id)"
              >⧉</button>
              <button
                class="gw-btn px-2 py-1 text-xs hover:border-red-500 hover:text-red-400"
                title="Delete"
                @click="confirmDelete(project)"
              >✕</button>
            </div>
          </div>

          <!-- Bar previews -->
          <div class="flex flex-wrap gap-1.5 mb-3">
            <div
              v-for="(bar, i) in project.bars"
              :key="i"
              class="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border"
              :style="barStyle(bar)"
            >
              <span>{{ barLabel(bar) }}</span>
            </div>
            <div
              v-for="i in (8 - project.bars.length)"
              :key="`empty-${i}`"
              class="w-8 h-5 rounded border border-dashed border-gw-border opacity-30"
            />
          </div>

          <!-- Meta -->
          <p class="text-gw-text-muted text-xs">
            {{ project.bars.length }} bar{{ project.bars.length !== 1 ? 's' : '' }} &middot;
            {{ timeAgo(project.updatedAt) }}
          </p>
        </div>

        <!-- Card footer -->
        <div class="border-t border-gw-border px-4 py-2">
          <span class="text-gw-gold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            Click to edit →
          </span>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <div
      v-if="deletingProject"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      @click.self="deletingProject = null"
    >
      <div class="gw-panel p-6 max-w-sm w-full mx-4">
        <h3 class="font-gw text-gw-gold mb-2">Delete Build</h3>
        <p class="text-gw-text text-sm mb-6">
          Delete "<span class="text-gw-gold">{{ deletingProject.name }}</span>"? This cannot be undone.
        </p>
        <div class="flex gap-3 justify-end">
          <button class="gw-btn px-4 py-1.5 text-sm" @click="deletingProject = null">Cancel</button>
          <button
            class="gw-btn px-4 py-1.5 text-sm border-red-700 text-red-400 hover:bg-red-900/30"
            @click="deleteBuild"
          >Delete</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { BuildProject, Bar } from '@/types'
import { useProjectsStore } from '@/stores/projectsStore'
import professions from '@/assets/data/professions.json'

const store = useProjectsStore()
const router = useRouter()

// ─── Profession lookup ──────────────────────────────────────────────────────

const profMap = new Map(professions.map((p: { id: number; abbrev: string; color: string }) => [p.id, p]))

function barLabel(bar: Bar): string {
  const pri = bar.primaryProfession ? profMap.get(bar.primaryProfession)?.abbrev : null
  const sec = bar.secondaryProfession ? profMap.get(bar.secondaryProfession)?.abbrev : null
  if (!pri) return '?/?'
  return sec ? `${pri}/${sec}` : pri
}

function barStyle(bar: Bar): Record<string, string> {
  const prof = bar.primaryProfession ? profMap.get(bar.primaryProfession) : null
  const color = prof?.color ?? '#5C4A20'
  return {
    borderColor: color,
    color: color,
    backgroundColor: `${color}22`,
  }
}

// ─── Navigation ─────────────────────────────────────────────────────────────

function openBuild(id: string) {
  router.push({ name: 'build-editor', params: { id } })
}

function createBuild() {
  const id = store.createProject()
  router.push({ name: 'build-editor', params: { id } })
}

function duplicateBuild(id: string) {
  const newId = store.duplicateProject(id)
  if (newId) router.push({ name: 'build-editor', params: { id: newId } })
}

// ─── Rename ──────────────────────────────────────────────────────────────────

const renamingId = ref<string | null>(null)
const renameValue = ref('')

function startRename(project: BuildProject) {
  renamingId.value = project.id
  renameValue.value = project.name
}

function commitRename(id: string) {
  if (renamingId.value !== id) return
  store.renameProject(id, renameValue.value)
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

// ─── Delete ──────────────────────────────────────────────────────────────────

const deletingProject = ref<BuildProject | null>(null)

function confirmDelete(project: BuildProject) {
  deletingProject.value = project
}

function deleteBuild() {
  if (!deletingProject.value) return
  store.deleteProject(deletingProject.value.id)
  deletingProject.value = null
}

// ─── Time formatting ─────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
</script>
