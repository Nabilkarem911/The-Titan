export interface CurrencyConvertResult {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  timestamp: number;
}

export async function currencyConvert(params: {
  from: string;
  to: string;
  amount?: number;
}): Promise<CurrencyConvertResult> {
  const { from, to, amount = 1 } = params;
  const apiKey = process.env['EXCHANGERATE_API_KEY'];

  let url: string;
  if (apiKey) {
    url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${from.toUpperCase()}/${to.toUpperCase()}/${amount}`;
  } else {
    // Free fallback — no key needed
    url = `https://api.exchangerate.host/convert?from=${from.toUpperCase()}&to=${to.toUpperCase()}&amount=${amount}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Currency API error ${res.status}`);

  const data = await res.json() as Record<string, unknown>;

  // Handle exchangerate-api.com response format
  if (data['conversion_result'] !== undefined) {
    return {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      amount,
      result: Number(data['conversion_result']),
      rate: Number(data['conversion_rate']),
      timestamp: Date.now(),
    };
  }

  // Handle exchangerate.host response format
  const result = Number(data['result']);
  const rate = Number((data['info'] as Record<string, unknown>)?.['rate'] ?? result / amount);
  return {
    from: from.toUpperCase(),
    to: to.toUpperCase(),
    amount,
    result,
    rate,
    timestamp: Date.now(),
  };
}
