<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

defineProps<{ title: string; description?: string }>();

const { t } = useI18n();
</script>

<template>
  <div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-8">
    <p class="text-lg font-semibold text-foreground">{{ t('app.name') }}</p>
    <main class="w-full max-w-sm">
      <Card class="w-full">
        <CardHeader>
          <CardTitle class="text-xl">
            <h1>{{ title }}</h1>
          </CardTitle>
          <CardDescription v-if="description">{{ description }}</CardDescription>
        </CardHeader>
        <CardContent>
          <slot />
        </CardContent>
        <CardFooter v-if="$slots.footer" class="flex-col gap-2 text-sm">
          <slot name="footer" />
        </CardFooter>
      </Card>
    </main>
  </div>
</template>
