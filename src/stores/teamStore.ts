import { defineStore } from 'pinia'
import type { Build } from '@/types'

function emptyBuild(): Build {
  return {
    primaryProfession: null,
    secondaryProfession: null,
    attributes: [],
    skills: [null, null, null, null, null, null, null, null],
  }
}

export const useTeamStore = defineStore('team', {
  state: () => ({
    builds: [emptyBuild()] as Build[],
    activeBuildIndex: 0,
    teamName: 'My Team',
  }),

  getters: {
    activeBuild(state): Build {
      return state.builds[state.activeBuildIndex] ?? emptyBuild()
    },
    buildCount(state): number {
      return state.builds.length
    },
  },

  actions: {
    addBuild() {
      if (this.builds.length >= 8) return
      this.builds.push(emptyBuild())
      this.activeBuildIndex = this.builds.length - 1
    },

    removeBuild(index: number) {
      if (this.builds.length <= 1) return
      this.builds.splice(index, 1)
      if (this.activeBuildIndex >= this.builds.length) {
        this.activeBuildIndex = this.builds.length - 1
      }
    },

    setActiveBuild(index: number) {
      if (index >= 0 && index < this.builds.length) {
        this.activeBuildIndex = index
      }
    },

    updateBuild(index: number, build: Build) {
      if (index >= 0 && index < this.builds.length) {
        this.builds[index] = build
      }
    },
  },
})
