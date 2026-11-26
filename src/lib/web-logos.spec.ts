import { describe, expect, it } from 'vitest';
import {
	brandDomain,
	guessDomains,
	iconCandidates,
	isPrivateAddress,
	normalizeDomain,
	pageTitle,
	sniffImage,
	titleMatches
} from './web-logos';

describe('brandDomain', () => {
	it('knows common German payees', () => {
		expect(brandDomain('REWE Markt GmbH-ZNL Ost')).toBe('rewe.de');
		expect(brandDomain('ALDI SUED sagt Danke')).toBe('aldi-sued.de');
		expect(brandDomain('Media Markt E-Business GmbH')).toBe('mediamarkt.de');
		expect(brandDomain('H&M Hennes & Mauritz')).toBe('hm.com');
		expect(brandDomain('ARD ZDF Deutschlandradio Beitragsservice')).toBe('rundfunkbeitrag.de');
		expect(brandDomain('Stadtwerke Musterstadt')).toBeNull();
	});
	it('does not turn people into brands', () => {
		expect(brandDomain('Otto Normalverbraucher')).toBeNull();
		expect(brandDomain('Mueller Hans')).toBeNull();
		expect(brandDomain('OTTO GmbH & Co KG')).toBe('otto.de');
		expect(brandDomain('dm-drogerie markt GmbH + Co. KG')).toBe('dm.de');
		expect(brandDomain('ING')).toBe('ing.de');
	});
});

describe('guessDomains', () => {
	it('tries only names that look like one company', () => {
		expect(guessDomains('Tchibo')).toEqual(['tchibo.de', 'tchibo.com']);
		expect(guessDomains('Musterfirma Nord GmbH')).toEqual([
			'musterfirmanord.de',
			'musterfirmanord.com',
			'musterfirma-nord.de',
			'musterfirma-nord.com',
			'musterfirma.de',
			'musterfirma.com'
		]);
		expect(guessDomains('Erika Mustermann')).toEqual([]);
	});
	it('never tries a generic first word alone', () => {
		expect(guessDomains('Stadtwerke Musterstadt GmbH')).toEqual([
			'stadtwerkemusterstadt.de',
			'stadtwerkemusterstadt.com',
			'stadtwerke-musterstadt.de',
			'stadtwerke-musterstadt.com'
		]);
		expect(guessDomains('Apotheke')).toEqual([]);
	});
});

describe('normalizeDomain and addresses', () => {
	it('reduces input to a public host name', () => {
		expect(normalizeDomain(' https://www.REWE.de/angebote?x=1 ')).toBe('rewe.de');
		expect(normalizeDomain('shop.example.org:443')).toBe('shop.example.org');
		expect(normalizeDomain('localhost')).toBeNull();
		expect(normalizeDomain('192.168.1.1')).toBeNull();
		expect(normalizeDomain('fritz.box')).toBe('fritz.box');
		expect(normalizeDomain('nas.local')).toBeNull();
	});
	it('recognises private and loopback addresses', () => {
		for (const ip of [
			'127.0.0.1',
			'10.1.2.3',
			'192.168.178.1',
			'172.20.0.5',
			'169.254.1.1',
			'100.64.0.1',
			'::1',
			'fd00::1',
			'fe80::1',
			'::ffff:192.168.0.1'
		])
			expect(isPrivateAddress(ip), ip).toBe(true);
		for (const ip of ['93.184.216.34', '8.8.8.8', '2a00:1450:4001::200e'])
			expect(isPrivateAddress(ip), ip).toBe(false);
	});
});

describe('iconCandidates', () => {
	it('prefers touch icons and large icons, resolves relative links', () => {
		const html = `<head>
			<link rel="icon" href="/favicon-16.png" sizes="16x16">
			<link rel="apple-touch-icon" href="/touch.png">
			<link rel='icon' type='image/png' sizes='192x192' href='https://cdn.example.org/i-192.png'>
			<link rel="mask-icon" href="/mask.svg">
			<link rel="stylesheet" href="/x.css">
			<link rel="icon" href="http://insecure.example.org/i.png" sizes="512x512">
		</head>`;
		expect(iconCandidates(html, 'https://www.example.org/start')).toEqual([
			'https://cdn.example.org/i-192.png',
			'https://www.example.org/touch.png',
			'https://www.example.org/favicon-16.png',
			'https://www.example.org/apple-touch-icon.png',
			'https://www.example.org/favicon.ico'
		]);
	});
	it('reads the title for the plausibility check', () => {
		const html = '<title>Tchibo – Jede Woche eine neue Welt</title>';
		expect(pageTitle(html)).toContain('Tchibo');
		expect(titleMatches(pageTitle(html), 'Tchibo GmbH')).toBe(true);
		expect(titleMatches('Diese Domain steht zum Verkauf', 'Tchibo GmbH')).toBe(false);
	});
});

describe('sniffImage', () => {
	const bytes = (...n: number[]) => new Uint8Array([...n, ...new Array<number>(16).fill(0)]);
	it('accepts images by their first bytes', () => {
		expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('image/png');
		expect(sniffImage(bytes(0xff, 0xd8, 0xff))).toBe('image/jpeg');
		expect(sniffImage(bytes(0, 0, 1, 0))).toBe('image/x-icon');
		const svg = new TextEncoder().encode(
			'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'
		);
		expect(sniffImage(svg)).toBe('image/svg+xml');
	});
	it('rejects HTML and scripted SVG', () => {
		expect(
			sniffImage(new TextEncoder().encode('<!doctype html><html><body>404</body></html>'))
		).toBeNull();
		expect(
			sniffImage(new TextEncoder().encode('<svg xmlns="x"><script>alert(1)</script></svg>'))
		).toBeNull();
		expect(
			sniffImage(new TextEncoder().encode('<svg onload="x()" xmlns="x"></svg>    '))
		).toBeNull();
	});
});
