export async function invoiceGenerate(params: {
  from: { name: string; email?: string; address?: string };
  to: { name: string; email?: string; address?: string };
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  invoiceNumber?: string;
  date?: string;
  dueDate?: string;
  currency?: string;
  notes?: string;
  tax?: number;
}): Promise<string> {
  const { from, to, items, currency = 'USD', notes, tax = 0 } = params;
  const invoiceNumber = params.invoiceNumber ?? `INV-${Date.now().toString(36).toUpperCase()}`;
  const date = params.date ?? new Date().toISOString().split('T')[0];
  const dueDate = params.dueDate ?? new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = subtotal * (tax / 100);
  const total = subtotal + taxAmount;

  const itemRows = items.map((i) =>
    `<tr><td>${i.description}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${currency} ${i.unitPrice.toFixed(2)}</td><td style="text-align:right">${currency} ${(i.quantity * i.unitPrice).toFixed(2)}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;margin:40px;color:#333}
h1{color:#2563eb;margin:0}
.header{display:flex;justify-content:space-between;margin-bottom:30px}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background:#f1f5f9;padding:10px;text-align:left;border-bottom:2px solid #e2e8f0}
td{padding:8px 10px;border-bottom:1px solid #e2e8f0}
.totals{text-align:right;margin-top:10px}
.total-row{font-size:1.2em;font-weight:bold;color:#2563eb}
.notes{margin-top:30px;padding:15px;background:#f8fafc;border-radius:8px}
</style></head><body>
<div class="header">
<div><h1>INVOICE</h1><p>${invoiceNumber}</p></div>
<div style="text-align:right"><p>Date: ${date}</p><p>Due: ${dueDate}</p></div>
</div>
<div class="header">
<div><strong>From:</strong><br>${from.name}${from.email ? `<br>${from.email}` : ''}${from.address ? `<br>${from.address}` : ''}</div>
<div style="text-align:right"><strong>To:</strong><br>${to.name}${to.email ? `<br>${to.email}` : ''}${to.address ? `<br>${to.address}` : ''}</div>
</div>
<table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemRows}</tbody></table>
<div class="totals">
<p>Subtotal: ${currency} ${subtotal.toFixed(2)}</p>
${tax > 0 ? `<p>Tax (${tax}%): ${currency} ${taxAmount.toFixed(2)}</p>` : ''}
<p class="total-row">Total: ${currency} ${total.toFixed(2)}</p>
</div>
${notes ? `<div class="notes"><strong>Notes:</strong><br>${notes}</div>` : ''}
</body></html>`;

  return JSON.stringify({ invoiceNumber, date, dueDate, subtotal, tax: taxAmount, total, currency, html, itemCount: items.length });
}
