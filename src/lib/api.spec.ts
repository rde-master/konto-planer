import { describe, expect, it } from 'vitest';
import { haSensors, haYaml, sensorSlug, statusJson } from './api';

const input = {
	generatedAt: new Date('2026-11-26T10:00:00Z'),
	accounts: [
		{
			id: 'a1',
			name: 'Gemeinschaftskonto Süd',
			type: 'giro' as const,
			balance: 123_456,
			asOf: '2026-11-20',
			available: 50_000,
			minimum: 73_456,
			cutoff: '2026-11-30',
			nextPayment: { name: 'Miete', amount: -85_000, date: '2026-12-01' }
		},
		{
			id: 'a2',
			name: 'Sparbuch',
			type: 'sparbuch' as const,
			balance: 500_000,
			asOf: null,
			available: null,
			minimum: null,
			cutoff: null,
			nextPayment: null
		}
	],
	budgets: [
		{
			category: 'Lebensmittel',
			account: 'Gemeinschaftskonto Süd',
			limit: 40_000,
			spent: 32_000,
			state: 'warn'
		}
	],
	warnings: [
		{
			type: 'overdraft_risk',
			account: 'Gemeinschaftskonto Süd',
			text: 'Dispo könnte reichen nicht'
		}
	]
};

describe('sensorSlug', () => {
	it('makes Home Assistant friendly ids', () => {
		expect(sensorSlug('Gemeinschaftskonto Süd')).toBe('gemeinschaftskonto_sued');
		expect(sensorSlug('Spaß & Co.')).toBe('spass_co');
		expect(sensorSlug('€€')).toBe('konto');
	});
});

describe('statusJson', () => {
	const s = statusJson(input);
	it('gives euros and cents, totals and the next payment', () => {
		expect(s.totals).toEqual({ balance: 6234.56, available: 500 });
		expect(s.nextPayment).toEqual({
			name: 'Miete',
			date: '2026-12-01',
			amount: -850,
			amountCents: -85_000,
			account: 'Gemeinschaftskonto Süd'
		});
		expect(s.accounts[0]).toMatchObject({
			sensor: 'gemeinschaftskonto_sued',
			balance: 1234.56,
			minimum: 734.56
		});
		expect(s.budgets[0]).toEqual({
			category: 'Lebensmittel',
			account: 'Gemeinschaftskonto Süd',
			limit: 400,
			spent: 320,
			state: 'warn'
		});
	});
	it('becomes Home Assistant sensors', () => {
		const sensors = haSensors(s);
		expect(sensors.map((x) => x.entity)).toEqual([
			'sensor.konto_planer_verfuegbar',
			'sensor.konto_planer_naechste_zahlung',
			'sensor.konto_planer_warnungen',
			'sensor.konto_planer_gemeinschaftskonto_sued_stand',
			'sensor.konto_planer_gemeinschaftskonto_sued_verfuegbar',
			'sensor.konto_planer_sparbuch_stand'
		]);
		expect(sensors[0].state).toBe('500');
		expect(sensors[2].state).toBe('1');
	});
});

describe('haYaml', () => {
	it('is a REST sensor with the token', () => {
		const y = haYaml('https://konto.example.org/api/v1/status', 'abc', [{ name: 'Giro "A"' }]);
		expect(y).toContain('  - resource: https://konto.example.org/api/v1/status');
		expect(y).toContain('Authorization: "Bearer abc"');
		expect(y).toContain(`- name: "Giro 'A' Stand"`);
		expect(y).toContain('value_json.accounts[0].balance');
	});
});
