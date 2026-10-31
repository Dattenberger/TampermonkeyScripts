import { describe, expect, it } from 'vitest'
import { scanText } from '../rules.js'

const rules = (text: string) => scanText('f.ts', text).map((finding) => `${finding.rule}: ${finding.match}`)

describe('public data guard', () => {
    it('finds internal hosts, tailnet names and addresses', () => {
        expect(rules('fetch("https://box.example.ts.net:8443/x")')).toEqual(['tailnet host: .ts.net'])
        expect(rules('const host = "printer.local"')).toEqual(['internal domain: printer.local'])
        expect(rules('ssh vm-test1 && ssh SRV-Files2')).toEqual(['internal host: vm-test1', 'internal host: SRV-Files2'])
        expect(rules('peer 100.64.0.1 and 100.127.255.1')).toEqual([
            'tailnet address: 100.64.0.1',
            'tailnet address: 100.127.255.1',
        ])
        expect(rules('http://[fd7a:115c:a1e0::1]/x')).toEqual(['tailnet address: fd7a:115c:a1e0::1'])
        expect(rules('10.0.0.1 172.16.0.1 172.31.9.9 192.168.1.10')).toEqual([
            'private address: 10.0.0.1',
            'private address: 172.16.0.1',
            'private address: 172.31.9.9',
            'private address: 192.168.1.10',
        ])
    })

    it('allows only the published role mailboxes of the company domains', () => {
        expect(rules('mailto:shop@robotico.de, Service@Dattenberger.com')).toEqual([])
        expect(rules('cc: someone@robotico.de; other.person@dattenberger.com')).toEqual([
            'company mail address: someone@robotico.de',
            'company mail address: other.person@dattenberger.com',
        ])
    })

    it('leaves ordinary code alone', () => {
        expect(rules('globalThis.localStorage.getItem(key); config.local(); const ip = "100.10.0.1"; vm-ready')).toEqual([])
        expect(rules('172.32.0.1 192.169.0.1 version 10.1.2.3.4')).toEqual([])
    })

    it('reports the line of each finding', () => {
        expect(scanText('a.html', 'ok\nok\n<p>vm-test1</p>')).toEqual([
            { file: 'a.html', line: 3, rule: 'internal host', match: 'vm-test1' },
        ])
    })
})
