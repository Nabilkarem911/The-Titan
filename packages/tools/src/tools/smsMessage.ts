export async function smsMessage(params: { to: string; body: string; from?: string }): Promise<string> {
  const accountSid = process.env['TWILIO_ACCOUNT_SID'];
  const authToken = process.env['TWILIO_AUTH_TOKEN'];
  const defaultFrom = process.env['TWILIO_FROM_NUMBER'];

  if (!accountSid || !authToken) throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN not configured');

  const from = params.from ?? defaultFrom;
  if (!from) throw new Error('from number required (set TWILIO_FROM_NUMBER or pass from param)');
  if (!params.to || !params.body) throw new Error('to and body required');

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: params.to, From: from, Body: params.body }),
  });

  if (!response.ok) throw new Error(`SMS failed: ${response.status}`);
  const data = await response.json() as { sid: string; status: string };
  return JSON.stringify({ success: true, messageSid: data.sid, status: data.status });
}
