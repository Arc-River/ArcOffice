<script setup lang="ts">
import { UserFilled } from '@element-plus/icons-vue'
import MarkdownRender from 'markstream-vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'
import { chatPreset, codeBlockThemes } from '@/utils/markstream'

defineProps<{
  role: string
  content: string
  isStreaming?: boolean
}>()

const themeStore = useThemeStore()
const { t } = useI18n()
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
    <!-- Avatar -->
    <div class="chat-message__avatar" :class="`chat-message__avatar--${role}`">
      <template v-if="role === 'user'">
        <el-icon :size="18"><UserFilled /></el-icon>
      </template>
      <template v-else-if="role === 'assistant'">
        <img src="/logo.svg" width="18" height="18" alt="ArcOffice" />
      </template>
      <template v-else>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      </template>
    </div>

    <div class="chat-message__body">
      <div class="chat-message__role-label">
        {{ role === 'user' ? t('chat.roleUser') : role === 'assistant' ? t('chat.roleAssistant') : '' }}
      </div>
      <div class="chat-message__content">
        <template v-if="role === 'tool'">
          <div class="chat-message__tool-label">{{ content }}</div>
        </template>

        <!-- Markdown 渲染（用户 + AI 共用） -->
        <MarkdownRender
          v-else
          v-bind="chatPreset"
          :content="content"
          :final="role === 'user' || !isStreaming"
          :is-dark="themeStore.isDark"
          :code-block-dark-theme="codeBlockThemes.codeBlockDarkTheme"
          :code-block-light-theme="codeBlockThemes.codeBlockLightTheme"
          :custom-html-tags="role === 'assistant' ? ['thinking'] : undefined"
          html-policy="escape"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-message {
  display: flex;
  gap: var(--arc-space-xs);
  margin: var(--arc-space-xs) 0;
  max-width: 85%;

  &--user {
    align-self: flex-end;
    flex-direction: row-reverse;

    .chat-message__role-label {
      text-align: right;
    }

    .chat-message__content {
      background: var(--arc-brand-blue);
      color: #fff;
      border-radius: var(--arc-radius-lg) var(--arc-radius-sm) var(--arc-radius-lg) var(--arc-radius-lg);
      box-shadow: var(--arc-shadow-sm);
    }

    .chat-message__content :deep(code) {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }

    .chat-message__content :deep(pre) {
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .chat-message__content :deep(a) {
      color: rgba(255, 255, 255, 0.85);
      text-decoration: underline;
    }
  }

  &--assistant {
    align-self: flex-start;

    .chat-message__content {
      background: var(--arc-bg-canvas);
      color: var(--arc-text-primary);
      border: 1px solid var(--arc-border);
      border-radius: var(--arc-radius-sm) var(--arc-radius-lg) var(--arc-radius-lg) var(--arc-radius-lg);
      box-shadow: var(--arc-shadow-sm);
    }

    .chat-message__content :deep(pre) {
      background: var(--arc-bg-soft);
    }

    .chat-message__content :deep(code) {
      background: var(--arc-bg-soft);
      color: var(--arc-text-primary);
    }
  }

  &--tool {
    align-self: center;
    max-width: 92%;

    .chat-message__content {
      background: var(--arc-bg-soft);
      border: 1px solid var(--arc-border);
      color: var(--arc-text-secondary);
      border-radius: var(--arc-radius-lg);
      @include font-body-sm;
    }
  }

  // ── Avatar ──
  &__avatar {
    width: 32px;
    height: 32px;
    border-radius: var(--arc-radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;

    &--user {
      background: var(--arc-brand-blue);
      color: #fff;
    }

    &--assistant {
      background: var(--arc-accent-lime-soft);
      padding: 5px;
    }

    &--tool {
      display: none;
    }
  }

  // ── Body (role label + content) ──
  &__body {
    flex: 1;
    min-width: 0;
  }

  &__role-label {
    @include font-body-xs;
    font-weight: 500;
    color: var(--arc-text-placeholder);
    margin: 0 0 2px 4px;
  }

  &__content {
    padding: var(--arc-space-sm) var(--arc-space-md);
    @include font-body;
    line-height: 1.6;

    // Markdown spacing inside bubbles
    :deep(p) {
      margin: 0;
      &:not(:first-child) {
        margin-top: 0.5em;
      }
    }

    :deep(ul),
    :deep(ol) {
      margin: 0.25em 0;
      padding-left: 1.5em;
    }

    :deep(li) {
      margin: 0.15em 0;
    }

    :deep(blockquote) {
      margin: 0.5em 0;
      padding: 0.25em 0.75em;
      border-left: 3px solid var(--arc-border);
      color: var(--arc-text-secondary);
    }

    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4) {
      margin: 0.75em 0 0.25em;
      font-weight: 600;
    }

    :deep(h1) { font-size: 1.2em; }
    :deep(h2) { font-size: 1.1em; }
    :deep(h3) { font-size: 1.05em; }
    :deep(h4) { font-size: 1em; }

    :deep(table) {
      border-collapse: collapse;
      width: 100%;
      margin: 0.5em 0;
      font-size: 0.9em;
    }

    :deep(th),
    :deep(td) {
      border: 1px solid var(--arc-border);
      padding: 6px 10px;
      text-align: left;
    }

    :deep(th) {
      background: var(--arc-bg-soft);
      font-weight: 600;
    }

    :deep(hr) {
      border: none;
      border-top: 1px solid var(--arc-border);
      margin: 0.75em 0;
    }

    // Code blocks
    :deep(pre) {
      border-radius: var(--arc-radius-md);
      font-size: 0.875em;
      margin: var(--arc-space-xs) 0;
      padding: var(--arc-space-sm);
    }

    // Inline code
    :deep(code) {
      font-size: 0.875em;
      padding: 0.15em 0.4em;
      border-radius: var(--arc-radius-xs);
    }

    // Mermaid / D2 charts
    :deep(.markstream-mermaid),
    :deep(.markstream-d2) {
      margin: var(--arc-space-sm) 0;
      padding: var(--arc-space-sm);
      background: var(--arc-bg-canvas);
      border-radius: var(--arc-radius-lg);
      border: 1px solid var(--arc-border);
    }

    // stream-diffs diff blocks
    :deep(.markstream-diff) {
      margin: var(--arc-space-xs) 0;
      border-radius: var(--arc-radius-md);
      font-size: 0.85em;
    }

    // Thinking tags
    :deep(.markstream-thinking) {
      display: block;
      margin: var(--arc-space-xs) 0;
      padding: var(--arc-space-sm);
      background: var(--arc-bg-soft);
      border-left: 3px solid var(--arc-accent-lilac);
      border-radius: var(--arc-radius-md);
      font-size: 0.9em;
      color: var(--arc-text-secondary);
    }
  }
}
</style>
