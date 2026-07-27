<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { chatPreset, codeBlockThemes } from '@/utils/markstream'

defineProps<{
  role: string
  content: string
  isStreaming?: boolean
}>()

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const themeStore = useThemeStore()
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'chat-message--user': role === 'user',
      'chat-message--assistant': role === 'assistant',
      'chat-message--tool': role === 'tool',
    }"
  >
    <div v-if="role === 'tool'" class="chat-message__tool-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
      </svg>
    </div>
    <div class="chat-message__content">
      <div v-if="role === 'tool'" class="chat-message__tool-label">{{ t('chat.systemTag') }}</div>

      <!-- 用户/工具消息：纯文本 -->
      <template v-if="role !== 'assistant'">{{ content }}</template>

      <!-- AI 回复：流式 Markdown 渲染（含自定义 <thinking> 标签） -->
      <MarkdownRender
        v-else
        v-bind="chatPreset"
        :content="content"
        :final="!isStreaming"
        :is-dark="themeStore.isDark"
        :code-block-dark-theme="codeBlockThemes.codeBlockDarkTheme"
        :code-block-light-theme="codeBlockThemes.codeBlockLightTheme"
        :custom-html-tags="['thinking']"
        html-policy="escape"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-message {
  max-width: 78%;
  padding: var(--arc-space-sm) var(--arc-space-md);
  border-radius: var(--arc-radius-xl);
  @include font-body;
  line-height: 1.55;
  margin: 4px 0;

  &--user {
    background: var(--arc-brand-blue);
    color: #fff;
    align-self: flex-end;
    border-bottom-right-radius: var(--arc-radius-sm);
  }

  &--assistant {
    background: var(--arc-accent-lime-soft);
    color: var(--arc-text-primary);
    align-self: flex-start;
    border-bottom-left-radius: var(--arc-radius-sm);
    padding: var(--arc-space-xs) var(--arc-space-sm);
  }

  &--tool {
    background: var(--arc-bg-soft);
    border: 1px solid var(--arc-border);
    color: var(--arc-text-secondary);
    align-self: flex-start;
    max-width: 92%;
    border-radius: var(--arc-radius-lg);
    display: flex;
    gap: var(--arc-space-xs);
    @include font-body-sm;
  }

  &__tool-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  &__tool-label {
    font-weight: 500;
    color: var(--arc-text-primary);
    margin-bottom: 2px;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }
}

/* ── markstream-vue 全局样式覆盖 ── */

/* 代码块 */
.chat-message__content :deep(pre) {
  border-radius: var(--arc-radius-md);
  font-size: 0.875em;
  margin: var(--arc-space-xs) 0;
}

/* 行内代码 */
.chat-message__content :deep(code) {
  font-size: 0.875em;
  padding: 0.15em 0.4em;
  border-radius: var(--arc-radius-xs);
  background: var(--arc-bg-soft);
}

/* Mermaid / D2 图表容器 */
.chat-message__content :deep(.markstream-mermaid),
.chat-message__content :deep(.markstream-d2) {
  margin: var(--arc-space-sm) 0;
  padding: var(--arc-space-sm);
  background: var(--arc-bg-canvas);
  border-radius: var(--arc-radius-lg);
  border: 1px solid var(--arc-border);
}

/* stream-diffs diff 块 */
.chat-message__content :deep(.markstream-diff) {
  margin: var(--arc-space-xs) 0;
  border-radius: var(--arc-radius-md);
  font-size: 0.85em;
}
</style>
