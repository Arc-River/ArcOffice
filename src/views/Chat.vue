<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAiChat } from '@/composables/useAiChat'
import type { PromptTemplate, SkillItem } from '@/types/ai'
import { getElectronAPI } from '@/utils/ipc'

const api = getElectronAPI()

const {
  messages,
  sessions,
  isStreaming,
  currentSessionId,
  sendMessage,
  clearMessages,
  loadSessions,
  createSession,
  deleteSession,
  renameSession,
  switchSession,
} = useAiChat()

const route = useRoute()
const router = useRouter()
const currentFile = ref<string | null>(null)
const sidebarVisible = ref(true)
const isAttaching = ref(false)
const prompts = ref<PromptTemplate[]>([])
const skills = ref<SkillItem[]>([])
const webSearch = ref(false)

onMounted(async () => {
  loadSessions()

  // 加载 Prompt 模板和 Skills
  if (api) {
    try {
      prompts.value = await api.getPrompts()
    } catch {
      /* ignore */
    }
    try {
      skills.value = await api.getSkills()
    } catch {
      /* ignore */
    }
  }

  // 从文件页面通过 ?file=/path 跳转过来时，自动发送文件处理请求
  const filePath = route.query.file as string | undefined
  if (filePath) {
    router.replace({ query: {} })
    const fileName = filePath.split(/[/\\]/).pop() || filePath
    currentFile.value = fileName
    nextTick(() => {
      sendMessage(`请帮我处理文件「${fileName}」，路径：${filePath}`)
    })
  }
})

async function handleSend(text: string) {
  if (!text.trim()) return
  await sendMessage(text)
}

async function handleAttachFile() {
  if (!api) return
  if (isStreaming.value) return

  const filePath = await api.openFileDialog()
  if (!filePath) return

  const fileName = filePath.split(/[/\\]/).pop() || filePath
  currentFile.value = fileName

  await sendMessage(`请帮我处理文件「${fileName}」，路径：${filePath}`)
}

function handleInsertPrompt(p: PromptTemplate) {
  sendMessage(p.content)
}

function handleSelectSkill(_skillName: string) {
  sendMessage(`请使用技能: ${_skillName}`)
}

function handleToggleWebSearch(enabled: boolean) {
  webSearch.value = enabled
}

function handleNewSession() {
  currentFile.value = null
  createSession()
}
</script>

<template>
  <div class="chat">
    <ChatSessionList
      v-show="sidebarVisible"
      :sessions="sessions"
      :active-session="currentSessionId"
      @select="switchSession"
      @new-session="handleNewSession"
      @delete="deleteSession"
      @rename="renameSession"
    />
    <div class="chat__main">
      <div class="chat__toolbar">
        <button class="chat__sidebar-toggle" @click="sidebarVisible = !sidebarVisible" :title="sidebarVisible ? '收起侧栏' : '展开侧栏'">
          <svg v-if="sidebarVisible" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>
      <div class="chat__messages">
        <template v-if="messages.length === 0">
          <div class="chat__empty">
            <div class="chat__empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="1.5" fill="var(--arc-brand-blue)" opacity="0.7" />
                <rect x="14" y="2" width="8" height="8" rx="1.5" fill="var(--arc-brand-blue)" opacity="0.5" />
                <rect x="2" y="14" width="8" height="8" rx="1.5" fill="var(--arc-brand-blue)" opacity="0.5" />
                <rect x="14" y="14" width="8" height="8" rx="1.5" fill="var(--arc-brand-blue)" />
              </svg>
            </div>
            <p class="chat__empty-text">开始与 AI 对话</p>
            <p class="chat__empty-hint">
              {{ isStreaming ? 'AI 正在回复…' : '输入内容开始对话，或附加文件进行分析' }}
            </p>
          </div>
        </template>
        <ChatMessage
          v-for="(msg, index) in messages"
          :key="index"
          :role="msg.role"
          :content="msg.content"
          :is-streaming="isStreaming && index === messages.length - 1 && msg.role === 'assistant'"
        />
      </div>
      <ChatInput
        :current-file="currentFile"
        :disabled="isStreaming || isAttaching"
        :web-search="webSearch"
        :prompts="prompts"
        :skills="skills"
        @send="handleSend"
        @attach="handleAttachFile"
        @insert-prompt="handleInsertPrompt"
        @select-skill="handleSelectSkill"
        @toggle-web-search="handleToggleWebSearch"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat {
  display: flex;
  height: 100%;
  overflow: hidden;

  &__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    padding: var(--arc-space-xs) var(--arc-space-sm);
    border-bottom: 1px solid var(--arc-border);
    flex-shrink: 0;
  }

  &__sidebar-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: var(--arc-radius-sm);
    color: var(--arc-text-secondary);
    cursor: pointer;

    &:hover {
      color: var(--arc-brand-blue);
      background: var(--arc-bg-hover);
    }
  }

  &__messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--arc-space-md);
    display: flex;
    flex-direction: column;
    gap: var(--arc-space-xs);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: var(--arc-space-sm);
    text-align: center;
  }

  &__empty-icon {
    margin-bottom: var(--arc-space-xs);
    opacity: 0.6;
  }

  &__empty-text {
    @include font-title;
    color: var(--arc-text-primary);
  }

  &__empty-hint {
    @include font-body-sm;
    color: var(--arc-text-placeholder);
  }
}
</style>
