import { describe, expect, it } from 'vitest';
import {
	buildIndex,
	initials,
	initialsColor,
	matchLogo,
	resolveLogo,
	words,
	NO_LOGO
} from './logos';

const index = buildIndex([
	{ slug: 'paypal', title: 'PayPal', hex: '002991' },
	{ slug: 'netflix', title: 'Netflix', hex: 'E50914' },
	{ slug: 'deutschetelekom', title: 'Deutsche Telekom', hex: 'E20074' },
	{ slug: 'deutschebahn', title: 'Deutsche Bahn', hex: 'F01414' },
	{ slug: 'deutschepost', title: 'Deutsche Post', hex: 'FFCC00' },
	{ slug: 'dm', title: 'dm', hex: '002878' },
	{ slug: 'o2', title: 'O2', hex: '0050FF' },
	{ slug: 'rewe', title: 'REWE', hex: 'CC071E' },
	{ slug: 'shell', title: 'Shell', hex: 'FFD500' },
	{ slug: 'otto', title: 'Otto', hex: 'D4021D' }
]);

describe('matchLogo', () => {
	it('finds brands at the start of payee names, ignoring legal forms', () => {
		expect(matchLogo(index, 'PayPal (Europe) S.a.r.l. et Cie., S.C.A.')?.slug).toBe('paypal');
		expect(matchLogo(index, 'NETFLIX INTERNATIONAL B.V.')?.slug).toBe('netflix');
		expect(matchLogo(index, 'Deutsche Telekom AG')?.slug).toBe('deutschetelekom');
		expect(matchLogo(index, 'Telekom Deutschland GmbH')?.slug).toBe('deutschetelekom');
		expect(matchLogo(index, 'DB Vertrieb GmbH')?.slug).toBe('deutschebahn');
		expect(matchLogo(index, 'dm-drogerie markt GmbH + Co. KG')?.slug).toBe('dm');
		expect(matchLogo(index, 'REWE Markt GmbH Filiale 4711')?.slug).toBe('rewe');
		expect(matchLogo(index, 'Telefonica Germany GmbH')?.slug).toBe('o2');
	});

	it('does not match words in the middle or unknown payees', () => {
		expect(matchLogo(index, 'Stadtwerke Musterstadt')).toBeNull();
		expect(matchLogo(index, 'Tankstelle Shell')).toBeNull();
		expect(matchLogo(index, 'Deutsche Wohnen')).toBeNull();
		// Brands that are first names only match the brand alone.
		expect(matchLogo(index, 'Otto Müller')).toBeNull();
		expect(matchLogo(index, 'OTTO GmbH & Co KG')?.slug).toBe('otto');
		expect(matchLogo(index, null)).toBeNull();
	});
});

describe('resolveLogo and initials', () => {
	it('an override wins; "-" means no logo', () => {
		expect(resolveLogo(index, 'Netflix', undefined)).toEqual({ slug: 'netflix', hex: 'E50914' });
		expect(resolveLogo(index, 'Netflix', NO_LOGO)).toBeNull();
		expect(resolveLogo(index, 'Kiosk am Eck', 'rewe')?.slug).toBe('rewe');
	});

	it('initials and a stable color', () => {
		expect(initials('Hausverwaltung Beispiel')).toBe('HB');
		expect(initials('Café Übersee GmbH')).toBe('CÜ');
		expect(initials('Frischmarkt')).toBe('FR');
		expect(initialsColor('Frischmarkt', ['a', 'b', 'c'])).toBe(
			initialsColor('Frischmarkt', ['a', 'b', 'c'])
		);
		expect(words('Café Übersee & Co.')).toEqual(['cafe', 'uebersee', 'and', 'co']);
	});
});
