// Read-only API ("Lesende API") and Home Assistant sensors: JSON shape, sensor ids, YAML snippet.

export const TOKEN_PURPOSES = ['home_assistant', 'widget', 'other'] as const;
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];
export const TOKEN_PURPOSE_LABELS: Record<TokenPurpose, string> = {
	home_assistant: 'Home Assistant',
	widget: 'Widget',
	other: 'Sonstiges'
};

/** Euro value for JSON consumers (two decimals), cents are given as well. */
export const euro = (cents: number) => Math.round(cents) / 100;

/** Home Assistant entity id part: lower case ASCII, umlauts spelled out. */
export function sensorSlug(name: string): string {
	const slug = name
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return slug || 'konto';
}

export type StatusAccount = {
	id: string;
	name: string;
	type: 'giro' | 'sparbuch' | 'kreditkarte';
	balance: number;
	asOf: string | null;
	available: number | null;
	minimum: number | null;
	cutoff: string | null;
	nextPayment: { name: string; amount: number; date: string } | null;
};

export type StatusInput = {
	generatedAt: Date;
	accounts: StatusAccount[];
	budgets: { category: string; account: string; limit: number; spent: number; state: string }[];
	warnings: { type: string; account: string; text: string }[];
};

function payment(p: StatusAccount['nextPayment']) {
	return p ? { name: p.name, date: p.date, amount: euro(p.amount), amountCents: p.amount } : null;
}

/** The `/api/v1/status` document. */
export function statusJson(i: StatusInput) {
	const next = i.accounts
		.map((a) => (a.nextPayment ? { ...a.nextPayment, account: a.name } : null))
		.filter((p) => p !== null)
		.sort((a, b) => a.date.localeCompare(b.date))[0];
	const giro = i.accounts.filter((a) => a.available !== null);
	return {
		generatedAt: i.generatedAt.toISOString(),
		currency: 'EUR',
		totals: {
			balance: euro(i.accounts.reduce((s, a) => s + a.balance, 0)),
			available: euro(giro.reduce((s, a) => s + (a.available ?? 0), 0))
		},
		nextPayment: next ? { ...payment(next), account: next.account } : null,
		accounts: i.accounts.map((a) => ({
			id: a.id,
			name: a.name,
			sensor: sensorSlug(a.name),
			type: a.type,
			balance: euro(a.balance),
			balanceCents: a.balance,
			asOf: a.asOf,
			available: a.available === null ? null : euro(a.available),
			minimum: a.minimum === null ? null : euro(a.minimum),
			cutoff: a.cutoff,
			nextPayment: payment(a.nextPayment)
		})),
		budgets: i.budgets.map((b) => ({
			category: b.category,
			account: b.account,
			limit: euro(b.limit),
			spent: euro(b.spent),
			state: b.state
		})),
		warnings: i.warnings
	};
}

/** Sensor states for pushing to Home Assistant (`/api/states/<entity>`). */
export function haSensors(status: ReturnType<typeof statusJson>) {
	const out: { entity: string; state: string; attributes: Record<string, unknown> }[] = [];
	const money = { unit_of_measurement: '€', device_class: 'monetary', state_class: 'total' };
	out.push({
		entity: 'sensor.konto_planer_verfuegbar',
		state: String(status.totals.available),
		attributes: { ...money, friendly_name: 'Konto Planer verfügbar', icon: 'mdi:cash-check' }
	});
	out.push({
		entity: 'sensor.konto_planer_naechste_zahlung',
		state: status.nextPayment?.date ?? 'unknown',
		attributes: {
			friendly_name: 'Konto Planer nächste Zahlung',
			icon: 'mdi:calendar-clock',
			...(status.nextPayment ?? {})
		}
	});
	out.push({
		entity: 'sensor.konto_planer_warnungen',
		state: String(status.warnings.length),
		attributes: {
			friendly_name: 'Konto Planer Warnungen',
			icon: 'mdi:alert',
			warnings: status.warnings
		}
	});
	for (const a of status.accounts) {
		out.push({
			entity: `sensor.konto_planer_${a.sensor}_stand`,
			state: String(a.balance),
			attributes: { ...money, friendly_name: `${a.name} Stand`, as_of: a.asOf }
		});
		if (a.available !== null)
			out.push({
				entity: `sensor.konto_planer_${a.sensor}_verfuegbar`,
				state: String(a.available),
				attributes: {
					...money,
					friendly_name: `${a.name} verfügbar`,
					minimum: a.minimum,
					cutoff: a.cutoff,
					next_payment: a.nextPayment
				}
			});
	}
	return out;
}

/** YAML for a Home Assistant REST sensor reading the status endpoint. */
export function haYaml(url: string, token: string, accounts: { name: string }[]): string {
	const sensors = [
		'      - name: "Konto Planer verfügbar"',
		'        unique_id: konto_planer_verfuegbar',
		'        value_template: "{{ value_json.totals.available }}"',
		'        unit_of_measurement: "€"',
		'        device_class: monetary',
		'        json_attributes:',
		'          - nextPayment',
		'          - warnings',
		...accounts.flatMap((a, i) => [
			`      - name: "${a.name.replace(/"/g, "'")} Stand"`,
			`        unique_id: konto_planer_${sensorSlug(a.name)}_stand`,
			`        value_template: "{{ value_json.accounts[${i}].balance }}"`,
			'        unit_of_measurement: "€"',
			'        device_class: monetary'
		])
	];
	return [
		'rest:',
		`  - resource: ${url}`,
		'    scan_interval: 900',
		'    headers:',
		`      Authorization: "Bearer ${token}"`,
		'    sensor:',
		...sensors
	].join('\n');
}
