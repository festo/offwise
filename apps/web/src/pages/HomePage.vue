<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import AppLayout from '@/components/AppLayout.vue';
import { useSession } from '@/features/auth/composables/useSession';
import { useSignOut } from '@/features/auth/composables/useSignOut';
import ApiStatus from '@/features/system/components/ApiStatus.vue';
import { useHealth } from '@/features/system/composables/useHealth';

const { t } = useI18n();
const session = useSession();
const { state, refresh } = useHealth();

onMounted(refresh);
const signOut = useSignOut();
</script>

<template>
  <AppLayout v-if="session.user.value" :user="session.user.value" @sign-out="signOut">
    <div class="flex flex-col gap-4">
      <h1 class="text-2xl font-semibold text-foreground">
        {{ t('home.welcome', { name: session.user.value.name }) }}
      </h1>
      <p class="text-muted-foreground">{{ t('app.tagline') }}</p>
      <div><ApiStatus :state="state" /></div>
    </div>
  </AppLayout>
</template>
