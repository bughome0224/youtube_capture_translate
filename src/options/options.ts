import { getConfig, saveConfig } from '../lib/storage';

const privacyAcceptedEl = document.querySelector<HTMLInputElement>('#privacyAccepted')!;
const tencentSecretIdEl = document.querySelector<HTMLInputElement>('#tencentSecretId')!;
const tencentSecretKeyEl = document.querySelector<HTMLInputElement>('#tencentSecretKey')!;
const youdaoAppKeyEl = document.querySelector<HTMLInputElement>('#youdaoAppKey')!;
const youdaoAppSecretEl = document.querySelector<HTMLInputElement>('#youdaoAppSecret')!;
const saveBtn = document.querySelector<HTMLButtonElement>('#save')!;
const saveStatusEl = document.querySelector<HTMLElement>('#save-status')!;

async function loadOptions(): Promise<void> {
  const config = await getConfig();
  privacyAcceptedEl.checked = config.privacyAccepted;
  tencentSecretIdEl.value = config.tencentSecretId;
  tencentSecretKeyEl.value = config.tencentSecretKey;
  youdaoAppKeyEl.value = config.youdaoAppKey;
  youdaoAppSecretEl.value = config.youdaoAppSecret;
}

async function closeOptionsPage(): Promise<void> {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id) {
      await chrome.tabs.remove(tab.id);
      return;
    }
  } catch {
    // Some browser contexts do not expose the current tab to extension pages.
  }

  window.close();
}

saveBtn.addEventListener('click', async () => {
  await saveConfig({
    privacyAccepted: privacyAcceptedEl.checked,
    tencentSecretId: tencentSecretIdEl.value.trim(),
    tencentSecretKey: tencentSecretKeyEl.value.trim(),
    youdaoAppKey: youdaoAppKeyEl.value.trim(),
    youdaoAppSecret: youdaoAppSecretEl.value.trim(),
  });

  saveStatusEl.textContent = '已保存，正在关闭设置页...';
  window.setTimeout(() => {
    void closeOptionsPage();
  }, 500);
});

void loadOptions();
