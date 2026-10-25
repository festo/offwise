import { IsString, Length } from 'class-validator';
import { IsBcp47Locale } from '../common/validation/locale';
import type { SettingsNamespace } from './settings-namespace';

export class CompanySettingsDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsBcp47Locale()
  locale!: string;
}

export const companySettings: SettingsNamespace<CompanySettingsDto> = {
  name: 'company',
  dto: CompanySettingsDto,
  defaults: { name: 'offwise', locale: 'en-GB' },
  secretFields: [],
};

/** Until module 4 (holidays/calendars) makes this configurable. */
export const COMPANY_DEFAULT_TIME_ZONE = 'UTC';
