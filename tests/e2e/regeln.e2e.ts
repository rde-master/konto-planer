import { expect, test, type Page } from '@playwright/test';

// Category rules: own giro account with a small invented export.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Regelkonto';
const IBAN = 'DE56123456780009999999';

const CSV = [
	'IBAN Auftragskonto;Buchungstag;Name Zahlungsbeteiligter;Verwendungszweck;Betrag;Waehrung',
	`${IBAN};02.11.2026;Betriebsrestaurant;Kantine Mittagessen;-8,50;EUR`,
	`${IBAN};03.11.2026;Tankstelle Nord;Kartenzahlung;-40,00;EUR`,
	`${IBAN};04.11.2026;Bäckerei Korn;Brötchen;-3,20;EUR`
].join('\n');

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function addRule(
	page: Page,
	field: string,
	operator: string,
	value: string,
	category: string
) {
	await page.getByRole('button', { name: 'Regel anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Regel' });
	await sheet.getByLabel('Wenn').selectOption({ label: field });
	await sheet.getByLabel('Bedingung').selectOption({ label: operator });
	await sheet.getByLabel('Text').fill(value);
	await sheet.getByLabel('Dann Kategorie').selectOption({ label: category });
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

test('rules are created, ordered and validated', async ({ page }) => {
	await login(page);
	await page.goto('/kategorien');
	await page.getByRole('link', { name: 'Regeln für den Import' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Regeln' })).toBeVisible();

	await page.getByRole('button', { name: 'Regel anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Regel' });
	await sheet.getByLabel('Text').fill('Kantine');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Bitte eine Kategorie wählen.')).toBeVisible();
	await sheet.getByLabel('Dann Kategorie').selectOption({ label: 'Supermarkt' });
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Regel angelegt.');

	await addRule(page, 'Empfänger/Zahler', 'beginnt mit', 'tankstelle', 'Mobilität (allgemein)');
	const rules = page.getByRole('region', { name: 'Regeln' });
	await expect(rules.getByRole('button').nth(0)).toContainText(
		'Verwendungszweck enthält „Kantine“'
	);
	await page.getByRole('button', { name: 'Regel 2 nach oben' }).click();
	await expect(rules.getByRole('button').nth(0)).toContainText(
		'Empfänger/Zahler beginnt mit „tankstelle“'
	);
});

test('rules set the category on import and for earlier bookings', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('IBAN (optional)').fill(IBAN);
	await account.getByLabel('Betrag in €').fill('500');
	await account.getByLabel('Stand am').fill('2026-10-31');
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await page.getByRole('link', { name: 'CSV importieren' }).click();
	await page
		.getByLabel('CSV-Datei')
		.setInputFiles({ name: 'regeln.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
	await page.getByRole('button', { name: 'Vorschau zeigen' }).click();
	const list = page.getByRole('list', { name: 'Buchungen der Datei' });
	await expect(list.getByRole('listitem', { name: 'Zeile 2' })).toContainText(
		'Kategorie: Supermarkt'
	);
	await expect(list.getByRole('listitem', { name: 'Zeile 3' })).toContainText(
		'Kategorie: Mobilität'
	);
	await expect(list.getByRole('listitem', { name: 'Zeile 4' })).not.toContainText('Kategorie');
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import übernommen' })).toBeVisible();

	// A new rule for the bakery, applied to the booking already imported.
	await page.goto('/kategorien/regeln');
	await addRule(page, 'Empfänger/Zahler', 'enthält', 'bäckerei', 'Bäckerei');
	await expect(page.getByLabel('Passende Buchungen')).toHaveText(
		'Eine importierte Buchung ohne Kategorie passt zu einer Regel.'
	);
	await page.getByRole('button', { name: 'Auf bisherige Buchungen anwenden' }).click();
	await expect(page.getByRole('status')).toHaveText('Eine Buchung hat eine Kategorie bekommen.');
	await expect(
		page.getByRole('button', { name: 'Auf bisherige Buchungen anwenden' })
	).toBeDisabled();
});

test('the admin deletes a rule; changes are logged', async ({ page }) => {
	await login(page);
	await page.goto('/kategorien/regeln');
	await page.getByRole('button').filter({ hasText: 'bäckerei' }).click();
	await page
		.getByRole('dialog', { name: 'Regel' })
		.getByRole('button', { name: 'Regel löschen' })
		.click();
	await expect(page.getByRole('status')).toHaveText('Regel gelöscht.');
	await expect(page.getByRole('button').filter({ hasText: 'bäckerei' })).toHaveCount(0);

	await page.goto('/einstellungen/protokoll?bereich=rule');
	await expect(
		page.getByRole('button').filter({ hasText: 'Kategorie-Regel angelegt' }).first()
	).toBeVisible();
	await expect(
		page.getByRole('button').filter({ hasText: 'Regeln angewendet' }).first()
	).toBeVisible();
});
