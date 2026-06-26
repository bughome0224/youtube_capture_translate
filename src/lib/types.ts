export interface AppConfig {
  tencentSecretId: string;
  tencentSecretKey: string;
  youdaoAppKey: string;
  youdaoAppSecret: string;
  privacyAccepted: boolean;
}

export interface CaptureResult {
  dataUrl: string;
  originalText: string;
  translatedText: string;
  timestamp: number;
  status: 'idle' | 'selecting' | 'loading' | 'success' | 'error';
  error?: string;
}

export interface PlayerRect {
  x: number;
  y: number;
  width: number;
  height: number;
  dpr: number;
}

export interface CaptureFrameResponse {
  success: boolean;
  base64?: string;
  dataUrl?: string;
  error?: string;
  rect?: PlayerRect;
}
