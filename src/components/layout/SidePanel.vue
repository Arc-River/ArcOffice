<script setup lang="ts">
import { ChatLineSquare, Cpu, Expand, Fold, FolderOpened, Grid, HomeFilled, Tools } from '@element-plus/icons-vue'
import { type Component, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import IconMcp from '@/components/icons/IconMcp.vue'
import IconSkills from '@/components/icons/IconSkills.vue'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const collapsed = ref(false)
const panelWidth = ref(200)
const isResizing = ref(false)

function _toggle() {
  collapsed.value = !collapsed.value
}

function _navigateTo(path: string) {
  router.push(path)
}

function _isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function _startResize(e: MouseEvent) {
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
  icon: Component | string
}

const _coreItems = computed<NavItem[]>(() => [
  { label: t('nav.home'), path: '/', icon: HomeFilled },
  { label: t('nav.chat'), path: '/chat', icon: ChatLineSquare },
  { label: t('nav.files'), path: '/files', icon: FolderOpened },
])

const _configItems = computed<NavItem[]>(() => [
  { label: t('nav.settings'), path: '/settings/general', icon: Tools },
  { label: t('nav.models'), path: '/settings/models', icon: Cpu },
  { label: t('nav.skills'), path: '/settings/skills', icon: IconSkills },
  { label: t('nav.mcp'), path: '/settings/mcp', icon: IconMcp },
])
</script>

<template>
  <aside
    class="side-panel"
    :class="{ 'side-panel--collapsed': collapsed, 'side-panel--resizing': isResizing }"
    :style="{ width: collapsed ? '40px' : panelWidth + 'px' }"
  >
    <div class="side-panel__header">
      <span v-if="!collapsed" class="side-panel__label">{{ t('nav.header') }}</span>
      <el-button
        class="side-panel__toggle"
        :icon="collapsed ? Expand : Fold"
        circle
        text
        size="small"
        :title="collapsed ? t('chat.sidebarExpand') : t('chat.sidebarCollapse')"
        @click="_toggle"
      />
    </div>
    <nav class="side-panel__nav" v-show="!collapsed">
      <div class="side-panel__group-label">{{ t('nav.groupCore') }}</div>
      <div class="side-panel__group">
        <button
          v-for="item in _coreItems"
          :key="item.path"
          class="side-panel__item"
          :class="{ 'side-panel__item--active': _isActive(item.path) }"
          @click="_navigateTo(item.path)"
        >
          <el-icon class="side-panel__item-icon"><img v-if="typeof item.icon === 'string'" :src="item.icon" width="16" height="16" /><component v-else :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </div>

      <div class="side-panel__sep"></div>

      <div class="side-panel__group-label">{{ t('nav.groupConfig') }}</div>
      <div class="side-panel__group">
        <button
          v-for="item in _configItems"
          :key="item.path"
          class="side-panel__item"
          :class="{ 'side-panel__item--active': _isActive(item.path) }"
          @click="_navigateTo(item.path)"
        >
          <el-icon class="side-panel__item-icon"><img v-if="typeof item.icon === 'string'" :src="item.icon" width="16" height="16" /><component v-else :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </div>

      <div class="side-panel__sep"></div>

      <div class="side-panel__group-label">{{ t('nav.groupExt') }}</div>
      <div class="side-panel__group">
        <div class="side-panel__item side-panel__item--disabled">
          <el-icon class="side-panel__item-icon"><Grid /></el-icon>
          <span>{{ t('nav.plugins') }}</span>
        </div>
      </div>
    </nav>
    <div
      v-if="!collapsed"
      class="side-panel__resize-handle"
      @mousedown="_startResize"
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
      --el-button-size: 24px;
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
    --el-button-size: 24px;
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
