<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: used in template
import MarkdownRender from 'markstream-vue'
import { useThemeStore } from '@/stores/theme'

defineProps<{
  role: string
  content: string
  isStreaming?: boolean
}>()

// biome-ignore lint/correctness/noUnusedVariables: used in template
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
      <div v-if="role === 'tool'" class="chat-message__tool-label">系统</div>
      <MarkdownRender
        v-if="role === 'assistant'"
        mode="chat"
        :content="content"
        :final="!isStreaming"
        :is-dark="themeStore.isDark"
        :fade="false"
        :max-live-nodes="0"
        :batch-rendering="true"
        :render-batch-size="16"
        :render-batch-delay="8"
        :render-batch-budget-ms="4"
        html-policy="escape"
      />
      <template v-else>{{ content }}</template>
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
</style>
