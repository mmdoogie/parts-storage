<script setup lang="ts">
import { useSearchStore, useSettingsStore, useWallStore } from '@/stores'
import SearchBar from '@/components/search/SearchBar.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const searchStore = useSearchStore()
const settingsStore = useSettingsStore()
const wallStore = useWallStore()
</script>

<template>
  <header class="app-header">
    <div class="header-content">
      <h1 class="header-title">Parts Storage</h1>
      <SearchBar v-model="searchStore.query" class="header-search" />
      <div class="header-actions">
        <BaseButton variant="primary" size="sm" @click="wallStore.openAddCaseModal()">
          <svg class="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Case
        </BaseButton>
        <button
          class="settings-button"
          @click="settingsStore.openSettingsModal()"
          title="Settings"
          aria-label="Open settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
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

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.button-icon {
  width: 16px;
  height: 16px;
  margin-right: var(--spacing-xs);
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
