<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ChatSession } from '@/types/ai'
import { formatRelativeTime } from '@/utils/format'

defineProps<{
  sessions: ChatSession[]
  activeSession: string | null
}>()

const emit = defineEmits<{
  select: [sessionId: string]
  newSession: []
  delete: [sessionId: string]
  rename: [sessionId: string, name: string]
}>()

const editingId = ref<string | null>(null)
const editingName = ref('')
const inputRefs = ref<Record<string, HTMLInputElement | null>>({})

async function startRename(session: ChatSession) {
  editingId.value = session.id
  editingName.value = session.name
  await nextTick()
  inputRefs.value[session.id]?.focus()
}

function confirmRename() {
  const id = editingId.value
  const name = editingName.value.trim()
  if (id && name) {
    emit('rename', id, name)
  }
  editingId.value = null
  editingName.value = ''
}

function cancelRename() {
  editingId.value = null
  editingName.value = ''
}
</script>

<template>
  <aside class="session-list">
    <div class="session-list__header">
      <span class="session-list__label">会话</span>
      <button class="session-list__new" title="新建对话" @click="emit('newSession')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
    <nav class="session-list__items">
      <button
        v-for="s in sessions"
        :key="s.id"
        class="session-list__item"
        :class="{ 'session-list__item--active': activeSession === s.id }"
        @click="emit('select', s.id)"
      >
        <svg class="session-list__item-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14l4 4V4a2 2 0 0 0-2-2z" />
        </svg>
        <span
          v-if="editingId !== s.id"
          class="session-list__item-name"
          @dblclick.stop="startRename(s)"
        >{{ s.name }}</span>
        <input
          v-else
          class="session-list__item-input"
          v-model="editingName"
          @click.stop
          @keydown.enter="confirmRename"
          @keydown.escape="cancelRename"
          @blur="confirmRename"
          :ref="(el) => { if (el) inputRefs[s.id] = el as HTMLInputElement }"
        />
        <span class="session-list__item-time">{{ formatRelativeTime(s.updated_at) }}</span>
        <el-popconfirm
          title="确定删除此会话？"
          confirm-button-text="删除"
          cancel-button-text="取消"
          @confirm="emit('delete', s.id)"
        >
          <template #reference>
            <button
              class="session-list__item-delete"
              title="删除会话"
              @click.stop
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          </template>
        </el-popconfirm>
      </button>
      <div v-if="sessions.length === 0" class="session-list__empty">
        暂无会话
      </div>
    </nav>
  </aside>
</template>

<style lang="scss" scoped>
.session-list {
  width: 200px;
  flex-shrink: 0;
  background: var(--arc-bg-page);
  border-right: 1px solid var(--arc-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--arc-space-sm) var(--arc-space-md);
  }

  &__label {
    @include font-label-sm;
    color: var(--arc-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  &__new {
    @include hoverable;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: var(--arc-radius-sm);
    color: var(--arc-text-secondary);

    &:hover {
      color: var(--arc-brand-blue);
    }
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 var(--arc-space-xs);
    flex: 1;
    overflow-y: auto;
  }

  &__empty {
    @include font-body-sm;
    color: var(--arc-text-placeholder);
    text-align: center;
    padding: var(--arc-space-lg) var(--arc-space-sm);
  }

  &__item {
    @include hoverable;
    display: flex;
    align-items: center;
    gap: var(--arc-space-xs);
    padding: var(--arc-space-xs) var(--arc-space-sm);
    border: none;
    background: transparent;
    border-radius: var(--arc-radius-md);
    @include font-body-sm;
    color: var(--arc-text-primary);
    text-align: left;
    width: 100%;
    position: relative;

    &--active {
      color: var(--arc-brand-blue);
      font-weight: 500;
      background: var(--arc-bg-hover);
    }

    &-icon {
      flex-shrink: 0;
    }

    &-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: text;
    }

    &-input {
      flex: 1;
      min-width: 0;
      height: 20px;
      border: 1px solid var(--arc-brand-blue);
      background: var(--arc-bg-canvas);
      border-radius: var(--arc-radius-sm);
      padding: 0 4px;
      @include font-body-sm;
      color: var(--arc-text-primary);
      outline: none;
    }

    &-time {
      flex-shrink: 0;
      @include font-body-xs;
      color: var(--arc-text-placeholder);
    }

    &-delete {
      display: none;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border: none;
      background: transparent;
      border-radius: var(--arc-radius-sm);
      color: var(--arc-danger);
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
    }
  }

  &__item:hover &__item-delete {
    display: flex;
  }
}
</style>
