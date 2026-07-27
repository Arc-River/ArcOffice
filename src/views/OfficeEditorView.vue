<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()

const filePath = ref<string | undefined>(undefined)
const fileName = ref<string | undefined>(undefined)

watch(
  () => route.query.file,
  (file) => {
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

function _handleSave(path: string) {
  console.log('[OfficeEditorView] saved to:', path)
}

function _handleError(msg: string) {
  console.error('[OfficeEditorView] error:', msg)
}

function _handleReady() {
  console.log('[OfficeEditorView] editor ready')
}
</script>

<template>
  <div class="office-view">
    <OfficeEditor
      :file-path="filePath"
      :file-name="fileName"
      @save="handleSave"
      @error="handleError"
      @ready="handleReady"
    />
  </div>
</template>

<style scoped>
.office-view {
  height: 100%;
}
</style>
