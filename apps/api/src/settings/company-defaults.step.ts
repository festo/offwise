import type { InstallStep } from '../install/install-step';
import { companySettings } from './company.settings';
import { Setting } from './setting.entity';

export const companyDefaultsStep: InstallStep = {
  name: 'company.defaults',
  run: async (manager) => {
    await manager
      .createQueryBuilder()
      .insert()
      .into(Setting)
      .values({ namespace: companySettings.name, value: { ...companySettings.defaults } })
      .orIgnore()
      .execute();
  },
};
