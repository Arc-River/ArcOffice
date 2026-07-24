<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useCrudList } from '@/composables/useCrudList'
import type { SkillItem } from '@/types/ai'
import { getElectronAPI } from '@/utils/ipc'

const api = getElectronAPI()

const crud = useCrudList<SkillItem>({
  load: () => (api ? api.getSkills() : Promise.resolve([])),
  save: (list) => (api ? api.saveSkills(list) : Promise.resolve()),
  createBlank: () => ({ id: '', name: '', description: '', enabled: true, created_at: '' }),
  getName: (s) => s.name,
  entityName: '技能',
})

function saveForm() {
  const name = crud.form.value.name.trim()
  const description = crud.form.value.description.trim()
  if (!name || !description) {
    ElMessage.warning('请填写完整信息')
    return
  }

  if (!crud.editingId.value) {
    crud.form.value.id = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    crud.form.value.created_at = new Date().toISOString()
  }
  crud.saveForm()
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-page__header">
      <h2 class="settings-page__title">Skills 管理</h2>
      <el-button type="primary" size="small" @click="crud.openNewForm()">新建</el-button>
    </div>
    <p class="settings-page__desc">文档操作技能，AI 通过对话调用。关闭的技能不会出现在 AI 的可用工具列表中。</p>

    <div v-if="crud.items.value.length === 0" class="settings-page__empty">
      <p>暂无技能，点击上方按钮创建</p>
    </div>

    <div v-else class="settings-page__section">
      <div v-for="s in crud.items.value" :key="s.id" class="settings-page__skill-card">
        <div class="settings-page__skill-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
          </svg>
        </div>
        <div class="settings-page__skill-info">
          <div class="settings-page__skill-name">{{ s.name }}</div>
          <div class="settings-page__skill-desc">{{ s.description }}</div>
        </div>
        <el-switch
          :model-value="s.enabled"
          size="small"
          @click="(e: MouseEvent) => e.stopPropagation()"
          @change="crud.toggleEnabled(s)"
        />
        <el-dropdown trigger="click" @command="(cmd: string) => { if (cmd === 'edit') crud.openEditForm(s); if (cmd === 'delete') crud.handleDelete(s) }">
          <el-button class="settings-page__more" text size="small">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
            </svg>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="edit">编辑</el-dropdown-item>
              <el-dropdown-item command="delete" divided style="color: var(--el-color-danger)">删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- Add / Edit Dialog -->
    <el-dialog
      v-model="crud.showDialog.value"
      :title="crud.editingId.value ? '编辑技能' : '新建技能'"
      width="520px"
      :close-on-click-modal="false"
      @close="crud.cancelForm()"
    >
      <el-form :model="crud.form.value" label-position="top">
        <el-form-item label="技能名称">
          <el-input
            v-model="crud.form.value.name"
            placeholder="技能标识，如 document-edit"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="crud.form.value.description"
            type="textarea"
            :rows="3"
            placeholder="描述这个技能的功能和用途"
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
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__skill-card {
    display: flex;
    align-items: center;
    gap: var(--arc-space-sm);
    padding: var(--arc-space-xs) var(--arc-space-sm);
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-lg);
  }

  &__skill-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--arc-radius-md);
    background: #EEF7D4;
    color: #5B6E2D;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__skill-info {
    flex: 1;
    min-width: 0;
  }

  &__skill-name {
    @include font-body;
    font-weight: 500;
  }

  &__skill-desc {
    @include font-body-xs;
    color: var(--arc-text-placeholder);
  }

  &__more {
    border: none;
    color: var(--arc-text-placeholder);

    &:hover {
      color: var(--arc-text-primary);
    }
  }
}
</style>
