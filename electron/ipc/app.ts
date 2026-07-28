import { app } from 'electron'

export async function getVersion() {
  return app.getVersion()
}

export async function checkUpdate(): Promise<{ latestVersion: string; releaseUrl: string }> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/Arc-River/ArcOffice/releases/latest',
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) {
      return { latestVersion: '', releaseUrl: '' }
    }
    const data = await res.json()
    return {
      latestVersion: (data.tag_name as string)?.replace(/^v/, '') || '',
      releaseUrl: (data.html_url as string) || '',
    }
  } catch {
    return { latestVersion: '', releaseUrl: '' }
  }
}
