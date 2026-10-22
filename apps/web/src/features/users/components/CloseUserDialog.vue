<script setup lang="ts">
import type { UserDto } from '@offwise/shared';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const props = defineProps<{
  open: boolean;
  user: UserDto;
  pending?: boolean;
  /** Why the last attempt failed, e.g. the last-admin rule. */
  error?: string | null;
}>();
const emit = defineEmits<{ confirm: []; 'update:open': [open: boolean] }>();

const { t } = useI18n();

function setOpen(open: boolean) {
  if (props.pending) return;
  emit('update:open', open);
}

function confirm() {
  if (props.pending) return;
  emit('confirm');
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent :show-close-button="false" class="w-full sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('users.close.title', { name: user.name }) }}</DialogTitle>
        <DialogDescription>{{ t('users.close.description') }}</DialogDescription>
      </DialogHeader>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      <DialogFooter>
        <Button variant="outline" class="h-11 sm:h-9" :disabled="pending" @click="setOpen(false)">
          {{ t('users.close.cancel') }}
        </Button>
        <Button variant="destructive" class="h-11 sm:h-9" :disabled="pending" @click="confirm">
          {{ pending ? t('users.close.closing') : t('users.close.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
