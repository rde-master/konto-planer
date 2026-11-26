// Demo mode: invented household data for screenshots and trying the app.
import { addDays } from './recurring.js';

/** Small deterministic random generator (same data on every reset of the same day). */
export function seededRandom(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export type DemoSpend = {
	payee: string;
	category: string;
	/** Chance per day. */
	chance: number;
	/** Amount range in cents. */
	min: number;
	max: number;
	/** On the credit card instead of the giro account. */
	card?: boolean;
};

export const DEMO_SPENDING: DemoSpend[] = [
	{ payee: 'Frischemarkt Beispiel', category: 'Supermarkt', chance: 0.35, min: 1800, max: 9500 },
	{ payee: 'Bäckerei Musterkorn', category: 'Bäckerei', chance: 0.3, min: 250, max: 1400 },
	{ payee: 'Tankstelle am Ring', category: 'Kraftstoff', chance: 0.07, min: 4500, max: 8500 },
	{
		payee: 'Trattoria Esempio',
		category: 'Restaurant',
		chance: 0.05,
		min: 2400,
		max: 7800,
		card: true
	},
	{ payee: 'Drogerie Fiktiv', category: 'Drogerie', chance: 0.08, min: 600, max: 3200 },
	{ payee: 'Apotheke am Platz', category: 'Apotheke', chance: 0.03, min: 450, max: 2600 },
	{
		payee: 'Onlineshop Muster',
		category: 'Einrichtung',
		chance: 0.03,
		min: 1500,
		max: 12000,
		card: true
	},
	{ payee: 'Getränkemarkt Quelle', category: 'Getränke', chance: 0.06, min: 900, max: 3400 }
];

export type DemoBooking = {
	date: string;
	payee: string;
	category: string;
	/** Negative cents. */
	amount: number;
	card: boolean;
};

/** Everyday spending from `from` up to and including `today`. */
export function demoBookings(from: string, today: string, seed: number): DemoBooking[] {
	const rand = seededRandom(seed);
	const out: DemoBooking[] = [];
	for (let d = from; d <= today; d = addDays(d, 1))
		for (const s of DEMO_SPENDING)
			if (rand() < s.chance) {
				const cents = Math.round((s.min + rand() * (s.max - s.min)) / 10) * 10;
				out.push({ date: d, payee: s.payee, category: s.category, amount: -cents, card: !!s.card });
			}
	return out;
}
