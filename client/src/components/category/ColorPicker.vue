<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  label?: string
}

defineProps<Props>()

const model = defineModel<string>({ default: '#3498db' })

// Predefined color palette for categories
const presetColors = [
  // Blues
  '#3498db', '#2980b9', '#1abc9c', '#16a085',
  // Greens
  '#2ecc71', '#27ae60', '#9b59b6', '#8e44ad',
  // Warm colors
  '#e74c3c', '#c0392b', '#e67e22', '#d35400',
  // Neutrals
  '#f39c12', '#f1c40f', '#95a5a6', '#7f8c8d',
  // Dark
  '#34495e', '#2c3e50', '#1a1a2e', '#16213e'
]

const showCustomInput = ref(false)
const customColor = ref(model.value)

watch(model, (newVal) => {
  customColor.value = newVal
})

function selectColor(color: string) {
  model.value = color
  showCustomInput.value = false
}

function applyCustomColor() {
  if (/^#[0-9A-Fa-f]{6}$/.test(customColor.value)) {
    model.value = customColor.value
  }
}

const isCustomColor = computed(() => !presetColors.includes(model.value))
</script>

<template>
  <div class="color-picker">
    <label v-if="label" class="color-picker-label">{{ label }}</label>

    <div class="color-grid">
      <button
        v-for="color in presetColors"
        :key="color"
        type="button"
        class="color-swatch"
        :class="{ selected: model === color }"
        :style="{ backgroundColor: color }"
        @click="selectColor(color)"
        :title="color"
      >
        <svg v-if="model === color" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M5 12l5 5L20 7" />
        </svg>
      </button>

      <!-- Custom color button -->
      <button
        type="button"
        class="color-swatch custom-swatch"
        :class="{ selected: isCustomColor }"
        :style="{ backgroundColor: isCustomColor ? model : '#ffffff' }"
        @click="showCustomInput = !showCustomInput"
        title="Custom color"
      >
        <svg v-if="!isCustomColor" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M5 12l5 5L20 7" />
        </svg>
      </button>
    </div>

    <!-- Custom color input -->
    <div v-if="showCustomInput" class="custom-color-input">
      <input
        v-model="customColor"
        type="color"
        class="color-input-native"
      />
      <input
        v-model="customColor"
        type="text"
        class="color-input-text"
        placeholder="#RRGGBB"
        maxlength="7"
        @blur="applyCustomColor"
        @keyup.enter="applyCustomColor"
      />
      <button
        type="button"
        class="apply-btn"
        @click="applyCustomColor"
      >
        Apply
      </button>
    </div>

    <!-- Current color preview -->
    <div class="current-color">
      <span class="current-color-preview" :style="{ backgroundColor: model }"></span>
      <span class="current-color-value">{{ model }}</span>
    </div>
  </div>
</template>

<style scoped>
.color-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.color-picker-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: var(--spacing-xs);
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.color-swatch:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.color-swatch.selected {
  border-color: white;
  box-shadow: 0 0 0 2px var(--color-primary);
}

.color-swatch svg {
  width: 16px;
  height: 16px;
  color: white;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.custom-swatch {
  border: 2px dashed rgba(0, 0, 0, 0.2);
}

.custom-swatch:not(.selected) svg {
  color: var(--color-text-muted);
  filter: none;
}

.custom-color-input {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
  padding: var(--spacing-sm);
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-sm);
}

.color-input-native {
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.color-input-text {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--font-size-sm);
  text-transform: uppercase;
}

.color-input-text:focus {
  outline: none;
  border-color: var(--color-primary);
}

.apply-btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.apply-btn:hover {
  background: var(--color-primary-dark);
}

.current-color {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-xs);
}

.current-color-preview {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-xs);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.current-color-value {
  font-family: monospace;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-transform: uppercase;
}
</style>
