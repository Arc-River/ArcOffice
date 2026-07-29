<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSkillsManager } from '@/composables/useSkillsManager'
import { getSkillColor, getSkillIcon } from '@/utils/skill-icons'

const { t } = useI18n()
const mgr = useSkillsManager()

onMounted(() => mgr.load())

function getFileIcon(entry: { name: string; isDirectory: boolean }): string {
  if (entry.isDirectory) return 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
  if (entry.name.endsWith('.md')) return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
  if (entry.name.endsWith('.py'))
    return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'
  if (entry.name.endsWith('.sh') || entry.name.endsWith('.js'))
    return 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'
  return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-page__header">
      <h2 class="settings-page__title">{{ t('settings.skills.title') }}</h2>
      <el-button type="primary" size="small" @click="mgr.openNewForm()">{{ t('settings.skills.add') }}</el-button>
    </div>
    <p class="settings-page__desc">{{ t('settings.skills.desc') }}</p>

    <div v-if="mgr.loading.value" class="settings-page__empty">
      <p>{{ t('common.loading') }}</p>
    </div>

    <div v-else-if="mgr.items.value.length === 0" class="settings-page__empty">
      <p>{{ t('settings.skills.empty') }}</p>
    </div>

    <div v-else class="settings-page__section">
      <div v-for="s in mgr.items.value" :key="s.name" class="settings-page__skill-card">
        <div class="settings-page__skill-icon" :style="{ background: getSkillColor(s.name) + '22', color: getSkillColor(s.name) }">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path :d="getSkillIcon(s.name)" />
          </svg>
        </div>
        <div class="settings-page__skill-info">
          <div class="settings-page__skill-name">
            {{ s.name }}
            <el-tag v-if="s.builtin" size="small" type="info" class="settings-page__builtin-tag">{{ t('settings.skills.builtin') }}</el-tag>
            <el-tag v-if="s.hasScripts" size="small" type="warning" effect="plain">{{ s.fileCount }} files</el-tag>
            <el-tag v-else size="small" type="info" effect="plain">{{ t('settings.skills.noInstructions') }}</el-tag>
          </div>
          <div class="settings-page__skill-desc">{{ s.description }}</div>
        </div>
        <el-button v-if="s.fileCount && s.fileCount > 0" size="small" text @click="mgr.openFiles(s)">
          {{ t('settings.skills.manageFiles') }}
        </el-button>
        <el-switch
          :model-value="s.enabled"
          size="small"
          @click="(e: MouseEvent) => e.stopPropagation()"
          @change="mgr.toggle(s)"
        />
        <el-dropdown trigger="click" @command="(cmd: string) => {
          if (cmd === 'edit' && !s.builtin) mgr.openEditForm(s);
          if (cmd === 'delete') mgr.remove(s)
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

    <!-- Add / Edit SKILL.md Dialog -->
    <el-dialog
      v-model="mgr.showFormDialog.value"
      :title="mgr.editingSkill.value ? t('settings.skills.editTitle') : t('settings.skills.addTitle')"
      width="520px"
      :close-on-click-modal="false"
      @close="mgr.cancelForm()"
    >
      <el-form :model="mgr.form.value" label-position="top">
        <el-form-item :label="t('settings.skills.name')">
          <el-input
            v-model="mgr.form.value.name"
            :placeholder="t('settings.skills.namePlaceholder')"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="t('settings.skills.descLabel')">
          <el-input
            v-model="mgr.form.value.description"
            type="textarea"
            :rows="3"
            :placeholder="t('settings.skills.descPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('settings.skills.instructions')">
          <div class="settings-page__content-hint">{{ t('settings.skills.instructionsDesc') }}</div>
          <el-input
            v-model="mgr.form.value.content"
            type="textarea"
            :rows="8"
            :placeholder="t('settings.skills.instructionsPlaceholder')"
            maxlength="10000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="mgr.cancelForm()">{{ t('settings.skills.cancel') }}</el-button>
        <el-button type="primary" @click="mgr.saveForm()">{{ t('settings.skills.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- File Browser Dialog -->
    <el-dialog
      v-model="mgr.showFilesDialog.value"
      :title="t('settings.skills.manageFiles') + ' — ' + mgr.filesTargetSkill.value"
      width="600px"
      :close-on-click-modal="false"
    >
      <div v-if="mgr.files.value.length === 0" class="settings-page__empty">
        <p>{{ t('settings.skills.noFiles') }}</p>
      </div>
      <div v-else class="settings-page__file-list">
        <div
          v-for="f in mgr.files.value"
          :key="f.path"
          class="settings-page__file-item"
          :class="{ 'settings-page__file-item--dir': f.isDirectory }"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="settings-page__file-icon">
            <path :d="getFileIcon(f)" />
          </svg>
          <span class="settings-page__file-name">{{ f.path }}</span>
          <span class="settings-page__file-size" v-if="!f.isDirectory">{{ (f.size / 1024).toFixed(1) }} KB</span>
          <el-button
            v-if="!f.isDirectory && !mgr.filesTargetBuiltin.value"
            size="small"
            text
            @click="mgr.openFileEditor(f.path)"
          >
            {{ t('common.edit') }}
          </el-button>
          <el-button
            v-if="!f.isDirectory && !mgr.filesTargetBuiltin.value"
            size="small"
            text
            type="danger"
            @click="mgr.deleteFile(f.path)"
          >
            {{ t('common.delete') }}
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="mgr.showFilesDialog.value = false">{{ t('settings.skills.cancel') }}</el-button>
      </template>
    </el-dialog>

    <!-- File Editor Dialog -->
    <el-dialog
      v-model="mgr.showFileEditor.value"
      :title="mgr.editingFilePath.value"
      width="700px"
      :close-on-click-modal="false"
      @close="mgr.showFileEditor.value = false"
    >
      <el-input
        v-model="mgr.editingFileContent.value"
        type="textarea"
        :rows="20"
        :placeholder="t('settings.skills.fileContent')"
      />
      <template #footer>
        <el-button @click="mgr.showFileEditor.value = false">{{ t('settings.skills.cancel') }}</el-button>
        <el-button type="primary" @click="mgr.saveFile()">{{ t('settings.skills.save') }}</el-button>
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

  // File list styles
  &__file-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 400px;
    overflow-y: auto;
  }

  &__file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: var(--arc-radius-md);
    @include font-body-sm;
    background: var(--arc-bg-soft);

    &--dir {
      opacity: 0.7;
    }
  }

  &__file-icon {
    flex-shrink: 0;
    width: 16px;
  }

  &__file-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__file-size {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--arc-text-placeholder);
  }
}
</style>
