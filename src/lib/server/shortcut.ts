import type { Viewer } from './account-rules.js';
import { bookingFormContext, BookingError, createBooking, getBookingFor } from './bookings.js';
import { quickTemplates } from './templates.js';
import { reportCategories } from './reports.js';
import { budgetHint } from './budgets.js';
import { listAccountsFor } from './accounts.js';
import { balancesOf } from './bookings.js';
import { plansFor } from './minimum.js';
import {
	chosenOption,
	shortcutAmount,
	shortcutOptions,
	shortcutReply,
	type ShortcutOption
} from '../shortcut.js';
import { todayBerlin } from '../dates.js';

export class ShortcutError extends Error {}

/** Choices for "Aus Liste wählen": the viewer's templates (usable accounts) and categories. */
export async function optionsFor(viewer: Viewer): Promise<ShortcutOption[]> {
	const { ctx } = await bookingFormContext(viewer);
	const [templates, cats] = await Promise.all([
		quickTemplates(viewer, ctx.accountIds),
		reportCategories()
	]);
	const names = new Map(cats.map((c) => [c.id, c.name]));
	return shortcutOptions(
		templates,
		cats.map((c) => ({
			id: c.id,
			name: c.name,
			parentName: c.parentId ? (names.get(c.parentId) ?? null) : null
		}))
	);
}

/** Books from the shortcut: today, on the template's account or the token's default account. */
export async function bookFromShortcut(
	viewer: Viewer & { name: string },
	defaultAccountId: string | null,
	body: { amount?: unknown; choice?: unknown; payee?: unknown }
): Promise<string> {
	const options = await optionsFor(viewer);
	const choice = chosenOption(options, body.choice);
	if (!choice) throw new ShortcutError('Unbekannte Auswahl. Bitte den Kurzbefehl neu laden.');
	const template = choice.type === 'template' ? choice.template : null;
	const amount = shortcutAmount(body.amount, template?.kind === 'income');
	if (amount === null) throw new ShortcutError('Bitte einen Betrag größer 0 eingeben.');
	const accountId = template?.accountId ?? defaultAccountId;
	if (!accountId) throw new ShortcutError('Für diesen Zugang ist kein Konto festgelegt.');
	const categoryId = template
		? template.categoryId
		: choice.type === 'category'
			? choice.categoryId
			: null;
	const payee =
		typeof body.payee === 'string' && body.payee.trim()
			? body.payee.trim().slice(0, 100)
			: (template?.counterparty ?? null);
	const today = todayBerlin();
	let bookingId: string;
	try {
		bookingId = await createBooking(viewer, {
			accountId,
			bookingDate: today,
			amount,
			categoryId,
			counterparty: payee,
			purpose: 'per Kurzbefehl'
		});
	} catch (e) {
		if (e instanceof BookingError) throw new ShortcutError(e.message);
		throw e;
	}
	const account = (await listAccountsFor(viewer)).find((a) => a.id === accountId);
	let available: number | null = null;
	if (account?.type === 'giro') {
		const balances = await balancesOf([account]);
		available =
			(await plansFor(viewer, [account], balances)).get(account.id)?.plan.available ?? null;
	}
	return shortcutReply({
		amount,
		// Without a chosen category a rule may have set one: name what was booked.
		label: template
			? template.name
			: ((await getBookingFor(viewer, bookingId))?.category?.name ??
				choice.label.split(' › ').at(-1)!),
		account: account?.name ?? '',
		budget: amount < 0 ? await budgetHint(viewer, categoryId, accountId, today.slice(0, 7)) : null,
		available
	});
}
