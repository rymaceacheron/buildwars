<template>
  <header class="border-b border-gw-border bg-gw-panel">
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
      <RouterLink to="/" class="font-gw text-gw-gold text-xl tracking-wide hover:text-gw-gold-light transition-colors">
        GW Build Creator
      </RouterLink>

      <nav class="flex items-center gap-6">
        <RouterLink
          to="/build"
          class="text-sm text-gw-text-muted hover:text-gw-text transition-colors"
          active-class="text-gw-gold"
        >
          Build Editor
        </RouterLink>
        <RouterLink
          to="/team"
          class="text-sm text-gw-text-muted hover:text-gw-text transition-colors"
          active-class="text-gw-gold"
        >
          Team Builder
        </RouterLink>
        <RouterLink
          to="/browse"
          class="text-sm text-gw-text-muted hover:text-gw-text transition-colors"
          active-class="text-gw-gold"
        >
          Browse
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
