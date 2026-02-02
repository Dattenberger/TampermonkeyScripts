import { gmFetch } from '@lib/fetch';
import { validateOrderNumber } from '@lib/utils';
import { State } from '../state';

const GQL_QUERY = `
  query getDetailedClosedOrder($siteName: String!, $orderNumber: ID!) {
    site(name: $siteName) {
      commerce {
        orders {
          get(orderId: $orderNumber) {
            customerOrderNumber
            orderNumber
            orderLines {
              ecomArticleDescription
              customerOrderLineReference
              requestedQuantity
              requestedDispatchDate
              unformattedArticleNumber
              totalGrossPrice
              totalNetPrice
              article {
                id
                name
                articleDescription
              }
              deliveryLines {
                deliveryQuantity
                promisedDispatchDate
                shipmentInfos { shipmentTrackingUrl }
              }
            }
          }
        }
      }
    }
  }`;

export function shouldRetryError(error: Error): boolean {
  const message = error.message || '';
  if (error.name === 'NetworkError' || message.includes('Failed to fetch')) return true;
  if (message.includes('GraphQL: leere Antwort')) return true;
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) return true;
  if (message.includes('timeout')) return true;
  if (message.includes('401') || message.includes('403') || message.includes('404')) return false;
  if (message.includes('Ungültige Bestellnummer')) return false;
  if (message.includes('Download bereits aktiv')) return false;
  return true;
}

export function handleExportError(error: Error, orderNumber: string): string {
  console.error(`Export error for order ${orderNumber}:`, error);
  const ctx = `Bestellung ${orderNumber}: `;
  if (error.name === 'NetworkError' || error.message.includes('Failed to fetch')) return ctx + 'Netzwerkfehler - bitte Internetverbindung prüfen';
  if (error.message.includes('401') || error.message.includes('403')) return ctx + 'Authentifizierung fehlgeschlagen - bitte neu anmelden';
  if (error.message.includes('404')) return ctx + 'Bestellung nicht gefunden';
  if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) return ctx + 'Server-Fehler - bitte später erneut versuchen';
  return ctx + `Export fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`;
}

export async function fetchOrderViaGraphQL(orderNumber: string, siteName: string, retryAttempt: number = 1): Promise<any> {
  if (!validateOrderNumber(orderNumber)) {
    throw new Error('Ungültige Bestellnummer');
  }

  if (retryAttempt === 1) {
    const cacheKey = `${orderNumber}-${siteName}`;
    if (State.orderCache.has(cacheKey)) {
      return State.orderCache.get(cacheKey);
    }
  }

  if (State.activeDownloads.has(orderNumber)) {
    throw new Error('Download bereits aktiv für diese Bestellung');
  }

  State.activeDownloads.add(orderNumber);

  try {
    const body = {
      query: GQL_QUERY,
      variables: { siteName, orderNumber },
      operationName: 'getDetailedClosedOrder',
    };

    const res = await gmFetch('https://portal.husqvarnagroup.com/hbd/graphql?', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);

    const json = await res.json() as any;
    const order = json?.data?.site?.commerce?.orders?.get;

    if (!order) throw new Error('GraphQL: leere Antwort');

    const cacheKey = `${orderNumber}-${siteName}`;
    State.orderCache.set(cacheKey, order);
    State.retryCounters.delete(orderNumber);

    return order;
  } finally {
    State.activeDownloads.delete(orderNumber);
  }
}
