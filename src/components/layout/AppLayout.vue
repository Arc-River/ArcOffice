<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: used in template
import SidePanel from './SidePanel.vue'
// biome-ignore lint/correctness/noUnusedImports: used in template
import StatusBar from './StatusBar.vue'
// biome-ignore lint/correctness/noUnusedImports: used in template
import TopNav from './TopNav.vue'
</script>

<template>
  <div class="app-shell app-layout-transition">
    <TopNav />
    <div class="app-body">
      <SidePanel />
      <main class="app-main">
        <router-view />
      </main>
    </div>
    <StatusBar />
  </div>
</template>

<style lang="scss" scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--arc-bg-page);
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow: auto;
  background: var(--arc-bg-page);
}
</style>
