<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getElectronAPI } from '@/utils/ipc'

const activeModel = ref('')

onMounted(async () => {
  const api = getElectronAPI()
  if (!api) return
  try {
    const modelId = await api.getActiveModel()
    if (!modelId) {
      activeModel.value = '未配置模型'
      return
    }
    const models = await api.getAiModels()
    const found = models.find((m: { id: string; name: string }) => m.id === modelId)
    activeModel.value = found ? found.name : '未配置模型'
  } catch {
    activeModel.value = '未配置模型'
  }
})
</script>

<template>
  <footer class="status-bar">
    <span class="status-bar__item">ArcOffice v0.1.0</span>
    <span class="status-bar__item status-bar__item--center">{{ activeModel }}</span>
  </footer>
</template>

<style lang="scss" scoped>
.status-bar {
  display: flex;
  align-items: center;
  height: var(--arc-height-statusbar);
  padding: 0 var(--arc-space-sm);
  background: var(--arc-bg-page);
  border-top: 1px solid var(--arc-border);
  @include font-body-xs;
  color: var(--arc-text-secondary);
  flex-shrink: 0;
  gap: var(--arc-space-md);

  &__item {
    white-space: nowrap;

    &--center {
      flex: 1;
      text-align: center;
    }
  }

}
</style>
