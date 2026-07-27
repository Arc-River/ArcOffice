import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '首页' },
  },
  {
    path: '/workbench',
    redirect: '/',
  },
  {
    path: '/batch',
    name: 'batch',
    component: () => import('@/views/BatchTask.vue'),
    meta: { title: '批量任务' },
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/views/Chat.vue'),
    meta: { title: '对话' },
  },
  {
    path: '/files',
    name: 'files',
    component: () => import('@/views/Files.vue'),
    meta: { title: '文件管理' },
  },
  {
    path: '/settings/general',
    name: 'settings-general',
    component: () => import('@/views/settings/General.vue'),
    meta: { title: '通用设置' },
  },
  {
    path: '/settings/models',
    name: 'settings-models',
    component: () => import('@/views/settings/Models.vue'),
    meta: { title: '模型配置' },
  },
  {
    path: '/settings/skills',
    name: 'settings-skills',
    component: () => import('@/views/settings/Skills.vue'),
    meta: { title: 'Skills' },
  },
  {
    path: '/settings/mcp',
    name: 'settings-mcp',
    component: () => import('@/views/settings/Mcp.vue'),
    meta: { title: 'MCP' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

export default router
