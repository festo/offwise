<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AuthLayout from '@/components/AuthLayout.vue';
import ForgotPasswordForm from '@/features/auth/components/ForgotPasswordForm.vue';
import { usePasswordReset } from '@/features/auth/composables/usePasswordReset';
import { tooManyAttemptsMessage } from '@/features/auth/lib/tooManyAttempts';
import { ApiError } from '@/lib/api';

const { t } = useI18n();
const { requestReset } = usePasswordReset();
const pending = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);

async function onSubmit({ email }: { email: string }) {
  pending.value = true;
  error.value = null;
  try {
    await requestReset(email);
    sent.value = true;
  } catch (e) {
    error.value =
      e instanceof ApiError && e.status === 429
        ? tooManyAttemptsMessage(t, e.retryAfter)
        : t('auth.genericError');
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="t('pages.forgotPassword')" :description="t('auth.forgotDescription')">
    <ForgotPasswordForm :pending="pending" :sent="sent" :error="error" @submit="onSubmit" />
  </AuthLayout>
</template>
