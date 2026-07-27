<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { getElectronAPI } from '@/utils/ipc'

const api = getElectronAPI()
// biome-ignore lint/correctness/noUnusedVariables: used in template
const themeStore = useThemeStore()
// biome-ignore lint/correctness/noUnusedVariables: used in template
const autoSave = ref(true)
// biome-ignore lint/correctness/noUnusedVariables: used in template
const restoreSession = ref(true)
// biome-ignore lint/correctness/noUnusedVariables: used in template
const language = ref('zh-CN')
const workingDir = ref('')

// Web Search config
const wsProvider = ref('tavily')
const wsApiKey = ref('')
const wsSaving = ref(false)

onMounted(async () => {
  if (!api) return
  try {
    const saved = await api.getConfig('working_dir')
    if (saved) workingDir.value = saved
  } catch {
    // DB not available
  }

  // Load web search config
  try {
    const raw = await api.getConfig('web_search_config')
    if (raw) {
      const config = JSON.parse(raw)
      wsProvider.value = config.provider || 'tavily'
      wsApiKey.value = config.api_key || ''
    }
  } catch {
    // ignore
  }
})

async function selectWorkingDir() {
  if (!api) return
  const dir = await api.selectDirectory()
  if (!dir) return
  workingDir.value = dir
  try {
    await api.setConfig('working_dir', dir)
  } catch {
    // ignore
  }
}

async function saveWebSearch() {
  if (!api) return
  wsSaving.value = true
  try {
    await api.setConfig('web_search_config', JSON.stringify({ provider: wsProvider.value, api_key: wsApiKey.value }))
    ElMessage.success('Web Search 配置已保存')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    wsSaving.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <h2 class="settings-page__title">通用设置</h2>
    <div class="settings-page__section">
      <div class="settings-page__row">
        <div>
          <div class="settings-page__row-label">自动保存</div>
          <div class="settings-page__row-desc">修改后自动保存文档</div>
        </div>
        <el-switch v-model="autoSave" />
      </div>
      <div class="settings-page__row">
        <div>
          <div class="settings-page__row-label">启动时恢复上次会话</div>
          <div class="settings-page__row-desc">重新打开时自动恢复对话</div>
        </div>
        <el-switch v-model="restoreSession" />
      </div>
      <div class="settings-page__row">
        <div>
          <div class="settings-page__row-label">界面语言</div>
          <div class="settings-page__row-desc">界面显示语言</div>
        </div>
        <el-select v-model="language" size="small" style="width: 140px">
          <el-option value="zh-CN" label="简体中文" />
        </el-select>
      </div>
      <div class="settings-page__row">
        <div>
          <div class="settings-page__row-label">工作目录</div>
          <div class="settings-page__row-desc">AI 文件操作和文件浏览的工作空间</div>
        </div>
        <div class="settings-page__dir-picker">
          <span class="settings-page__dir-path" :title="workingDir">{{ workingDir || '未设置' }}</span>
          <el-button size="small" @click="selectWorkingDir">选择目录</el-button>
        </div>
      </div>
      <div class="settings-page__row">
        <div>
          <div class="settings-page__row-label">主题模式</div>
          <div class="settings-page__row-desc">选择浅色、深色或跟随系统</div>
        </div>
        <el-select
          :model-value="themeStore.mode"
          @update:model-value="themeStore.setMode"
          size="small"
          style="width: 140px"
        >
          <el-option value="light" label="浅色" />
          <el-option value="dark" label="深色" />
          <el-option value="auto" label="跟随系统" />
        </el-select>
      </div>
    </div>

    <!-- Web Search 配置 -->
    <h2 class="settings-page__title" style="margin-top: var(--arc-space-lg)">Web Search</h2>
    <div class="settings-page__section">
      <div class="settings-page__row">
        <div>
          <div class="settings-page__row-label">搜索服务商</div>
          <div class="settings-page__row-desc">目前仅支持 Tavily</div>
        </div>
        <el-select v-model="wsProvider" size="small" style="width: 140px" disabled>
          <el-option value="tavily" label="Tavily" />
        </el-select>
      </div>
      <div class="settings-page__row">
        <div style="flex: 1; min-width: 0;">
          <div class="settings-page__row-label">API Key</div>
          <div class="settings-page__row-desc">从 <a href="https://tavily.com" target="_blank" rel="noopener">tavily.com</a> 获取，每月 1000 次免费查询</div>
        </div>
        <div class="settings-page__ws-api-key">
          <el-input
            v-model="wsApiKey"
            type="password"
            show-password
            placeholder="tvly-..."
            size="small"
            style="width: 200px"
            clearable
          />
          <el-button size="small" type="primary" :loading="wsSaving" @click="saveWebSearch">
            保存
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-page {
  // Using shared .settings-page from common.scss
  // Only view-specific styles below

  &__section {
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-lg);
    overflow: hidden;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--arc-space-sm) var(--arc-space-md);
    border-bottom: 1px solid var(--arc-border);

    &:last-child {
      border-bottom: none;
    }

    &-label {
      @include font-body;
      font-weight: 500;
    }

    &-desc {
      @include font-body-xs;
      color: var(--arc-text-placeholder);
      margin-top: 2px;
    }
  }

  &__dir-picker {
    display: flex;
    align-items: center;
    gap: var(--arc-space-xs);
    max-width: 70%;
  }

  &__dir-path {
    @include font-body-sm;
    color: var(--arc-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  &__ws-api-key {
    display: flex;
    align-items: center;
    gap: var(--arc-space-xs);
  }

  a {
    color: var(--arc-brand-blue);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
