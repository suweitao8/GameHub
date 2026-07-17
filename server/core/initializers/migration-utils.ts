import { join } from 'path'
import { pathToFileURL } from 'url'

export function getMigrationModuleUrl (initializerDirectory: string, migrationScriptName: string) {
  return pathToFileURL(join(initializerDirectory, 'migrations', migrationScriptName)).href
}
