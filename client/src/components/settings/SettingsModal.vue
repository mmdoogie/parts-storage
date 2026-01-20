<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores'
import BaseModal from '@/components/base/BaseModal.vue'
import DrawerSizeManager from './DrawerSizeManager.vue'
import LayoutTemplateManager from './LayoutTemplateManager.vue'
import CategoryManager from '@/components/category/CategoryManager.vue'
import WallManager from './WallManager.vue'

const settingsStore = useSettingsStore()

type TabType = 'walls' | 'drawer-sizes' | 'layout-templates' | 'categories'
const activeTab = ref<TabType>('walls')

const tabs: { id: TabType; label: string }[] = [
  { id: 'walls', label: 'Walls' },
  { id: 'drawer-sizes', label: 'Drawer Sizes' },
  { id: 'layout-templates', label: 'Layout Templates' },
  { id: 'categories', label: 'Categories' }
]

watch(() => settingsStore.settingsModalOpen, async (open) => {
  if (open) {
    await settingsStore.initializeSettings()
  }
})

function handleClose() {
  settingsStore.closeSettingsModal()
}
</script>

<template>
  <BaseModal
    :open="settingsStore.settingsModalOpen"
    title="Settings"
    size="xl"
    @close="handleClose"
  >
    <div class="settings-content">
      <!-- Tab Navigation -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <WallManager v-if="activeTab === 'walls'" />
        <DrawerSizeManager v-if="activeTab === 'drawer-sizes'" />
        <LayoutTemplateManager v-if="activeTab === 'layout-templates'" />
        <CategoryManager v-if="activeTab === 'categories'" />
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.settings-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: 400px;
}

.tabs {
  display: flex;
  gap: var(--spacing-xs);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: var(--spacing-xs);
}

.tab {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-md);
  font-weight: 500;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  transition: all var(--transition-fast);
  position: relative;
}

.tab:hover {
  color: var(--color-text);
  background: rgba(0, 0, 0, 0.03);
}

.tab.active {
  color: var(--color-primary);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: calc(-1 * var(--spacing-xs) - 1px);
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
}
</style>
