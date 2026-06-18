export async function pushNotification(params: { token: string; title: string; body: string; data?: Record<string, string>; provider?: 'firebase' | 'expo' }): Promise<string> {
  const { token: deviceToken, title, body, data, provider = 'firebase' } = params;
  if (!deviceToken || !title) throw new Error('token and title required');

  if (provider === 'expo') {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: deviceToken, title, body, data }),
    });
    if (!res.ok) throw new Error(`Expo push failed: ${res.status}`);
    return res.text();
  }

  // Firebase FCM
  const serverKey = process.env['FIREBASE_SERVER_KEY'];
  if (!serverKey) throw new Error('FIREBASE_SERVER_KEY not configured');

  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: { 'Authorization': `key=${serverKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: deviceToken, notification: { title, body }, data }),
  });

  if (!res.ok) throw new Error(`FCM push failed: ${res.status}`);
  return res.text();
}
