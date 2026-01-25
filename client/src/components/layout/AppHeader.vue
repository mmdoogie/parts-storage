<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSearchStore, useSettingsStore, useWallStore } from '@/stores'
import SearchBar from '@/components/search/SearchBar.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const searchStore = useSearchStore()
const settingsStore = useSettingsStore()
const wallStore = useWallStore()

const isWallDropdownOpen = ref(false)
const wallSelectorRef = ref<HTMLElement | null>(null)
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null)

const walls = computed(() => wallStore.walls)
const currentWall = computed(() => wallStore.currentWall)
const isLocked = computed(() => settingsStore.editLocked)

function toggleWallDropdown() {
  isWallDropdownOpen.value = !isWallDropdownOpen.value
}

function closeWallDropdown() {
  isWallDropdownOpen.value = false
}

function handleClickOutside(event: MouseEvent) {
  if (wallSelectorRef.value && !wallSelectorRef.value.contains(event.target as Node)) {
    closeWallDropdown()
  }
}

function handleKeydown(event: KeyboardEvent) {
  // "/" to focus search bar, but not when typing in an input/textarea
  if (event.key === '/' && !isInputFocused()) {
    event.preventDefault()
    searchBarRef.value?.focus()
  }
}

function isInputFocused(): boolean {
  const activeElement = document.activeElement
  if (!activeElement) return false
  const tagName = activeElement.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || (activeElement as HTMLElement).isContentEditable
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

async function selectWall(wallId: number) {
  if (wallId !== currentWall.value?.id) {
    await wallStore.fetchWall(wallId)
  }
  closeWallDropdown()
}

async function createNewWall() {
  const name = `Wall ${walls.value.length + 1}`
  const wall = await wallStore.createWall({ name })
  await wallStore.fetchWall(wall.id)
  closeWallDropdown()
}
</script>

<template>
  <header class="app-header">
    <div class="header-content">
      <div class="header-left">
        <h1 class="header-title">Parts Storage</h1>
        <div ref="wallSelectorRef" class="wall-selector">
          <button class="wall-selector-button" @click="toggleWallDropdown">
            <span class="wall-name">{{ currentWall?.name || 'Select Wall' }}</span>
            <svg class="dropdown-icon" :class="{ open: isWallDropdownOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div v-if="isWallDropdownOpen" class="wall-dropdown">
            <button
              v-for="wall in walls"
              :key="wall.id"
              class="wall-option"
              :class="{ active: wall.id === currentWall?.id }"
              @click="selectWall(wall.id)"
            >
              {{ wall.name }}
            </button>
            <div class="dropdown-divider" v-if="walls.length > 0"></div>
            <button class="wall-option new-wall" @click="createNewWall">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Wall
            </button>
          </div>
        </div>
      </div>
      <SearchBar ref="searchBarRef" v-model="searchStore.query" class="header-search" />
      <div class="header-actions">
        <BaseButton
          variant="primary"
          size="sm"
          :disabled="isLocked"
          @click="wallStore.openAddCaseModal()"
        >
          <svg class="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Case
        </BaseButton>
        <button
          class="lock-button"
          :class="{ 'is-locked': isLocked }"
          @click="settingsStore.toggleEditLock()"
          :title="isLocked ? 'Unlock editing' : 'Lock editing'"
          :aria-label="isLocked ? 'Unlock editing' : 'Lock editing'"
        >
          <svg v-if="isLocked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
        </button>
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

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.header-title {
  color: white;
  font-size: var(--font-size-xl);
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  margin: 0;
  white-space: nowrap;
}

.wall-selector {
  position: relative;
}

.wall-selector-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-sm);
  color: white;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.wall-selector-button:hover {
  background: rgba(255, 255, 255, 0.25);
}

.wall-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-icon {
  width: 16px;
  height: 16px;
  transition: transform var(--transition-fast);
}

.dropdown-icon.open {
  transform: rotate(180deg);
}

.wall-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: var(--spacing-xs);
  min-width: 180px;
  background: white;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 100;
}

.wall-option {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.wall-option:hover {
  background: rgba(0, 0, 0, 0.05);
}

.wall-option.active {
  background: rgba(52, 152, 219, 0.1);
  color: var(--color-primary);
  font-weight: 500;
}

.wall-option.new-wall {
  color: var(--color-primary);
}

.wall-option.new-wall svg {
  width: 16px;
  height: 16px;
}

.dropdown-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
  margin: var(--spacing-xs) 0;
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

.lock-button,
.settings-button {
  padding: var(--spacing-sm);
  color: white;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  opacity: 0.8;
}

.lock-button:hover,
.settings-button:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.lock-button svg,
.settings-button svg {
  width: 24px;
  height: 24px;
}

.lock-button.is-locked {
  color: var(--color-warning, #f39c12);
  opacity: 1;
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
  }

  .header-left {
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .header-title {
    text-align: center;
  }

  .wall-selector {
    width: 100%;
  }

  .wall-selector-button {
    width: 100%;
    justify-content: center;
  }

  .wall-dropdown {
    left: 50%;
    transform: translateX(-50%);
  }

  .header-search {
    max-width: none;
  }

  .settings-button {
    position: absolute;
    top: var(--spacing-md);
    right: var(--spacing-md);
  }
}
</style>
