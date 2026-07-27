<script setup lang="ts">
import { ChatDotSquare, Delete, Plus } from '@element-plus/icons-vue'
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChatSession } from '@/types/ai'
import { formatRelativeTime } from '@/utils/format'

const { t } = useI18n()

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
      <span class="session-list__label">{{ t('chat.newSession') }}</span>
      <el-button
        class="session-list__new"
        :icon="Plus"
        circle
        text
        size="small"
        :title="t('chat.newChat')"
        @click="emit('newSession')"
      />
    </div>
    <nav class="session-list__items">
      <button
        v-for="s in sessions"
        :key="s.id"
        class="session-list__item"
        :class="{ 'session-list__item--active': activeSession === s.id }"
        @click="emit('select', s.id)"
      >
        <el-icon class="session-list__item-icon"><ChatDotSquare /></el-icon>
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
          :title="t('common.confirm') + '?'"
          :confirm-button-text="t('common.delete')"
          :cancel-button-text="t('common.cancel')"
          @confirm="emit('delete', s.id)"
        >
          <template #reference>
            <el-button
              class="session-list__item-delete"
              :icon="Delete"
              circle
              text
              size="small"
              type="danger"
              :title="t('common.delete') + ' ' + t('chat.newSession')"
              @click.stop
            />
          </template>
        </el-popconfirm>
      </button>
      <div v-if="sessions.length === 0" class="session-list__empty">
        {{ t('chat.emptyTitle') }}
      </div>
    </nav>
  </aside>
</template>

<style lang="scss" scoped>
.session-list {
  width: 220px;
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
    --el-button-size: 24px;
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
      font-size: 10px;
      color: var(--arc-text-placeholder);
    }

    &-delete {
      display: none;
    }

    &:hover &-delete {
      display: inline-flex;
    }
  }
}
</style>
