<script setup lang="ts">
import {
  LAST_ADMIN_RULE,
  ROLES,
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  type CreateUserRequest,
  type Role,
  type UpdateUserRequest,
  type UserDto,
} from '@offwise/shared';
import { computed, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UserFormErrors } from '../lib/userFormErrors';

const props = defineProps<{
  initial?: UserDto;
  pending?: boolean;
  errors?: UserFormErrors | null;
  mode: 'create' | 'edit';
}>();
const emit = defineEmits<{
  submit: [body: CreateUserRequest | UpdateUserRequest];
  cancel: [];
}>();

const { t } = useI18n();

type FieldName = 'name' | 'email' | 'role' | 'locale' | 'timeZone';
const ids = {
  name: useId(),
  email: useId(),
  role: useId(),
  locale: useId(),
  timeZone: useId(),
  timeZones: useId(),
};
const errorId = (field: FieldName) => `${ids[field]}-error`;
const hintId = (field: FieldName) => `${ids[field]}-hint`;

const name = ref('');
const email = ref('');
const role = ref<Role>('employee');
const locale = ref('');
const timeZone = ref('');

function reset(user: UserDto | undefined) {
  name.value = user?.name ?? '';
  email.value = user?.email ?? '';
  role.value = user?.role ?? 'employee';
  locale.value = user?.locale ?? '';
  timeZone.value = user?.timeZone ?? '';
}
watch(() => props.initial, reset, { immediate: true });

// V8 leaves 'UTC' out of supportedValuesOf, yet it is the zone admins most often want.
const timeZones = (() => {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  return ['UTC', ...zones.filter((zone) => zone !== 'UTC')];
})();

const clientErrors = ref<Partial<Record<FieldName, string>>>({});
const noChanges = ref(false);

// A server field error describes the value that was submitted; once the user edits that
// field it no longer applies. A new `errors` object shows its errors again.
const editedSinceErrors = ref(new Set<FieldName>());
watch(
  () => props.errors,
  () => (editedSinceErrors.value = new Set()),
);
const fields = { name, email, role, locale, timeZone } as const;
for (const [field, value] of Object.entries(fields) as [FieldName, typeof name][]) {
  watch(value, () => editedSinceErrors.value.add(field));
}

const serverFieldError = computed<Partial<Record<FieldName, string>>>(() => {
  const errors = props.errors;
  if (!errors?.field || errors.rule === LAST_ADMIN_RULE) return {};
  if (editedSinceErrors.value.has(errors.field as FieldName)) return {};
  const fallback = errors.field === 'email' ? t('users.form.emailTaken') : t('users.form.invalid');
  return { [errors.field]: errors.message ?? fallback };
});
const fieldError = (field: FieldName) => clientErrors.value[field] ?? serverFieldError.value[field];

const formError = computed(() => {
  const errors = props.errors;
  if (!errors) return null;
  if (errors.rule === LAST_ADMIN_RULE) return t('users.form.lastAdmin');
  if (errors.field && ['name', 'email', 'role', 'locale', 'timeZone'].includes(errors.field))
    return null;
  return errors.message ?? null;
});

const describedBy = (field: FieldName, withHint = false) =>
  [fieldError(field) ? errorId(field) : null, withHint ? hintId(field) : null]
    .filter(Boolean)
    .join(' ') || undefined;

const orNull = (value: string) => value.trim() || null;

function onSubmit() {
  if (props.pending) return;
  noChanges.value = false;
  const values: CreateUserRequest = {
    name: name.value.trim(),
    email: email.value.trim(),
    role: role.value,
    locale: orNull(locale.value),
    timeZone: orNull(timeZone.value),
  };

  const errors: Partial<Record<FieldName, string>> = {};
  if (!values.name) errors.name = t('users.form.nameRequired');
  if (!values.email) errors.email = t('users.form.emailRequired');
  clientErrors.value = errors;
  if (Object.keys(errors).length > 0) return;

  if (props.mode === 'create' || !props.initial) {
    emit('submit', values);
    return;
  }

  const initial = props.initial;
  const changes: UpdateUserRequest = {};
  if (values.name !== initial.name) changes.name = values.name;
  if (values.email !== initial.email) changes.email = values.email;
  if (values.role !== initial.role) changes.role = values.role;
  if (values.locale !== initial.locale) changes.locale = values.locale;
  if (values.timeZone !== initial.timeZone) changes.timeZone = values.timeZone;

  if (Object.keys(changes).length === 0) {
    noChanges.value = true;
    return;
  }
  emit('submit', changes);
}

const submitLabel = computed(() => {
  if (props.mode === 'create')
    return props.pending ? t('users.form.creating') : t('users.form.create');
  return props.pending ? t('users.form.saving') : t('users.form.save');
});
</script>

<template>
  <form class="grid gap-5" novalidate @submit.prevent="onSubmit">
    <p
      v-if="formError"
      role="alert"
      class="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {{ formError }}
    </p>

    <div class="grid gap-2">
      <Label :for="ids.name">{{ t('users.form.name') }}</Label>
      <Input
        :id="ids.name"
        v-model="name"
        name="name"
        autocomplete="off"
        :maxlength="USER_NAME_MAX_LENGTH"
        required
        :aria-invalid="fieldError('name') ? 'true' : undefined"
        :aria-describedby="describedBy('name')"
        class="h-11 text-base"
      />
      <p v-if="fieldError('name')" :id="errorId('name')" class="text-sm text-destructive">
        {{ fieldError('name') }}
      </p>
    </div>

    <div class="grid gap-2">
      <Label :for="ids.email">{{ t('users.form.email') }}</Label>
      <Input
        :id="ids.email"
        v-model="email"
        type="email"
        name="email"
        autocomplete="off"
        :maxlength="USER_EMAIL_MAX_LENGTH"
        required
        :aria-invalid="fieldError('email') ? 'true' : undefined"
        :aria-describedby="describedBy('email')"
        class="h-11 text-base"
      />
      <p v-if="fieldError('email')" :id="errorId('email')" class="text-sm text-destructive">
        {{ fieldError('email') }}
      </p>
    </div>

    <div class="grid gap-2">
      <Label :for="ids.role">{{ t('users.form.role') }}</Label>
      <Select v-model="role" name="role">
        <SelectTrigger
          :id="ids.role"
          class="w-full text-base data-[size=default]:h-11 md:text-sm md:data-[size=default]:h-9"
          :aria-invalid="fieldError('role') ? 'true' : undefined"
          :aria-describedby="describedBy('role')"
        >
          <SelectValue>{{ t(`users.roles.${role}`) }}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="r in ROLES" :key="r" :value="r" class="min-h-11 md:min-h-8">
            {{ t(`users.roles.${r}`) }}
          </SelectItem>
        </SelectContent>
      </Select>
      <p v-if="fieldError('role')" :id="errorId('role')" class="text-sm text-destructive">
        {{ fieldError('role') }}
      </p>
    </div>

    <div class="grid gap-2">
      <Label :for="ids.locale">{{ t('users.form.locale') }}</Label>
      <Input
        :id="ids.locale"
        v-model="locale"
        name="locale"
        placeholder="en-GB"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :aria-invalid="fieldError('locale') ? 'true' : undefined"
        :aria-describedby="describedBy('locale', true)"
        class="h-11 text-base"
      />
      <p :id="hintId('locale')" class="text-sm text-muted-foreground">
        {{ t('users.form.localeHint') }}
      </p>
      <p v-if="fieldError('locale')" :id="errorId('locale')" class="text-sm text-destructive">
        {{ fieldError('locale') }}
      </p>
    </div>

    <div class="grid gap-2">
      <Label :for="ids.timeZone">{{ t('users.form.timeZone') }}</Label>
      <Input
        :id="ids.timeZone"
        v-model="timeZone"
        name="timeZone"
        :list="ids.timeZones"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :aria-invalid="fieldError('timeZone') ? 'true' : undefined"
        :aria-describedby="describedBy('timeZone', true)"
        class="h-11 text-base"
      />
      <datalist :id="ids.timeZones">
        <option v-for="zone in timeZones" :key="zone" :value="zone" />
      </datalist>
      <p :id="hintId('timeZone')" class="text-sm text-muted-foreground">
        {{ t('users.form.timeZoneHint') }}
      </p>
      <p v-if="fieldError('timeZone')" :id="errorId('timeZone')" class="text-sm text-destructive">
        {{ fieldError('timeZone') }}
      </p>
    </div>

    <p v-if="noChanges" role="status" class="text-sm text-muted-foreground">
      {{ t('users.form.noChanges') }}
    </p>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        data-action="cancel"
        class="h-11 sm:h-9"
        @click="emit('cancel')"
      >
        {{ t('users.form.cancel') }}
      </Button>
      <Button type="submit" class="h-11 sm:h-9" :disabled="pending">{{ submitLabel }}</Button>
    </div>
  </form>
</template>
