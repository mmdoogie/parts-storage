<script setup lang="ts">
import { useSearchStore, useSettingsStore } from '@/stores'
import SearchBar from '@/components/search/SearchBar.vue'

const searchStore = useSearchStore()
const settingsStore = useSettingsStore()
</script>

<template>
  <header class="app-header">
    <div class="header-content">
      <h1 class="header-title">Parts Storage</h1>
      <SearchBar v-model="searchStore.query" class="header-search" />
      <button
        class="settings-button"
        @click="settingsStore.openSettingsModal()"
        title="Settings"
        aria-label="Open settings"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: linear-gradient(135deg, var(--wood-dark) 0%, var(--wood-medium) 100%);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-content {
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.header-title {
  color: white;
  font-size: var(--font-size-xl);
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  margin: 0;
  white-space: nowrap;
}

.header-search {
  flex: 1;
  min-width: 200px;
  max-width: 400px;
}

.settings-button {
  padding: var(--spacing-sm);
  color: white;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  opacity: 0.8;
}

.settings-button:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.settings-button svg {
  width: 24px;
  height: 24px;
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
  }

  .header-title {
    text-align: center;
  }

  .header-search {
    max-width: none;
  }

  .settings-button {
    position: absolute;
    top: var(--spacing-md);
    right: var(--spacing-md);
  }

  .app-header {
    position: relative;
  }
}
</style>
