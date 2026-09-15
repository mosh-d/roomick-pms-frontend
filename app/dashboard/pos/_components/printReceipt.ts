import { currencySymbolFor } from '@/lib/currencies';
import { formatMoney } from '@/lib/numberFormat';
import { SETTLEMENT_LABELS, type PosOrder } from '@/lib/pos';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

/**
 * Prints a till receipt, sized for an 80mm receipt printer. It prints from a
 * hidden iframe holding only the receipt, so the dashboard around the
 * terminal never reaches the paper and no popup is opened.
 */
export function printReceipt(order: PosOrder): void {
  const symbol = currencySymbolFor(order.currency);
  const money = (value: string) => escapeHtml(formatMoney(value, symbol));

  const lines = order.items
    .map((line) => {
      const modifiers = line.modifiers.map((m) => `<div class="mod">+ ${escapeHtml(m.label)}</div>`).join('');
      return `<tr><td>${line.qty}× ${escapeHtml(line.name)}${modifiers}</td><td class="amt">${money(line.lineTotal)}</td></tr>`;
    })
    .join('');

  const settledTo =
    order.settlement === 'room' && order.reservation
      ? `Charged to Room ${escapeHtml(order.reservation.room?.number ?? '')} — ${escapeHtml(order.reservation.guest.name)}`
      : `Paid by ${SETTLEMENT_LABELS[order.settlement].toLowerCase()}`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Order #${order.orderNo}</title><style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace; color: #000; margin: 0; }
    h1 { font-size: 14px; text-align: center; margin: 0; }
    .centre { text-align: center; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    td { vertical-align: top; padding: 2px 0; }
    .amt { text-align: right; white-space: nowrap; padding-left: 8px; }
    .mod { padding-left: 12px; font-size: 11px; }
    .rule { border-top: 1px dashed #000; margin: 6px 0; }
    .total td { font-weight: bold; font-size: 13px; }
    .void { text-align: center; font-weight: bold; border: 2px solid #000; margin: 6px 0; padding: 2px; }
  </style></head><body>
    <h1>${escapeHtml(order.branch.name)}</h1>
    <div class="centre">${escapeHtml(order.outlet.name)}</div>
    <div class="rule"></div>
    <div>Order #${order.orderNo}${order.tableNumber ? ` · Table ${escapeHtml(order.tableNumber)}` : ''}</div>
    <div>${escapeHtml(new Date(order.createdAt).toLocaleString())}</div>
    ${order.cashierName ? `<div>Served by ${escapeHtml(order.cashierName)}</div>` : ''}
    ${order.voidedAt ? '<div class="void">VOID</div>' : ''}
    <table>${lines}</table>
    <div class="rule"></div>
    <table>
      <tr><td>Subtotal</td><td class="amt">${money(order.subtotal)}</td></tr>
      <tr><td>Tax</td><td class="amt">${money(order.taxTotal)}</td></tr>
      <tr class="total"><td>Total</td><td class="amt">${money(order.total)}</td></tr>
    </table>
    <div class="rule"></div>
    <div class="centre">${settledTo}</div>
    ${order.settlement === 'room' ? '<div class="centre" style="margin-top:16px">Guest signature: ____________________</div>' : ''}
    <div class="centre" style="margin-top:8px">Thank you</div>
  </body></html>`;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const frameWindow = frame.contentWindow;
  if (!frameWindow) {
    frame.remove();
    return;
  }
  frameWindow.document.open();
  frameWindow.document.write(html);
  frameWindow.document.close();
  frameWindow.focus();
  frameWindow.print();
  // print() blocks until the dialog closes in every major browser; the delay only guards the ones that return early.
  setTimeout(() => frame.remove(), 1000);
}
