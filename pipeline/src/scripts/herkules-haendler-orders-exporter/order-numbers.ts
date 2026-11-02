// Our D-BE number per portal order, typed by the user and kept in this browser's Tampermonkey storage:
// the portal has no field for it, and the page cannot read this storage as it could localStorage.
// The script declares the key in scripts.config.ts.

export const ORDER_NUMBERS_KEY = 'herkulesOrderNumbers'

interface StoredOrderNumbers {
    version: 1
    /** Keyed by the portal's order number; a number from a reference is not stored. */
    orders: Record<string, { orderNumber: string; updatedAt: string }>
}

function readAll(): StoredOrderNumbers {
    const stored = GM_getValue<Partial<StoredOrderNumbers> | undefined>(ORDER_NUMBERS_KEY)
    return { version: 1, orders: stored?.orders ?? {} }
}

export function readOrderNumber(portalOrder: string): string {
    return readAll().orders[portalOrder]?.orderNumber ?? ''
}

/** Stores the number; an empty one removes the entry. Reads first, so another tab's entries stay. */
export function writeOrderNumber(portalOrder: string, orderNumber: string): void {
    const all = readAll()
    if (orderNumber) all.orders[portalOrder] = { orderNumber, updatedAt: new Date().toISOString() }
    else delete all.orders[portalOrder]
    GM_setValue(ORDER_NUMBERS_KEY, all)
}
