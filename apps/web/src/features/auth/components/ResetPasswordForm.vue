<script setup lang="ts">
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@offwise/shared';
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const props = defineProps<{ pending?: boolean; error?: string | null; tokenMissing?: boolean }>();
const emit = defineEmits<{ submit: [payload: { password: string }] }>();

const { t } = useI18n();
const passwordId = useId();
const confirmId = useId();
const password = ref('');
const confirm = ref('');
const clientError = ref<string | null>(null);
const shownError = computed(() => clientError.value ?? props.error ?? null);

function onSubmit() {
  if (props.pending) return;
  clientError.value = null;
  if (password.value.length < PASSWORD_MIN_LENGTH || password.value.length > PASSWORD_MAX_LENGTH) {
    clientError.value = t('auth.passwordLength');
    return;
  }
  if (password.value !== confirm.value) {
    clientError.value = t('auth.passwordMismatch');
    return;
  }
  emit('submit', { password: password.value });
}
</script>

<template>
  <div v-if="tokenMissing" class="grid gap-4">
    <p role="alert" class="text-sm text-destructive">{{ t('auth.resetInvalid') }}</p>
    <RouterLink
      to="/forgot-password"
      class="inline-flex min-h-11 items-center justify-center text-sm underline"
    >
      {{ t('auth.requestNewLink') }}
    </RouterLink>
  </div>
  <form v-else class="grid gap-4" novalidate @submit.prevent="onSubmit">
    <p v-if="shownError" role="alert" class="text-sm text-destructive">{{ shownError }}</p>
    <div class="grid gap-2">
      <Label :for="passwordId">{{ t('auth.newPassword') }}</Label>
      <Input
        :id="passwordId"
        v-model="password"
        type="password"
        name="password"
        autocomplete="new-password"
        required
        class="h-11 text-base"
      />
    </div>
    <div class="grid gap-2">
      <Label :for="confirmId">{{ t('auth.confirmPassword') }}</Label>
      <Input
        :id="confirmId"
        v-model="confirm"
        type="password"
        name="confirmPassword"
        autocomplete="new-password"
        required
        class="h-11 text-base"
      />
    </div>
    <Button type="submit" class="h-11 w-full" :disabled="pending">
      {{ pending ? t('auth.saving') : t('auth.setPassword') }}
    </Button>
  </form>
</template>
