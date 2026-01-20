<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as caseService from '@/services/caseService'
import type { Case } from '@/types'

const route = useRoute()
const router = useRouter()

const caseData = ref<Case | null>(null)
const loading = ref(true)

onMounted(async () => {
  const id = parseInt(route.params.id as string)
  if (isNaN(id)) {
    router.push('/')
    return
  }

  try {
    caseData.value = await caseService.getCase(id)
  } catch {
    router.push('/')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="case-detail-view">
    <div v-if="loading" class="loading">Loading case...</div>
    <div v-else-if="caseData" class="case-content">
      <header class="case-header">
        <button class="back-btn" @click="router.push('/')">
          ← Back to Wall
        </button>
        <h1>{{ caseData.name }}</h1>
      </header>
      <!-- TODO: Implement detailed case view with editing -->
      <p>Case detail view coming soon...</p>
    </div>
  </div>
</template>

<style scoped>
.case-detail-view {
  padding: var(--spacing-lg);
}

.loading {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-muted);
}

.case-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.back-btn {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
}

.case-header h1 {
  margin: 0;
  font-size: var(--font-size-xl);
}
</style>
