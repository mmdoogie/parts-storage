<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from './components/layout/AppHeader.vue'
import SettingsModal from './components/settings/SettingsModal.vue'
</script>

<template>
  <div class="app">
    <AppHeader />
    <main class="app-main">
      <RouterView />
    </main>
    <SettingsModal />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-background);
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
