<script setup lang="ts">
interface Props {
  label?: string
  error?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'url'
  placeholder?: string
}

withDefaults(defineProps<Props>(), {
  type: 'text'
})

const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="input-group" :class="{ 'has-error': error }">
    <label v-if="label" class="input-label">{{ label }}</label>
    <input
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      class="input-field"
    />
    <span v-if="error" class="input-error">{{ error }}</span>
  </div>
</template>

<style scoped>
.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.input-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.input-field {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  transition: all var(--transition-fast);
}

.input-field:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

.has-error .input-field {
  border-color: var(--color-danger);
}

.has-error .input-field:focus {
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.2);
}

.input-error {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}
</style>
