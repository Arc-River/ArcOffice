<script setup lang="ts">
import { ChatDotSquare, Delete, Plus } from '@element-plus/icons-vue'
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChatSession } from '@/types/ai'

const { t } = useI18n()

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutesAgo', { n: minutes })
  if (hours < 24) return t('time.hoursAgo', { n: hours })
  if (days < 7) return t('time.daysAgo', { n: days })
  return new Date(dateStr).toLocaleDateString()
}

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

async function _startRename(session: ChatSession) {
  editingId.value = session.id
  editingName.value = session.name
  await nextTick()
  inputRefs.value[session.id]?.focus()
}

function _confirmRename() {
  const id = editingId.value
  const name = editingName.value.trim()
  if (id && name) {
    emit('rename', id, name)
  }
  editingId.value = null
  editingName.value = ''
}

function _cancelRename() {
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
        <div class="session-list__item-body">
          <span
            v-if="editingId !== s.id"
            class="session-list__item-name"
            @dblclick.stop="_startRename(s)"
          >{{ s.name }}</span>
          <input
            v-else
            class="session-list__item-input"
            v-model="editingName"
            @click.stop
            @keydown.enter="_confirmRename"
            @keydown.escape="_cancelRename"
            @blur="_confirmRename"
            :ref="(el) => { if (el) inputRefs[s.id] = el as HTMLInputElement }"
          />
          <span class="session-list__item-time">{{ formatRelativeTime(s.updated_at) }}</span>
        </div>
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
      <el-empty v-if="sessions.length === 0" :description="t('chat.emptyTitle')" :image-size="40" />
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

  &__item {
    @include hoverable;
    display: flex;
    align-items: flex-start;
    gap: var(--arc-space-xs);
    padding: var(--arc-space-xs) var(--arc-space-sm);
    border: none;
    background: transparent;
    border-radius: var(--arc-radius-md);
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
      margin-top: 2px;
    }

    &-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    &-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: text;
      @include font-body-sm;
      line-height: 1.4;
    }

    &-input {
      width: 100%;
      height: 22px;
      border: 1px solid var(--arc-brand-blue);
      background: var(--arc-bg-canvas);
      border-radius: var(--arc-radius-sm);
      padding: 0 4px;
      @include font-body-sm;
      color: var(--arc-text-primary);
      outline: none;
    }

    &-time {
      @include font-body-xs;
      font-size: 10px;
      color: var(--arc-text-placeholder);
    }

    &-delete {
      display: none;
      margin-top: 0;
    }

    &:hover &-delete {
      display: inline-flex;
    }
  }
}
</style>
