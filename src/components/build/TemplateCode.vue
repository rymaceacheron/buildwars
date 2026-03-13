<template>
  <div class="gw-panel p-4">
    <h3 class="font-gw text-gw-gold text-sm mb-3 uppercase tracking-wider">Template Code</h3>

    <!-- Current code -->
    <div class="flex gap-2 mb-3">
      <input
        :value="store.templateCode"
        readonly
        class="gw-input flex-1 font-mono text-xs"
        placeholder="Select a profession to generate a code"
        @click="(e) => (e.target as HTMLInputElement).select()"
      />
      <button
        class="gw-btn"
        :class="copySuccess ? 'border-green-600 text-green-400' : ''"
        :disabled="!store.templateCode"
        @click="copyCode"
      >
        {{ copySuccess ? 'Copied!' : 'Copy' }}
      </button>
    </div>

    <!-- Share URL -->
    <div v-if="shareUrl" class="mb-3">
      <div class="text-xs text-gw-text-muted mb-1">Share URL</div>
      <div class="flex gap-2">
        <input
          :value="shareUrl"
          readonly
          class="gw-input flex-1 font-mono text-xs"
          @click="(e) => (e.target as HTMLInputElement).select()"
        />
        <button class="gw-btn" @click="copyUrl">{{ urlCopied ? 'Copied!' : 'Copy URL' }}</button>
      </div>
    </div>

    <!-- Import -->
    <div class="border-t border-gw-border pt-3">
      <div class="text-xs text-gw-text-muted mb-2">Import template code</div>
      <div class="flex gap-2">
        <input
          v-model="importInput"
          class="gw-input flex-1 font-mono text-xs"
          placeholder="Paste template code here…"
          @keydown.enter="importCode"
        />
        <button class="gw-btn-primary" :disabled="!importInput" @click="importCode">
          Load
        </button>
      </div>
      <p v-if="importError" class="text-red-400 text-xs mt-1">{{ importError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBuildStore } from '@/stores/buildStore'
import { useTemplateCodec } from '@/composables/useTemplateCodec'

const store = useBuildStore()
const { decode } = useTemplateCodec()
const router = useRouter()

const importInput = ref('')
const importError = ref('')
const copySuccess = ref(false)
const urlCopied = ref(false)

const shareUrl = computed(() => {
  if (!store.templateCode) return ''
  return `${window.location.origin}/build/${store.templateCode}`
})

function copyCode() {
  if (!store.templateCode) return
  navigator.clipboard.writeText(store.templateCode).then(() => {
    copySuccess.value = true
    setTimeout(() => (copySuccess.value = false), 2000)
  })
}

function copyUrl() {
  navigator.clipboard.writeText(shareUrl.value).then(() => {
    urlCopied.value = true
    setTimeout(() => (urlCopied.value = false), 2000)
  })
}

function importCode() {
  importError.value = ''
  const trimmed = importInput.value.trim()
  if (!trimmed) return

  const result = decode(trimmed)
  if ('error' in result) {
    importError.value = result.error.message
    return
  }

  store.loadFromDecodedBuild(result.data)
  importInput.value = ''

  // Update URL
  if (store.templateCode) {
    router.replace({ name: 'build-editor-with-code', params: { code: store.templateCode } })
  }
}
</script>
