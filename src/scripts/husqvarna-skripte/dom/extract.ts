export function extractOrderNumber(): string {
  const headingElement = document.querySelector('[data-testid="order-detail-page"] h1');
  if (headingElement) {
    const headingMatch = headingElement.textContent?.match(/(\d{6,})/);
    if (headingMatch) return headingMatch[1];
  }
  const queryMatch = location.search.match(/[?&]order=(\d{6,})/);
  if (queryMatch) return queryMatch[1];
  const detailNumber = Array.from(document.querySelectorAll('p'))
    .map(p => p.textContent?.trim() || '')
    .find(text => /^\d{6,}$/.test(text));
  if (detailNumber) return detailNumber;
  const pathMatch = location.pathname.match(/\/de\/orders\/(\d{6,})/);
  if (pathMatch) return pathMatch[1];
  return '';
}

export function extractSiteName(): string {
  const redirectLink = document.querySelector('a[href*="/b2b/products/redirect/"]');
  if (redirectLink) {
    const urlMatch = redirectLink.getAttribute('href')?.match(/\/b2b\/products\/redirect\/([^/]+)\//);
    if (urlMatch) return urlMatch[1];
  }
  return 'b2b-de-de-de';
}

export function isOrderListPage(): boolean {
  return !!document.querySelector('[data-testid="order-list-page"]') &&
    !!document.querySelector('div[role="table"]');
}

export function extractOrderIdFromHref(href: string | null | undefined): string {
  if (!href) return '';
  const match = href.match(/orderId=(\d+)/);
  return match ? match[1] : '';
}
