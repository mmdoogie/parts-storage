<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCategoryStore } from '@/stores'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import ColorPicker from './ColorPicker.vue'
import type { Category } from '@/types'
import type { CategoryDrawer } from '@/services/categoryService'

const categoryStore = useCategoryStore()

// Get existing category colors for the color picker
const existingCategoryColors = computed(() =>
  categoryStore.categories.map(c => c.color)
)

// Form state
const isAdding = ref(false)
const editingId = ref<number | null>(null)
const formData = ref({
  name: '',
  color: '#3498db'
})
const formError = ref<string | null>(null)
const deleteError = ref<string | null>(null)

// Delete confirmation state
const deletingCategory = ref<Category | null>(null)
const drawersUsingCategory = ref<CategoryDrawer[]>([])
const loadingDrawers = ref(false)

onMounted(async () => {
  if (categoryStore.categories.length === 0) {
    await categoryStore.fetchCategories()
  }
})

function resetForm() {
  formData.value = { name: '', color: '#3498db' }
  formError.value = null
  isAdding.value = false
  editingId.value = null
}

function startAdd() {
  resetForm()
  isAdding.value = true
}

function startEdit(category: Category) {
  editingId.value = category.id
  formData.value = {
    name: category.name,
    color: category.color
  }
  formError.value = null
  isAdding.value = false
}

function cancelEdit() {
  resetForm()
}

async function saveCategory() {
  formError.value = null

  if (!formData.value.name.trim()) {
    formError.value = 'Name is required'
    return
  }

  try {
    if (editingId.value) {
      await categoryStore.updateCategory(editingId.value, {
        name: formData.value.name.trim(),
        color: formData.value.color
      })
    } else {
      await categoryStore.createCategory({
        name: formData.value.name.trim(),
        color: formData.value.color
      })
    }
    resetForm()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Failed to save category'
  }
}

async function initiateDelete(category: Category) {
  deletingCategory.value = category
  loadingDrawers.value = true
  deleteError.value = null

  try {
    drawersUsingCategory.value = await categoryStore.getCategoryDrawers(category.id)
  } catch (e) {
    drawersUsingCategory.value = []
  } finally {
    loadingDrawers.value = false
  }
}

function cancelDelete() {
  deletingCategory.value = null
  drawersUsingCategory.value = []
}

async function confirmDelete() {
  if (!deletingCategory.value) return

  deleteError.value = null
  try {
    await categoryStore.deleteCategory(deletingCategory.value.id)
    deletingCategory.value = null
    drawersUsingCategory.value = []
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete category'
  }
}
</script>

<template>
  <div class="category-manager">
    <div class="manager-header">
      <p class="manager-description">
        Manage categories for organizing drawers. Categories can be assigned to drawers to help with filtering and searching.
      </p>
      <BaseButton v-if="!isAdding && !editingId && !deletingCategory" size="sm" @click="startAdd">
        Add Category
      </BaseButton>
    </div>

    <!-- Error message for delete -->
    <div v-if="deleteError" class="error-message">
      {{ deleteError }}
      <button class="dismiss-btn" @click="deleteError = null">Dismiss</button>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="deletingCategory" class="delete-confirmation">
      <h4>Delete Category: {{ deletingCategory.name }}</h4>

      <div v-if="loadingDrawers" class="loading-drawers">
        Loading affected drawers...
      </div>

      <div v-else>
        <p v-if="drawersUsingCategory.length === 0" class="no-drawers-message">
          No drawers are using this category. It can be safely deleted.
        </p>

        <div v-else class="drawers-warning">
          <p class="warning-text">
            <strong>Warning:</strong> {{ drawersUsingCategory.length }} drawer(s) are using this category.
            Deleting will remove this category from those drawers.
          </p>
          <div class="affected-drawers">
            <div
              v-for="drawer in drawersUsingCategory.slice(0, 5)"
              :key="drawer.id"
              class="affected-drawer"
            >
              <span class="drawer-name">{{ drawer.name || 'Unnamed drawer' }}</span>
              <span class="drawer-path">
                {{ drawer.path.wallName }} / {{ drawer.path.caseName }}
              </span>
            </div>
            <p v-if="drawersUsingCategory.length > 5" class="more-drawers">
              ...and {{ drawersUsingCategory.length - 5 }} more drawer(s)
            </p>
          </div>
        </div>
      </div>

      <div class="delete-actions">
        <BaseButton size="sm" variant="danger" @click="confirmDelete" :disabled="loadingDrawers">
          Delete Category
        </BaseButton>
        <BaseButton size="sm" variant="ghost" @click="cancelDelete">
          Cancel
        </BaseButton>
      </div>
    </div>

    <!-- Add/Edit Form -->
    <div v-else-if="isAdding || editingId" class="category-form">
      <h4>{{ editingId ? 'Edit Category' : 'Add New Category' }}</h4>
      <div class="form-row">
        <BaseInput
          v-model="formData.name"
          label="Name"
          placeholder="e.g., Electronics, Hardware, Tools..."
        />
      </div>
      <div class="form-row">
        <ColorPicker v-model="formData.color" label="Color" :existing-colors="existingCategoryColors" />
      </div>
      <div v-if="formError" class="form-error">{{ formError }}</div>
      <div class="form-actions">
        <BaseButton size="sm" @click="saveCategory" :loading="categoryStore.loading">
          {{ editingId ? 'Update' : 'Create' }}
        </BaseButton>
        <BaseButton size="sm" variant="ghost" @click="cancelEdit">
          Cancel
        </BaseButton>
      </div>
    </div>

    <!-- Categories List -->
    <div class="categories-list">
      <div
        v-for="category in categoryStore.categories"
        :key="category.id"
        class="category-item"
        :class="{ editing: editingId === category.id }"
      >
        <div class="category-color" :style="{ backgroundColor: category.color }"></div>
        <div class="category-info">
          <span class="category-name">{{ category.name }}</span>
          <span class="category-color-value">{{ category.color }}</span>
        </div>
        <div class="category-actions">
          <BaseButton
            size="sm"
            variant="ghost"
            @click="startEdit(category)"
            :disabled="!!editingId || isAdding || !!deletingCategory"
          >
            Edit
          </BaseButton>
          <BaseButton
            size="sm"
            variant="danger"
            @click="initiateDelete(category)"
            :disabled="!!editingId || isAdding || !!deletingCategory"
          >
            Delete
          </BaseButton>
        </div>
      </div>

      <p v-if="!categoryStore.categories.length && !categoryStore.loading" class="empty-message">
        No categories defined yet.
      </p>

      <p v-if="categoryStore.loading" class="loading-message">
        Loading categories...
      </p>
    </div>
  </div>
</template>

<style scoped>
.category-manager {
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

.delete-confirmation {
  background: rgba(231, 76, 60, 0.05);
  border: 1px solid rgba(231, 76, 60, 0.2);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.delete-confirmation h4 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-danger);
}

.loading-drawers {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.no-drawers-message {
  color: var(--color-text-muted);
  margin: 0;
}

.drawers-warning {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.warning-text {
  color: var(--color-danger);
  margin: 0;
  font-size: var(--font-size-sm);
}

.affected-drawers {
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm);
  max-height: 150px;
  overflow-y: auto;
}

.affected-drawer {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-xs) 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.affected-drawer:last-child {
  border-bottom: none;
}

.drawer-name {
  font-weight: 500;
  font-size: var(--font-size-sm);
}

.drawer-path {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.more-drawers {
  margin: var(--spacing-xs) 0 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

.delete-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.category-form {
  background: rgba(0, 0, 0, 0.03);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.category-form h4 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.form-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.categories-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.category-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.category-item:hover {
  border-color: rgba(0, 0, 0, 0.2);
}

.category-item.editing {
  opacity: 0.5;
}

.category-color {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.category-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.category-name {
  font-weight: 600;
}

.category-color-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-family: monospace;
  text-transform: uppercase;
}

.category-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.empty-message,
.loading-message {
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--spacing-lg);
}
</style>
