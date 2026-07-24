<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PromptTemplate, SkillItem } from '@/types/ai'

const props = defineProps<{
  currentFile: string | null
  disabled?: boolean
  webSearch?: boolean
  prompts?: PromptTemplate[]
  skills?: SkillItem[]
}>()

const emit = defineEmits<{
  send: [text: string]
  attach: []
  insertPrompt: [prompt: PromptTemplate]
  selectSkill: [skill: SkillItem]
  toggleWebSearch: [enabled: boolean]
}>()

const text = ref('')
const showTools = ref(false)
const showPrompts = ref(false)
const showSkills = ref(false)

const enabledSkills = computed(() => props.skills?.filter((s) => s.enabled) || [])

function handleSend() {
  if (!text.value.trim()) return
  emit('send', text.value)
  text.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function selectPrompt(p: PromptTemplate) {
  emit('insertPrompt', p)
  showPrompts.value = false
}

function selectSkill(s: SkillItem) {
  emit('selectSkill', s.name)
  showSkills.value = false
}

function toggleTools() {
  showTools.value = !showTools.value
}
</script>

<template>
  <div class="chat-input">
    <!-- Current file chip -->
    <div class="chat-input__tools" v-if="currentFile">
      <span class="chat-input__chip">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
        </svg>
        {{ currentFile }}
      </span>
    </div>

    <!-- Input bar -->
    <div class="chat-input__bar">
      <input
        class="chat-input__field"
        v-model="text"
        placeholder="Ask anything, or task an agent..."
        @keydown="handleKeydown"
        :disabled="disabled"
      />
      <button class="chat-input__btn" title="展开工具" @click="toggleTools" :class="{ 'chat-input__btn--active': showTools }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      <button class="chat-input__send" @click="handleSend" :disabled="disabled || !text.trim()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>

    <!-- Tool buttons row -->
    <div class="chat-input__tools-row" v-if="showTools">
      <button class="chat-input__tool-btn" title="附加文件" @click="emit('attach')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.31 2.69 6 6 6s6-2.69 6-6V6h-2.5z" />
        </svg>
        <span>Add files & photos</span>
      </button>

      <button class="chat-input__tool-btn" title="Prompt 模板" @click="showPrompts = !showPrompts">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
          <path d="M14 2v6h6" />
        </svg>
        <span>Prompts</span>
      </button>

      <button class="chat-input__tool-btn" title="Skills" @click="showSkills = !showSkills" v-if="enabledSkills.length > 0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
        </svg>
        <span>Skills</span>
      </button>

      <label class="chat-input__tool-btn chat-input__tool-btn--toggle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
        <span>Web search</span>
        <span class="chat-input__toggle-label" :class="{ 'chat-input__toggle-label--on': webSearch }" @click.prevent="emit('toggleWebSearch', !webSearch)">{{ webSearch ? 'Auto' : 'Off' }}</span>
      </label>
    </div>

    <!-- Prompts popover -->
    <div v-if="showPrompts && prompts && prompts.length > 0" class="chat-input__popover">
      <div class="chat-input__popover-header">Prompt 模板</div>
      <button
        v-for="p in prompts"
        :key="p.id"
        class="chat-input__popover-item"
        @click="selectPrompt(p)"
      >
        <span class="chat-input__popover-name">{{ p.name }}</span>
        <span class="chat-input__popover-preview">{{ p.content }}</span>
      </button>
      <div v-if="!prompts || prompts.length === 0" class="chat-input__popover-empty">暂无模板</div>
    </div>

    <!-- Skills popover -->
    <div v-if="showSkills && enabledSkills.length > 0" class="chat-input__popover">
      <div class="chat-input__popover-header">Skills</div>
      <button
        v-for="s in enabledSkills"
        :key="s.id"
        class="chat-input__popover-item"
        @click="selectSkill(s)"
      >
        <span class="chat-input__popover-name">{{ s.name }}</span>
        <span class="chat-input__popover-preview">{{ s.description }}</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-input {
  padding: var(--arc-space-sm) var(--arc-space-md);
  border-top: 1px solid var(--arc-border);
  background: var(--arc-bg-canvas);
  position: relative;

  &__bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-xl);
    transition: border-color 200ms;

    &:focus-within {
      border-color: var(--arc-brand-blue);
    }
  }

  &__field {
    flex: 1;
    border: none;
    background: transparent;
    @include font-body-sm;
    color: var(--arc-text-primary);
    outline: none;
    min-height: 22px;

    &::placeholder {
      color: var(--arc-text-placeholder);
    }

    &:disabled {
      opacity: 0.5;
    }
  }

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: var(--arc-radius-sm);
    cursor: pointer;
    color: var(--arc-text-placeholder);
    flex-shrink: 0;
    transition: color 200ms, background 200ms;

    &:hover {
      color: var(--arc-brand-blue);
      background: var(--arc-bg-hover);
    }

    &--active {
      color: var(--arc-brand-blue);
      background: var(--arc-bg-soft);
    }
  }

  &__send {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: var(--arc-brand-blue);
    border-radius: 50%;
    cursor: pointer;
    color: #fff;
    flex-shrink: 0;
    transition: opacity 200ms;

    &:hover {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.3;
      cursor: default;
    }
  }

  &__tools {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }

  &__chip {
    @include font-label-sm;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 7px;
    border-radius: var(--arc-radius-sm);
    background: var(--arc-bg-soft);
    color: var(--arc-text-secondary);
  }

  // ── Tool buttons row ──

  &__tools-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  &__tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 8px;
    border: 1px solid var(--arc-border);
    background: var(--arc-bg-soft);
    border-radius: var(--arc-radius-lg);
    @include font-label-sm;
    color: var(--arc-text-secondary);
    cursor: pointer;
    transition: all 200ms;

    svg {
      flex-shrink: 0;
    }

    &:hover {
      border-color: var(--arc-brand-blue);
      color: var(--arc-brand-blue);
      background: var(--arc-bg-hover);
    }

    &--toggle {
      gap: 4px;
      cursor: default;
    }
  }

  &__toggle-label {
    @include font-label-sm;
    padding: 0 5px;
    border-radius: var(--arc-radius-sm);
    background: var(--arc-bg-canvas);
    color: var(--arc-text-placeholder);
    cursor: pointer;
    transition: all 200ms;

    &--on {
      color: var(--arc-brand-blue);
      background: rgba(22, 119, 255, 0.1);
    }
  }

  // ── Popover ──

  &__popover {
    position: absolute;
    bottom: calc(100% - var(--arc-space-sm));
    left: var(--arc-space-md);
    right: var(--arc-space-md);
    max-height: 240px;
    overflow-y: auto;
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-lg);
    box-shadow: var(--arc-shadow-lg);
    z-index: 100;
  }

  &__popover-header {
    @include font-label-sm;
    padding: var(--arc-space-xs) var(--arc-space-sm);
    color: var(--arc-text-secondary);
    border-bottom: 1px solid var(--arc-border);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  &__popover-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    padding: var(--arc-space-xs) var(--arc-space-sm);
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 200ms;

    &:hover {
      background: var(--arc-bg-hover);
    }

    &:not(:last-child) {
      border-bottom: 1px solid var(--arc-border);
    }
  }

  &__popover-name {
    @include font-body-sm;
    font-weight: 500;
    color: var(--arc-text-primary);
  }

  &__popover-preview {
    @include font-body-xs;
    color: var(--arc-text-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__popover-empty {
    @include font-body-sm;
    color: var(--arc-text-placeholder);
    text-align: center;
    padding: var(--arc-space-sm);
  }
}
</style>
