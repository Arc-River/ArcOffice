import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
    meta: { title: 'nav.home' },
  },
  {
    path: '/workbench',
    redirect: '/',
  },
  {
    path: '/batch',
    name: 'batch',
    component: () => import('@/views/BatchTask.vue'),
    meta: { title: 'nav.batch' },
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/views/Chat.vue'),
    meta: { title: 'nav.chat' },
  },
  {
    path: '/files',
    name: 'files',
    component: () => import('@/views/Files.vue'),
    meta: { title: 'nav.files' },
  },
  {
    path: '/office',
    name: 'office',
    component: () => import('@/views/OfficeEditorView.vue'),
    meta: { title: 'nav.office' },
  },
  {
    path: '/settings/general',
    name: 'settings-general',
    component: () => import('@/views/settings/General.vue'),
    meta: { title: 'settings.general.title' },
  },
  {
    path: '/settings/models',
    name: 'settings-models',
    component: () => import('@/views/settings/Models.vue'),
    meta: { title: 'settings.models.title' },
  },
  {
    path: '/settings/skills',
    name: 'settings-skills',
    component: () => import('@/views/settings/Skills.vue'),
    meta: { title: 'settings.skills.title' },
  },
  {
    path: '/settings/mcp',
    name: 'settings-mcp',
    component: () => import('@/views/settings/Mcp.vue'),
    meta: { title: 'settings.mcp.title' },
  },
  {
    path: '/settings/about',
    name: 'settings-about',
    component: () => import('@/views/settings/About.vue'),
    meta: { title: 'settings.about.title' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

export default router
