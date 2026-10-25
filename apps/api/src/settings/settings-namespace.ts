export interface SettingsNamespace<T extends object> {
  name: string;
  dto: new () => T;
  defaults: T;
  secretFields: readonly (keyof T & string)[];
}
