import type { CaptureResult, PlayerRect } from '../lib/types';

const BUTTON_ID = 'yt-capture-translate-button';
const MODAL_ID = 'yt-capture-translate-modal';
const MIN_SELECTION_SIZE = 8;
const SELECTION_OVERLAY_BACKGROUND = 'rgba(0, 0, 0, 0.28)';
const VIDEO_SELECTORS = [
  'video.html5-main-video',
  '#movie_player video',
  'ytd-player video',
];

let activeSelectionCancel: (() => void) | null = null;
let buttonObserver: MutationObserver | null = null;

interface ResultMessage {
  type: 'SHOW_TRANSLATION_RESULT';
  result: CaptureResult;
}

function findMainVideo(): HTMLVideoElement | null {
  for (const selector of VIDEO_SELECTORS) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLVideoElement && element.videoWidth > 0) {
      return element;
    }
  }

  const candidates = [...document.querySelectorAll('video')].filter(
    (video): video is HTMLVideoElement =>
      video instanceof HTMLVideoElement &&
      video.videoWidth > 0 &&
      video.getBoundingClientRect().width > 0,
  );

  return (
    candidates.sort(
      (left, right) =>
        right.clientWidth * right.clientHeight -
        left.clientWidth * left.clientHeight,
    )[0] ?? null
  );
}

function assertCaptureReady(): void {
  if (document.pictureInPictureElement) {
    throw new Error('请先退出画中画模式后再截图');
  }

  if (document.querySelector('.ad-showing')) {
    throw new Error('当前正在播放广告，请稍后再试');
  }
}

function pauseMainVideo(): void {
  findMainVideo()?.pause();
}

function setSelectionBox(
  box: HTMLElement,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): DOMRect {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;

  return new DOMRect(left, top, width, height);
}

function createPageButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.className = 'ytp-button';
  button.title = '框选截图并翻译';
  button.setAttribute('aria-label', '框选截图并翻译');
  button.textContent = '译';
  button.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'justify-content: center',
    'width: 36px',
    'height: 36px',
    'margin: 0 2px',
    'border: 0',
    'border-radius: 4px',
    'background: #1677ff',
    'color: #fff',
    'font: 700 16px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'cursor: pointer',
  ].join(';');

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void chrome.runtime.sendMessage({ type: 'RUN_CAPTURE_FROM_PAGE' });
  });

  return button;
}

function injectPageButton(): void {
  if (document.getElementById(BUTTON_ID)) {
    return;
  }

  const controls = document.querySelector<HTMLElement>('.ytp-right-controls');
  if (!controls) {
    return;
  }

  const settingsButton = controls.querySelector('.ytp-settings-button');
  const referenceNode =
    settingsButton instanceof Node && settingsButton.parentNode === controls
      ? settingsButton
      : controls.firstChild;

  controls.insertBefore(createPageButton(), referenceNode);
}

function startButtonObserver(): void {
  injectPageButton();
  buttonObserver?.disconnect();
  buttonObserver = new MutationObserver(injectPageButton);
  buttonObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function createSelectionOverlay(): {
  overlay: HTMLElement;
  selectionBox: HTMLElement;
  toolbar: HTMLElement;
  tip: HTMLElement;
  confirmButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
} {
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 2147483647',
    'cursor: crosshair',
    `background: ${SELECTION_OVERLAY_BACKGROUND}`,
    'user-select: none',
  ].join(';');

  const tip = document.createElement('div');
  tip.textContent = '拖拽选择要翻译的区域';
  tip.style.cssText = [
    'position: fixed',
    'left: 50%',
    'top: 18px',
    'transform: translateX(-50%)',
    'padding: 8px 12px',
    'border-radius: 8px',
    'background: rgba(17, 24, 39, 0.92)',
    'color: #fff',
    'font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24)',
    'pointer-events: none',
  ].join(';');

  const selectionBox = document.createElement('div');
  selectionBox.style.cssText = [
    'position: fixed',
    'display: none',
    'border: 2px solid #ef4444',
    'background: transparent',
    'box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.42)',
    'pointer-events: none',
  ].join(';');

  const toolbar = document.createElement('div');
  toolbar.style.cssText = [
    'position: fixed',
    'display: none',
    'gap: 8px',
    'padding: 8px',
    'border-radius: 8px',
    'background: rgba(17, 24, 39, 0.96)',
    'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24)',
  ].join(';');

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.textContent = '确认翻译';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = '取消';

  for (const button of [confirmButton, cancelButton]) {
    button.style.cssText = [
      'border: 0',
      'border-radius: 6px',
      'padding: 7px 10px',
      'font: 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'color: #fff',
      'cursor: pointer',
    ].join(';');
  }
  confirmButton.style.background = '#ef4444';
  cancelButton.style.background = '#374151';

  toolbar.append(confirmButton, cancelButton);
  overlay.append(tip, selectionBox, toolbar);
  document.body.append(overlay);

  return { overlay, selectionBox, toolbar, tip, confirmButton, cancelButton };
}

function placeToolbar(toolbar: HTMLElement, rect: DOMRect): void {
  const toolbarWidth = 156;
  const toolbarHeight = 42;
  const margin = 8;
  const left = Math.min(
    window.innerWidth - toolbarWidth - margin,
    Math.max(margin, rect.left + rect.width - toolbarWidth),
  );
  const belowTop = rect.top + rect.height + margin;
  const top =
    belowTop + toolbarHeight <= window.innerHeight
      ? belowTop
      : Math.max(margin, rect.top - toolbarHeight - margin);

  toolbar.style.left = `${left}px`;
  toolbar.style.top = `${top}px`;
}

function selectCaptureRegion(): Promise<PlayerRect> {
  if (activeSelectionCancel) {
    activeSelectionCancel();
    activeSelectionCancel = null;
  }

  assertCaptureReady();
  pauseMainVideo();

  return new Promise((resolve, reject) => {
    const { overlay, selectionBox, toolbar, tip, confirmButton, cancelButton } =
      createSelectionOverlay();
    let startX = 0;
    let startY = 0;
    let selectionRect: DOMRect | null = null;
    let isDragging = false;

    function cleanup(): void {
      activeSelectionCancel = null;
      overlay.remove();
      window.removeEventListener('keydown', handleKeydown, true);
    }

    function cancel(message = '已取消截图区域选择'): void {
      cleanup();
      reject(new Error(message));
    }

    activeSelectionCancel = () => cancel('已取消上一次区域选择');

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    }

    overlay.addEventListener('pointerdown', (event) => {
      if (event.target instanceof HTMLButtonElement) {
        return;
      }
      event.preventDefault();
      overlay.setPointerCapture(event.pointerId);
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      overlay.style.background = 'transparent';
      toolbar.style.display = 'none';
      selectionBox.style.display = 'block';
      selectionRect = setSelectionBox(selectionBox, startX, startY, startX, startY);
    });

    overlay.addEventListener('pointermove', (event) => {
      if (!isDragging) {
        return;
      }
      event.preventDefault();
      selectionRect = setSelectionBox(
        selectionBox,
        startX,
        startY,
        event.clientX,
        event.clientY,
      );
    });

    overlay.addEventListener('pointerup', (event) => {
      if (!isDragging) {
        return;
      }
      event.preventDefault();
      isDragging = false;
      overlay.releasePointerCapture(event.pointerId);

      if (
        !selectionRect ||
        selectionRect.width < MIN_SELECTION_SIZE ||
        selectionRect.height < MIN_SELECTION_SIZE
      ) {
        overlay.style.background = SELECTION_OVERLAY_BACKGROUND;
        selectionBox.style.display = 'none';
        toolbar.style.display = 'none';
        tip.textContent = '区域太小，请重新拖拽选择';
        selectionRect = null;
        return;
      }

      toolbar.style.display = 'flex';
      placeToolbar(toolbar, selectionRect);
      tip.textContent = '确认后将翻译选中区域';
    });

    confirmButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectionRect) {
        return;
      }

      const rect: PlayerRect = {
        x: selectionRect.left,
        y: selectionRect.top,
        width: selectionRect.width,
        height: selectionRect.height,
        dpr: window.devicePixelRatio || 1,
      };
      cleanup();
      resolve(rect);
    });

    cancelButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    });

    window.addEventListener('keydown', handleKeydown, true);
  });
}

function createModalShell(): HTMLElement {
  document.getElementById(MODAL_ID)?.remove();

  const modal = document.createElement('section');
  modal.id = MODAL_ID;
  modal.style.cssText = [
    'position: fixed',
    'right: 18px',
    'bottom: 78px',
    'z-index: 2147483646',
    'width: min(420px, calc(100vw - 36px))',
    'max-height: min(720px, calc(100vh - 108px))',
    'display: flex',
    'flex-direction: column',
    'gap: 12px',
    'padding: 14px',
    'border: 1px solid rgba(148, 163, 184, 0.28)',
    'border-radius: 12px',
    'background: rgba(17, 24, 39, 0.96)',
    'color: #f9fafb',
    'box-shadow: 0 20px 60px rgba(0, 0, 0, 0.34)',
    'font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  ].join(';');

  document.body.append(modal);
  return modal;
}

function createModalButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = [
    'border: 1px solid rgba(148, 163, 184, 0.34)',
    'border-radius: 8px',
    'background: #374151',
    'color: #f9fafb',
    'padding: 7px 10px',
    'font: 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'cursor: pointer',
  ].join(';');
  return button;
}

function appendTextBlock(parent: HTMLElement, title: string, text: string): void {
  const label = document.createElement('h3');
  label.textContent = title;
  label.style.cssText = 'margin: 0;color: #d1d5db;font-size: 12px;font-weight: 600;';

  const block = document.createElement('pre');
  block.textContent = text;
  block.style.cssText = [
    'margin: 0',
    'max-height: 170px',
    'overflow: auto',
    'white-space: pre-wrap',
    'word-break: break-word',
    'border: 1px solid rgba(148, 163, 184, 0.24)',
    'border-radius: 8px',
    'background: rgba(31, 41, 55, 0.92)',
    'padding: 10px',
    'color: #f9fafb',
    'font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace',
  ].join(';');

  parent.append(label, block);
}

function showLoadingModal(): void {
  const modal = createModalShell();
  modal.textContent = '';

  const title = document.createElement('strong');
  title.textContent = '正在识别并翻译...';
  title.style.cssText = 'font-size: 14px;';

  const hint = document.createElement('p');
  hint.textContent = '请稍候，完成后会在这里显示结果。';
  hint.style.cssText = 'margin: 0;color: #d1d5db;';

  modal.append(title, hint);
}

function showResultModal(result: CaptureResult): void {
  const modal = createModalShell();
  modal.textContent = '';

  const header = document.createElement('div');
  header.style.cssText = 'display: flex;align-items: center;justify-content: space-between;gap: 12px;';

  const title = document.createElement('strong');
  title.textContent = result.status === 'error' ? '翻译失败' : '截图翻译结果';
  title.style.cssText = 'font-size: 14px;';

  const closeButton = createModalButton('关闭');
  closeButton.addEventListener('click', () => modal.remove());

  header.append(title, closeButton);
  modal.append(header);

  if (result.status === 'error') {
    const error = document.createElement('p');
    error.textContent = result.error ?? '处理失败';
    error.style.cssText = 'margin: 0;color: #fecaca;';
    modal.append(error);
    return;
  }

  if (result.dataUrl) {
    const image = document.createElement('img');
    image.src = result.dataUrl;
    image.alt = '截图预览';
    image.style.cssText = [
      'width: 100%',
      'max-height: 180px',
      'object-fit: contain',
      'border-radius: 8px',
      'background: #000',
      'border: 1px solid rgba(148, 163, 184, 0.24)',
    ].join(';');
    modal.append(image);
  }

  appendTextBlock(modal, '识别原文', result.originalText || '（未识别到文字）');
  appendTextBlock(
    modal,
    '中文译文',
    result.translatedText || (result.originalText ? '（翻译结果为空）' : '（无可翻译内容）'),
  );

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex;gap: 8px;justify-content: flex-end;';

  const copyOriginalButton = createModalButton('复制原文');
  copyOriginalButton.addEventListener('click', () => {
    void navigator.clipboard.writeText(result.originalText);
  });

  const copyTranslatedButton = createModalButton('复制译文');
  copyTranslatedButton.style.background = '#1677ff';
  copyTranslatedButton.addEventListener('click', () => {
    void navigator.clipboard.writeText(result.translatedText);
  });

  actions.append(copyOriginalButton, copyTranslatedButton);
  modal.append(actions);
}

chrome.runtime.onMessage.addListener((message: ResultMessage | { type?: string }, _sender, sendResponse) => {
  if (message?.type === 'PING') {
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === 'SELECT_CAPTURE_REGION') {
    void selectCaptureRegion()
      .then((rect) => sendResponse({ rect }))
      .catch((error) =>
        sendResponse({
          error: error instanceof Error ? error.message : '区域选择失败',
        }),
      );
    return true;
  }

  if (message?.type === 'SHOW_TRANSLATION_LOADING') {
    showLoadingModal();
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === 'SHOW_TRANSLATION_RESULT' && 'result' in message) {
    showResultModal(message.result);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

startButtonObserver();
