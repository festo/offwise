import { describe, expect, it } from 'vitest';
import { SnakeNamingStrategy } from './snake-naming.strategy';

describe('SnakeNamingStrategy', () => {
  const strategy = new SnakeNamingStrategy();

  it('derives table names from the class name', () => {
    expect(strategy.tableName('InstallStepRecord', undefined)).toBe('install_step_record');
  });

  it('converts an acronym-prefixed class name', () => {
    expect(strategy.tableName('HTTPServer', undefined)).toBe('http_server');
  });

  it.each([
    ['userID', 'user_id'],
    ['leaveType2Id', 'leave_type2_id'],
  ])('converts column name %s to %s', (input, expected) => {
    expect(strategy.columnName(input, undefined, [])).toBe(expected);
  });

  it('keeps an explicit table name verbatim', () => {
    expect(strategy.tableName('InstallStepRecord', 'install_steps')).toBe('install_steps');
  });

  it('derives column names from the property name', () => {
    expect(strategy.columnName('appliedAt', undefined, [])).toBe('applied_at');
  });

  it('keeps an explicit column name verbatim', () => {
    expect(strategy.columnName('appliedAt', 'applied_on', [])).toBe('applied_on');
  });

  it('prefixes embedded columns', () => {
    expect(strategy.columnName('startDate', undefined, ['period'])).toBe('period_start_date');
  });

  it('names join columns <relation>_<referenced column>', () => {
    expect(strategy.joinColumnName('managerUser', 'id')).toBe('manager_user_id');
  });

  it('names join tables and their columns in snake_case', () => {
    expect(strategy.joinTableName('user', 'holiday_group', 'holidayGroups', 'users')).toBe(
      'user_holiday_groups_holiday_group',
    );
    expect(strategy.joinTableColumnName('user', 'id')).toBe('user_id');
  });
});
