<script setup lang="ts">
import { ArrowRight, Operation } from '@element-plus/icons-vue'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAiChat } from '@/composables/useAiChat'
import type { FileAttachment, McpService, SkillItem } from '@/types/ai'
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
const attachments = ref<FileAttachment[]>([])
const sidebarVisible = ref(true)
const isAttaching = ref(false)
const skills = ref<SkillItem[]>([])
const mcpServices = ref<McpService[]>([])
const webSearch = ref(false)
const webSearchConfigured = ref(false)
const activeSkillIds = ref<string[]>([])
const activeMcpIds = ref<string[]>([])
const messagesEl = ref<HTMLElement | null>(null)
const autoScroll = ref(true)

// 自动滚动到最底部，显示最新内容
function scrollToBottom() {
  const el = messagesEl.value
  if (!el) return
  nextTick(() => {
    el.scrollTop = el.scrollHeight
  })
}

// 流式内容变化时自动滚动到最新内容
let scrollRaf: number | null = null
watch(
  () => messages.value.at(-1)?.content,
  () => {
    if (!autoScroll.value) return
    if (scrollRaf) cancelAnimationFrame(scrollRaf)
    scrollRaf = requestAnimationFrame(() => {
      scrollToBottom()
      scrollRaf = null
    })
  },
)

// 用户手动滚动时，判断是否应暂停自动滚动
function handleScroll() {
  const el = messagesEl.value
  if (!el) return
  const threshold = 120 // 底部 120px 以内视为"在底部"
  autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

onMounted(async () => {
  loadSessions()

  // 加载 Skills、MCP 服务和 Web Search 配置
  if (api) {
    try {
      skills.value = await api.getSkills()
    } catch {
      /* ignore */
    }
    try {
      mcpServices.value = await api.getMcpServices()
    } catch {
      /* ignore */
    }
    try {
      const raw = await api.getConfig('web_search_config')
      if (raw) {
        const cfg = JSON.parse(raw)
        webSearchConfigured.value = !!cfg.api_key
      }
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
      sendMessage(`「${fileName}」，路径：${filePath}`)
    })
  }
})

async function handleSend(text: string) {
  if (!text.trim() && attachments.value.length === 0) return
  const files = attachments.value.length > 0 ? [...attachments.value] : undefined
  attachments.value = []
  await sendMessage(
    text,
    {
      activeSkillIds: activeSkillIds.value,
      activeMcpServiceIds: activeMcpIds.value,
      webSearch: webSearch.value,
    },
    files,
  )
}

async function handleAttachFile() {
  if (!api) return
  if (isStreaming.value) return

  const filePath = await api.openFileDialog()
  if (!filePath) return

  const fileName = filePath.split(/[/\\]/).pop() || filePath
  let content = ''
  try {
    content = await api.readFileText(filePath)
  } catch {
    // binary or unreadable file — still attach with empty content
  }

  attachments.value.push({
    name: fileName,
    path: filePath,
    content,
    size: content.length,
  })
}

function handleRemoveAttachment(index: number) {
  attachments.value.splice(index, 1)
}

function toggleListItem(list: string[], id: string) {
  const idx = list.indexOf(id)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(id)
}

function handleToggleSkill(skillId: string) {
  toggleListItem(activeSkillIds.value, skillId)
}

function handleToggleMcp(serviceId: string) {
  toggleListItem(activeMcpIds.value, serviceId)
}

function handleToggleWebSearch(enabled: boolean) {
  webSearch.value = enabled
}

function handleNewSession() {
  attachments.value = []
  activeSkillIds.value = []
  activeMcpIds.value = []
  webSearch.value = false
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
        <el-button
          :icon="sidebarVisible ? Operation : ArrowRight"
          text
          size="small"
          class="chat__sidebar-toggle"
          :title="sidebarVisible ? '收起侧栏' : '展开侧栏'"
          @click="sidebarVisible = !sidebarVisible"
        />
      </div>
      <div class="chat__messages" ref="messagesEl" @scroll="handleScroll">
        <template v-if="messages.length === 0">
          <div class="chat__empty">
            <div class="chat__empty-icon">
              <img src="/logo.svg" alt="ArcOffice" width="48" height="48" />
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
        <!-- 用户向上滚动时出现"回到底部"按钮 -->
        <Transition name="fade">
          <el-button
            v-if="!autoScroll && messages.length > 0"
            class="chat__scroll-bottom"
            round
            size="small"
            @click="scrollToBottom(); autoScroll = true"
            title="回到最新回复"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span style="margin-left:4px" v-if="isStreaming">AI 正在回复中</span>
            <span style="margin-left:4px" v-else>回到最新消息</span>
          </el-button>
        </Transition>
      </div>
      <ChatInput
        :attachments="attachments"
        :disabled="isStreaming || isAttaching"
        :web-search="webSearch"
        :web-search-configured="webSearchConfigured"
        :skills="skills"
        :mcp-services="mcpServices"
        :active-skill-ids="activeSkillIds"
        :active-mcp-ids="activeMcpIds"
        @send="handleSend"
        @attach="handleAttachFile"
        @remove-attachment="handleRemoveAttachment"
        @toggle-skill="handleToggleSkill"
        @toggle-mcp="handleToggleMcp"
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
    --el-button-size: 28px;
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

  // 回到底部按钮
  &__scroll-bottom {
    position: sticky;
    bottom: var(--arc-space-sm);
    align-self: center;
    z-index: 10;
    margin-top: -36px;
    box-shadow: var(--arc-shadow-md);
  }
}

// 淡入淡出过渡（用于 scroll-bottom 按钮）
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
