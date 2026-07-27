<script setup lang="ts">
import { Aim, Check, Delete, Edit } from '@element-plus/icons-vue'
import { ref, toRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCrudList } from '@/composables/useCrudList'
import type { AiModel } from '@/types/ai'
import { getElectronAPI } from '@/utils/ipc'

const api = getElectronAPI()
const { t } = useI18n()

const activeModelId = ref('')
const testingId = ref<string | null>(null)
const testResult = ref<{ id: string; success: boolean; message: string } | null>(null)
const advancedOpen = ref<string[]>([])

const crud = useCrudList<AiModel>({
  load: async () => {
    if (!api) return []
    const models = await api.getAiModels()
    activeModelId.value = await api.getActiveModel()
    return models
  },
  save: (list) => (api ? api.saveAiModels(list) : Promise.resolve()),
  createBlank: () => ({
    id: `model-${Date.now()}`,
    name: '',
    provider: 'anthropic',
    modelId: '',
    apiKey: '',
    baseUrl: '',
    temperature: 0.7,
    maxTokens: 1000000,
  }),
  getName: (m) => m.name,
  entityName: t('settings.models.title'),
})

async function openNewForm() {
  testResult.value = null
  crud.openNewForm()
}

function openEditForm(model: AiModel) {
  testResult.value = null
  crud.openEditForm(model)
}

async function saveModel() {
  if (!crud.form.value.name || !crud.form.value.modelId || !crud.form.value.apiKey) return
  await crud.saveForm()
}

async function deleteModel(id: string) {
  if (!api) return
  const updated = toRaw(crud.items.value).filter((m) => m.id !== id)
  await api.saveAiModels(updated)
  crud.items.value = updated
  if (activeModelId.value === id) {
    activeModelId.value = ''
    await api.setActiveModel('')
  }
}

async function setActiveModel(id: string) {
  if (!api) return
  activeModelId.value = id
  await api.setActiveModel(id)
}

async function testModel(model: AiModel) {
  if (!api) return
  testingId.value = model.id
  testResult.value = null
  try {
    const result = await api.testConnection(toRaw(model))
    testResult.value = { id: model.id, ...result }
  } catch (err) {
    testResult.value = {
      id: model.id,
      success: false,
      message: `请求失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  } finally {
    testingId.value = null
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-page__header">
      <h2 class="settings-page__title">{{ t('settings.models.title') }}</h2>
      <el-button type="primary" size="small" @click="openNewForm">{{ t('settings.models.add') }}</el-button>
    </div>
    <p class="settings-page__desc">{{ t('settings.models.desc') }}</p>

    <!-- Add/Edit Form -->
    <div v-if="crud.showDialog.value" class="settings-page__form">
      <h3 class="settings-page__form-title">
        {{ crud.editingId.value ? t('settings.models.edit') : t('settings.models.addNew') }}
      </h3>
      <el-form label-position="top" size="small">
        <el-form-item :label="t('settings.models.name')">
          <el-input v-model="crud.form.value.name" :placeholder="t('settings.models.namePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('settings.models.provider')">
          <el-select v-model="crud.form.value.provider" style="width: 100%">
            <el-option value="anthropic" label="Anthropic" />
            <el-option value="openai-compatible" :label="t('settings.models.providerOpenAI')" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('settings.models.modelId')">
          <el-input v-model="crud.form.value.modelId" :placeholder="t('settings.models.modelIdPlaceholder')" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="crud.form.value.apiKey" type="password" show-password placeholder="sk-ant-***" />
        </el-form-item>
        <el-collapse v-model="advancedOpen">
          <el-collapse-item :title="t('settings.models.advanced')" name="advanced">
            <el-form-item :label="t('settings.models.baseUrl')">
              <el-input v-model="crud.form.value.baseUrl" :placeholder="t('settings.models.baseUrlPlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('settings.models.temperature')">
              <el-slider v-model="crud.form.value.temperature" :min="0" :max="2" :step="0.1" />
            </el-form-item>
            <el-form-item label="Max Tokens">
              <el-input-number v-model="crud.form.value.maxTokens" :min="1" :max="1000000" :step="1024" />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
        <div class="settings-page__form-actions">
          <el-button @click="crud.cancelForm()">{{ t('settings.models.cancel') }}</el-button>
          <el-button type="primary" @click="saveModel" :disabled="!crud.form.value.name || !crud.form.value.modelId || !crud.form.value.apiKey">
            {{ t('settings.models.save') }}
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- Model List -->
    <div v-if="crud.items.value.length === 0 && !crud.showDialog.value" class="settings-page__empty">
      <p class="settings-page__empty-text">{{ t('settings.models.empty') }}</p>
      <p class="settings-page__empty-hint">{{ t('settings.models.emptyHint') }}</p>
    </div>
    <div v-else class="settings-page__section">
      <div v-for="m in crud.items.value" :key="m.id" class="settings-page__model-card">
        <div
          class="settings-page__model-icon"
          :class="`settings-page__model-icon--${m.id === activeModelId ? 'connected' : 'disconnected'}`"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
          </svg>
        </div>
        <div class="settings-page__model-info">
          <div class="settings-page__model-name">{{ m.name }}</div>
          <div class="settings-page__model-meta">
            {{ m.provider }} · {{ m.modelId }} · 温度 {{ m.temperature }}
          </div>
        </div>
        <div class="settings-page__model-actions">
          <el-tag v-if="m.id === activeModelId" type="success" size="small">{{ t('settings.models.activated') }}</el-tag>
          <template v-else>
            <el-button text size="small" :icon="Check" @click="setActiveModel(m.id)">{{ t('settings.models.activate') }}</el-button>
          </template>
          <el-button text size="small" :icon="Edit" @click="openEditForm(m)">{{ t('settings.models.edit') }}</el-button>
          <el-button
            text
            size="small"
            type="warning"
            :icon="testingId === m.id ? undefined : Aim"
            :loading="testingId === m.id"
            @click="testModel(m)"
          >
            {{ testingId === m.id ? t('settings.models.testing') : t('settings.models.test') }}
          </el-button>
          <el-popconfirm
            :title="t('settings.models.deleteConfirm')"
            :confirm-button-text="t('settings.models.delete')"
            :cancel-button-text="t('settings.models.cancel')"
            @confirm="deleteModel(m.id)"
          >
            <template #reference>
              <el-button text size="small" :icon="Delete" type="danger">{{ t('settings.models.delete') }}</el-button>
            </template>
          </el-popconfirm>
        </div>
        <el-alert
          v-if="testResult && testResult.id === m.id"
          :type="testResult.success ? 'success' : 'error'"
          :title="testResult.message"
          show-icon
          :closable="true"
          @close="testResult = null"
          class="settings-page__test-alert"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-page {
  // Using shared .settings-page from common.scss
  // Only view-specific styles below

  &__form {
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-lg);
    padding: var(--arc-space-md);
    margin-bottom: var(--arc-space-md);
  }

  &__form-title {
    @include font-title;
    margin-bottom: var(--arc-space-md);
  }

  &__form-actions {
    display: flex;
    gap: var(--arc-space-xs);
    justify-content: flex-end;
    border-top: none;
    margin-top: 0;
    padding-top: var(--arc-space-sm);
  }

  :deep(.el-collapse) {
    border-bottom: none;
  }

  :deep(.el-collapse-item__wrap) {
    border-bottom: none;
  }

  :deep(.el-collapse-item__header) {
    border-bottom: none;
  }

  :deep(.el-form-item) {
    margin-bottom: 0;
  }

  :deep(.el-form) {
    padding-bottom: 0;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__model-card {
    display: flex;
    align-items: center;
    gap: var(--arc-space-sm);
    padding: var(--arc-space-xs) var(--arc-space-sm);
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-lg);
    flex-wrap: wrap;
    position: relative;
  }

  &__model-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--arc-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &--connected {
      background: color-mix(in srgb, var(--arc-brand-blue) 10%, transparent);
      color: var(--arc-brand-blue);
    }

    &--disconnected {
      background: color-mix(in srgb, var(--arc-danger) 10%, transparent);
      color: var(--arc-danger);
    }
  }

  &__model-info {
    flex: 1;
    min-width: 0;
  }

  &__model-name {
    @include font-body;
    font-weight: 500;
  }

  &__model-meta {
    @include font-body-xs;
    color: var(--arc-text-placeholder);
  }

  &__model-actions {
    display: flex;
    gap: 4px;
    align-items: center;
    flex-shrink: 0;
  }

  &__test-alert {
    margin-top: 6px;
  }
}
</style>
