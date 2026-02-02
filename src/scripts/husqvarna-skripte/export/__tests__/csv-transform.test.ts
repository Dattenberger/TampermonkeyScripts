import { describe, it, expect } from 'vitest';
import { mapGraphQLToRow, prepareCsvDataToExport } from '../csv-transform';

describe('mapGraphQLToRow', () => {
  it('maps a full order line with deliveryLines', () => {
    const line = {
      unformattedArticleNumber: '00012345',
      customerOrderLineReference: 'D-BE123 VPE=2 ART456',
      article: { id: 'A1', name: 'Mower', articleDescription: 'Lawn mower' },
      ecomArticleDescription: 'Fallback desc',
      requestedQuantity: 5,
      requestedDispatchDate: '2024-03-15T00:00:00Z',
      totalNetPrice: 100.5,
      deliveryLines: [{
        deliveryQuantity: 3,
        promisedDispatchDate: '2024-03-20T00:00:00Z',
        shipmentInfos: [{ shipmentTrackingUrl: 'https://track.me/123' }],
      }],
    };
    const row = mapGraphQLToRow(line);
    expect(row['Artikelnumer']).toBe('00012345');
    expect(row['Kommentar']).toBe('D-BE123 VPE=2 ART456');
    expect(row['Beschreibung']).toBe('Mower Lawn mower');
    expect(row['Anz/Konf.']).toBe('3 / 5');
    expect(row['Gesamt']).toBe(100.5);
    expect(row['Tracking link']).toBe('https://track.me/123');
  });

  it('handles missing deliveryLines', () => {
    const line = {
      unformattedArticleNumber: '999',
      customerOrderLineReference: '',
      article: null,
      ecomArticleDescription: 'Desc',
      requestedQuantity: 2,
      requestedDispatchDate: '2024-01-01T00:00:00Z',
      totalNetPrice: 50,
      deliveryLines: null,
    };
    const row = mapGraphQLToRow(line);
    expect(row['Anz/Konf.']).toBe('2 / 2');
    expect(row['Tracking link']).toBe('');
  });

  it('handles empty deliveryLines array', () => {
    const line = {
      unformattedArticleNumber: '111',
      customerOrderLineReference: '',
      article: null,
      ecomArticleDescription: 'Test',
      requestedQuantity: 1,
      requestedDispatchDate: null,
      totalNetPrice: 10,
      deliveryLines: [],
    };
    const row = mapGraphQLToRow(line);
    expect(row['Anz/Konf.']).toBe('1 / 1');
    expect(row['Versendet']).toBe('');
  });
});

describe('prepareCsvDataToExport', () => {
  const makeRow = (overrides: any = {}) => ({
    'Artikelnumer': '00012345',
    'Kommentar': 'D-BE123 VPE=2 ART456',
    'Beschreibung': 'Test item',
    'Angefragt': '15.03.2024',
    'Versendet': '20.03.2024',
    'Anz/Konf.': '5 / 5',
    'Gesamt': 100,
    'Tracking link': '',
    ...overrides,
  });

  it('calculates VPE correctly (VPE=2 means quantity * 2)', () => {
    const rows = [makeRow()];
    const result = prepareCsvDataToExport(rows, 'INNER123', 'OUTER456');
    expect(result[0]['menge']).toBe(10); // 5 * 2
  });

  it('defaults VPE to 1 when missing', () => {
    const rows = [makeRow({ 'Kommentar': 'D-BE123 ART456' })];
    const result = prepareCsvDataToExport(rows, 'INNER', 'OUTER');
    expect(result[0]['menge']).toBe(5);
  });

  it('calculates EK netto (totalNetPrice * 0.97 / quantity)', () => {
    const rows = [makeRow({ 'Gesamt': 100, 'Anz/Konf.': '5 / 5', 'Kommentar': 'D-BE123 ART456' })];
    const result = prepareCsvDataToExport(rows, 'I', 'O');
    // 100 * 0.97 / 5 = 19.4
    expect(result[0]['EK netto']).toBe('19,4000');
  });

  it('strips leading zeros from HAN', () => {
    const rows = [makeRow({ 'Artikelnumer': '000123' })];
    const result = prepareCsvDataToExport(rows, 'I', 'O');
    expect(result[0]['HAN']).toBe('123');
  });

  it('extracts Artikelnummer from Kommentar', () => {
    const rows = [makeRow({ 'Kommentar': 'D-BE123 VPE=2 ART456' })];
    const result = prepareCsvDataToExport(rows, 'I', 'O');
    expect(result[0]['Artikelnummer']).toBe('ART456');
  });

  it('truncates Interne Bestellnummer to 14 chars', () => {
    const rows = [makeRow()];
    const result = prepareCsvDataToExport(rows, '12345678901234567', 'O');
    expect(result[0]['Interne Bestellnummer']).toBe('12345678901234');
  });

  it('returns empty array for empty orderLines', () => {
    const result = prepareCsvDataToExport([], 'I', 'O');
    expect(result).toEqual([]);
  });

  it('sets Freiposition to N', () => {
    const rows = [makeRow()];
    const result = prepareCsvDataToExport(rows, 'I', 'O');
    expect(result[0]['Freiposition']).toBe('N');
  });

  it('sets Fremdbelegnummer to outer order number', () => {
    const rows = [makeRow()];
    const result = prepareCsvDataToExport(rows, 'I', 'OUTER789');
    expect(result[0]['Fremdbelegnummer']).toBe('OUTER789');
  });
});
