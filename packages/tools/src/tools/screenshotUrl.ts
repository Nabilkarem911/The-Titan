export interface ScreenshotResult {
  dataUrl: string;
  url: string;
  width: number;
  height: number;
}

export async function screenshotUrl(params: {
  url: string;
  width?: number;
  height?: number;
  fullPage?: boolean;
}): Promise<ScreenshotResult> {
  const { url, width = 1280, height = 800, fullPage = false } = params;

  if (!url) throw new Error('url is required');

  const puppeteer = await import('puppeteer').catch(() => null);
  if (!puppeteer) throw new Error('puppeteer is not installed. Run: npm install puppeteer');

  const browser = await puppeteer.default.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const buffer = await page.screenshot({ fullPage, type: 'png' }) as Buffer;
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    return { dataUrl, url, width, height };
  } finally {
    await browser.close();
  }
}
