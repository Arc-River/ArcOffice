<script setup lang="ts">
import { onMounted, ref, toRaw } from 'vue'
import { useCrudList } from '@/composables/useCrudList'
import type { AiModel } from '@/types/ai'
import { getElectronAPI } from '@/utils/ipc'

const api = getElectronAPI()

const activeModelId = ref('')
const testingId = ref<string | null>(null)
const testResult = ref<{ id: string; success: boolean; message: string } | null>(null)

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
    maxTokens: 4096,
  }),
  getName: (m) => m.name,
  entityName: '模型',
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
      <h2 class="settings-page__title">模型配置</h2>
      <el-button type="primary" size="small" @click="openNewForm">添加模型</el-button>
    </div>
    <p class="settings-page__desc">配置 AI 模型后可在对话页面使用</p>

    <!-- Add/Edit Form -->
    <div v-if="crud.showDialog.value" class="settings-page__form">
      <h3 class="settings-page__form-title">
        {{ crud.editingId.value ? '编辑模型' : '添加模型' }}
      </h3>
      <el-form label-position="top" size="small">
        <el-form-item label="名称">
          <el-input v-model="crud.form.value.name" placeholder="例如: Claude Opus 4.8" />
        </el-form-item>
        <el-form-item label="提供商">
          <el-select v-model="crud.form.value.provider" style="width: 100%">
            <el-option value="anthropic" label="Anthropic" />
            <el-option value="openai-compatible" label="OpenAI 兼容" />
          </el-select>
        </el-form-item>
        <el-form-item label="Model ID">
          <el-input v-model="crud.form.value.modelId" placeholder="例如: claude-opus-4-8-20250514" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="crud.form.value.apiKey" type="password" show-password placeholder="sk-ant-***" />
        </el-form-item>
        <el-form-item label="Base URL (自定义端点，可选)">
          <el-input v-model="crud.form.value.baseUrl" placeholder="https://api.anthropic.com (留空使用默认)" />
        </el-form-item>
        <el-form-item label="温度 (Temperature)">
          <el-slider v-model="crud.form.value.temperature" :min="0" :max="2" :step="0.1" />
        </el-form-item>
        <el-form-item label="Max Tokens">
          <el-input-number v-model="crud.form.value.maxTokens" :min="1" :max="128000" :step="1024" />
        </el-form-item>
        <div class="settings-page__form-actions">
          <el-button @click="crud.cancelForm()">取消</el-button>
          <el-button type="primary" @click="saveModel" :disabled="!crud.form.value.name || !crud.form.value.modelId || !crud.form.value.apiKey">
            保存
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- Model List -->
    <div v-if="crud.items.value.length === 0 && !crud.showDialog.value" class="settings-page__empty">
      <p class="settings-page__empty-text">暂无模型</p>
      <p class="settings-page__empty-hint">点击"添加模型"开始配置</p>
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
          <el-tag v-if="m.id === activeModelId" type="success" size="small">已激活</el-tag>
          <template v-else>
            <el-button text size="small" @click="setActiveModel(m.id)">激活</el-button>
          </template>
          <el-button text size="small" @click="openEditForm(m)">编辑</el-button>
          <el-button
            text
            size="small"
            type="danger"
            :loading="testingId === m.id"
            @click="testModel(m)"
          >
            {{ testingId === m.id ? '测试中…' : '测试' }}
          </el-button>
          <el-popconfirm
            title="确定删除此模型？"
            confirm-button-text="删除"
            cancel-button-text="取消"
            @confirm="deleteModel(m.id)"
          >
            <template #reference>
              <el-button text size="small" type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </div>
        <div v-if="testResult && testResult.id === m.id" class="settings-page__test-result" :class="{ 'is-success': testResult.success, 'is-error': !testResult.success }">
          {{ testResult.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-page {
  padding: var(--arc-space-lg);
  max-width: 640px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--arc-space-xs);
  }

  &__title {
    @include font-title-lg;
    color: var(--arc-text-primary);
  }

  &__desc {
    @include font-body-sm;
    color: var(--arc-text-secondary);
    margin-bottom: var(--arc-space-md);
  }

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
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--arc-space-sm);
    padding: var(--arc-space-xxl);
    text-align: center;
  }

  &__empty-text {
    @include font-title;
    color: var(--arc-text-primary);
  }

  &__empty-hint {
    @include font-body-sm;
    color: var(--arc-text-placeholder);
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
      background: #E6F0FF;
      color: var(--arc-brand-blue);
    }

    &--disconnected {
      background: #FFEAEA;
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

  &__test-result {
    width: 100%;
    @include font-body-xs;
    padding: 4px 8px;
    border-radius: var(--arc-radius-sm);

    &.is-success {
      background: #E8F9EE;
      color: var(--arc-success);
    }

    &.is-error {
      background: #FFEAEA;
      color: var(--arc-danger);
    }
  }
}
</style>
