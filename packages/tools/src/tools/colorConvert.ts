export interface ColorConvertResult {
  input: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  hsv: { h: number; s: number; v: number };
  name?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0)
    : max === gn ? (bn - rn) / d + 2
    : (rn - gn) / d + 4;
  h /= 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const v = max, d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (max !== min) {
    h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0)
      : max === gn ? (bn - rn) / d + 2
      : (rn - gn) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

export async function colorConvert(params: {
  color: string;
}): Promise<ColorConvertResult> {
  const { color } = params;
  if (!color) throw new Error('color is required');

  let r: number, g: number, b: number;
  const input = color.trim();

  if (/^#?[0-9a-f]{3,6}$/i.test(input)) {
    const rgb = hexToRgb(input.startsWith('#') ? input : '#' + input);
    r = rgb.r; g = rgb.g; b = rgb.b;
  } else if (/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.test(input)) {
    const m = input.match(/(\d+)/g)!;
    r = parseInt(m[0]); g = parseInt(m[1]); b = parseInt(m[2]);
  } else if (/^hsl\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)$/i.test(input)) {
    const m = input.match(/(\d+)/g)!;
    const h = parseInt(m[0]) / 360, s = parseInt(m[1]) / 100, l = parseInt(m[2]) / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    r = Math.round(hue2rgb(h + 1/3) * 255);
    g = Math.round(hue2rgb(h) * 255);
    b = Math.round(hue2rgb(h - 1/3) * 255);
  } else {
    throw new Error(`Unrecognized color format: "${color}". Use HEX (#fff or #ffffff), RGB (rgb(r,g,b)), or HSL (hsl(h,s%,l%))`);
  }

  return {
    input,
    hex: rgbToHex(r, g, b),
    rgb: { r, g, b },
    hsl: rgbToHsl(r, g, b),
    hsv: rgbToHsv(r, g, b),
  };
}
