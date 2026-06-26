import { sha256Hex } from './crypto';

const API_URL = 'https://openapi.youdao.com/api';

const ERROR_MESSAGES: Record<string, string> = {
  '101': '缺少必填参数，请检查配置',
  '108': '应用 ID 无效：有道服务器拒绝了当前 appKey',
  '110': '当前应用未开通「文本翻译」服务，请在有道控制台为应用开通该服务',
  '202': '签名错误：请确认应用密钥（appSecret）填写正确',
  '206': '时间戳无效，请检查本机系统时间是否正确',
};

function maskCredential(value: string): string {
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatYoudaoError(errorCode: string, appKey: string): string {
  if (errorCode === '108') {
    return [
      `有道翻译错误（108）：${ERROR_MESSAGES[errorCode]}`,
      `当前保存的 appKey 为 ${maskCredential(appKey)}，长度 ${appKey.length}`,
      '请确认该应用已开通「文本翻译」服务，且应用 ID 来自同一个有道智云账号和应用环境。',
    ].join('。');
  }

  const hint = ERROR_MESSAGES[errorCode];
  if (hint) {
    return `有道翻译错误（${errorCode}）：${hint}`;
  }
  return `有道翻译错误（errorCode: ${errorCode}）`;
}

interface YoudaoResponse {
  errorCode: string;
  translation?: string[];
  l?: string;
}

function truncateForSign(text: string): string {
  const length = text.length;
  if (length <= 20) {
    return text;
  }
  return `${text.slice(0, 10)}${length}${text.slice(-10)}`;
}

function createSalt(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export async function translateToChinese(
  appKey: string,
  appSecret: string,
  text: string,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  const salt = createSalt();
  const curtime = String(Math.floor(Date.now() / 1000));
  const sign = await sha256Hex(
    `${appKey}${truncateForSign(trimmed)}${salt}${curtime}${appSecret}`,
  );

  const body = new URLSearchParams({
    q: trimmed,
    from: 'auto',
    to: 'zh-CHS',
    appKey,
    salt,
    sign,
    signType: 'v3',
    curtime,
  });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`有道翻译请求失败（HTTP ${response.status}）`);
  }

  const data = (await response.json()) as YoudaoResponse;
  if (data.errorCode !== '0') {
    throw new Error(formatYoudaoError(data.errorCode, appKey));
  }

  return data.translation?.join('\n').trim() ?? '';
}
