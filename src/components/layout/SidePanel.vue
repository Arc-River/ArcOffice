<script setup lang="ts">
import {
  ChatLineSquare,
  Connection,
  Cpu,
  EditPen,
  Expand,
  Fold,
  FolderOpened,
  Grid,
  HomeFilled,
  Setting,
  Tools,
} from '@element-plus/icons-vue'
import { type Component, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const panelWidth = ref(200)
const isResizing = ref(false)

function toggle() {
  collapsed.value = !collapsed.value
}

function navigateTo(path: string) {
  router.push(path)
}

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const startX = e.clientX
  const startWidth = panelWidth.value

  function onMouseMove(ev: MouseEvent) {
    const newWidth = Math.max(160, Math.min(400, startWidth + (ev.clientX - startX)))
    panelWidth.value = newWidth
  }

  function onMouseUp() {
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

interface NavItem {
  label: string
  path: string
  icon: Component
}

const coreItems: NavItem[] = [
  { label: '首页', path: '/', icon: HomeFilled },
  { label: '对话', path: '/chat', icon: ChatLineSquare },
  { label: '文件', path: '/files', icon: FolderOpened },
]

const configItems: NavItem[] = [
  { label: '通用', path: '/settings/general', icon: Tools },
  { label: '模型', path: '/settings/models', icon: Cpu },
  { label: 'Skills', path: '/settings/skills', icon: Setting },
  { label: 'MCP', path: '/settings/mcp', icon: Connection },
  { label: 'Prompt', path: '/settings/prompts', icon: EditPen },
]
</script>

<template>
  <aside
    class="side-panel"
    :class="{ 'side-panel--collapsed': collapsed, 'side-panel--resizing': isResizing }"
    :style="{ width: collapsed ? '40px' : panelWidth + 'px' }"
  >
    <div class="side-panel__header">
      <span v-if="!collapsed" class="side-panel__label">导航</span>
      <button class="side-panel__toggle" @click="toggle" :title="collapsed ? '展开' : '折叠'">
        <el-icon :size="16">
          <Fold v-if="!collapsed" />
          <Expand v-else />
        </el-icon>
      </button>
    </div>
    <nav class="side-panel__nav" v-show="!collapsed">
      <div class="side-panel__group-label">核心</div>
      <div class="side-panel__group">
        <button
          v-for="item in coreItems"
          :key="item.path"
          class="side-panel__item"
          :class="{ 'side-panel__item--active': isActive(item.path) }"
          @click="navigateTo(item.path)"
        >
          <el-icon class="side-panel__item-icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </div>

      <div class="side-panel__sep"></div>

      <div class="side-panel__group-label">配置</div>
      <div class="side-panel__group">
        <button
          v-for="item in configItems"
          :key="item.path"
          class="side-panel__item"
          :class="{ 'side-panel__item--active': isActive(item.path) }"
          @click="navigateTo(item.path)"
        >
          <el-icon class="side-panel__item-icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </div>

      <div class="side-panel__sep"></div>

      <div class="side-panel__group-label">扩展</div>
      <div class="side-panel__group">
        <div class="side-panel__item side-panel__item--disabled">
          <el-icon class="side-panel__item-icon"><Grid /></el-icon>
          <span>插件</span>
        </div>
      </div>
    </nav>
    <div
      v-if="!collapsed"
      class="side-panel__resize-handle"
      @mousedown="startResize"
    ></div>
  </aside>
</template>

<style lang="scss" scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  background: var(--arc-bg-page);
  border-right: 1px solid var(--arc-border);
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
  transition:
    width 250ms cubic-bezier(0.4, 0, 0.2, 1),
    background-color 200ms ease;

  &--resizing {
    transition: none;
  }

  &--collapsed {
    width: 40px !important;
    min-width: 40px;

    .side-panel__header {
      padding: 8px;
      justify-content: center;
      min-width: unset;
    }

    .side-panel__label,
    .side-panel__nav {
      display: none;
    }

    .side-panel__toggle {
      width: 24px;
      height: 24px;
      padding: 0;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--arc-space-sm) var(--arc-space-md);
    min-width: 240px;
  }

  &__label {
    @include font-body-sm;
    color: var(--arc-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  &__toggle {
    @include hoverable;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: var(--arc-radius-sm);
    font-size: 14px;
    color: var(--arc-text-secondary);
  }

  &__nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 var(--arc-space-xs);
    min-width: 240px;
    overflow-y: auto;
    flex: 1;
  }

  &__group-label {
    @include font-label-sm;
    color: var(--arc-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: var(--arc-space-sm) var(--arc-space-sm) var(--arc-space-xxs);
    margin-top: var(--arc-space-xxs);
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  &__sep {
    height: 1px;
    background: var(--arc-border);
    margin: var(--arc-space-xs) var(--arc-space-sm);
  }

  &__item {
    @include hoverable;
    display: flex;
    align-items: center;
    gap: var(--arc-space-xs);
    padding: var(--arc-space-xs) var(--arc-space-sm);
    border: none;
    background: transparent;
    border-radius: var(--arc-radius-md);
    @include font-body;
    color: var(--arc-text-primary);
    text-align: left;
    width: 100%;

    &--active {
      color: var(--arc-brand-blue);
      font-weight: 500;
      background: var(--arc-bg-hover);
    }

    &--disabled {
      opacity: 0.4;
      cursor: default;

      &:hover {
        background: transparent;
      }
    }

    &-icon {
      font-size: 16px;
      width: 20px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }

  &__resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 10;

    &:hover {
      background: var(--arc-brand-blue);
      opacity: 0.3;
    }
  }
}
</style>
