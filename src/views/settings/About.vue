<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getElectronAPI } from '@/utils/ipc'

const { t } = useI18n()

const appVersion = ref('')
const checking = ref(false)
const api = getElectronAPI()

onMounted(async () => {
  if (!api) {
    appVersion.value = '0.1.0'
    return
  }
  try {
    appVersion.value = await api.getAppVersion()
  } catch {
    appVersion.value = '0.1.0'
  }
})

async function handleCheckUpdate() {
  if (!api) {
    ElMessage.warning(t('settings.about.electronOnly'))
    return
  }
  checking.value = true
  try {
    const result = await api.checkUpdate()
    if (!result.latestVersion) {
      ElMessage.error(t('settings.about.checkFailed'))
      return
    }
    if (result.latestVersion === appVersion.value) {
      ElMessage.success(t('settings.about.latest'))
    } else {
      ElMessageBox.confirm(
        t('settings.about.updateConfirm', { version: result.latestVersion }),
        t('settings.about.updateAvailable'),
        {
          confirmButtonText: t('settings.about.download'),
          cancelButtonText: t('settings.about.cancel'),
          type: 'info',
        },
      )
        .then(() => {
          window.open(result.releaseUrl, '_blank')
        })
        .catch(() => {
          // user cancelled
        })
    }
  } catch {
    ElMessage.error(t('settings.about.checkFailed'))
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <div class="about-page">
    <h2 class="about-page__title">{{ t('settings.about.title') }}</h2>

    <div class="about-page__card">
      <div class="about-page__logo">
        <img src="/logo.svg" alt="ArcOffice" width="64" height="64" />
      </div>
      <div class="about-page__app-name">{{ t('settings.about.appName') }}</div>

      <div class="about-page__info">
        <div class="about-page__row">
          <span class="about-page__label">{{ t('settings.about.version') }}</span>
          <span class="about-page__value">{{ appVersion ? `v${appVersion}` : '' }}</span>
        </div>
        <div class="about-page__row">
          <span class="about-page__label">{{ t('settings.about.license') }}</span>
          <span class="about-page__value">GPL-3.0</span>
        </div>
        <div class="about-page__row">
          <span class="about-page__label">{{ t('settings.about.repoLink') }}</span>
          <a
            class="about-page__link"
            href="https://github.com/Arc-River/ArcOffice"
            target="_blank"
            rel="noopener"
          >github.com/Arc-River/ArcOffice</a>
        </div>
      </div>

      <div class="about-page__actions">
        <el-button
            :icon="Refresh"
          type="primary"
          :loading="checking"
          :disabled="!api"
          @click="handleCheckUpdate"
        >
          {{ checking ? t('settings.about.checking') : t('settings.about.checkUpdate') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.about-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--arc-space-xl);

  &__title {
    align-self: flex-start;
    @include font-title-lg;
    margin-bottom: var(--arc-space-lg);
  }

  &__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--arc-bg-canvas);
    border: 1px solid var(--arc-border);
    border-radius: var(--arc-radius-lg);
    padding: var(--arc-space-xl) var(--arc-space-lg);
    max-width: 420px;
    width: 100%;
  }

  &__logo {
    margin-bottom: var(--arc-space-md);
  }

  &__app-name {
    @include font-title-lg;
    margin-bottom: var(--arc-space-lg);
  }

  &__info {
    width: 100%;
    border-top: 1px solid var(--arc-border);
    padding-top: var(--arc-space-md);
    margin-bottom: var(--arc-space-lg);
  }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--arc-space-xs) 0;
  }

  &__label {
    @include font-body;
    color: var(--arc-text-secondary);
  }

  &__value {
    @include font-body;
    font-weight: 500;
  }

  &__link {
    @include font-body-sm;
    color: var(--arc-brand-blue);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__actions {
    width: 100%;
    display: flex;
    justify-content: center;
  }
}
</style>
