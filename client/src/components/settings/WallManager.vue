<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useWallStore } from '@/stores'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import type { Wall } from '@/types'

const wallStore = useWallStore()

const walls = computed(() => wallStore.walls)
const currentWall = computed(() => wallStore.currentWall)

const editingWallId = ref<number | null>(null)
const editingName = ref('')
const deleteConfirmId = ref<number | null>(null)
const isDeleting = ref(false)

function startEditing(wall: Wall) {
  editingWallId.value = wall.id
  editingName.value = wall.name
}

function cancelEditing() {
  editingWallId.value = null
  editingName.value = ''
}

async function saveWallName(wallId: number) {
  if (!editingName.value.trim()) return

  try {
    await wallStore.updateWall(wallId, { name: editingName.value.trim() })
    cancelEditing()
  } catch (e) {
    console.error('Failed to update wall name:', e)
  }
}

function showDeleteConfirm(wallId: number) {
  deleteConfirmId.value = wallId
}

function cancelDelete() {
  deleteConfirmId.value = null
}

async function confirmDelete(wallId: number) {
  if (walls.value.length <= 1) {
    alert('Cannot delete the last wall.')
    cancelDelete()
    return
  }

  isDeleting.value = true
  try {
    const wasCurrentWall = currentWall.value?.id === wallId
    await wallStore.deleteWall(wallId)

    // If we deleted the current wall, switch to another wall
    if (wasCurrentWall && walls.value.length > 0) {
      await wallStore.fetchWall(walls.value[0].id)
    }

    cancelDelete()
  } catch (e) {
    console.error('Failed to delete wall:', e)
  } finally {
    isDeleting.value = false
  }
}

async function selectWall(wallId: number) {
  if (wallId !== currentWall.value?.id) {
    await wallStore.fetchWall(wallId)
  }
}

// Refresh walls when component mounts
watch(() => wallStore.walls, () => {}, { immediate: true })
</script>

<template>
  <div class="wall-manager">
    <div class="manager-header">
      <h3>Manage Walls</h3>
      <p class="description">Rename or delete storage walls. The currently selected wall is shown in the header.</p>
    </div>

    <div class="wall-list">
      <div
        v-for="wall in walls"
        :key="wall.id"
        class="wall-item"
        :class="{ active: wall.id === currentWall?.id }"
      >
        <!-- Normal view -->
        <template v-if="editingWallId !== wall.id && deleteConfirmId !== wall.id">
          <div class="wall-info" @click="selectWall(wall.id)">
            <span class="wall-name">{{ wall.name }}</span>
            <span v-if="wall.id === currentWall?.id" class="current-badge">Current</span>
          </div>
          <div class="wall-actions">
            <button class="action-button edit" @click.stop="startEditing(wall)" title="Rename">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              class="action-button delete"
              @click.stop="showDeleteConfirm(wall.id)"
              title="Delete"
              :disabled="walls.length <= 1"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </template>

        <!-- Edit mode -->
        <template v-else-if="editingWallId === wall.id">
          <div class="edit-form">
            <BaseInput
              v-model="editingName"
              placeholder="Wall name"
              autofocus
              @keyup.enter="saveWallName(wall.id)"
              @keyup.escape="cancelEditing"
            />
            <div class="edit-actions">
              <BaseButton size="sm" @click="saveWallName(wall.id)">Save</BaseButton>
              <BaseButton size="sm" variant="ghost" @click="cancelEditing">Cancel</BaseButton>
            </div>
          </div>
        </template>

        <!-- Delete confirmation -->
        <template v-else-if="deleteConfirmId === wall.id">
          <div class="delete-confirm">
            <span class="confirm-message">Delete "{{ wall.name }}"? This cannot be undone.</span>
            <div class="confirm-actions">
              <BaseButton size="sm" variant="danger" @click="confirmDelete(wall.id)" :loading="isDeleting">
                Delete
              </BaseButton>
              <BaseButton size="sm" variant="ghost" @click="cancelDelete">Cancel</BaseButton>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="walls.length === 0" class="empty-state">
      <p>No walls found.</p>
    </div>
  </div>
</template>

<style scoped>
.wall-manager {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.manager-header h3 {
  margin: 0 0 var(--spacing-xs) 0;
  font-size: var(--font-size-lg);
}

.description {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.wall-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.wall-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.wall-item:hover {
  border-color: rgba(0, 0, 0, 0.2);
}

.wall-item.active {
  border-color: var(--color-primary);
  background: rgba(52, 152, 219, 0.05);
}

.wall-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
  flex: 1;
}

.wall-name {
  font-weight: 500;
}

.current-badge {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
}

.wall-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.action-button {
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.action-button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text);
}

.action-button.delete:hover {
  color: var(--color-danger);
}

.action-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-button svg {
  width: 18px;
  height: 18px;
}

.edit-form {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
}

.edit-form :deep(.base-input) {
  flex: 1;
}

.edit-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.delete-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: var(--spacing-md);
}

.confirm-message {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.confirm-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-muted);
}
</style>
