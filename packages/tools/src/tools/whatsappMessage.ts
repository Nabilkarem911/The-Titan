export async function whatsappMessage(params: { to: string; message: string; type?: 'text' | 'template' | 'image'; imageUrl?: string; templateName?: string }): Promise<string> {
  const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
  const token = process.env['WHATSAPP_ACCESS_TOKEN'];
  if (!phoneNumberId || !token) throw new Error('WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN required');

  const { to, message, type = 'text', imageUrl, templateName } = params;
  if (!to) throw new Error('to (phone number) required');

  let body: Record<string, unknown>;

  switch (type) {
    case 'text': body = { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }; break;
    case 'image': {
      if (!imageUrl) throw new Error('imageUrl required for image type');
      body = { messaging_product: 'whatsapp', to, type: 'image', image: { link: imageUrl, caption: message } };
      break;
    }
    case 'template': {
      if (!templateName) throw new Error('templateName required for template type');
      body = { messaging_product: 'whatsapp', to, type: 'template', template: { name: templateName, language: { code: 'en' } } };
      break;
    }
    default: throw new Error(`Unknown type: ${type}`);
  }

  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) { const err = await res.text(); throw new Error(`WhatsApp failed: ${res.status} — ${err}`); }
  return res.text();
}
