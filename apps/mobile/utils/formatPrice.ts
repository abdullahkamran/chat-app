import type { Amount } from '@chat-app/shared-types';

/** A price as one line, e.g. "$1.99 + 50 coins", or "Free". */
export function formatPrice(price: Amount): string {
  const parts: string[] = [];
  if (price.realMoney > 0) parts.push(`$${price.realMoney.toFixed(2)}`);
  if (price.cash > 0) parts.push(`${price.cash} cash`);
  if (price.coins > 0) parts.push(`${price.coins} coins`);
  return parts.length > 0 ? parts.join(' + ') : 'Free';
}
