<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useCrudList } from '@/composables/useCrudList'
import type { PromptTemplate } from '@/types/ai'
import { getElectronAPI } from '@/utils/ipc'

const api = getElectronAPI()

const crud = useCrudList<PromptTemplate>({
  load: () => (api ? api.getPrompts() : Promise.resolve([])),
  save: (list) => (api ? api.savePrompts(list) : Promise.resolve()),
  createBlank: () => ({ id: '', name: '', content: '', created_at: '' }),
  getName: (p) => p.name,
  entityName: '模板',
})

function saveForm() {
  const name = crud.form.value.name.trim()
  const content = crud.form.value.content.trim()
  if (!name || !content) {
    ElMessage.warning('请填写完整信息')
    return
  }

  if (!crud.editingId.value) {
    crud.form.value.id = `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    crud.form.value.created_at = new Date().toISOString()
  }
  crud.saveForm()
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-page__header">
      <h2 class="settings-page__title">Prompt 模板</h2>
      <el-button type="primary" size="small" @click="crud.openNewForm()">新建模板</el-button>
    </div>
    <p class="settings-page__desc">
      自定义 AI 指令模板，发送消息时可通过 <code>/</code> 快速选用
    </p>

    <div v-if="crud.items.value.length === 0" class="settings-page__empty">
      <p>暂无模板，点击上方按钮创建</p>
    </div>

    <div v-else class="settings-page__section">
      <div v-for="p in crud.items.value" :key="p.id" class="settings-page__prompt-item">
        <div class="settings-page__prompt-info">
          <span class="settings-page__prompt-name">{{ p.name }}</span>
          <span class="settings-page__prompt-preview">{{ p.content }}</span>
        </div>
        <div class="settings-page__prompt-actions">
          <el-button text size="small" type="primary" @click="crud.openEditForm(p)">编辑</el-button>
          <el-button text size="small" type="danger" @click="crud.handleDelete(p)">删除</el-button>
        </div>
      </div>
    </div>

    <!-- Add / Edit Dialog -->
    <el-dialog
      v-model="crud.showDialog.value"
      :title="crud.editingId.value ? '编辑模板' : '新建模板'"
      width="520px"
      :close-on-click-modal="false"
      @close="crud.cancelForm()"
    >
      <el-form :model="crud.form.value" label-position="top">
        <el-form-item label="模板名称">
          <el-input
            v-model="crud.form.value.name"
            placeholder="给模板起个简短的名字"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="Prompt 内容">
          <el-input
            v-model="crud.form.value.content"
            type="textarea"
            :rows="6"
            placeholder="输入 AI 指令模板，可用 {{变量}} 占位"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="crud.cancelForm()">取消</el-button>
        <el-button type="primary" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>
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

    code {
      background: var(--arc-bg-soft);
      padding: 0 4px;
      border-radius: 3px;
      @include font-mono;
    }
  }

  &__empty {
    @include font-body-sm;
    color: var(--arc-text-placeholder);
    text-align: center;
    padding: var(--arc-space-xl) var(--arc-space-sm);
    border: 1px dashed var(--arc-border);
    border-radius: var(--arc-radius-lg);
  }

  &__section {
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-lg);
    overflow: hidden;
  }

  &__prompt-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--arc-space-sm);
    padding: var(--arc-space-sm) var(--arc-space-md);
    border-bottom: 1px solid var(--arc-border);

    &:last-child {
      border-bottom: none;
    }
  }

  &__prompt-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__prompt-name {
    @include font-body;
    color: var(--arc-text-primary);
    font-weight: 500;
  }

  &__prompt-preview {
    @include font-body-xs;
    color: var(--arc-text-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__prompt-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
}
</style>
