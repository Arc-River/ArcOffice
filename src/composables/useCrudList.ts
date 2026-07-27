import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref, toRaw } from 'vue'

export interface CrudOptions<T extends { id: string }> {
  /** Async function to load all items */
  load: () => Promise<T[]>
  /** Async function to persist the full list */
  save: (items: T[]) => Promise<void>
  /** Create a blank item (used for new-form) */
  createBlank: () => T
  /** Get the name label for delete confirmation */
  getName: (item: T) => string
  /** Entity name for messages (e.g. "模型"、"技能") */
  entityName?: string
  /** Whether to auto-load on mount */
  autoLoad?: boolean
}

/**
 * Generic CRUD composable for list-based settings views.
 * Eliminates the identical load/save/delete/persist boilerplate across settings pages.
 */
export function useCrudList<T extends { id: string }>(options: CrudOptions<T>) {
  const items = ref<T[]>([])
  const showDialog = ref(false)
  const editingId = ref<string | null>(null)
  const form = ref<T>(options.createBlank())

  async function load() {
    try {
      items.value = await options.load()
    } catch {
      // data source not available
    }
  }

  if (options.autoLoad !== false) {
    onMounted(() => load())
  }

  function openNewForm() {
    editingId.value = null
    form.value = { ...options.createBlank() }
    showDialog.value = true
  }

  function openEditForm(item: T) {
    editingId.value = item.id
    // Deep clone to avoid mutating the source
    form.value = structuredClone(toRaw(item))
    showDialog.value = true
  }

  function cancelForm() {
    showDialog.value = false
    editingId.value = null
  }

  async function saveForm(): Promise<boolean> {
    const list = [...items.value] as T[]
    if (editingId.value) {
      const idx = list.findIndex((s) => s.id === editingId.value)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...form.value }
      }
    } else {
      list.unshift({ ...form.value })
    }

    const ok = await persist(list)
    if (ok) {
      showDialog.value = false
    }
    return ok
  }

  async function handleDelete(item: T): Promise<boolean> {
    const name = options.getName(item)
    const entity = options.entityName || '项目'
    try {
      await ElMessageBox.confirm(`确定要删除${entity}「${name}」吗？`, `删除${entity}`, {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      })
      const list = items.value.filter((i) => i.id !== item.id) as T[]
      return await persist(list)
    } catch {
      return false
    }
  }

  async function toggleEnabled(item: T, field: 'enabled' = 'enabled' as any): Promise<boolean> {
    const list = items.value.map((i) => (i.id === item.id ? { ...i, [field]: !(i as any)[field] } : i)) as T[]
    return await persist(list)
  }

  async function persist(list: T[]): Promise<boolean> {
    try {
      // Deep-clone via structuredClone (preceded by toRaw to unwrap Vue proxies)
      await options.save(structuredClone(toRaw(list)))
      items.value = list
      ElMessage.success('保存成功')
      return true
    } catch (err) {
      console.error(`[useCrudList] 保存${options.entityName || '项目'}失败:`, err)
      ElMessage.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }

  return {
    items,
    showDialog,
    editingId,
    form,
    load,
    openNewForm,
    openEditForm,
    cancelForm,
    saveForm,
    handleDelete,
    toggleEnabled,
    persist,
  }
}
