<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import AuthLayout from '@/components/AuthLayout.vue';
import ResetPasswordForm from '@/features/auth/components/ResetPasswordForm.vue';
import { usePasswordReset } from '@/features/auth/composables/usePasswordReset';
import { tooManyAttemptsMessage } from '@/features/auth/lib/tooManyAttempts';
import { ApiError } from '@/lib/api';

const { t } = useI18n();
const { confirmReset } = usePasswordReset();
const router = useRouter();

// The token travels in the URL fragment so it never reaches server logs; read it once and
// remove it from the address bar and history entry.
const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') ?? '';
if (window.location.hash) {
  window.history.replaceState(window.history.state, '', window.location.pathname);
}

const pending = ref(false);
const error = ref<string | null>(null);

async function onSubmit({ password }: { password: string }) {
  pending.value = true;
  error.value = null;
  try {
    await confirmReset(token, password);
    await router.replace({ name: 'login', query: { reset: '1' } });
  } catch (e) {
    error.value =
      e instanceof ApiError && e.status === 400
        ? t('auth.resetRejected')
        : e instanceof ApiError && e.status === 429
          ? tooManyAttemptsMessage(t, e.retryAfter)
          : t('auth.genericError');
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="t('pages.resetPassword')" :description="t('auth.resetDescription')">
    <ResetPasswordForm
      :pending="pending"
      :error="error"
      :token-missing="!token"
      @submit="onSubmit"
    />
  </AuthLayout>
</template>
