<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '@/components/AuthLayout.vue';
import { Button } from '@/components/ui/button';
import { safeRedirect } from '@/router/guards';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const retrying = ref(false);

/** Navigating back runs the guard again, which reloads the session. */
async function retry() {
  retrying.value = true;
  try {
    await router.replace(safeRedirect(route.query.redirect));
  } finally {
    retrying.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="t('pages.sessionError')">
    <div class="flex flex-col gap-4">
      <p role="alert" class="text-sm text-muted-foreground">
        {{ t('system.sessionError.message') }}
      </p>
      <Button type="button" class="h-11 w-full" :disabled="retrying" @click="retry">
        {{ retrying ? t('system.sessionError.retrying') : t('system.sessionError.retry') }}
      </Button>
    </div>
  </AuthLayout>
</template>
