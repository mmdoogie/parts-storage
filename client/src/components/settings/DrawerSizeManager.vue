<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/stores'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import type { DrawerSize } from '@/types'

const settingsStore = useSettingsStore()

// Form state
const isAdding = ref(false)
const editingId = ref<number | null>(null)
const formData = ref({
  name: '',
  widthUnits: 1,
  heightUnits: 1
})
const formError = ref<string | null>(null)
const deleteError = ref<string | null>(null)

function resetForm() {
  formData.value = { name: '', widthUnits: 1, heightUnits: 1 }
  formError.value = null
  isAdding.value = false
  editingId.value = null
}

function startAdd() {
  resetForm()
  isAdding.value = true
}

function startEdit(size: DrawerSize) {
  editingId.value = size.id
  formData.value = {
    name: size.name,
    widthUnits: size.widthUnits,
    heightUnits: size.heightUnits
  }
  formError.value = null
  isAdding.value = false
}

function cancelEdit() {
  resetForm()
}

async function saveSize() {
  formError.value = null

  if (!formData.value.name.trim()) {
    formError.value = 'Name is required'
    return
  }

  if (formData.value.widthUnits < 1 || formData.value.heightUnits < 1) {
    formError.value = 'Width and height must be at least 1'
    return
  }

  try {
    if (editingId.value) {
      await settingsStore.updateDrawerSize(editingId.value, {
        name: formData.value.name.trim(),
        widthUnits: formData.value.widthUnits,
        heightUnits: formData.value.heightUnits
      })
    } else {
      await settingsStore.createDrawerSize({
        name: formData.value.name.trim(),
        widthUnits: formData.value.widthUnits,
        heightUnits: formData.value.heightUnits
      })
    }
    resetForm()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Failed to save drawer size'
  }
}

async function deleteSize(id: number) {
  deleteError.value = null
  if (!confirm('Are you sure you want to delete this drawer size?')) {
    return
  }

  try {
    await settingsStore.deleteDrawerSize(id)
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete drawer size'
  }
}
</script>

<template>
  <div class="drawer-size-manager">
    <div class="manager-header">
      <p class="manager-description">
        Define the available drawer sizes. Each size specifies width and height in grid units.
      </p>
      <BaseButton v-if="!isAdding && !editingId" size="sm" @click="startAdd">
        Add Drawer Size
      </BaseButton>
    </div>

    <!-- Error message for delete -->
    <div v-if="deleteError" class="error-message">
      {{ deleteError }}
      <button class="dismiss-btn" @click="deleteError = null">Dismiss</button>
    </div>

    <!-- Add/Edit Form -->
    <div v-if="isAdding || editingId" class="size-form">
      <h4>{{ editingId ? 'Edit Drawer Size' : 'Add New Drawer Size' }}</h4>
      <div class="form-row">
        <BaseInput
          v-model="formData.name"
          label="Name"
          placeholder="e.g., small, medium, large..."
        />
      </div>
      <div class="form-row form-row--split">
        <div class="number-field">
          <label class="input-label">Width (units)</label>
          <input
            v-model.number="formData.widthUnits"
            type="number"
            min="1"
            max="20"
            class="number-input"
          />
        </div>
        <div class="number-field">
          <label class="input-label">Height (units)</label>
          <input
            v-model.number="formData.heightUnits"
            type="number"
            min="1"
            max="20"
            class="number-input"
          />
        </div>
      </div>
      <div v-if="formError" class="form-error">{{ formError }}</div>
      <div class="form-actions">
        <BaseButton size="sm" @click="saveSize" :loading="settingsStore.loading">
          {{ editingId ? 'Update' : 'Create' }}
        </BaseButton>
        <BaseButton size="sm" variant="ghost" @click="cancelEdit">
          Cancel
        </BaseButton>
      </div>
    </div>

    <!-- Sizes List -->
    <div class="sizes-list">
      <div
        v-for="size in settingsStore.drawerSizes"
        :key="size.id"
        class="size-item"
        :class="{ editing: editingId === size.id }"
      >
        <div class="size-preview" :style="{
          width: `${size.widthUnits * 24}px`,
          height: `${size.heightUnits * 24}px`
        }">
          {{ size.widthUnits }}x{{ size.heightUnits }}
        </div>
        <div class="size-info">
          <span class="size-name">{{ size.name }}</span>
          <span class="size-dimensions">{{ size.widthUnits }} x {{ size.heightUnits }} units</span>
        </div>
        <div class="size-actions">
          <BaseButton
            size="sm"
            variant="ghost"
            @click="startEdit(size)"
            :disabled="!!editingId || isAdding"
          >
            Edit
          </BaseButton>
          <BaseButton
            size="sm"
            variant="danger"
            @click="deleteSize(size.id)"
            :disabled="!!editingId || isAdding"
          >
            Delete
          </BaseButton>
        </div>
      </div>

      <p v-if="!settingsStore.drawerSizes.length" class="empty-message">
        No drawer sizes defined yet.
      </p>
    </div>
  </div>
</template>

<style scoped>
.drawer-size-manager {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.manager-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.manager-description {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
  flex: 1;
}

.error-message {
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dismiss-btn {
  color: var(--color-danger);
  text-decoration: underline;
  font-size: var(--font-size-sm);
}

.size-form {
  background: rgba(0, 0, 0, 0.03);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.size-form h4 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-row--split {
  flex-direction: row;
  gap: var(--spacing-md);
}

.number-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
}

.input-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.number-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  width: 100%;
}

.number-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

.form-error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.form-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.sizes-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.size-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.size-item:hover {
  border-color: rgba(0, 0, 0, 0.2);
}

.size-item.editing {
  opacity: 0.5;
}

.size-preview {
  background: var(--drawer-color, #FFE4B5);
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: rgba(0, 0, 0, 0.5);
  min-width: 48px;
  min-height: 24px;
}

.size-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.size-name {
  font-weight: 600;
}

.size-dimensions {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.size-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.empty-message {
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--spacing-lg);
}
</style>
