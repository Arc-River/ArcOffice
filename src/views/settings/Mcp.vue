<script setup lang="ts">
import { Connection } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCrudList } from '@/composables/useCrudList'
import type { McpService } from '@/types/ai'
import { getElectronAPI } from '@/utils/ipc'

const api = getElectronAPI()
const { t } = useI18n()

const newArg = ref('')
const newEnvKey = ref('')
const newEnvVal = ref('')

const crud = useCrudList<McpService>({
  load: () => (api ? api.getMcpServices() : Promise.resolve([])),
  save: (list) => (api ? api.saveMcpServices(list) : Promise.resolve()),
  createBlank: () => ({
    id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    type: 'stdio',
    command: '',
    args: [],
    url: '',
    env: {},
    enabled: true,
    created_at: '',
  }),
  getName: (s) => s.name,
  entityName: t('settings.mcp.title'),
})

function openEditForm(s: McpService) {
  crud.editingId.value = s.id
  crud.form.value = { ...s, args: [...s.args], env: { ...s.env } }
  crud.showDialog.value = true
}

function addArg() {
  const val = newArg.value.trim()
  if (!val) return
  crud.form.value.args.push(val)
  newArg.value = ''
}

function removeArg(idx: number) {
  crud.form.value.args.splice(idx, 1)
}

function addEnv() {
  const key = newEnvKey.value.trim()
  const val = newEnvVal.value.trim()
  if (!key) return
  crud.form.value.env[key] = val
  newEnvKey.value = ''
  newEnvVal.value = ''
}

function removeEnv(key: string) {
  delete crud.form.value.env[key]
  crud.form.value.env = { ...crud.form.value.env }
}

function saveForm() {
  const form = crud.form.value
  const name = form.name.trim()
  if (!name) {
    ElMessage.warning(t('settings.mcp.validateName'))
    return
  }
  if (form.type === 'stdio' && !form.command.trim()) {
    ElMessage.warning(t('settings.mcp.validateCommand'))
    return
  }
  if (form.type === 'sse' && !form.url.trim()) {
    ElMessage.warning(t('settings.mcp.validateUrl'))
    return
  }

  if (!crud.editingId.value) {
    form.created_at = new Date().toISOString()
  }
  crud.saveForm()
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-page__header">
      <h2 class="settings-page__title">{{ t('settings.mcp.title') }}</h2>
      <el-button type="primary" size="small" @click="crud.openNewForm()">{{ t('settings.mcp.add') }}</el-button>
    </div>
    <p class="settings-page__desc">
      {{ t('settings.mcp.desc') }}
    </p>

    <div v-if="crud.items.value.length === 0" class="settings-page__empty">
      <el-icon class="settings-page__empty-icon" :size="48" color="var(--arc-text-placeholder)"><Connection /></el-icon>
      <p class="settings-page__empty-text">{{ t('settings.mcp.empty') }}</p>
      <p class="settings-page__empty-hint">{{ t('settings.mcp.emptyHint') }}</p>
    </div>

    <div v-else class="settings-page__section">
      <div v-for="s in crud.items.value" :key="s.id" class="settings-page__service-card">
        <div class="settings-page__card-body">
          <div class="settings-page__card-top">
            <div class="settings-page__card-info">
              <span class="settings-page__service-name">{{ s.name }}</span>
              <span class="settings-page__service-type">{{ s.type === 'stdio' ? t('settings.mcp.local') : t('settings.mcp.remote') }}</span>
            </div>
            <el-switch
              :model-value="s.enabled"
              size="small"
              @click="(e: MouseEvent) => e.stopPropagation()"
              @change="crud.toggleEnabled(s)"
            />
            <el-dropdown trigger="click" @command="(cmd: string) => { if (cmd === 'edit') openEditForm(s); if (cmd === 'delete') crud.handleDelete(s) }">
              <el-button class="settings-page__more" text size="small">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                </svg>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">{{ t('settings.mcp.edit') }}</el-dropdown-item>
                  <el-dropdown-item command="delete" divided style="color: var(--el-color-danger)">{{ t('settings.mcp.delete') }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="settings-page__card-detail">
            <code v-if="s.type === 'stdio'">{{ s.command }} {{ s.args.join(' ') }}</code>
            <code v-else>{{ s.url }}</code>
          </div>
          <div v-if="Object.keys(s.env).length > 0" class="settings-page__card-env">
            <span v-for="(v, k) in s.env" :key="k" class="settings-page__env-tag">{{ k }}={{ v }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Add / Edit Dialog -->
    <el-dialog
      v-model="crud.showDialog.value"
      :title="crud.editingId.value ? t('settings.mcp.editTitle') : t('settings.mcp.addTitle')"
      width="600px"
      :close-on-click-modal="false"
      @close="crud.cancelForm()"
    >
      <el-form :model="crud.form.value" label-position="top">
        <el-form-item :label="t('settings.mcp.name')">
          <el-input v-model="crud.form.value.name" :placeholder="t('settings.mcp.namePlaceholder')" maxlength="50" show-word-limit />
        </el-form-item>

        <el-form-item :label="t('settings.mcp.connType')">
          <el-radio-group v-model="crud.form.value.type">
            <el-radio value="stdio">{{ t('settings.mcp.localLabel') }}</el-radio>
            <el-radio value="sse">{{ t('settings.mcp.remoteLabel') }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="crud.form.value.type === 'stdio'">
          <el-form-item :label="t('settings.mcp.command')">
            <el-input v-model="crud.form.value.command" :placeholder="t('settings.mcp.commandPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('settings.mcp.args')">
            <div class="settings-page__arg-list">
              <div v-for="(arg, idx) in crud.form.value.args" :key="idx" class="settings-page__arg-item">
                <code>{{ arg }}</code>
                <el-button text type="danger" size="small" @click="removeArg(idx)">{{ t('settings.mcp.removeArg') }}</el-button>
              </div>
            </div>
            <div class="settings-page__arg-input">
              <el-input v-model="newArg" :placeholder="t('settings.mcp.argsPlaceholder')" size="small" @keydown.enter.prevent="addArg" />
              <el-button size="small" @click="addArg">{{ t('settings.mcp.addArg') }}</el-button>
            </div>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item :label="t('settings.mcp.url')">
            <el-input v-model="crud.form.value.url" :placeholder="t('settings.mcp.urlPlaceholder')" />
          </el-form-item>
        </template>

        <el-form-item :label="t('settings.mcp.env')">
          <div class="settings-page__env-list">
            <div v-for="(val, key) in crud.form.value.env" :key="key" class="settings-page__env-item">
              <code>{{ key }}={{ val }}</code>
              <el-button text type="danger" size="small" @click="removeEnv(key)">{{ t('settings.mcp.removeEnv') }}</el-button>
            </div>
          </div>
          <div class="settings-page__env-input">
            <el-input v-model="newEnvKey" :placeholder="t('settings.mcp.envKey')" size="small" class="settings-page__env-key" />
            <el-input v-model="newEnvVal" :placeholder="t('settings.mcp.envValue')" size="small" class="settings-page__env-val" @keydown.enter.prevent="addEnv" />
            <el-button size="small" @click="addEnv">{{ t('settings.mcp.addEnv') }}</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="crud.cancelForm()">{{ t('settings.mcp.cancel') }}</el-button>
        <el-button type="primary" @click="saveForm">{{ t('settings.mcp.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.settings-page {
  // Using shared .settings-page from common.scss, with wider max-width
  max-width: 720px;

  // Only view-specific styles below

  &__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__service-card {
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-lg);
    overflow: hidden;
  }

  &__card-body {
    padding: var(--arc-space-sm) var(--arc-space-md);
  }

  &__card-top {
    display: flex;
    align-items: center;
    gap: var(--arc-space-sm);
  }

  &__card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--arc-space-xs);
  }

  &__service-name {
    @include font-body;
    font-weight: 500;
  }

  &__service-type {
    @include font-label-sm;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--arc-radius-sm);
    background: var(--arc-bg-soft);
    color: var(--arc-text-secondary);
    display: inline-flex;
    align-items: center;
  }

  &__more {
    border: none;
    color: var(--arc-text-placeholder);

    &:hover {
      color: var(--arc-text-primary);
    }
  }

  &__card-detail {
    margin-top: var(--arc-space-xs);
    @include font-mono;
    font-size: 12px;
    color: var(--arc-text-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__card-env {
    margin-top: var(--arc-space-xs);
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  &__env-tag {
    @include font-mono;
    font-size: 11px;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--arc-radius-sm);
    background: var(--arc-bg-soft);
    color: var(--arc-text-secondary);
    display: inline-flex;
    align-items: center;
  }

  // ── Form helpers ──

  &__arg-list,
  &__env-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
  }

  &__arg-item,
  &__env-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: var(--arc-bg-soft);
    border-radius: var(--arc-radius-sm);

    code {
      @include font-mono;
      font-size: 12px;
    }
  }

  &__arg-input,
  &__env-input {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  &__env-key {
    width: 160px;
  }

  &__env-val {
    flex: 1;
  }
}
</style>
