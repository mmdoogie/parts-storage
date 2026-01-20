<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDrawerStore, useCategoryStore } from '@/stores'
import * as partService from '@/services/partService'
import * as drawerService from '@/services/drawerService'
import type { Part } from '@/types'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import PartCard from '@/components/part/PartCard.vue'

interface Props {
  open: boolean
  drawerId: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const drawerStore = useDrawerStore()
const categoryStore = useCategoryStore()

const isAddingPart = ref(false)
const newPartName = ref('')
const newPartNotes = ref('')
const loading = ref(false)
const showDeleteConfirm = ref(false)
const deleteLoading = ref(false)
const showCategoryPicker = ref(false)

const drawer = computed(() => {
  if (!props.drawerId) return null
  return drawerStore.drawers.get(props.drawerId) || null
})

const title = computed(() => {
  if (!drawer.value) return 'Drawer'
  return drawer.value.name || `Drawer ${drawer.value.id}`
})

watch(() => props.open, async (open) => {
  if (open && props.drawerId) {
    await drawerStore.fetchDrawer(props.drawerId)
    await categoryStore.fetchCategories()
  }
})

async function addPart() {
  if (!newPartName.value.trim() || !props.drawerId) return

  loading.value = true
  try {
    const part = await partService.createPart({
      drawerId: props.drawerId,
      name: newPartName.value.trim(),
      notes: newPartNotes.value.trim() || undefined
    })

    // Refresh drawer to get updated parts
    await drawerStore.fetchDrawer(props.drawerId)

    newPartName.value = ''
    newPartNotes.value = ''
    isAddingPart.value = false
  } catch (e) {
    console.error('Failed to add part:', e)
  } finally {
    loading.value = false
  }
}

async function deletePart(partId: number) {
  if (!props.drawerId) return

  try {
    await partService.deletePart(partId)
    await drawerStore.fetchDrawer(props.drawerId)
  } catch (e) {
    console.error('Failed to delete part:', e)
  }
}

async function updatePart(partId: number, data: Partial<Part>) {
  if (!props.drawerId) return

  try {
    await partService.updatePart(partId, data)
    await drawerStore.fetchDrawer(props.drawerId)
  } catch (e) {
    console.error('Failed to update part:', e)
  }
}

async function addLink(partId: number, url: string, title?: string) {
  if (!props.drawerId) return

  try {
    await partService.addLinkToPart(partId, { url, title })
    await drawerStore.fetchDrawer(props.drawerId)
  } catch (e) {
    console.error('Failed to add link:', e)
  }
}

async function deleteLink(linkId: number) {
  if (!props.drawerId) return

  try {
    await partService.deleteLink(linkId)
    await drawerStore.fetchDrawer(props.drawerId)
  } catch (e) {
    console.error('Failed to delete link:', e)
  }
}

async function addCategory(categoryId: number) {
  if (!props.drawerId) return

  try {
    await drawerService.addCategoryToDrawer(props.drawerId, categoryId)
    await drawerStore.fetchDrawer(props.drawerId)
    showCategoryPicker.value = false
  } catch (e) {
    console.error('Failed to add category:', e)
  }
}

async function removeCategory(categoryId: number) {
  if (!props.drawerId) return

  try {
    await drawerService.removeCategoryFromDrawer(props.drawerId, categoryId)
    await drawerStore.fetchDrawer(props.drawerId)
  } catch (e) {
    console.error('Failed to remove category:', e)
  }
}

function getAvailableCategories() {
  const drawerCatIds = new Set(drawer.value?.categories?.map(c => c.id) || [])
  return categoryStore.categories.filter(c => !drawerCatIds.has(c.id))
}

async function deleteDrawer() {
  if (!props.drawerId) return
  deleteLoading.value = true
  try {
    await drawerStore.deleteDrawer(props.drawerId)
    emit('close')
  } catch (e) {
    console.error('Failed to delete drawer:', e)
  } finally {
    deleteLoading.value = false
    showDeleteConfirm.value = false
  }
}
</script>

<template>
  <BaseModal :open="open" :title="title" size="lg" @close="emit('close')">
    <div class="drawer-content">
      <!-- Drawer name editing -->
      <div v-if="drawer" class="drawer-name-section">
        <div class="drawer-name-row">
          <BaseInput
            :model-value="drawer.name || ''"
            label="Drawer Name"
            placeholder="Optional drawer name..."
            @update:model-value="val => drawerStore.updateDrawer(drawer!.id, { name: val || null })"
          />
          <BaseButton
            v-if="drawer.name"
            size="sm"
            variant="ghost"
            class="clear-name-btn"
            title="Clear drawer name"
            @click="drawerStore.updateDrawer(drawer!.id, { name: null })"
          >
            Clear
          </BaseButton>
        </div>
      </div>

      <!-- Categories section -->
      <div v-if="drawer" class="categories-section">
        <h3>Categories</h3>
        <div class="category-tags">
          <span
            v-for="cat in drawer.categories"
            :key="cat.id"
            class="category-tag"
            :style="{ '--cat-color': cat.color }"
          >
            {{ cat.name }}
            <button class="tag-remove" @click="removeCategory(cat.id)">×</button>
          </span>
          <button class="add-category-btn" @click="showCategoryPicker = !showCategoryPicker">
            + Category
          </button>
        </div>
        <div v-if="showCategoryPicker" class="category-picker">
          <button
            v-for="cat in getAvailableCategories()"
            :key="cat.id"
            class="category-option"
            :style="{ '--cat-color': cat.color }"
            @click="addCategory(cat.id)"
          >
            {{ cat.name }}
          </button>
          <p v-if="!getAvailableCategories().length" class="no-categories">
            No more categories available
          </p>
        </div>
      </div>

      <!-- Delete drawer section -->
      <div v-if="drawer" class="delete-section">
        <BaseButton
          v-if="!showDeleteConfirm"
          variant="danger"
          size="sm"
          @click="showDeleteConfirm = true"
        >
          Delete Drawer
        </BaseButton>

        <div v-else class="delete-confirm">
          <p class="delete-warning">
            Are you sure you want to delete this drawer?
            <span v-if="drawer.parts?.length">
              This will also delete {{ drawer.parts.length }} part{{ drawer.parts.length === 1 ? '' : 's' }}.
            </span>
          </p>
          <div class="delete-actions">
            <BaseButton
              size="sm"
              variant="ghost"
              @click="showDeleteConfirm = false"
              :disabled="deleteLoading"
            >
              Cancel
            </BaseButton>
            <BaseButton
              size="sm"
              variant="danger"
              :loading="deleteLoading"
              @click="deleteDrawer"
            >
              Delete
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Parts list -->
      <div class="parts-section">
        <div class="parts-header">
          <h3>Parts</h3>
          <BaseButton
            v-if="!isAddingPart"
            size="sm"
            @click="isAddingPart = true"
          >
            Add Part
          </BaseButton>
        </div>

        <!-- Add part form -->
        <div v-if="isAddingPart" class="add-part-form">
          <BaseInput
            v-model="newPartName"
            label="Part Name"
            placeholder="Enter part name..."
          />
          <div class="notes-field">
            <label class="input-label">Notes</label>
            <textarea
              v-model="newPartNotes"
              placeholder="Optional notes..."
              class="notes-textarea"
            />
          </div>
          <div class="form-actions">
            <BaseButton size="sm" @click="addPart" :loading="loading">
              Save
            </BaseButton>
            <BaseButton size="sm" variant="ghost" @click="isAddingPart = false">
              Cancel
            </BaseButton>
          </div>
        </div>

        <!-- Parts list -->
        <div v-if="drawer?.parts?.length" class="parts-list">
          <PartCard
            v-for="part in drawer.parts"
            :key="part.id"
            :part="part"
            @update="(data) => updatePart(part.id, data)"
            @delete="deletePart(part.id)"
            @add-link="({ url, title }) => addLink(part.id, url, title)"
            @delete-link="deleteLink"
          />
        </div>

        <p v-else-if="!isAddingPart" class="no-parts">
          No parts in this drawer yet.
        </p>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.drawer-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.drawer-name-section {
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.drawer-name-row {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-sm);
}

.drawer-name-row .input-group {
  flex: 1;
}

.clear-name-btn {
  flex-shrink: 0;
  margin-bottom: 2px;
}

.parts-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.parts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.parts-header h3 {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin: 0;
}

.add-part-form {
  background: rgba(0, 0, 0, 0.03);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.notes-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.input-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.notes-textarea {
  padding: var(--spacing-sm);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
}

.notes-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

.form-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.parts-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.no-parts {
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--spacing-lg);
}

.delete-section {
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.delete-confirm {
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.delete-warning {
  margin: 0 0 var(--spacing-md) 0;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.delete-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

.categories-section {
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.categories-section h3 {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin: 0 0 var(--spacing-sm) 0;
}

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.category-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--cat-color);
  color: white;
  border-radius: 12px;
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.tag-remove {
  color: inherit;
  opacity: 0.7;
  font-size: 14px;
  line-height: 1;
}

.tag-remove:hover {
  opacity: 1;
}

.add-category-btn {
  padding: 4px 10px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  border: 1px dashed currentColor;
  border-radius: 12px;
  transition: all var(--transition-fast);
}

.add-category-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.category-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-sm);
}

.category-option {
  padding: 4px 12px;
  background: var(--cat-color);
  color: white;
  border-radius: 12px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.category-option:hover {
  transform: scale(1.05);
}

.no-categories {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
}
</style>
