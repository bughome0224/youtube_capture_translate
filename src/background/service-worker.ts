import { cropImageFromDataUrl } from '../lib/image-crop';
import { getConfig, validateConfig } from '../lib/storage';
import { recognizeImage } from '../lib/tencent-ocr';
import { translateToChinese } from '../lib/youdao-translate';
import type { CaptureResult, PlayerRect } from '../lib/types';

function isConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Receiving end does not exist');
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return;
  } catch (error) {
    if (!isConnectionError(error)) {
      throw error;
    }
  }

  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js;
  if (!files?.length) {
    throw new Error('内容脚本未配置，请重新安装扩展');
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [...files],
  });
}

async function sendTabMessage<T>(tabId: number, message: unknown): Promise<T> {
  try {
    await ensureContentScript(tabId);
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  } catch (error) {
    if (isConnectionError(error)) {
      throw new Error('无法连接页面脚本，请刷新 YouTube 页面后重试');
    }
    throw error;
  }
}

async function requestSelectionRect(tabId: number): Promise<PlayerRect> {
  const response = await sendTabMessage<{ rect?: PlayerRect; error?: string }>(tabId, {
    type: 'SELECT_CAPTURE_REGION',
  });
  if (!response.rect) {
    throw new Error(response.error ?? '未选择截图区域');
  }
  return response.rect;
}

async function showLoading(tabId: number): Promise<void> {
  await sendTabMessage(tabId, { type: 'SHOW_TRANSLATION_LOADING' });
}

async function showResult(tabId: number, result: CaptureResult): Promise<void> {
  await sendTabMessage(tabId, { type: 'SHOW_TRANSLATION_RESULT', result });
}

async function captureSelectedRegion(
  tab: chrome.tabs.Tab,
  rect: PlayerRect,
): Promise<{ base64: string; dataUrl: string }> {
  if (!tab.id || tab.windowId === undefined) {
    throw new Error('截图失败，无法获取当前标签页窗口');
  }

  const visibleTabDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: 'jpeg',
    quality: 85,
  });

  return cropImageFromDataUrl(visibleTabDataUrl, rect);
}

function isSelectionCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('已取消截图区域选择');
}

function createErrorResult(message: string): CaptureResult {
  return {
    dataUrl: '',
    originalText: '',
    translatedText: '',
    timestamp: Date.now(),
    status: 'error',
    error: message,
  };
}

async function processCapture(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url?.includes('youtube.com')) {
    await showResult(tabId, createErrorResult('请在 YouTube 页面使用此功能'));
    return;
  }

  const config = await getConfig();
  const configError = validateConfig(config);
  if (configError) {
    await showResult(tabId, createErrorResult(configError));
    return;
  }

  try {
    const rect = await requestSelectionRect(tabId);
    await showLoading(tabId);

    const image = await captureSelectedRegion(tab, rect);

    const originalText = await recognizeImage(
      config.tencentSecretId,
      config.tencentSecretKey,
      image.base64,
    );

    let translatedText = '';
    if (originalText) {
      translatedText = await translateToChinese(
        config.youdaoAppKey,
        config.youdaoAppSecret,
        originalText,
      );
    }

    const result: CaptureResult = {
      dataUrl: image.dataUrl,
      originalText,
      translatedText,
      timestamp: Date.now(),
      status: 'success',
    };
    await showResult(tabId, result);
  } catch (error) {
    if (isSelectionCancel(error)) {
      return;
    }
    await showResult(
      tabId,
      createErrorResult(error instanceof Error ? error.message : '处理失败'),
    );
  }
}

chrome.action.onClicked.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'capture') {
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) {
      return;
    }
    void processCapture(tabId);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RUN_CAPTURE_FROM_PAGE') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: '无法获取当前标签页' });
      return false;
    }
    void processCapture(tabId)
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '截图失败',
        }),
      );
    return true;
  }
  return false;
});
