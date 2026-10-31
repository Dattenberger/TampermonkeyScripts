// The public data guard: this repository is public, so no internal host, network address or
// personal company mail address may reach a source file, a fixture or a built bundle. Only the
// role mailboxes the company publishes itself are allowed. The rules are generic on purpose: a
// list of the real internal names would publish them. A bare number (a purchase condition) is
// invisible to the guard; reviews check for those.

export interface Finding {
    file: string
    line: number
    rule: string
    match: string
}

interface Rule {
    name: string
    pattern: RegExp
}

/** Role mailboxes printed on the company's own websites and mails. */
export const PUBLIC_MAILBOXES: ReadonlySet<string> = new Set(['shop@robotico.de', 'service@dattenberger.com'])

const RULES: readonly Rule[] = [
    { name: 'tailnet host', pattern: /\.ts\.net\b|\btailnet\b/gi },
    { name: 'internal domain', pattern: /\b[\w-]+\.local\b(?![\w(])/gi },
    { name: 'internal host', pattern: /\b(?:vm|srv)-[a-z]+\d+\b/gi },
    { name: 'tailnet address', pattern: /\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b|\bfd7a:115c:a1e0:[\da-f:]*/gi },
    {
        name: 'private address',
        pattern: /\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b(?!\.\d)/g,
    },
    { name: 'company mail address', pattern: /[\w.+-]+@(?:dattenberger\.com|robotico\.de)\b/gi },
]

export function scanText(file: string, text: string): Finding[] {
    const findings: Finding[] = []
    for (const [index, line] of text.split('\n').entries()) {
        for (const rule of RULES) {
            for (const [match] of line.matchAll(rule.pattern)) {
                if (rule.name === 'company mail address' && PUBLIC_MAILBOXES.has(match.toLowerCase())) continue
                findings.push({ file, line: index + 1, rule: rule.name, match })
            }
        }
    }
    return findings
}
