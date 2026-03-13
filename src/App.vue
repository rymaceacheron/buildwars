<template>
  <div class="h-screen flex flex-col bg-gw-dark overflow-hidden">
    <AppHeader />
    <main class="flex-1 overflow-hidden flex flex-col">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/shared/AppHeader.vue'
</script>
