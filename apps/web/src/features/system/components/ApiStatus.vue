<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import type { HealthState } from '../types';

const props = defineProps<{ state: HealthState }>();
const { t } = useI18n();

const variant = computed(() => {
  if (props.state === 'ok') return 'default';
  if (props.state === 'error') return 'destructive';
  return 'secondary';
});
</script>

<template>
  <Badge :variant="variant" role="status" aria-live="polite">
    {{ t(`system.apiStatus.${state}`) }}
  </Badge>
</template>
