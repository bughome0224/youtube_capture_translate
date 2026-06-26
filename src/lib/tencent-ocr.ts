import { bufferToHex, hmacSha256, sha256Hex } from './crypto';

const HOST = 'ocr.tencentcloudapi.com';
const SERVICE = 'ocr';
const ACTION = 'GeneralBasicOCR';
const VERSION = '2018-11-19';

interface TencentOcrResponse {
  Response: {
    TextDetections?: Array<{ DetectedText: string }>;
    Error?: {
      Code: string;
      Message: string;
    };
  };
}

function toUtcDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

async function buildAuthorization(
  secretId: string,
  secretKey: string,
  payload: string,
  timestamp: number,
): Promise<string> {
  const date = toUtcDate(timestamp);
  const hashedPayload = await sha256Hex(payload);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${HOST}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n');

  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');

  const secretDate = await hmacSha256(`TC3${secretKey}`, date);
  const secretService = await hmacSha256(secretDate, SERVICE);
  const secretSigning = await hmacSha256(secretService, 'tc3_request');
  const signature = bufferToHex(await hmacSha256(secretSigning, stringToSign));

  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export async function recognizeImage(
  secretId: string,
  secretKey: string,
  imageBase64: string,
): Promise<string> {
  const payload = JSON.stringify({
    ImageBase64: imageBase64,
    LanguageType: 'auto',
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const authorization = await buildAuthorization(
    secretId,
    secretKey,
    payload,
    timestamp,
  );

  const response = await fetch(`https://${HOST}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Host: HOST,
      Authorization: authorization,
      'X-TC-Action': ACTION,
      'X-TC-Version': VERSION,
      'X-TC-Timestamp': String(timestamp),
    },
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`腾讯云 OCR 请求失败（HTTP ${response.status}）`);
  }

  const data = (await response.json()) as TencentOcrResponse;
  if (data.Response.Error) {
    throw new Error(
      `腾讯云 OCR 错误：${data.Response.Error.Message}（${data.Response.Error.Code}）`,
    );
  }

  const lines = data.Response.TextDetections?.map((item) => item.DetectedText) ?? [];
  return lines.join('\n').trim();
}
