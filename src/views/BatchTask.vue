<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { TaskRecord } from '@/types/models'
import { getElectronAPI } from '@/utils/ipc'

interface TaskView extends TaskRecord {
  _statusLabel: string
  _statusClass: string
}

const api = getElectronAPI()
const tasks = ref<TaskView[]>([])

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'tag-pending' },
  processing: { label: '处理中', cls: 'tag-processing' },
  completed: { label: '已完成', cls: 'tag-success' },
  warning: { label: '部分完成', cls: 'tag-warning' },
  failed: { label: '失败', cls: 'tag-error' },
}

onMounted(async () => {
  if (!api) return
  try {
    const records = await api.getTasks()
    tasks.value = records.map((t) => ({
      ...t,
      _statusLabel: STATUS_MAP[t.status]?.label || t.status,
      _statusClass: STATUS_MAP[t.status]?.cls || 'tag-pending',
    }))
  } catch {
    // DB not available
  }
})
</script>

<template>
  <div class="batch-task">
    <div class="batch-task__toolbar">
      <h2 class="batch-task__title">批量任务</h2>
    </div>

    <div v-if="tasks.length === 0" class="batch-task__empty">
      <p class="batch-task__text">暂无批量任务</p>
      <p class="batch-task__hint">批量处理多个文件时，任务将显示在这里</p>
    </div>

    <div v-else class="batch-task__list">
      <div v-for="task in tasks" :key="task.id" class="task-card">
        <div class="task-card__header">
          <div class="task-card__info">
            <span class="task-card__type">{{ task.type }}</span>
            <span class="task-card__status" :class="task._statusClass">
              {{ task._statusLabel }}
            </span>
          </div>
        </div>
        <div class="task-card__progress">
          <div class="task-card__progress-bar">
            <div
              class="task-card__progress-fill"
              :style="{ width: `${task.progress}%` }"
              :class="{
                'task-card__progress-fill--success': task.status === 'completed',
                'task-card__progress-fill--warning': task.status === 'warning',
                'task-card__progress-fill--danger': task.status === 'failed',
              }"
            />
          </div>
          <span class="task-card__progress-label">{{ task.progress }}%</span>
        </div>
        <div v-if="task.log" class="task-card__log">{{ task.log }}</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.batch-task {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--arc-space-md);

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--arc-space-md);
  }

  &__title {
    @include font-title-lg;
    color: var(--arc-text-primary);
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

  &__text {
    @include font-title;
    color: var(--arc-text-primary);
  }

  &__hint {
    @include font-body-sm;
    color: var(--arc-text-placeholder);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--arc-space-sm);
    flex: 1;
    overflow-y: auto;
  }
}

.task-card {
  background: var(--arc-bg-canvas);
  border: 1px solid var(--arc-border);
  border-radius: var(--arc-radius-lg);
  padding: var(--arc-space-sm) var(--arc-space-md);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--arc-space-xs);
  }

  &__info {
    display: flex;
    align-items: center;
    gap: var(--arc-space-xs);
  }

  &__type {
    @include font-body;
    font-weight: 500;
  }

  &__status {
    @include font-label-sm;
    height: 22px;
    padding: 0 8px;
    border-radius: var(--arc-radius-sm);
    display: inline-flex;
    align-items: center;
  }

  &__progress {
    display: flex;
    align-items: center;
    gap: var(--arc-space-xs);
    margin-bottom: var(--arc-space-xs);
  }

  &__progress-bar {
    flex: 1;
    height: 4px;
    background: var(--arc-bg-hover);
    border-radius: var(--arc-radius-full);
    overflow: hidden;
  }

  &__progress-fill {
    height: 100%;
    background: var(--arc-brand-blue);
    border-radius: var(--arc-radius-full);
    transition: width 300ms ease;

    &--success {
      background: var(--arc-success);
    }

    &--warning {
      background: var(--arc-warning);
    }

    &--danger {
      background: var(--arc-danger);
    }
  }

  &__progress-label {
    @include font-body-xs;
    color: var(--arc-text-secondary);
    min-width: 36px;
    text-align: right;
  }

  &__log {
    @include font-body-sm;
    color: var(--arc-text-placeholder);
    margin-top: 2px;
  }
}

// Status tag colors (matching design_token.html)
:deep(.tag-pending) {
  background: var(--arc-bg-hover);
  color: var(--arc-text-secondary);
}

:deep(.tag-processing) {
  background: #E8F4FF;
  color: var(--arc-brand-blue);
}

:deep(.tag-success) {
  background: #E8FFE8;
  color: var(--arc-success);
}

:deep(.tag-warning) {
  background: #FFF3E8;
  color: var(--arc-warning);
}

:deep(.tag-error) {
  background: #FFE8E8;
  color: var(--arc-danger);
}
</style>
