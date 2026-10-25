<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import type { HealthState } from '../types';

const props = defineProps<{ state: HealthState }>();
const { t } = useI18n();

// The badge gets `transition-none`: Badge's `transition-all` would cross-fade the light
// secondary and dark primary colours on a state change, passing through grey on grey.
const variant = computed(() => {
  if (props.state === 'ok') return 'default';
  if (props.state === 'error') return 'destructive';
  return 'secondary';
});
</script>

<template>
  <Badge :variant="variant" class="transition-none" role="status" aria-live="polite">
    {{ t(`system.apiStatus.${state}`) }}
  </Badge>
</template>
