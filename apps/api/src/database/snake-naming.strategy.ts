import { snakeCase } from 'change-case';
import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

/**
 * Every table and column name is snake_case (project rule). Names are derived from class and
 * property names; an explicit `name:` is kept verbatim, and the e2e naming guard rejects it
 * if it is not snake_case.
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? snakeCase(targetName);
  }

  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const name = customName ?? snakeCase(propertyName);
    return embeddedPrefixes.length > 0 ? `${snakeCase(embeddedPrefixes.join('_'))}_${name}` : name;
  }

  override relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    // Required by the NamingStrategyInterface signature (typeorm 0.3), unused here.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _secondPropertyName: string,
  ): string {
    return `${firstTableName}_${snakeCase(firstPropertyName.replace(/\./g, '_'))}_${secondTableName}`;
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snakeCase(`${tableName}_${columnName ?? propertyName}`);
  }
}
