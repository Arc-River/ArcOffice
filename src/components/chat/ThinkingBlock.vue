<script setup lang="ts">
/**
 * ThinkingBlock — markstream-vue 自定义 <thinking> 标签渲染组件
 *
 * 可折叠的 AI 思考过程块，内部嵌套 Markdown 流式渲染。
 * 通过 setCustomComponents({ thinking: ThinkingBlock }) 注册到 markstream-vue。
 *
 * Props 说明：
 * - node: markstream-vue 传入的 AST 节点，含 htmlTag / content / children
 *         对于 customHtmlTag，content 是标签内文本原始内容
 * - isDark: 暗色模式
 * - customId: 用于 scoped 样式覆盖
 */

import MarkdownRender from 'markstream-vue'
import { computed, ref } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { chatPreset, codeBlockThemes } from '@/utils/markstream'

const props = defineProps<{
  node?: Record<string, unknown>
  isDark?: boolean
  customId?: string
}>()

const themeStore = useThemeStore()
const expanded = ref(true) // 默认展开

/** 从 node 提取标签内部文本内容 */
const innerContent = computed(() => {
  const node = props.node
  if (!node) return ''
  // 尝试多种可能的属性名
  const content =
    typeof node.content === 'string'
      ? node.content
      : typeof node.text === 'string'
        ? node.text
        : typeof node.value === 'string'
          ? node.value
          : ''
  return content
})
</script>

<template>
  <details
    class="thinking-block"
    :class="{ 'thinking-block--collapsed': !expanded }"
    :open="expanded"
    :data-custom-id="customId || ''"
  >
    <summary class="thinking-block__summary" @click.prevent="expanded = !expanded">
      <span class="thinking-block__icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
          <line x1="9" y1="17" x2="15" y2="17" />
          <path d="M12 22v-5" />
        </svg>
      </span>
      <span class="thinking-block__label">思考过程</span>
      <span class="thinking-block__arrow">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </span>
    </summary>
    <div v-if="innerContent" class="thinking-block__body">
      <MarkdownRender
        v-bind="chatPreset"
        :content="innerContent"
        :final="true"
        :is-dark="themeStore.isDark"
        :code-block-dark-theme="codeBlockThemes.codeBlockDarkTheme"
        :code-block-light-theme="codeBlockThemes.codeBlockLightTheme"
        html-policy="escape"
      />
    </div>
    <!-- fallback: 如果 node.content 为空，尝试渲染默认插槽 -->
    <div v-else class="thinking-block__body">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.thinking-block {
  margin: var(--arc-space-xs) 0;
  border: 1px solid var(--arc-border);
  border-radius: var(--arc-radius-lg);
  background: var(--arc-bg-soft);
  overflow: hidden;
}

.thinking-block__summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
  font-size: 0.85em;
  color: var(--arc-text-secondary);
  transition: background 200ms;
  -webkit-user-select: none;
  list-style: none;
}

.thinking-block__summary::-webkit-details-marker {
  display: none;
}

.thinking-block__summary:hover {
  background: var(--arc-bg-hover);
}

.thinking-block__icon {
  display: flex;
  align-items: center;
  opacity: 0.6;
}

.thinking-block__label {
  flex: 1;
  font-weight: 500;
}

.thinking-block__arrow {
  display: flex;
  align-items: center;
  transition: transform 200ms;
}

.thinking-block--collapsed .thinking-block__arrow {
  transform: rotate(-90deg);
}

.thinking-block__body {
  padding: var(--arc-space-xs) var(--arc-space-sm);
  border-top: 1px solid var(--arc-border);
  line-height: 1.5;
}
</style>
