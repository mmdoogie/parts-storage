<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Case } from '@/types'
import { useCaseStore } from '@/stores'
import { markLocalMutation } from '@/composables/useDragDrop'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import ColorPicker from '@/components/category/ColorPicker.vue'

interface Props {
  open: boolean
  caseData: Case | null
  wallGridColumns?: number
}

const props = withDefaults(defineProps<Props>(), {
  wallGridColumns: 12
})

const emit = defineEmits<{
  close: []
  updated: [caseData: Case]
  deleted: [caseId: number]
}>()

const caseStore = useCaseStore()

// Form state
const name = ref('')
const internalColumns = ref(4)
const internalRows = ref(6)
const color = ref('#8B7355')

// Grid position state
const gridColumnStart = ref(1)
const gridColumnSpan = ref(4)
const gridRowStart = ref(1)
const gridRowSpan = ref(3)

// Loading and error state
const saving = ref(false)
const deleting = ref(false)
const errorMessage = ref('')

// Delete confirmation
const showDeleteConfirm = ref(false)

// Grid change warning
const showGridWarning = ref(false)
const gridWarningMessage = ref('')
const affectedDrawerCount = ref(0)

// Case color presets (wood/cabinet colors)
const caseColorPresets = [
  // Wood tones
  '#8B7355', '#A0522D', '#8B4513', '#D2691E',
  '#CD853F', '#DEB887', '#BC8F8F', '#F4A460',
  // Modern/Industrial
  '#2C3E50', '#34495E', '#5D6D7E', '#7F8C8D',
  '#95A5A6', '#BDC3C7', '#1A1A2E', '#16213E',
  // Colors
  '#3498DB', '#2980B9', '#1ABC9C', '#27AE60',
  '#E74C3C', '#9B59B6', '#F39C12', '#E67E22'
]

// Watch for case data changes to populate form
watch(() => props.caseData, (newCaseData) => {
  if (newCaseData) {
    name.value = newCaseData.name
    internalColumns.value = newCaseData.internalColumns
    internalRows.value = newCaseData.internalRows
    color.value = newCaseData.color
    gridColumnStart.value = newCaseData.gridColumnStart
    gridColumnSpan.value = newCaseData.gridColumnSpan
    gridRowStart.value = newCaseData.gridRowStart
    gridRowSpan.value = newCaseData.gridRowSpan
    showGridWarning.value = false
    gridWarningMessage.value = ''
    affectedDrawerCount.value = 0
    errorMessage.value = ''
    showDeleteConfirm.value = false
  }
}, { immediate: true })

// Check grid changes for drawer impact
function checkGridChanges() {
  if (!props.caseData) return

  const impact = caseStore.checkGridChangeImpact(
    props.caseData,
    internalColumns.value,
    internalRows.value
  )

  showGridWarning.value = impact.affected
  gridWarningMessage.value = impact.message
  affectedDrawerCount.value = impact.drawerCount
}

// Watch grid dimension changes
watch([internalColumns, internalRows], () => {
  checkGridChanges()
})

// Check if form has changes
const hasChanges = computed(() => {
  if (!props.caseData) return false
  return (
    name.value !== props.caseData.name ||
    internalColumns.value !== props.caseData.internalColumns ||
    internalRows.value !== props.caseData.internalRows ||
    color.value !== props.caseData.color ||
    gridColumnStart.value !== props.caseData.gridColumnStart ||
    gridColumnSpan.value !== props.caseData.gridColumnSpan ||
    gridRowStart.value !== props.caseData.gridRowStart ||
    gridRowSpan.value !== props.caseData.gridRowSpan
  )
})

// Computed max values for position inputs
const maxColumnStart = computed(() => {
  return props.wallGridColumns - gridColumnSpan.value + 1
})

async function saveChanges() {
  if (!props.caseData) return

  saving.value = true
  errorMessage.value = ''
  markLocalMutation() // Mark before API call so SSE events are ignored

  try {
    const updatedCase = await caseStore.updateCase(props.caseData.id, {
      name: name.value,
      internalColumns: internalColumns.value,
      internalRows: internalRows.value,
      color: color.value,
      gridColumnStart: gridColumnStart.value,
      gridColumnSpan: gridColumnSpan.value,
      gridRowStart: gridRowStart.value,
      gridRowSpan: gridRowSpan.value
    })

    emit('updated', updatedCase)
    emit('close')
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to save changes'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!props.caseData) return

  deleting.value = true
  errorMessage.value = ''
  markLocalMutation() // Mark before API call so SSE events are ignored

  try {
    await caseStore.deleteCase(props.caseData.id)
    emit('deleted', props.caseData.id)
    emit('close')
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to delete case'
  } finally {
    deleting.value = false
    showDeleteConfirm.value = false
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Case Properties"
    size="md"
    @close="handleClose"
  >
    <div class="case-properties-form" v-if="caseData">
      <!-- Error message -->
      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <!-- Case Name -->
      <BaseInput
        v-model="name"
        label="Case Name"
        placeholder="Enter case name..."
      />

      <!-- Wall Position -->
      <div class="form-section">
        <label class="section-label">Wall Position</label>
        <p class="section-description">
          Position and size of the case on the storage wall.
        </p>
        <div class="position-grid">
          <div class="dimension-field">
            <label>Column</label>
            <input
              type="number"
              v-model.number="gridColumnStart"
              :min="1"
              :max="maxColumnStart"
            />
          </div>
          <div class="dimension-field">
            <label>Row</label>
            <input
              type="number"
              v-model.number="gridRowStart"
              :min="1"
            />
          </div>
          <div class="dimension-field">
            <label>Width</label>
            <input
              type="number"
              v-model.number="gridColumnSpan"
              :min="1"
              :max="wallGridColumns"
            />
          </div>
          <div class="dimension-field">
            <label>Height</label>
            <input
              type="number"
              v-model.number="gridRowSpan"
              :min="1"
              :max="10"
            />
          </div>
        </div>
        <p class="dimension-hint">
          Position: Column {{ gridColumnStart }}-{{ gridColumnStart + gridColumnSpan - 1 }},
          Row {{ gridRowStart }}-{{ gridRowStart + gridRowSpan - 1 }}
        </p>
      </div>

      <!-- Grid Dimensions -->
      <div class="form-section">
        <label class="section-label">Internal Grid</label>
        <p class="section-description">
          Define the internal drawer grid for this case.
        </p>
        <div class="dimension-grid">
          <div class="dimension-field">
            <label>Columns</label>
            <input
              type="number"
              v-model.number="internalColumns"
              :min="1"
              :max="12"
            />
          </div>
          <div class="dimension-field">
            <label>Rows</label>
            <input
              type="number"
              v-model.number="internalRows"
              :min="1"
              :max="12"
            />
          </div>
        </div>
        <p class="dimension-hint">
          Grid: {{ internalColumns }} columns x {{ internalRows }} rows
          ({{ internalColumns * internalRows }} slots)
        </p>

        <!-- Grid change warning -->
        <div v-if="showGridWarning" class="warning-banner">
          <svg class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="warning-content">
            <strong>Warning:</strong> {{ gridWarningMessage }}
          </div>
        </div>
      </div>

      <!-- Case Color -->
      <div class="form-section">
        <label class="section-label">Case Color</label>
        <p class="section-description">
          Choose a color for the case frame and background.
        </p>
        <div class="color-picker-wrapper">
          <ColorPicker v-model="color" />
        </div>

        <!-- Quick color presets for cases -->
        <div class="quick-colors">
          <span class="quick-colors-label">Quick picks:</span>
          <div class="quick-colors-grid">
            <button
              v-for="presetColor in caseColorPresets.slice(0, 8)"
              :key="presetColor"
              type="button"
              class="quick-color-btn"
              :class="{ selected: color === presetColor }"
              :style="{ backgroundColor: presetColor }"
              @click="color = presetColor"
              :title="presetColor"
            />
          </div>
        </div>
      </div>

      <!-- Case Preview -->
      <div class="form-section">
        <label class="section-label">Preview</label>
        <div class="case-preview" :style="{ '--preview-color': color }">
          <div class="preview-header">
            <span class="preview-name">{{ name || 'Case Name' }}</span>
          </div>
          <div
            class="preview-grid"
            :style="{
              gridTemplateColumns: `repeat(${Math.min(internalColumns, 6)}, 1fr)`,
              gridTemplateRows: `repeat(${Math.min(internalRows, 4)}, 1fr)`
            }"
          >
            <div
              v-for="i in Math.min(internalColumns, 6) * Math.min(internalRows, 4)"
              :key="i"
              class="preview-slot"
            />
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="form-section danger-zone">
        <label class="section-label danger-label">Danger Zone</label>
        <div v-if="!showDeleteConfirm" class="delete-section">
          <p class="section-description">
            Permanently delete this case and all its drawers.
          </p>
          <BaseButton variant="danger" @click="showDeleteConfirm = true">
            Delete Case
          </BaseButton>
        </div>
        <div v-else class="delete-confirm">
          <p class="delete-warning">
            Are you sure? This will permanently delete this case and all {{ caseData?.drawers?.length || 0 }} drawer(s) inside.
          </p>
          <div class="delete-actions">
            <BaseButton variant="ghost" @click="showDeleteConfirm = false">
              Cancel
            </BaseButton>
            <BaseButton variant="danger" @click="handleDelete" :loading="deleting">
              Yes, Delete Case
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="handleClose">
        Cancel
      </BaseButton>
      <BaseButton
        @click="saveChanges"
        :loading="saving"
        :disabled="!hasChanges"
      >
        Save Changes
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.case-properties-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.error-banner {
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.section-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.section-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
}

.position-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-sm);
}

.dimension-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.dimension-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.dimension-field label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.dimension-field input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  width: 100%;
}

.dimension-field input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

.dimension-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
}

.warning-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(243, 156, 18, 0.1);
  border: 1px solid rgba(243, 156, 18, 0.3);
  border-radius: var(--radius-sm);
  color: #b7791f;
}

.warning-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-content {
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.warning-content strong {
  font-weight: 600;
}

.color-picker-wrapper {
  margin-top: var(--spacing-xs);
}

.quick-colors {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.quick-colors-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.quick-colors-grid {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.quick-color-btn {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-xs);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quick-color-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.quick-color-btn.selected {
  border-color: white;
  box-shadow: 0 0 0 2px var(--color-primary);
}

/* Case Preview */
.case-preview {
  background: var(--preview-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

.preview-header {
  padding: var(--spacing-xs) var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.preview-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.preview-grid {
  display: grid;
  gap: 2px;
  padding: var(--spacing-xs);
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);
}

.preview-slot {
  aspect-ratio: 1;
  min-height: 20px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(0, 0, 0, 0.05) 100%
  );
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* Danger Zone */
.danger-zone {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid rgba(231, 76, 60, 0.2);
}

.danger-label {
  color: var(--color-danger);
}

.delete-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.delete-confirm {
  background: rgba(231, 76, 60, 0.05);
  border: 1px solid rgba(231, 76, 60, 0.2);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
}

.delete-warning {
  margin: 0 0 var(--spacing-md) 0;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.delete-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}
</style>
