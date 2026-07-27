<script setup lang="ts">
import { Document, Download, EditPen, Upload } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'
import { getElectronAPI, isElectron } from '@/utils/ipc'

declare const __ONLYOFFICE_CDN__: string

import { type FileType, OFFICE_THEME, type OfficeThemeId } from '@/components/onlyoffice/const'
import { OnlyOfficeManager, onlyOfficeManagerFactory } from '@/components/onlyoffice/core/onlyoffice-manager'
import { setCurrentLang } from '@/components/onlyoffice/store/lang'
import { getFileTypeConstant, getOnlyOfficeMimeType } from '@/components/onlyoffice/util/document-file'

// ── Constants ──
const OO_LOCALE_MAP: Record<string, 'zh' | 'en'> = {
  'zh-CN': 'zh',
  en: 'en',
}

const { t, locale } = useI18n()
const themeStore = useThemeStore()
const { isDark } = storeToRefs(themeStore)

const props = defineProps<{
  filePath?: string
  fileName?: string
}>()

const emit = defineEmits<{
  (e: 'save', filePath: string): void
  (e: 'error', message: string): void
  (e: 'ready'): void
}>()

// ── State ──
const loading = ref(true)
const loadingText = ref(t('office.initializing'))
const error = ref<string | null>(null)
const readOnly = ref(false)

let manager: OnlyOfficeManager | null = null

// ── Theme sync ──
const currentTheme = computed<OfficeThemeId>(() => (isDark.value ? OFFICE_THEME.DARK : OFFICE_THEME.WHITE))

watch(isDark, () => {
  if (manager) {
    void manager.toggleTheme()
  }
})

// ── Language sync ──
const currentOoLang = computed<'zh' | 'en'>(() => OO_LOCALE_MAP[locale.value] || 'en')

watch(currentOoLang, (lang) => {
  setCurrentLang(lang)
  if (manager) {
    void manager.setLanguage(lang)
  }
})

// ── Helpers ──
function guessFileType(fileName?: string): FileType {
  const ext = (fileName?.split('.').pop() || 'docx').toLowerCase()
  return getFileTypeConstant(ext)
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() || 'document'
}

// ── Init ──
onMounted(async () => {
  try {
    // Register CDN for static SDK assets
    OnlyOfficeManager.registerStaticResource({
      cdnOrigin: __ONLYOFFICE_CDN__,
    })

    // Sync initial language to OnlyOffice lang store
    setCurrentLang(currentOoLang.value)

    loadingText.value = t('office.loadingSdk')
    await onlyOfficeManagerFactory.open(
      {
        containerId: 'iframe-office-id',
        fileType: guessFileType(props.fileName),
        defaultFileName: props.fileName || t('office.untitled'),
        readOnly: readOnly.value,
        theme: currentTheme.value,
        lang: currentOoLang.value,
      },
      {
        fileName: props.fileName || t('office.untitled'),
        isNew: !props.filePath,
      },
    )

    manager = onlyOfficeManagerFactory.get('iframe-office-id')
    if (!manager) {
      throw new Error('Failed to create OnlyOffice manager')
    }

    // If file path provided, load the file via Electron IPC
    if (props.filePath && isElectron()) {
      loadingText.value = t('office.openingFile')
      await loadFileFromDisk(props.filePath)
    }

    loading.value = false
    emit('ready')
  } catch (err) {
    error.value = String(err)
    loading.value = false
    emit('error', String(err))
  }
})

onBeforeUnmount(() => {
  onlyOfficeManagerFactory.destroyAll()
})

// ── File operations ──

/** Load an Office file from the local filesystem */
async function loadFileFromDisk(filePath: string) {
  if (!manager) return
  const api = getElectronAPI()
  if (!api?.readFileBinary) {
    throw new Error('readFileBinary IPC not available')
  }
  const result = await api.readFileBinary(filePath)
  const name = basename(filePath)
  const ext = (name.split('.').pop() || 'docx').toLowerCase()
  const file = new File([new Uint8Array(result.data)], name, {
    type: getOnlyOfficeMimeType(ext),
  })
  await manager.openFile(file)
}

/** Open file dialog and load selected file */
async function openFile() {
  if (!manager) return
  const api = getElectronAPI()
  if (!api?.openOfficeFileDialog) {
    error.value = t('office.electronRequired')
    return
  }
  const filePath = await api.openOfficeFileDialog()
  if (!filePath) return

  loading.value = true
  loadingText.value = t('office.openingFile')
  error.value = null
  try {
    await loadFileFromDisk(filePath)
    emit('save', filePath)
  } catch (err) {
    error.value = String(err)
    emit('error', String(err))
  } finally {
    loading.value = false
  }
}

/** Save the document to disk */
async function saveFile() {
  if (!manager) return
  const api = getElectronAPI()
  if (!api?.saveOfficeFileDialog) {
    error.value = t('office.electronRequired')
    return
  }
  try {
    const result = await manager.exportAsBlob()
    const filePath = await api.saveOfficeFileDialog(result.fileName)
    if (!filePath) return

    const uint8 = new Uint8Array(await result.blob.arrayBuffer())
    await api.writeFileBinary(filePath, Array.from(uint8))
    emit('save', filePath)
  } catch (err) {
    error.value = String(err)
    emit('error', String(err))
  }
}

/** Toggle read-only */
function toggleReadOnly() {
  readOnly.value = !readOnly.value
  manager?.setReadOnly(readOnly.value)
}
</script>

<template>
  <div class="office-editor">
    <!-- Loading overlay -->
    <div v-if="loading" class="office-editor__loading">
      <el-icon class="is-loading" :size="32">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </el-icon>
      <span class="office-editor__loading-text">{{ loadingText }}</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="office-editor__error">
      <el-result icon="error" :title="t('office.errorTitle')" :sub-title="error">
        <template #extra>
          <el-button type="primary" @click="openFile">{{ t('office.openFile') }}</el-button>
        </template>
      </el-result>
    </div>

    <!-- Editor toolbar -->
    <div v-if="!loading && !error" class="office-editor__toolbar">
      <el-button-group>
        <el-button :icon="Upload" size="small" @click="openFile">
          {{ t('office.openFile') }}
        </el-button>
        <el-button :icon="Download" size="small" @click="saveFile">
          {{ t('office.save') }}
        </el-button>
        <el-button
          :icon="EditPen"
          size="small"
          :type="readOnly ? 'default' : 'warning'"
          @click="toggleReadOnly"
        >
          {{ readOnly ? t('office.edit') : t('office.readOnly') }}
        </el-button>
      </el-button-group>
      <span class="office-editor__file-name" :title="fileName">
        <el-icon><Document /></el-icon>
        {{ fileName || t('office.untitled') }}
      </span>
    </div>

    <!-- Editor container -->
    <div
      v-show="!loading && !error"
      class="office-editor__container onlyoffice-container"
      id="iframe-office-id"
    ></div>
  </div>
</template>

<style scoped>
.office-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--arc-bg-page);
  overflow: hidden;
}

.office-editor__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  color: var(--arc-text-secondary);
}

.office-editor__loading-text {
  font-size: 14px;
  color: var(--arc-text-secondary);
}

.office-editor__error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.office-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--arc-bg-soft);
  flex-shrink: 0;
}

.office-editor__file-name {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 13px;
  color: var(--arc-text-secondary);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.office-editor__container {
  flex: 1;
  position: relative;
  min-height: 0;
}

/* Override OnlyOffice container to fill available space */
:deep(.onlyoffice-container) {
  position: absolute;
  inset: 0;
}
</style>
