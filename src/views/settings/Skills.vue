<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useCrudList } from '@/composables/useCrudList'
import type { SkillItem } from '@/types/ai'
import { getElectronAPI } from '@/utils/ipc'
// biome-ignore lint/correctness/noUnusedImports: used in template for icon rendering
import { getSkillColor, getSkillIcon } from '@/utils/skill-icons'

const api = getElectronAPI()
const { t } = useI18n()

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
  entityName: t('settings.skills.title'),
})

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function saveForm() {
  const name = crud.form.value.name.trim()
  const description = crud.form.value.description.trim()
  if (!name || !description) {
    ElMessage.warning(t('settings.skills.validate'))
    return
  }

  if (!crud.editingId.value) {
    crud.form.value.id = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    crud.form.value.builtin = false
    crud.form.value.created_at = new Date().toISOString()
  }
  await crud.saveForm()
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function handleToggle(skill: SkillItem) {
  await crud.toggleEnabled(skill)
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
async function handleDelete(skill: SkillItem) {
  if (skill.builtin) {
    ElMessage.info(t('settings.skills.builtinNotDeletable'))
    return
  }
  await crud.handleDelete(skill)
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-page__header">
      <h2 class="settings-page__title">{{ t('settings.skills.title') }}</h2>
      <el-button type="primary" size="small" @click="crud.openNewForm()">{{ t('settings.skills.add') }}</el-button>
    </div>
    <p class="settings-page__desc">{{ t('settings.skills.desc') }}</p>

    <div v-if="crud.items.value.length === 0" class="settings-page__empty">
      <p>{{ t('settings.skills.empty') }}</p>
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
            <el-tag v-if="s.builtin" size="small" type="info" class="settings-page__builtin-tag">{{ t('settings.skills.builtin') }}</el-tag>
            <el-tag v-if="s.content" size="small" type="warning" effect="plain">{{ t('settings.skills.hasInstructions') }}</el-tag>
            <el-tag v-else size="small" effect="plain">{{ t('settings.skills.noInstructions') }}</el-tag>
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
                {{ t('settings.skills.edit') }}
                <template v-if="s.builtin">{{ t('settings.skills.builtinNotEditable') }}</template>
              </el-dropdown-item>
              <el-dropdown-item command="delete" divided :style="{ color: s.builtin ? 'var(--el-color-info)' : 'var(--el-color-danger)' }">
                {{ s.builtin ? t('settings.skills.cannotDelete') : t('settings.skills.delete') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- Add / Edit Dialog -->
    <el-dialog
      v-model="crud.showDialog.value"
      :title="crud.editingId.value ? t('settings.skills.editTitle') : t('settings.skills.addTitle')"
      width="520px"
      :close-on-click-modal="false"
      @close="crud.cancelForm()"
    >
      <el-form :model="crud.form.value" label-position="top">
        <el-form-item :label="t('settings.skills.name')">
          <el-input
            v-model="crud.form.value.name"
            :placeholder="t('settings.skills.namePlaceholder')"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="t('settings.skills.descLabel')">
          <el-input
            v-model="crud.form.value.description"
            type="textarea"
            :rows="3"
            :placeholder="t('settings.skills.descPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('settings.skills.instructions')">
          <div class="settings-page__content-hint">{{ t('settings.skills.instructionsDesc') }}</div>
          <el-input
            v-model="crud.form.value.content"
            type="textarea"
            :rows="8"
            :placeholder="t('settings.skills.instructionsPlaceholder')"
            maxlength="10000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="crud.cancelForm()">{{ t('settings.skills.cancel') }}</el-button>
        <el-button type="primary" @click="saveForm">{{ t('settings.skills.save') }}</el-button>
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
