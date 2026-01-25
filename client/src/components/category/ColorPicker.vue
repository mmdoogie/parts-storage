<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

interface Props {
  label?: string
  existingColors?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  existingColors: () => []
})

const model = defineModel<string>({ default: '#3498db' })

// Color conversion utilities
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

// Convert RGB to LAB for Delta-E calculation
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // RGB to XYZ
  let rNorm = r / 255
  let gNorm = g / 255
  let bNorm = b / 255

  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92

  const x = (rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375) * 100
  const y = (rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.0721750) * 100
  const z = (rNorm * 0.0193339 + gNorm * 0.1191920 + bNorm * 0.9503041) * 100

  // XYZ to LAB (D65 illuminant)
  const xn = 95.047
  const yn = 100.000
  const zn = 108.883

  const fx = x / xn > 0.008856 ? Math.pow(x / xn, 1/3) : (7.787 * x / xn) + 16/116
  const fy = y / yn > 0.008856 ? Math.pow(y / yn, 1/3) : (7.787 * y / yn) + 16/116
  const fz = z / zn > 0.008856 ? Math.pow(z / zn, 1/3) : (7.787 * z / zn) + 16/116

  const L = (116 * fy) - 16
  const a = 500 * (fx - fy)
  const bLab = 200 * (fy - fz)

  return [L, a, bLab]
}

// CIE76 Delta-E calculation
function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(lab1[0] - lab2[0], 2) +
    Math.pow(lab1[1] - lab2[1], 2) +
    Math.pow(lab1[2] - lab2[2], 2)
  )
}

function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return rgbToLab(r, g, b)
}

// Generate a set of candidate colors in LAB space
function generateCandidateColors(): string[] {
  const candidates: string[] = []

  // Generate colors using HSL for better distribution
  // Cover a range of hues, saturations, and lightnesses
  for (let h = 0; h < 360; h += 15) { // 24 hue steps
    for (let s = 50; s <= 100; s += 25) { // 3 saturation steps
      for (let l = 35; l <= 65; l += 15) { // 3 lightness steps
        candidates.push(hslToHex(h, s, l))
      }
    }
  }

  return candidates
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0

  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }

  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  )
}

// Generate 15 colors that are perceptually distinct from existing colors
function generateSuggestedColors(existingColors: string[]): string[] {
  const existingLabs = existingColors.map(hexToLab)
  const candidates = generateCandidateColors()
  const minDeltaE = 25 // Minimum perceptual difference threshold

  // Score each candidate by its minimum distance to existing colors
  const scored = candidates.map(hex => {
    const lab = hexToLab(hex)
    let minDist = Infinity

    for (const existingLab of existingLabs) {
      const dist = deltaE(lab, existingLab)
      minDist = Math.min(minDist, dist)
    }

    return { hex, lab, minDist }
  })

  // Sort by distance (prefer colors furthest from existing ones)
  scored.sort((a, b) => b.minDist - a.minDist)

  // Select top 15 colors that are also distinct from each other
  const selected: { hex: string; lab: [number, number, number] }[] = []

  for (const candidate of scored) {
    if (selected.length >= 15) break
    if (candidate.minDist < minDeltaE) continue

    // Check distance from already selected colors
    let farEnough = true
    for (const sel of selected) {
      if (deltaE(candidate.lab, sel.lab) < minDeltaE * 0.7) {
        farEnough = false
        break
      }
    }

    if (farEnough) {
      selected.push({ hex: candidate.hex, lab: candidate.lab })
    }
  }

  // If we don't have enough colors, relax the constraints
  if (selected.length < 15) {
    for (const candidate of scored) {
      if (selected.length >= 15) break
      if (selected.find(s => s.hex === candidate.hex)) continue
      selected.push({ hex: candidate.hex, lab: candidate.lab })
    }
  }

  return selected.map(s => s.hex)
}

// Compute suggested colors based on existing category colors
const suggestedColors = computed(() => {
  return generateSuggestedColors(props.existingColors)
})

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

const isCustomColor = computed(() => !suggestedColors.value.includes(model.value))
</script>

<template>
  <div class="color-picker">
    <label v-if="label" class="color-picker-label">{{ label }}</label>

    <p v-if="existingColors.length > 0" class="color-hint">
      Suggested colors optimized to be visually distinct from existing categories
    </p>

    <div class="color-grid">
      <button
        v-for="color in suggestedColors"
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

.color-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
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
