<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getElectronAPI } from '@/utils/ipc'

const { t } = useI18n()

const appVersion = ref('')
const activeModel = ref('')
const isOnline = ref(false)

const statusText = computed(() => (isOnline.value ? t('status.connected') : t('status.disconnected')))

onMounted(async () => {
  const api = getElectronAPI()
  // Load version
  if (api) {
    try {
      appVersion.value = await api.getAppVersion()
    } catch {
      appVersion.value = '0.1.0'
    }
  }

  if (!api) return
  try {
    const modelId = await api.getActiveModel()
    if (!modelId) {
      activeModel.value = t('status.noModel')
      return
    }
    const models = await api.getAiModels()
    const found = models.find((m: { id: string; name: string }) => m.id === modelId)
    activeModel.value = found ? found.name : t('status.noModel')
    isOnline.value = !!found
  } catch {
    activeModel.value = t('status.noModel')
  }
})
</script>

<template>
  <footer class="status-bar">
    <span class="status-bar__item">ArcOffice v{{ appVersion }}</span>
    <span class="status-bar__item status-bar__item--right">
      <span
        class="status-dot"
        :class="{ 'status-dot--online': isOnline, 'status-dot--offline': !isOnline }"
        :title="statusText"
      />
      {{ activeModel }}
    </span>
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
    display: flex;
    align-items: center;
    gap: 6px;

    &--right {
      margin-left: auto;
    }
  }

}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &--online {
    background: #22c55e;
  }

  &--offline {
    background: #ef4444;
  }
}

</style>
