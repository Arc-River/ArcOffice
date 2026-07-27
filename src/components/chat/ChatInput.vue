<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import IconMcp from '@/components/icons/IconMcp.vue'
import IconSkills from '@/components/icons/IconSkills.vue'
import type { FileAttachment, McpService, SkillItem } from '@/types/ai'
import { getSkillColor, getSkillIcon } from '@/utils/skill-icons'

const props = defineProps<{
  attachments: FileAttachment[]
  disabled?: boolean
  webSearch?: boolean
  webSearchConfigured?: boolean
  skills?: SkillItem[]
  mcpServices?: McpService[]
  activeSkillIds?: string[]
  activeMcpIds?: string[]
}>()

const emit = defineEmits<{
  send: [text: string]
  attach: []
  removeAttachment: [index: number]
  toggleSkill: [skillId: string]
  toggleMcp: [serviceId: string]
  toggleWebSearch: [enabled: boolean]
}>()

const text = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const showTools = ref(false)

const enabledSkills = computed(() => props.skills?.filter((s) => s.enabled) || [])
const activeSkills = computed(() => enabledSkills.value.filter((s) => props.activeSkillIds?.includes(s.id)))
const activeMCPDisplay = computed(() => (props.activeMcpIds || []).slice(0, 3))
const hasActiveCapabilities = computed(
  () => (props.activeSkillIds?.length || 0) > 0 || (props.activeMcpIds?.length || 0) > 0 || props.webSearch,
)

interface CapabilityGroup<T extends { id: string }> {
  key: string
  title: string
  width: number
  items: T[]
  activeCount: number
  isActive: (item: T) => boolean
  toggle: (id: string) => void
  renderIcon?: (item: T) => string
  renderColor?: (item: T) => string
  renderPreview: (item: T) => string
}

const capabilityGroups = computed<CapabilityGroup<SkillItem | McpService>[]>(() => [
  {
    key: 'skills',
    title: 'Skills',
    width: 280,
    items: enabledSkills.value,
    activeCount: activeSkills.value.length,
    isActive: (s) => isSkillActive(s as SkillItem),
    toggle: (id) => handleToggleSkill({ id } as SkillItem),
    renderIcon: (s) => getSkillIcon((s as SkillItem).name),
    renderColor: (s) => getSkillColor((s as SkillItem).name),
    renderPreview: (s) => (s as SkillItem).description,
  },
  {
    key: 'mcp',
    title: 'MCP 服务',
    width: 300,
    items: (props.mcpServices || []) as unknown as McpService[],
    activeCount: activeMCPDisplay.value.length,
    isActive: (s) => isMcpActive(s as McpService),
    toggle: (id) => handleToggleMcp({ id } as McpService),
    renderPreview: (s) => {
      const m = s as McpService
      return m.type === 'stdio' ? m.command : m.url
    },
  },
])

function handleSend() {
  // 直接从 DOM 读取输入值，避免 v-model / IME 的时序问题
  const input = inputRef.value
  const msg = input?.value.trim() || ''
  if (!msg && props.attachments.length === 0) return
  if (input) input.value = ''
  text.value = ''
  try {
    emit('send', msg)
  } catch {
    // emit 失败不影响 input 状态
  }
}

function handleKeydown(e: KeyboardEvent) {
  // IME（中文输入法）确认时会触发 Enter，此时 text.value 尚未更新为最终文字
  if (e.isComposing) return
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleToggleSkill(s: SkillItem) {
  emit('toggleSkill', s.id)
}

function handleToggleMcp(s: McpService) {
  emit('toggleMcp', s.id)
}

function toggleTools() {
  showTools.value = !showTools.value
}

function includesId(ids: string[] | undefined, item: { id: string }): boolean {
  return ids?.includes(item.id) ?? false
}

function isSkillActive(s: SkillItem): boolean {
  return includesId(props.activeSkillIds, s)
}

function isMcpActive(s: McpService): boolean {
  return includesId(props.activeMcpIds, s)
}

function handleToggleWebSearch() {
  const next = !props.webSearch
  if (next && !props.webSearchConfigured) {
    ElMessage.warning('Web Search 未配置 API Key，请在 设置 → 通用 → Web Search 中配置')
  }
  emit('toggleWebSearch', next)
}
</script>

<template>
  <div class="chat-input">
    <!-- Attachment chips -->
    <div class="chat-input__tools" v-if="attachments.length > 0">
      <span
        class="chat-input__chip"
        v-for="(f, i) in attachments"
        :key="i"
        :title="f.path"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
        </svg>
        <span class="chat-input__chip-name">{{ f.name }}</span>
        <span class="chat-input__chip-size" v-if="f.size > 0">({{ (f.size / 1024).toFixed(1) }}KB)</span>
        <button class="chat-input__chip-remove" @click="emit('removeAttachment', i)" title="移除文件">&times;</button>
      </span>
    </div>

    <!-- Input bar -->
    <div class="chat-input__bar">
      <input
        ref="inputRef"
        class="chat-input__field"
        v-model="text"
        placeholder="Ask anything, or attach files for AI to analyze..."
        @keydown="handleKeydown"
        :disabled="disabled"
      />
      <button class="chat-input__btn" title="展开工具" @click="toggleTools" :class="{ 'chat-input__btn--active': showTools }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      <button class="chat-input__send" @click="handleSend" :disabled="disabled || (!text.trim() && attachments.length === 0)">
        <svg v-if="disabled" class="chat-input__spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>

    <!-- Active capabilities chips -->
    <div class="chat-input__tools" v-if="activeSkills.length > 0">
      <span class="chat-input__chip chat-input__chip--skill" v-for="s in activeSkills" :key="s.id">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path :d="getSkillIcon(s.name)" />
        </svg>
        {{ s.name }}
      </span>
    </div>
    <div class="chat-input__tools" v-if="activeMCPDisplay.length > 0 || webSearch">
      <span class="chat-input__chip" v-for="mcpId in activeMCPDisplay" :key="mcpId">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
        {{ webSearch ? 'Web' : '' }}{{ mcpId }}
      </span>
    </div>

    <!-- Tool buttons row -->
    <div class="chat-input__tools-row" v-if="showTools">
      <button class="chat-input__tool-btn" title="附加文件" @click="emit('attach')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.31 2.69 6 6 6s6-2.69 6-6V6h-2.5z" />
        </svg>
        <span>Add files</span>
      </button>

      <template v-for="g in capabilityGroups" :key="g.key">
        <el-popover
          trigger="click"
          placement="top-start"
          :width="g.width"
          popper-class="chat-input__popper"
        >
          <template #reference>
            <button
              class="chat-input__tool-btn"
              :title="g.title + '（点击展开/收起）'"
              v-if="g.items.length > 0"
            >
              <IconSkills class="chat-input__tool-svg" v-if="g.key === 'skills'" />
              <IconMcp class="chat-input__tool-svg" v-else-if="g.key === 'mcp'" />
              <span>{{ g.title }}</span>
              <span v-if="g.activeCount > 0" class="chat-input__badge">{{ g.activeCount }}</span>
            </button>
          </template>
          <div class="chat-input__popover-header">{{ g.title }}</div>
          <div style="max-height:200px;overflow-y:auto">
            <button
              v-for="s in g.items"
              :key="s.id"
              class="chat-input__popover-item"
              :class="{ 'chat-input__popover-item--active': g.isActive(s) }"
              @click="g.toggle(s.id)"
            >
              <span class="chat-input__popover-check">{{ g.isActive(s) ? '✓' : '' }}</span>
              <span class="chat-input__popover-skill-icon" v-if="g.renderIcon" :style="{ color: g.renderColor?.(s) }">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path :d="g.renderIcon(s)" />
                </svg>
              </span>
              <span class="chat-input__popover-name">{{ s.name }}</span>
              <span class="chat-input__popover-preview">{{ g.renderPreview(s) }}</span>
            </button>
          </div>
        </el-popover>
      </template>

      <label class="chat-input__tool-btn chat-input__tool-btn--toggle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
        <span>Web search</span>
        <span class="chat-input__toggle-label" :class="{ 'chat-input__toggle-label--on': webSearch }" @click.prevent="handleToggleWebSearch">{{ webSearch ? 'Auto' : 'Off' }}</span>
      </label>
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
      opacity: 0.5;
      cursor: default;
    }
  }

  &__spinner {
    animation: chat-input-spin 800ms linear infinite;
  }

  @keyframes chat-input-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
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

    &--skill {
      background: color-mix(in srgb, var(--arc-accent-lime) 30%, transparent);
      color: #5B6E2D;
    }
  }

  &__chip-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__chip-size {
    font-size: 10px;
    opacity: 0.6;
  }

  &__chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--arc-text-secondary);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      background: var(--arc-bg-hover);
      color: var(--arc-text-primary);
    }
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

  &__tool-svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--arc-brand-blue);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
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
      background: color-mix(in srgb, var(--arc-brand-blue) 10%, transparent);
    }
  }

  // ── Popover content styles are in non-scoped .chat-input__popper block below
}
</style>

<!-- el-popover renders at document root — non-scoped styles for popper content -->
<style lang="scss">
.chat-input__popper {
  padding: 0 !important;
  border-radius: var(--arc-radius-lg) !important;

  .chat-input__popover-header {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 6px 10px;
    color: var(--arc-text-secondary);
    border-bottom: 1px solid var(--arc-border);
  }

  .chat-input__popover-item {
    display: flex;
    gap: 6px;
    align-items: center;
    width: 100%;
    padding: 6px 10px;
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

    &--active {
      background: color-mix(in srgb, var(--arc-brand-blue) 6%, transparent);

      .chat-input__popover-name {
        color: var(--arc-brand-blue);
      }
    }
  }

  .chat-input__popover-check {
    width: 14px;
    flex-shrink: 0;
    text-align: center;
    color: var(--arc-brand-blue);
    font-weight: 600;
    font-size: 13px;
  }

  .chat-input__popover-skill-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .chat-input__popover-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--arc-text-primary);
  }

  .chat-input__popover-preview {
    font-size: 11px;
    color: var(--arc-text-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
}
</style>
