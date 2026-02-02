import { nullSafeString, nullSafeMatch, formatGermanDate, formatDateFromISO } from '@lib/utils';
import { Config } from '../config';

interface OrderLineRow {
  'Artikelnumer': string;
  'Kommentar': string;
  'Beschreibung': string;
  'Angefragt': string;
  'Versendet': string;
  'Anz/Konf.': string;
  'Gesamt': number;
  'Tracking link': string;
}

export interface CsvExportRow {
  'HAN': string;
  'Interne Bestellnummer': string;
  'Artikelnummer': string;
  'Lieferantenbezeichnung': string;
  'menge': number;
  'EK netto': string;
  'Lieferdatum': string;
  'Freiposition': string;
  'Fremdbelegnummer': string;
}

export function mapGraphQLToRow(line: any): OrderLineRow {
  const firstDel = line.deliveryLines?.[0] ?? null;
  const delivered = firstDel?.deliveryQuantity;
  const requested = line.requestedQuantity;
  const anzKonf = `${(delivered ?? requested) ?? ''} / ${requested ?? ''}`;

  const promised = firstDel?.promisedDispatchDate;
  const versendet = formatDateFromISO(promised) || formatDateFromISO(line.requestedDispatchDate);

  const name = line.article?.name || line.ecomArticleDescription;
  const beschreibung = line.article?.articleDescription || '';
  const nameBeschreibung = (name + ' ' + beschreibung).trim();

  return {
    'Artikelnumer': line.unformattedArticleNumber || line.article?.id || '',
    'Kommentar': line.customerOrderLineReference || '',
    'Beschreibung': nameBeschreibung,
    'Angefragt': formatDateFromISO(line.requestedDispatchDate),
    'Versendet': versendet,
    'Anz/Konf.': anzKonf,
    'Gesamt': line.totalNetPrice,
    'Tracking link': firstDel?.shipmentInfos?.[0]?.shipmentTrackingUrl || '',
  };
}

export function prepareCsvDataToExport(rows: OrderLineRow[], innerOrderNumber: string, outerOrderNumber: string): CsvExportRow[] {
  return rows.map((data) => {
    let vpe = parseInt(nullSafeMatch(data['Kommentar'], /^D-BE\S*\s*VPE=(\d+)/, 1), 10);
    if (!Number.isFinite(vpe) || vpe < 1) vpe = 1;

    const quantityRaw = (data['Anz/Konf.'] || '').split('/')[0] || '';
    const quantity = parseInt(String(quantityRaw).replace(/\D+/g, ''), 10);
    const baseQuantity = Number.isFinite(quantity) ? quantity : 0;
    const totalQuantity = Math.max(1, baseQuantity * vpe);

    const totalPrice = data['Gesamt'];
    const purchasePriceNet = (Number.isFinite(totalPrice) && totalQuantity > 0) ? (totalPrice * Config.business.DISCOUNT_FACTOR / totalQuantity) : NaN;

    return {
      'HAN': (data['Artikelnumer'] || '').replace(/^0+/g, '').replace(/\D+/g, ''),
      'Interne Bestellnummer': nullSafeString(innerOrderNumber).slice(0, 14),
      'Artikelnummer': nullSafeMatch(data['Kommentar'], /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/, 1),
      'Lieferantenbezeichnung': data['Beschreibung'] || '',
      'menge': totalQuantity,
      'EK netto': Number.isFinite(purchasePriceNet) ? purchasePriceNet.toFixed(4).replace('.', ',') : '',
      'Lieferdatum': formatGermanDate(data['Versendet']),
      'Freiposition': 'N',
      'Fremdbelegnummer': nullSafeString(outerOrderNumber),
    };
  });
}
