import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'wall',
      component: () => import('./views/WallView.vue')
    },
    {
      path: '/case/:id',
      name: 'case-detail',
      component: () => import('./views/CaseDetailView.vue')
    }
  ]
})

export default router
