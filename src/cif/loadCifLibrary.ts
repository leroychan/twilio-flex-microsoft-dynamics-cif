function defaultGetCrmUrl(): string | undefined {
  const anc = (window as any)?.location?.ancestorOrigins?.[0];
  if (anc) return anc;
  if (document.referrer) return new URL(document.referrer).origin;
  return undefined;
}

function defaultInject(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}

export async function loadCifLibrary(deps: {
  getCrmUrl?: () => string | undefined;
  injectScript?: (src: string) => Promise<void>;
  isReady?: () => boolean;
  timeoutMs?: number;
} = {}): Promise<boolean> {
  // NOTE: We gate on presence of window.Microsoft.CIFramework rather than the CIFInitDone
  // event. In practice this is sufficient: the Flex Actions listeners that make CIF calls
  // (afterAcceptTask/afterCompleteTask) only fire long after page load and CIF handshake,
  // so the API is initialized by the time we call it. Revisit if a call ever races init.
  const getCrmUrl = deps.getCrmUrl ?? defaultGetCrmUrl;
  const injectScript = deps.injectScript ?? defaultInject;
  const isReady = deps.isReady ?? (() => !!(window as any)?.Microsoft?.CIFramework);
  const timeoutMs = deps.timeoutMs ?? 15000;

  if (isReady()) return true;
  const crmUrl = getCrmUrl();
  if (!crmUrl) return false;

  try {
    await injectScript(`${crmUrl}/webresources/Widget/msdyn_ciLibrary.js`);
  } catch {
    return false;
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isReady()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
