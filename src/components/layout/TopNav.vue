<script setup lang="ts">
// Explicit imports for icons used in template — auto-import may not resolve these
// biome-ignore lint/correctness/noUnusedImports: used in template
import { MoonNight, Sunny } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const { t } = useI18n()

// biome-ignore lint/correctness/noUnusedVariables: used in template
const themeLabel = computed(() => {
  return themeStore.isDark ? t('theme.light') : t('theme.dark')
})
</script>

<template>
  <header class="top-nav">
    <div class="top-nav__left">
      <span class="top-nav__logo">
        <svg width="22" height="22" viewBox="0 0 240 240" fill="none">
          <g fill="var(--arc-brand-blue)">
            <rect x="74" y="50" width="44" height="44" rx="6" />
            <rect x="122" y="50" width="44" height="44" rx="6" />
            <rect x="26" y="98" width="44" height="44" rx="6" />
            <rect x="74" y="98" width="44" height="44" rx="6" />
            <rect x="122" y="98" width="44" height="44" rx="6" />
            <rect x="170" y="98" width="44" height="44" rx="6" />
            <rect x="26" y="146" width="44" height="44" rx="6" />
            <rect x="170" y="146" width="44" height="44" rx="6" />
          </g>
        </svg>
      </span>
      <span class="top-nav__title">ArcOffice</span>
    </div>
    <div class="top-nav__right">
      <button
        class="top-nav__theme-btn"
        @click="themeStore.toggle()"
        :title="themeLabel"
      >
        <el-icon :size="16">
          <Sunny v-if="themeStore.isDark" />
          <MoonNight v-else />
        </el-icon>
        <span class="top-nav__theme-label">{{ themeLabel }}</span>
      </button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--arc-height-topnav);
  padding: 0 var(--arc-space-md);
  background: var(--arc-bg-canvas);
  border-bottom: 1px solid var(--arc-border);
  user-select: none;
  flex-shrink: 0;
  -webkit-app-region: drag;

  &__left {
    display: flex;
    align-items: center;
    gap: var(--arc-space-xs);
    -webkit-app-region: no-drag;
  }

  &__logo {
    display: flex;
    align-items: center;
  }

  &__title {
    @include font-body-sm;
    font-weight: 600;
    color: var(--arc-text-primary);
  }

  &__right {
    display: flex;
    align-items: center;
    gap: var(--arc-space-xs);
    -webkit-app-region: no-drag;
  }

  &__theme-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    border: 1px solid var(--arc-border);
    background: var(--arc-bg-canvas);
    border-radius: var(--arc-radius-lg);
    cursor: pointer;
    color: var(--arc-text-secondary);
    transition: all 200ms ease;

    &:hover {
      background: var(--arc-bg-hover);
      border-color: var(--arc-brand-blue);
      color: var(--arc-brand-blue);
    }
  }

  &__theme-label {
    @include font-label-sm;
  }
}
</style>
