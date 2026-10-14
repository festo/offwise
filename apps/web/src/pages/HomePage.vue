<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import ApiStatus from '@/features/system/components/ApiStatus.vue';
import { useHealth } from '@/features/system/composables/useHealth';

const { t } = useI18n();
const { state, refresh } = useHealth();

onMounted(refresh);
</script>

<template>
  <main
    class="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 bg-background p-6 text-center"
  >
    <h1 class="text-3xl font-semibold text-foreground">{{ t('app.name') }}</h1>
    <p class="text-muted-foreground">{{ t('app.tagline') }}</p>
    <ApiStatus :state="state" />
  </main>
</template>
