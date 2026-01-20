<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false
})
</script>

<template>
  <button
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--loading': loading }]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="btn-spinner" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Sizes */
.btn--sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
}

.btn--md {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-md);
}

.btn--lg {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-lg);
}

/* Variants */
.btn--primary {
  background: var(--color-primary);
  color: white;
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn--secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.btn--secondary:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
}

.btn--danger {
  background: var(--color-danger);
  color: white;
}

.btn--danger:hover:not(:disabled) {
  background: #c0392b;
}

.btn--ghost {
  background: transparent;
  color: var(--color-text);
}

.btn--ghost:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
}

/* Loading state */
.btn--loading {
  position: relative;
  color: transparent;
}

.btn-spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn--primary .btn-spinner,
.btn--danger .btn-spinner {
  border-color: rgba(255, 255, 255, 0.3);
  border-top-color: white;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
