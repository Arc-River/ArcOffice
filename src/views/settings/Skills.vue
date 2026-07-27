<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useCrudList } from '@/composables/useCrudList'
import type { SkillItem } from '@/types/ai'
import { getElectronAPI } from '@/utils/ipc'
import { getSkillColor, getSkillIcon } from '@/utils/skill-icons'

const api = getElectronAPI()

const crud = useCrudList<SkillItem>({
  load: () => (api ? api.getSkills() : Promise.resolve([])),
  save: (list) => (api ? api.saveSkills(list) : Promise.resolve()),
  createBlank: () => ({
    id: '',
    name: '',
    description: '',
    content: '',
    builtin: false,
    enabled: true,
    created_at: '',
  }),
  getName: (s) => s.name,
  entityName: '技能',
})

async function saveForm() {
  const name = crud.form.value.name.trim()
  const description = crud.form.value.description.trim()
  if (!name || !description) {
    ElMessage.warning('请填写完整信息')
    return
  }

  if (!crud.editingId.value) {
    crud.form.value.id = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    crud.form.value.builtin = false
    crud.form.value.created_at = new Date().toISOString()
  }
  await crud.saveForm()
}

async function handleToggle(skill: SkillItem) {
  await crud.toggleEnabled(skill)
}

async function handleDelete(skill: SkillItem) {
  if (skill.builtin) {
    ElMessage.info('内置技能不可删除，可在列表中关闭')
    return
  }
  await crud.handleDelete(skill)
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
        <div class="settings-page__skill-icon" :style="{ background: getSkillColor(s.name) + '22', color: getSkillColor(s.name) }">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path :d="getSkillIcon(s.name)" />
          </svg>
        </div>
        <div class="settings-page__skill-info">
          <div class="settings-page__skill-name">
            {{ s.name }}
            <el-tag v-if="s.builtin" size="small" type="info" class="settings-page__builtin-tag">内置</el-tag>
            <el-tag v-if="s.content" size="small" type="warning" effect="plain">有指令</el-tag>
            <el-tag v-else size="small" effect="plain">无指令</el-tag>
          </div>
          <div class="settings-page__skill-desc">{{ s.description }}</div>
        </div>
        <el-switch
          :model-value="s.enabled"
          size="small"
          @click="(e: MouseEvent) => e.stopPropagation()"
          @change="handleToggle(s)"
        />
        <el-dropdown trigger="click" @command="(cmd: string) => {
          if (cmd === 'edit' && !s.builtin) crud.openEditForm(s);
          if (cmd === 'delete') handleDelete(s)
        }">
          <el-button class="settings-page__more" text size="small">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
            </svg>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :disabled="s.builtin" command="edit">
                编辑
                <template v-if="s.builtin">（内置不可编辑）</template>
              </el-dropdown-item>
              <el-dropdown-item command="delete" divided :style="{ color: s.builtin ? 'var(--el-color-info)' : 'var(--el-color-danger)' }">
                {{ s.builtin ? '不可删除' : '删除' }}
              </el-dropdown-item>
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
        <el-form-item label="技能指令">
          <div class="settings-page__content-hint">技能指令将注入到 AI 的 system prompt 中，指导 AI 如何执行该技能。支持 Markdown 格式。</div>
          <el-input
            v-model="crud.form.value.content"
            type="textarea"
            :rows="8"
            placeholder="编写详细的操作指南和规则，AI 将在对话中参考这些指令。"
            maxlength="10000"
            show-word-limit
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
  // Using shared .settings-page from common.scss
  // Only view-specific styles below

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
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__builtin-tag {
    flex-shrink: 0;
  }

  &__skill-desc {
    @include font-body-xs;
    color: var(--arc-text-placeholder);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__content-hint {
    @include font-body-xs;
    color: var(--arc-text-placeholder);
    margin-bottom: 6px;
    line-height: 1.5;
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
