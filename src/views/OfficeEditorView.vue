<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

defineOptions({ name: 'ViewOffice' })

import OfficeEditor from '@/components/office/OfficeEditor.vue'

const { t } = useI18n()
const route = useRoute()

const filePath = ref<string | undefined>(undefined)
const fileName = ref<string | undefined>(undefined)

// 只在路由处于 /office 时才响应 query.file 变化
// 避免切到其他页面再切回来时重置 filePath
watch(
  () => route.query.file,
  (file) => {
    if (route.path !== '/office') return
    if (file && typeof file === 'string') {
      filePath.value = file
      fileName.value = file.split(/[/\\]/).pop() || t('office.untitled')
    } else {
      filePath.value = undefined
      fileName.value = undefined
    }
  },
  { immediate: true },
)

function handleSave(path: string) {
  console.log('[OfficeEditorView] saved to:', path)
}

function _handleError(msg: string) {
  console.error('[OfficeEditorView] error:', msg)
}

function handleReady() {
  console.log('[OfficeEditorView] editor ready')
}
</script>

<template>
  <div class="office-view">
    <OfficeEditor
      :file-path="filePath"
      :file-name="fileName"
      @save="handleSave"
      @error="_handleError"
      @ready="handleReady"
    />
  </div>
</template>

<style scoped>
.office-view {
  height: 100%;
}
</style>
