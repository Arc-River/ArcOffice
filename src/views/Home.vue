<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: used in template only
import { DataAnalysis, Document, Film } from '@element-plus/icons-vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ViewHome' })

import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()

// biome-ignore lint/correctness/noUnusedVariables: used in template
const recentFiles = ref<{ name: string; type: string; size: string; date: string }[]>([])
const isDragOver = ref(false)

// biome-ignore lint/correctness/noUnusedVariables: used in template
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function handleDragLeave() {
  isDragOver.value = false
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  // TODO: handle file drop with IPC
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function openFile() {
  // TODO: open file dialog via IPC
  router.push('/files')
}
</script>

<template>
  <div
    class="home"
    :class="{ 'home--dragover': isDragOver }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div class="home__hero">
      <div class="home__logo">
        <img src="/logo.svg" alt="ArcOffice" width="64" height="64" />
      </div>
      <h1 class="home__title">ArcOffice</h1>
      <p class="home__subtitle">{{ t('home.subtitle') }}</p>
      <div class="home__actions">
        <el-button type="primary" size="large" @click="router.push('/chat')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px;">
            <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-1 4v3H8v2h3v3h2v-3h3v-2h-3V8h-2z" />
          </svg>
          {{ t('home.startChat') }}
        </el-button>
        <el-button size="large" @click="openFile">{{ t('home.openFile') }}</el-button>
      </div>
      <p class="home__hint">{{ t('home.dropHint') }}</p>
    </div>

    <div class="home__drop-zone" v-if="isDragOver">
      <div class="home__drop-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="2" width="8" height="8" rx="1.5" fill="var(--arc-brand-blue)" />
          <rect x="14" y="2" width="8" height="8" rx="1.5" fill="var(--arc-brand-blue)" opacity="0.7" />
          <rect x="2" y="14" width="8" height="8" rx="1.5" fill="var(--arc-brand-blue)" opacity="0.7" />
          <rect x="14" y="14" width="8" height="8" rx="1.5" fill="var(--arc-brand-blue)" />
        </svg>
        <p class="home__drop-text">{{ t('home.dropOverlay') }}</p>
      </div>
    </div>

    <div class="home__recent" v-if="recentFiles.length > 0">
      <h2 class="home__recent-title">{{ t('home.recentFiles') }}</h2>
      <div class="home__recent-list">
        <div
          v-for="file in recentFiles"
          :key="file.name"
          class="home__recent-item"
          @click="router.push('/chat')"
        >
          <span class="home__recent-icon">
            <el-icon :size="20">
              <Document v-if="file.type === 'doc'" />
              <DataAnalysis v-else-if="file.type === 'xls'" />
              <Film v-else />
            </el-icon>
          </span>
          <span class="home__recent-name">{{ file.name }}</span>
          <span class="home__recent-meta">{{ file.size }} · {{ file.date }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.home {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--arc-space-lg);
  gap: var(--arc-space-xl);
  transition: background-color 200ms ease;

  &--dragover {
    background: color-mix(in srgb, var(--arc-brand-blue) 4%, transparent);
  }

  &__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--arc-space-md);
    text-align: center;
    max-width: 480px;
  }

  &__logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 96px;
    height: 96px;
    background: var(--arc-bg-canvas);
    border-radius: var(--arc-radius-xl);
    border: 1px solid var(--arc-border);
    margin-bottom: var(--arc-space-xs);
  }

  &__title {
    @include font-display;
    color: var(--arc-text-primary);
  }

  &__subtitle {
    @include font-body;
    color: var(--arc-text-secondary);
  }

  &__actions {
    display: flex;
    gap: var(--arc-space-sm);
    margin-top: var(--arc-space-sm);
  }

  &__hint {
    @include font-body-sm;
    color: var(--arc-text-placeholder);
    margin-top: var(--arc-space-xs);
  }

  &__drop-zone {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--arc-brand-blue) 6%, transparent);
    border: 2px dashed var(--arc-brand-blue);
    border-radius: var(--arc-radius-xl);
    z-index: 10;
  }

  &__drop-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--arc-space-sm);
  }

  &__drop-text {
    @include font-title;
    color: var(--arc-brand-blue);
  }

  &__recent {
    width: 100%;
    max-width: 560px;
  }

  &__recent-title {
    @include font-title-sm;
    color: var(--arc-text-primary);
    margin-bottom: var(--arc-space-sm);
  }

  &__recent-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__recent-item {
    display: flex;
    align-items: center;
    gap: var(--arc-space-sm);
    padding: var(--arc-space-xs) var(--arc-space-sm);
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-lg);
    cursor: pointer;
    transition: box-shadow 200ms;

    &:hover {
      box-shadow: var(--arc-shadow-sm);
    }
  }

  &__recent-icon {
    font-size: 20px;
    width: 28px;
    text-align: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &__recent-name {
    @include font-body;
    font-weight: 500;
    color: var(--arc-text-primary);
    flex: 1;
    min-width: 0;
  }

  &__recent-meta {
    @include font-body-xs;
    color: var(--arc-text-secondary);
    flex-shrink: 0;
  }
}
</style>
