import type { AppConfig, CaptureResult } from './types';

const CONFIG_KEYS = [
  'tencentSecretId',
  'tencentSecretKey',
  'youdaoAppKey',
  'youdaoAppSecret',
  'privacyAccepted',
] as const;

const DEFAULT_RESULT: CaptureResult = {
  dataUrl: '',
  originalText: '',
  translatedText: '',
  timestamp: 0,
  status: 'idle',
};

function cleanCredential(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[\u00a0\u3000]/g, ' ')
    .trim();
}

export async function getConfig(): Promise<AppConfig> {
  const data = await chrome.storage.local.get([...CONFIG_KEYS]);
  return {
    tencentSecretId: cleanCredential(data.tencentSecretId),
    tencentSecretKey: cleanCredential(data.tencentSecretKey),
    youdaoAppKey: cleanCredential(data.youdaoAppKey),
    youdaoAppSecret: cleanCredential(data.youdaoAppSecret),
    privacyAccepted: Boolean(data.privacyAccepted),
  };
}

export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
  await chrome.storage.local.set({
    ...config,
    ...(config.tencentSecretId !== undefined && {
      tencentSecretId: cleanCredential(config.tencentSecretId),
    }),
    ...(config.tencentSecretKey !== undefined && {
      tencentSecretKey: cleanCredential(config.tencentSecretKey),
    }),
    ...(config.youdaoAppKey !== undefined && {
      youdaoAppKey: cleanCredential(config.youdaoAppKey),
    }),
    ...(config.youdaoAppSecret !== undefined && {
      youdaoAppSecret: cleanCredential(config.youdaoAppSecret),
    }),
  });
}

export async function getLastResult(): Promise<CaptureResult> {
  const data = await chrome.storage.local.get('lastResult');
  return (data.lastResult as CaptureResult | undefined) ?? DEFAULT_RESULT;
}

export async function setLastResult(result: CaptureResult): Promise<void> {
  await chrome.storage.local.set({ lastResult: result });
}

export function validateConfig(config: AppConfig): string | null {
  if (!config.privacyAccepted) {
    return '请先在设置页同意隐私说明';
  }
  if (!config.tencentSecretId || !config.tencentSecretKey) {
    return '请先在设置页配置腾讯云 SecretId 和 SecretKey';
  }
  if (!config.youdaoAppKey || !config.youdaoAppSecret) {
    return '请先在设置页配置有道 appKey 和 appSecret';
  }
  return null;
}
