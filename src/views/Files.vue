<script setup lang="ts">
import {
  ArrowRight,
  ArrowUp,
  ChatLineSquare,
  DataAnalysis,
  Document,
  Film,
  Folder,
  FolderOpened,
  Pointer,
  Search,
} from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'

defineOptions({ name: 'ViewFiles' })

import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { getElectronAPI } from '@/utils/ipc'

const { t } = useI18n()

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatSmartDate(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutesAgo', { n: minutes })
  if (hours < 24) return t('time.hoursAgo', { n: hours })
  if (days < 7) return t('time.daysAgo', { n: days })
  return new Date(dateStr).toLocaleDateString()
}

const api = getElectronAPI()
const router = useRouter()

interface FileEntry {
  name: string
  isDir: boolean
  size: number
  mtime: string
}

interface CategoryItem {
  key: string
  label: string
  icon: unknown
}

const currentPath = ref('')
const entries = ref<FileEntry[]>([])
const breadcrumbs = ref<{ name: string; path: string }[]>([])
const activeCategory = ref('all')
const searchQuery = ref('')
const loading = ref(false)
const error = ref('')
const workingDir = ref('')

const categories: CategoryItem[] = [
  { key: 'all', label: t('files.categories.all'), icon: Folder },
  { key: 'doc', label: t('files.categories.doc'), icon: Document },
  { key: 'xls', label: t('files.categories.xls'), icon: DataAnalysis },
  { key: 'ppt', label: t('files.categories.ppt'), icon: Film },
  { key: 'other', label: t('files.categories.other'), icon: FolderOpened },
]

const fileTypeIcon: Record<string, unknown> = {
  doc: Document,
  xls: DataAnalysis,
  ppt: Film,
}

const filteredEntries = computed(() => {
  let list = entries.value

  // Category filter
  if (activeCategory.value !== 'all') {
    list = list.filter((e) => {
      const cat = getFileCategory(e)
      return cat === activeCategory.value || (activeCategory.value === 'other' && cat === 'other')
    })
  }

  // Search filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((e) => e.name.toLowerCase().includes(q))
  }

  return list
})

function getFileCategory(entry: FileEntry): string {
  if (entry.isDir) return 'all'
  const ext = entry.name.split('.').pop()?.toLowerCase() || ''
  if (
    [
      'docx',
      'doc',
      'txt',
      'md',
      'pdf',
      'json',
      'js',
      'ts',
      'vue',
      'css',
      'scss',
      'html',
      'xml',
      'yaml',
      'yml',
      'toml',
      'py',
      'rs',
      'java',
      'go',
    ].includes(ext)
  )
    return 'doc'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'xls'
  if (['pptx', 'ppt'].includes(ext)) return 'ppt'
  return 'other'
}

function getFileIcon(entry: FileEntry): unknown {
  if (entry.isDir) return Folder
  const cat = getFileCategory(entry)
  return fileTypeIcon[cat] || Document
}

function updateBreadcrumbs(dirPath: string) {
  const parts = dirPath.split('/').filter(Boolean)
  const crumbs: { name: string; path: string }[] = []
  let acc = ''
  for (const p of parts) {
    acc += `/${p}`
    crumbs.push({ name: p, path: acc })
  }
  breadcrumbs.value = crumbs
}

async function loadDirectory(dirPath: string) {
  if (!api) return
  loading.value = true
  error.value = ''
  try {
    currentPath.value = dirPath
    updateBreadcrumbs(dirPath)
    const result = await api.listDirectory(dirPath)
    entries.value = result
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    entries.value = []
  } finally {
    loading.value = false
  }
}

function navigateToDir(dirPath: string) {
  loadDirectory(dirPath)
}

function navigateToBreadcrumb(index: number) {
  navigateToDir(breadcrumbs.value[index].path)
}

function goUp() {
  const parent = currentPath.value.split('/').slice(0, -1).join('/') || '/'
  navigateToDir(parent)
}

function handleFileAction(entry: FileEntry) {
  const fullPath = `${currentPath.value}/${entry.name}`
  if (entry.isDir) {
    navigateToDir(fullPath)
  } else {
    router.push({ path: '/chat', query: { file: fullPath } })
  }
}

onMounted(async () => {
  if (!api) {
    error.value = t('files.noElectron')
    return
  }
  try {
    const dir = await api.getConfig('working_dir')
    if (dir) {
      workingDir.value = dir
      await loadDirectory(dir)
    } else {
      error.value = t('files.noWorkDir')
    }
  } catch {
    error.value = t('files.loadFailed')
  }
})
</script>

<template>
  <div class="files">
    <div class="files__sidebar">
      <div class="files__sidebar-header">{{ t('files.sidebarTitle') }}</div>
      <div class="files_categories">
        <button
          v-for="cat in categories"
          :key="cat.key"
          class="files__category"
          :class="{ 'files__category--active': activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          <el-icon :size="16"><component :is="cat.icon" /></el-icon>
          <span>{{ cat.label }}</span>
        </button>
      </div>
    </div>
    <div class="files__main">
      <div class="files__toolbar">
        <el-input
          v-model="searchQuery"
          :placeholder="t('files.searchPlaceholder')"
          size="small"
          clearable
          :prefix-icon="Search"
          class="files__search"
        />
        <el-button
          class="files__up"
          :icon="ArrowUp"
          circle
          text
          size="small"
          :title="t('files.goUp')"
          @click="goUp"
          :disabled="currentPath === workingDir"
        />
      </div>

      <el-breadcrumb v-if="breadcrumbs.length > 0" class="files__breadcrumb" :separator-icon="ArrowRight">
        <el-breadcrumb-item v-for="(crumb, idx) in breadcrumbs" :key="crumb.path">
          <a
            class="files__breadcrumb-link"
            :class="{ 'files__breadcrumb-link--active': idx === breadcrumbs.length - 1 }"
            @click="navigateToBreadcrumb(idx)"
          >{{ crumb.name }}</a>
        </el-breadcrumb-item>
      </el-breadcrumb>

      <div v-if="loading" class="files__empty">
        <p class="files__empty-text">{{ t('files.loading') }}</p>
      </div>
      <div v-else-if="error" class="files__empty">
        <el-icon class="files__empty-icon" :size="48" color="var(--arc-danger)"><FolderOpened /></el-icon>
        <p class="files__empty-text">{{ error }}</p>
      </div>
      <div v-else-if="filteredEntries.length === 0" class="files__empty">
        <el-icon class="files__empty-icon" :size="48" color="var(--arc-text-placeholder)"><FolderOpened /></el-icon>
        <p class="files__empty-text">{{ searchQuery ? t('files.noMatch') : t('files.emptyFolder') }}</p>
      </div>
      <div v-else class="files__list">
        <div
          v-for="entry in filteredEntries"
          :key="entry.name"
          class="files__item"
          :class="{ 'files__item--folder': entry.isDir }"
          @click="handleFileAction(entry)"
        >
          <span class="files__item-icon">
            <el-icon :size="24"><component :is="getFileIcon(entry)" /></el-icon>
          </span>
          <div class="files__item-info">
            <div class="files__item-name">{{ entry.name }}</div>
            <div class="files__item-meta">{{ entry.isDir ? t('files.folder') : formatFileSize(entry.size) }} · {{ formatSmartDate(entry.mtime) }}</div>
          </div>
          <el-button text @click.stop="handleFileAction(entry)" :type="entry.isDir ? 'success' : 'primary'" size="small" :icon="entry.isDir ? Pointer : ChatLineSquare">
            {{ entry.isDir ? t('files.open') : t('files.chatAction') }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.files {
  display: flex;
  height: 100%;
  overflow: hidden;

  &__sidebar {
    width: 180px;
    flex-shrink: 0;
    background: var(--arc-bg-page);
    border-right: 1px solid var(--arc-border);
    display: flex;
    flex-direction: column;
  }

  &__sidebar-header {
    @include font-label-sm;
    padding: var(--arc-space-sm) var(--arc-space-md);
    color: var(--arc-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  &_categories {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 var(--arc-space-xs);
  }

  &__category {
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

    &--active {
      color: var(--arc-brand-blue);
      font-weight: 500;
      background: var(--arc-bg-hover);
    }
  }

  &__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--arc-space-sm) var(--arc-space-md);
    border-bottom: 1px solid var(--arc-border);

    // el-input inside toolbar
    :deep(.el-input) {
      max-width: 260px;
    }
  }

  &__search {
    max-width: 260px;
  }

  &__up {
    flex-shrink: 0;
  }

  &__breadcrumb {
    padding: var(--arc-space-xs) var(--arc-space-md);
    border-bottom: 1px solid var(--arc-border);

    &-link {
      color: var(--arc-text-secondary);
      text-decoration: none;

      &:hover {
        color: var(--arc-brand-blue);
      }

      &--active {
        color: var(--arc-text-primary);
        font-weight: 500;
      }
    }
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: var(--arc-space-sm);
  }

  &__empty-icon {
    margin-bottom: var(--arc-space-xs);
  }

  &__empty-text {
    @include font-title;
    color: var(--arc-text-primary);
  }

  &__empty-hint {
    @include font-body-sm;
    color: var(--arc-text-placeholder);
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: var(--arc-space-sm);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__item {
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

    &--folder {
      cursor: pointer;
    }

    &-icon {
      width: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    &-info {
      flex: 1;
      min-width: 0;
    }

    &-name {
      @include font-body;
      font-weight: 500;
      color: var(--arc-text-primary);
    }

    &-meta {
      @include font-body-xs;
      color: var(--arc-text-secondary);
    }

  }
}
</style>
