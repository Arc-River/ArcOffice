import { app } from 'electron'
import path from 'node:path'

/**
 * Check whether a target path is within the allowed filesystem boundaries.
 *
 * @param targetPath  The path to validate
 * @param workingDir  Optional additional allowed root (e.g. the user's configured working directory)
 */
export function isPathAllowed(targetPath: string, workingDir?: string | null): boolean {
  const resolved = path.resolve(targetPath)
  if (workingDir && resolved.startsWith(workingDir + path.sep)) {
    return true
  }
  // Allow access to the user skills directory
  const skillsDir = path.join(app.getPath('userData'), 'skills')
  if (resolved.startsWith(skillsDir + path.sep)) {
    return true
  }
  return resolved.startsWith(app.getPath('documents')) || resolved.startsWith(app.getPath('home'))
}
