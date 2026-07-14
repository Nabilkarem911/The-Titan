import QRCode from 'qrcode';

interface QrGenerateResult {
  dataUrl: string;
  text: string;
}

export async function qrGenerate(params: { text: string; size?: number }): Promise<QrGenerateResult> {
  const { text, size = 300 } = params;

  if (!text) throw new Error('text is required');

  const dataUrl = await QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  return { dataUrl, text };
}
