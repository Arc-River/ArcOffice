import { ElMessage, ElMessageBox } from 'element-plus'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SkillFileEntry, SkillItem } from '@/types/ai'
import { getElectronAPI } from '@/utils/ipc'

export function useSkillsManager() {
  const api = getElectronAPI()
  const { t } = useI18n()

  const items = ref<SkillItem[]>([])
  const loading = ref(false)
  const skillsDirPath = ref('')

  /** Dialog state for skill form (create/edit SKILL.md) */
  const showFormDialog = ref(false)
  const editingSkill = ref<string | null>(null)
  const form = ref<{ name: string; description: string; content: string }>({
    name: '',
    description: '',
    content: '',
  })

  /** Dialog state for file browser */
  const showFilesDialog = ref(false)
  const filesTargetSkill = ref<string>('')
  const filesTargetBuiltin = ref(false)
  const files = ref<SkillFileEntry[]>([])

  /** Dialog state for file editor */
  const showFileEditor = ref(false)
  const editingFilePath = ref('')
  const editingFileContent = ref('')

  async function load() {
    if (!api) return
    loading.value = true
    try {
      items.value = await api.getSkills()
    } catch (err) {
      ElMessage.error(String(err))
    } finally {
      loading.value = false
    }
  }

  async function toggle(skill: SkillItem) {
    if (!api) return
    try {
      await api.toggleSkill(skill.name, !skill.enabled)
      skill.enabled = !skill.enabled
    } catch (err) {
      ElMessage.error(String(err))
    }
  }

  async function remove(skill: SkillItem) {
    if (!api) return
    try {
      await ElMessageBox.confirm(t('settings.skills.confirmDelete', { name: skill.name }), t('common.confirm'), {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      })
      await api.deleteSkill(skill.name)
      items.value = items.value.filter((s) => s.name !== skill.name)
      ElMessage.success(t('common.deleteSuccess'))
    } catch {
      // cancelled
    }
  }

  // ── SKILL.md form ──

  async function openNewForm() {
    if (!api) return
    if (!skillsDirPath.value) {
      skillsDirPath.value = await api.getSkillsDirPath()
    }
    editingSkill.value = null
    form.value = { name: '', description: '', content: '' }
    showFormDialog.value = true
  }

  async function openEditForm(skill: SkillItem) {
    if (!api) return
    if (!skillsDirPath.value) {
      skillsDirPath.value = await api.getSkillsDirPath()
    }
    editingSkill.value = skill.name
    form.value = {
      name: skill.name,
      description: skill.description,
      content: skill.content || '',
    }
    showFormDialog.value = true
  }

  function cancelForm() {
    showFormDialog.value = false
    editingSkill.value = null
    form.value = { name: '', description: '', content: '' }
  }

  async function saveForm() {
    if (!api) return
    const name = form.value.name.trim()
    const description = form.value.description.trim()
    if (!name || !description) {
      ElMessage.warning(t('settings.skills.validate'))
      return
    }

    try {
      // If renaming a skill, delete old and create new
      if (editingSkill.value && editingSkill.value !== name) {
        await api.deleteSkill(editingSkill.value)
      }
      await api.saveSkill(form.value)
      ElMessage.success(t('common.saveSuccess'))
      cancelForm()
      await load()
    } catch (err) {
      ElMessage.error(String(err))
    }
  }

  // ── File browser ──

  async function openFiles(skill: SkillItem) {
    if (!api) return
    filesTargetSkill.value = skill.name
    filesTargetBuiltin.value = !!skill.builtin
    try {
      files.value = await api.getSkillFiles(skill.name)
      showFilesDialog.value = true
    } catch (err) {
      ElMessage.error(String(err))
    }
  }

  async function openFileEditor(filePath: string) {
    if (!api) return
    editingFilePath.value = filePath
    try {
      editingFileContent.value = await api.readSkillFile(filesTargetSkill.value, filePath)
      showFileEditor.value = true
    } catch (err) {
      ElMessage.error(String(err))
    }
  }

  async function saveFile() {
    if (!api) return
    try {
      await api.writeSkillFile(filesTargetSkill.value, editingFilePath.value, editingFileContent.value)
      ElMessage.success(t('common.saveSuccess'))
      showFileEditor.value = false
      // Refresh file list
      files.value = await api.getSkillFiles(filesTargetSkill.value)
    } catch (err) {
      ElMessage.error(String(err))
    }
  }

  async function deleteFile(filePath: string) {
    if (!api) return
    try {
      await ElMessageBox.confirm(t('settings.skills.confirmDeleteFile', { name: filePath }), t('common.confirm'), {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      })
      await api.deleteSkillFile(filesTargetSkill.value, filePath)
      ElMessage.success(t('common.deleteSuccess'))
      files.value = files.value.filter((f) => f.path !== filePath)
    } catch {
      // cancelled
    }
  }

  return {
    items,
    loading,
    showFormDialog,
    editingSkill,
    form,
    showFilesDialog,
    filesTargetSkill,
    filesTargetBuiltin,
    files,
    showFileEditor,
    editingFilePath,
    editingFileContent,
    skillsDirPath,
    load,
    toggle,
    remove,
    openNewForm,
    openEditForm,
    cancelForm,
    saveForm,
    openFiles,
    openFileEditor,
    saveFile,
    deleteFile,
  }
}
