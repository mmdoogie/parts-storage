<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'

interface Props {
  open: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

const emit = defineEmits<{
  close: []
}>()

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    emit('close')
  }
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}

watch(() => props.open, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @click="handleBackdropClick">
        <div class="modal" :class="`modal--${size}`" role="dialog" aria-modal="true">
          <header v-if="title || $slots.header" class="modal-header">
            <slot name="header">
              <h2 class="modal-title">{{ title }}</h2>
            </slot>
            <button class="modal-close" @click="emit('close')" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
  z-index: var(--z-modal-backdrop);
}

.modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-height: calc(100vh - var(--spacing-xl) * 2);
  display: flex;
  flex-direction: column;
  z-index: var(--z-modal);
}

.modal--sm { width: 100%; max-width: 400px; }
.modal--md { width: 100%; max-width: 560px; }
.modal--lg { width: 100%; max-width: 720px; }
.modal--xl { width: 100%; max-width: 960px; }

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.modal-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0;
}

.modal-close {
  padding: var(--spacing-xs);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--color-text);
}

.modal-close svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-normal);
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform var(--transition-normal), opacity var(--transition-normal);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.95);
  opacity: 0;
}
</style>
