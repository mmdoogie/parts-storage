<script setup lang="ts">
import { ref } from 'vue'
import type { Part } from '@/types'
import BaseButton from '@/components/base/BaseButton.vue'

interface Props {
  part: Part
}

const props = defineProps<Props>()

const emit = defineEmits<{
  update: [data: Partial<Part>]
  delete: []
  'add-link': [data: { url: string; title?: string }]
  'delete-link': [linkId: number]
}>()

const isEditing = ref(false)
const editName = ref('')
const editNotes = ref('')
const isAddingLink = ref(false)
const newLinkUrl = ref('')
const newLinkTitle = ref('')

function startEdit() {
  editName.value = props.part.name
  editNotes.value = props.part.notes || ''
  isEditing.value = true
}

function saveEdit() {
  emit('update', {
    name: editName.value,
    notes: editNotes.value || null
  })
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}

function addLink() {
  if (!newLinkUrl.value.trim()) return
  emit('add-link', {
    url: newLinkUrl.value.trim(),
    title: newLinkTitle.value.trim() || undefined
  })
  newLinkUrl.value = ''
  newLinkTitle.value = ''
  isAddingLink.value = false
}
</script>

<template>
  <div class="part-card">
    <!-- View mode -->
    <template v-if="!isEditing">
      <div class="part-header">
        <h4 class="part-name">{{ part.name }}</h4>
        <div class="part-actions">
          <button class="icon-btn" @click="startEdit" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button class="icon-btn icon-btn--danger" @click="emit('delete')" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Notes -->
      <p v-if="part.notes" class="part-notes">{{ part.notes }}</p>

      <!-- Links -->
      <div v-if="part.links?.length" class="part-links">
        <div v-for="link in part.links" :key="link.id" class="link-item">
          <a :href="link.url" target="_blank" rel="noopener">
            {{ link.title || link.url }}
          </a>
          <button class="link-remove" @click="emit('delete-link', link.id)">×</button>
        </div>
      </div>

      <!-- Add link -->
      <div v-if="!isAddingLink" class="add-link-trigger">
        <button @click="isAddingLink = true">+ Add Link</button>
      </div>
      <div v-else class="add-link-form">
        <input
          v-model="newLinkUrl"
          type="url"
          placeholder="URL"
          class="link-input"
        />
        <input
          v-model="newLinkTitle"
          type="text"
          placeholder="Title (optional)"
          class="link-input"
        />
        <div class="link-actions">
          <BaseButton size="sm" @click="addLink">Add</BaseButton>
          <BaseButton size="sm" variant="ghost" @click="isAddingLink = false">Cancel</BaseButton>
        </div>
      </div>
    </template>

    <!-- Edit mode -->
    <template v-else>
      <div class="edit-form">
        <input
          v-model="editName"
          type="text"
          placeholder="Part name"
          class="edit-input"
        />
        <textarea
          v-model="editNotes"
          placeholder="Notes..."
          class="edit-textarea"
        />
        <div class="edit-actions">
          <BaseButton size="sm" @click="saveEdit">Save</BaseButton>
          <BaseButton size="sm" variant="ghost" @click="cancelEdit">Cancel</BaseButton>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.part-card {
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.part-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.part-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin: 0;
  word-break: break-word;
}

.part-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.icon-btn {
  padding: var(--spacing-xs);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text);
}

.icon-btn--danger:hover {
  color: var(--color-danger);
}

.icon-btn svg {
  width: 16px;
  height: 16px;
}

.part-notes {
  margin: var(--spacing-sm) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  white-space: pre-wrap;
}

.part-links {
  margin-top: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.link-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.link-item a {
  font-size: var(--font-size-sm);
  word-break: break-all;
}

.link-remove {
  color: var(--color-text-muted);
  font-size: 16px;
}

.link-remove:hover {
  color: var(--color-danger);
}

.add-link-trigger {
  margin-top: var(--spacing-sm);
}

.add-link-trigger button {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
}

.add-link-form {
  margin-top: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.link-input {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.link-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.link-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.edit-input {
  padding: var(--spacing-sm);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-weight: 600;
}

.edit-textarea {
  padding: var(--spacing-sm);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  min-height: 60px;
  resize: vertical;
  font-family: inherit;
}

.edit-input:focus,
.edit-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.edit-actions {
  display: flex;
  gap: var(--spacing-sm);
}
</style>
