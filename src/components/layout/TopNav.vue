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
      <el-button
        class="top-nav__theme-btn"
        text
        size="small"
        @click="themeStore.toggle()"
        :title="themeLabel"
      >
        <el-icon :size="14">
          <Sunny v-if="themeStore.isDark" />
          <MoonNight v-else />
        </el-icon>
        <span>{{ themeLabel }}</span>
      </el-button>
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
    // el-button text handles styling; minimal gap for icon+label
  }
}
</style>
