import { defineStore } from 'pinia'
import type { BuildProject, Bar } from '@/types'

const STORAGE_KEY = 'gw1-projects'

function emptyBar(): Bar {
  return {
    primaryProfession: null,
    secondaryProfession: null,
    attributes: [],
    skills: [null, null, null, null, null, null, null, null],
  }
}

function newProject(name = 'New Build'): BuildProject {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    bars: [emptyBar()],
  }
}

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projects: [] as BuildProject[],
  }),

  getters: {
    getProjectById: (state) => (id: string): BuildProject | undefined => {
      return state.projects.find(p => p.id === id)
    },

    sortedProjects: (state): BuildProject[] => {
      return [...state.projects].sort((a, b) => b.updatedAt - a.updatedAt)
    },
  },

  actions: {
    createProject(name = 'New Build'): string {
      const project = newProject(name)
      this.projects.push(project)
      this.persist()
      return project.id
    },

    renameProject(id: string, name: string) {
      const project = this.projects.find(p => p.id === id)
      if (!project) return
      project.name = name.trim() || 'New Build'
      project.updatedAt = Date.now()
      this.persist()
    },

    deleteProject(id: string) {
      this.projects = this.projects.filter(p => p.id !== id)
      this.persist()
    },

    duplicateProject(id: string): string | null {
      const source = this.projects.find(p => p.id === id)
      if (!source) return null
      const copy: BuildProject = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        name: `${source.name} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      this.projects.push(copy)
      this.persist()
      return copy.id
    },

    addBar(id: string): number {
      const project = this.projects.find(p => p.id === id)
      if (!project || project.bars.length >= 8) return -1
      project.bars.push(emptyBar())
      project.updatedAt = Date.now()
      this.persist()
      return project.bars.length - 1
    },

    removeBar(id: string, barIndex: number) {
      const project = this.projects.find(p => p.id === id)
      if (!project || project.bars.length <= 1) return
      project.bars.splice(barIndex, 1)
      project.updatedAt = Date.now()
      this.persist()
    },

    updateBar(id: string, barIndex: number, bar: Bar) {
      const project = this.projects.find(p => p.id === id)
      if (!project || barIndex < 0 || barIndex >= project.bars.length) return
      project.bars[barIndex] = bar
      project.updatedAt = Date.now()
      this.persist()
    },

    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projects))
      } catch {
        // storage full or unavailable
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as BuildProject[]
        if (Array.isArray(parsed)) {
          // Basic shape validation
          this.projects = parsed.filter(
            p => p.id && p.name && Array.isArray(p.bars) && p.bars.length >= 1,
          )
        }
      } catch {
        // corrupted data — start fresh
      }
    },
  },
})
