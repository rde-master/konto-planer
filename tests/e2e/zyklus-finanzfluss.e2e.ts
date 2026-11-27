import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// "Finanzfluss": the salary arrives on the main account and is passed on by transfers; the
// page shows the flow and whether what arrives on an account covers what leaves it.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const MAIN = 'Flusshaupt';
const DAILY = 'Flussalltag';
const today = todayBerlin();
// From tomorrow on: twelve due dates in the plan, nothing booked yet.
const start = addDays(today, 1);

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function createAccount(page: Page, name: string, balance: string) {
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(name);
	await sheet.getByLabel('Betrag in €').fill(balance);
	await sheet.getByLabel('Stand am').fill(today);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

async function createItem(
	page: Page,
	o: { kind: 'Ausgabe' | 'Einnahme' | 'Umbuchung'; name: string; amount: string; account: string }
) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByText(o.kind, { exact: true }).click();
	await sheet.getByLabel('Bezeichnung').fill(o.name);
	await sheet.getByLabel('Betrag in €').fill(o.amount);
	if (o.kind === 'Umbuchung') {
		await sheet.getByLabel('Von Konto').selectOption({ label: o.account });
		await sheet.getByLabel('Auf Konto').selectOption({ label: DAILY });
	} else await sheet.getByLabel('Konto').selectOption({ label: o.account });
	if (o.kind === 'Einnahme') await sheet.getByRole('switch', { name: /Gehalt/ }).check();
	await sheet.getByLabel('Erste Fälligkeit').fill(start);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

async function open(page: Page) {
	await page.goto('/finanzfluss');
	await page.getByLabel('Hauptkonto').selectOption({ label: MAIN });
	await expect(page).toHaveURL(/konto=/);
}

test('the plan shows the flow and that the transfer is too small', async ({ page }) => {
	await login(page);
	await createAccount(page, MAIN, '2.000');
	await createAccount(page, DAILY, '100');
	await createItem(page, { kind: 'Einnahme', name: 'Flusslohn', amount: '2.000', account: MAIN });
	await createItem(page, { kind: 'Umbuchung', name: 'Flussgeld', amount: '300', account: MAIN });
	await createItem(page, { kind: 'Ausgabe', name: 'Flussmiete', amount: '350', account: DAILY });

	await page.goto('/mehr');
	await page.getByRole('link', { name: 'Finanzfluss' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Finanzfluss' })).toBeVisible();
	await open(page);

	const chart = page.getByRole('region', { name: 'Geldfluss' });
	await expect(chart.getByRole('img', { name: 'Geldfluss je Monat, geplant' })).toBeVisible();
	await chart.getByText('Alle Flüsse als Liste').click();
	const flows = chart.getByRole('list', { name: 'Flüsse' });
	const flow = (text: string) => flows.getByRole('listitem').filter({ hasText: text });
	await expect(flow(`Gehalt → ${MAIN}`)).toContainText(/2\.000,00\s€/);
	await expect(flow(`${MAIN} → ${DAILY}`)).toContainText(/300,00\s€/);
	await expect(flow(`${DAILY} → Ausgaben`)).toContainText(/350,00\s€/);
	// 50 € a month more leave the everyday account than arrive.
	await expect(flow(`Aus dem Bestand → ${DAILY}`)).toContainText(/50,00\s€/);
	await expect(flow(`${MAIN} → Bleibt übrig`)).toContainText(/1\.700,00\s€/);

	const daily = page.getByRole('article', { name: DAILY });
	await expect(daily).toContainText(/kommt an 300,00\s€ · geht ab 350,00\s€/);
	await expect(daily).toContainText('Reicht nicht');
	await expect(daily).toContainText(/50,00\s€ im Monat zu wenig/);
	const main = page.getByRole('article', { name: MAIN });
	await expect(main).toContainText('Hauptkonto');
	await expect(main).toContainText('Reicht');
	await expect(main).toContainText(/im Schnitt bleiben 1\.700,00\s€ im Monat übrig/);

	// The account's page is one tap away, and back.
	await daily.getByRole('link', { name: new RegExp(DAILY) }).click();
	await expect(page.getByRole('heading', { level: 1, name: DAILY })).toBeVisible();
	await page.locator('main header').getByRole('link').click();
	await expect(page.getByRole('heading', { level: 1, name: 'Finanzfluss' })).toBeVisible();
});

test('with more money moved the amount is enough on average', async ({ page }) => {
	await login(page);
	await createItem(page, {
		kind: 'Umbuchung',
		name: 'Flusszuschuss',
		amount: '100',
		account: MAIN
	});

	await open(page);
	const daily = page.getByRole('article', { name: DAILY });
	await expect(daily).toContainText(/kommt an 400,00\s€ · geht ab 350,00\s€/);
	await expect(daily).not.toContainText('Reicht nicht');
	// Enough on average – but the rent leaves before the transfers of that day arrive.
	await expect(daily).toContainText('Zeitweise knapp');
	await expect(daily).toContainText(/Im Schnitt genug, aber am .* voraussichtlich nur −250,00\s€/);
});

test('the past shows what was really moved', async ({ page }) => {
	await login(page);
	// A transfer by hand today: 80 € from the main account to the everyday account.
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('80');
	await sheet.getByLabel('Konto').selectOption({ label: MAIN });
	await sheet.getByLabel('Umbuchung auf/von').selectOption({ label: DAILY });
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await open(page);
	await page
		.getByRole('navigation', { name: 'Ansicht' })
		.getByRole('link', { name: 'Tatsächlich' })
		.click();
	await expect(page).toHaveURL(/ansicht=ist/);
	const chart = page.getByRole('region', { name: 'Geldfluss' });
	await expect(chart.getByRole('img', { name: /Geldfluss je Monat, tatsächlich/ })).toBeVisible();
	// The accounts are new: the running month counts so far.
	await expect(chart).toContainText('bisher');
	await chart.getByText('Alle Flüsse als Liste').click();
	await expect(
		chart
			.getByRole('list', { name: 'Flüsse' })
			.getByRole('listitem')
			.filter({ hasText: `${MAIN} → ${DAILY}` })
	).toContainText(/80,00\s€/);
	const daily = page.getByRole('article', { name: DAILY });
	await expect(daily).toContainText(/kommt an 80,00\s€ · geht ab 0,00\s€/);

	// The look back can be longer; the choice stays in the address.
	await page
		.getByRole('navigation', { name: 'Rückblick' })
		.getByRole('link', { name: '12 Monate' })
		.click();
	await expect(page).toHaveURL(/monate=12/);
	await expect(page).toHaveURL(/ansicht=ist/);
});
