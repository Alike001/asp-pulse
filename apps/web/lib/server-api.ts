import { createApp } from '@asp-pulse/api/app'
import { createConfiguredScanStore } from '@asp-pulse/api/store-factory'

let appPromise: Promise<ReturnType<typeof createApp>> | undefined

async function getApp(): Promise<ReturnType<typeof createApp>> {
  appPromise ??= createConfiguredScanStore().then((store) => createApp({ store }))
  return appPromise
}

export async function handleVercelApi(request: Request): Promise<Response> {
  const url = new URL(request.url)
  url.pathname = url.pathname.slice('/api'.length) || '/'
  return (await getApp()).fetch(new Request(url, request))
}
