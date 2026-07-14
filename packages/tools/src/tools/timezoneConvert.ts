interface TimezoneConvertResult {
  originalTime: string;
  fromTimezone: string;
  toTimezone: string;
  convertedTime: string;
  offset: string;
}

export async function timezoneConvert(params: {
  time?: string;
  fromTimezone: string;
  toTimezone: string;
}): Promise<TimezoneConvertResult> {
  const { time, fromTimezone, toTimezone } = params;

  const inputTime = time ? new Date(time) : new Date();
  if (isNaN(inputTime.getTime())) throw new Error(`Invalid time: ${time}`);

  const formatOpts: Intl.DateTimeFormatOptions = {
    timeZone: toTimezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  };

  let convertedTime: string;
  try {
    convertedTime = new Intl.DateTimeFormat('en-US', formatOpts).format(inputTime);
  } catch {
    throw new Error(`Invalid timezone: ${toTimezone}`);
  }

  const fromDate = new Intl.DateTimeFormat('en-US', { timeZone: fromTimezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(inputTime);
  const toDate = new Intl.DateTimeFormat('en-US', { timeZone: toTimezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(inputTime);

  return {
    originalTime: inputTime.toISOString(),
    fromTimezone,
    toTimezone,
    convertedTime,
    offset: `${fromDate} → ${toDate}`,
  };
}
