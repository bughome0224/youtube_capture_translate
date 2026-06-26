import type { PlayerRect } from './types';

export async function cropImageFromDataUrl(
  dataUrl: string,
  rect: PlayerRect,
): Promise<{ base64: string; dataUrl: string }> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const cropWidth = Math.max(1, Math.round(rect.width * rect.dpr));
  const cropHeight = Math.max(1, Math.round(rect.height * rect.dpr));
  const sourceX = Math.max(0, Math.round(rect.x * rect.dpr));
  const sourceY = Math.max(0, Math.round(rect.y * rect.dpr));

  const canvas = new OffscreenCanvas(cropWidth, cropHeight);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建画布上下文');
  }

  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  const outputBlob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: 0.85,
  });
  const base64 = await blobToBase64(outputBlob);
  return {
    base64,
    dataUrl: `data:image/jpeg;base64,${base64}`,
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
