<script setup lang="ts">
import { ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const props = defineProps<{ pending?: boolean; sent?: boolean; error?: string | null }>();
const emit = defineEmits<{ submit: [payload: { email: string }] }>();

const { t } = useI18n();
const emailId = useId();
const emailErrorId = useId();
const email = ref('');
const emailError = ref<string | null>(null);

function onSubmit() {
  if (props.pending) return;
  const trimmed = email.value.trim();
  emailError.value = trimmed ? null : t('auth.emailRequired');
  if (emailError.value) return;
  emit('submit', { email: trimmed });
}
</script>

<template>
  <div v-if="sent" class="grid gap-4">
    <p role="status" class="text-sm">{{ t('auth.sent') }}</p>
    <RouterLink
      to="/login"
      class="inline-flex min-h-11 items-center justify-center text-sm underline"
    >
      {{ t('auth.backToSignIn') }}
    </RouterLink>
  </div>
  <form v-else class="grid gap-4" novalidate @submit.prevent="onSubmit">
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
    <div class="grid gap-2">
      <Label :for="emailId">{{ t('auth.email') }}</Label>
      <Input
        :id="emailId"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        required
        :aria-invalid="emailError ? 'true' : undefined"
        :aria-describedby="emailError ? emailErrorId : undefined"
        class="h-11 text-base"
      />
      <p v-if="emailError" :id="emailErrorId" class="text-sm text-destructive">
        {{ emailError }}
      </p>
    </div>
    <Button type="submit" class="h-11 w-full" :disabled="pending">
      {{ pending ? t('auth.sending') : t('auth.sendLink') }}
    </Button>
    <RouterLink
      to="/login"
      class="inline-flex min-h-11 items-center justify-center text-sm underline"
    >
      {{ t('auth.backToSignIn') }}
    </RouterLink>
  </form>
</template>
