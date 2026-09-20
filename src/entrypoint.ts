import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Normalize argv[1] before comparing it with import.meta.url.
 * launchd can preserve a relative entrypoint even with WorkingDirectory set.
 */
export function isEntrypoint(metaUrl: string, argv1 = process.argv[1]): boolean {
    return Boolean(argv1) && fileURLToPath(metaUrl) === path.resolve(argv1!);
}
