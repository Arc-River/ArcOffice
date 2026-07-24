<script setup lang="ts">
import { ArrowRight, DataAnalysis, Document, Film, Folder, FolderOpened, Search } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatFileSize, formatSmartDate } from '@/utils/format'
import { getElectronAPI } from '@/utils/ipc'

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
  { key: 'all', label: '全部', icon: Folder },
  { key: 'doc', label: '文档', icon: Document },
  { key: 'xls', label: '表格', icon: DataAnalysis },
  { key: 'ppt', label: '演示', icon: Film },
  { key: 'other', label: '其他', icon: FolderOpened },
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
    acc += '/' + p
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
  const fullPath = currentPath.value + '/' + entry.name
  if (entry.isDir) {
    navigateToDir(fullPath)
  } else {
    router.push({ path: '/chat', query: { file: fullPath } })
  }
}

onMounted(async () => {
  if (!api) {
    error.value = '未检测到 Electron API'
    return
  }
  try {
    const dir = await api.getConfig('working_dir')
    if (dir) {
      workingDir.value = dir
      await loadDirectory(dir)
    } else {
      error.value = '请先在「设置 → 通用」中配置工作目录'
    }
  } catch {
    error.value = '加载工作目录失败'
  }
})
</script>

<template>
  <div class="files">
    <div class="files__sidebar">
      <div class="files__sidebar-header">分类</div>
      <div class="files__categories">
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
        <div class="files__search">
          <el-icon :size="14"><Search /></el-icon>
          <input
            class="files__search-input"
            placeholder="搜索文件…"
            v-model="searchQuery"
          />
        </div>
        <button class="files__up" title="返回上级" @click="goUp" :disabled="currentPath === workingDir">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>

      <div class="files__breadcrumb" v-if="breadcrumbs.length > 0">
        <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.path">
          <span
            class="files__breadcrumb-item"
            :class="{ 'files__breadcrumb-item--active': idx === breadcrumbs.length - 1 }"
            @click="navigateToBreadcrumb(idx)"
          >{{ crumb.name }}</span>
          <span v-if="idx < breadcrumbs.length - 1" class="files__breadcrumb-sep">
            <el-icon :size="12"><ArrowRight /></el-icon>
          </span>
        </template>
      </div>

      <div v-if="loading" class="files__empty">
        <p class="files__empty-text">加载中…</p>
      </div>
      <div v-else-if="error" class="files__empty">
        <el-icon class="files__empty-icon" :size="48" color="var(--arc-danger)"><FolderOpened /></el-icon>
        <p class="files__empty-text">{{ error }}</p>
      </div>
      <div v-else-if="filteredEntries.length === 0" class="files__empty">
        <el-icon class="files__empty-icon" :size="48" color="var(--arc-text-placeholder)"><FolderOpened /></el-icon>
        <p class="files__empty-text">{{ searchQuery ? '无匹配文件' : '文件夹为空' }}</p>
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
            <div class="files__item-meta">{{ entry.isDir ? '文件夹' : formatFileSize(entry.size) }} · {{ formatSmartDate(entry.mtime) }}</div>
          </div>
          <button class="files__item-action" @click.stop="handleFileAction(entry)">
            {{ entry.isDir ? '打开' : '对话' }}
          </button>
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

  &__categories {
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
  }

  &__search {
    display: flex;
    align-items: center;
    gap: var(--arc-space-xs);
    padding: 4px 10px;
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-lg);
    max-width: 260px;
    flex: 1;
  }

  &__search-input {
    border: none;
    background: transparent;
    @include font-body-sm;
    color: var(--arc-text-primary);
    outline: none;
    width: 100%;

    &::placeholder {
      color: var(--arc-text-placeholder);
    }
  }

  &__up {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: var(--arc-radius-sm);
    color: var(--arc-text-secondary);
    cursor: pointer;
    flex-shrink: 0;

    &:hover {
      color: var(--arc-brand-blue);
      background: var(--arc-bg-hover);
    }

    &:disabled {
      opacity: 0.3;
      cursor: default;
      &:hover {
        background: transparent;
        color: var(--arc-text-secondary);
      }
    }
  }

  &__breadcrumb {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: var(--arc-space-xs) var(--arc-space-md);
    border-bottom: 1px solid var(--arc-border);
    @include font-body-sm;
    flex-wrap: wrap;

    &-item {
      color: var(--arc-text-secondary);
      cursor: pointer;
      padding: 0 2px;

      &:hover {
        color: var(--arc-brand-blue);
      }

      &--active {
        color: var(--arc-text-primary);
        font-weight: 500;
      }
    }

    &-sep {
      display: inline-flex;
      align-items: center;
      color: var(--arc-text-placeholder);
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

    &-action {
      @include font-button;
      height: 28px;
      padding: 0 12px;
      border-radius: var(--arc-radius-lg);
      border: none;
      background: var(--arc-brand-blue);
      color: #fff;
      cursor: pointer;
      flex-shrink: 0;

      &:hover {
        opacity: 0.9;
      }
    }
  }
}
</style>
