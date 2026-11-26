import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { getRecurringFor, markCancelled, RecurringError } from '#lib/server/recurring.js';
import { storeAttachment } from '#lib/server/attachments.js';
import { renderLetter } from '#lib/server/cancellation-pdf.js';
import { audit } from '#lib/server/audit.js';
import { formString } from '#lib/server/validation.js';
import { cancellationLetter, LETTER_OPTIONS, type PostalAddress } from '#lib/cancellation.js';
import { terminationEnd } from '#lib/contracts.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

async function editableContract(user: App.Locals['user'], id: string) {
	const item = await getRecurringFor(user!, id);
	if (!item || !item.contract || !item.canEdit) error(404, 'Dauerposten nicht gefunden.');
	return { item, contract: item.contract };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { item, contract } = await editableContract(locals.user, params.id);
	const today = todayBerlin();
	const [me] = await db
		.select({ address: users.postalAddress })
		.from(users)
		.where(eq(users.id, locals.user!.id));
	const created = url.searchParams.get('anhang');
	return {
		today,
		item: { id: item.id, name: item.name, counterparty: item.counterparty },
		cancelled: contract.cancelledOn,
		end: contract.cancelledOn ? null : terminationEnd({ ...contract, cancelledOn: null }, today),
		sender: me?.address ?? {
			name: locals.user!.name,
			street: '',
			postalCode: '',
			city: ''
		},
		recipient: {
			name: contract.cancelName ?? item.counterparty ?? item.name,
			street: contract.cancelStreet ?? '',
			postalCode: contract.cancelPostalCode ?? '',
			city: contract.cancelCity ?? ''
		},
		email: contract.cancelEmail,
		created: created && /^[0-9a-f-]{36}$/i.test(created) ? created : null
	};
};

function readAddress(data: FormData, prefix: string): PostalAddress {
	return {
		name: formString(data, `${prefix}Name`).trim().slice(0, 100),
		street: formString(data, `${prefix}Street`).trim().slice(0, 100),
		postalCode: formString(data, `${prefix}PostalCode`).trim().slice(0, 10),
		city: formString(data, `${prefix}City`).trim().slice(0, 60)
	};
}

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const { item, contract } = await editableContract(locals.user, params.id);
		const data = await request.formData();
		const sender = readAddress(data, 'sender');
		const recipient = readAddress(data, 'recipient');
		const errors: Partial<Record<string, string>> = {};
		if (!sender.name) errors.senderName = 'Bitte deinen Namen eingeben.';
		if (!sender.street || !sender.postalCode || !sender.city)
			errors.senderCity = 'Bitte Straße, PLZ und Ort eingeben.';
		if (!recipient.name) errors.recipientName = 'Bitte den Empfänger eingeben.';
		if (!recipient.street || !recipient.postalCode || !recipient.city)
			errors.recipientCity = 'Bitte die Anschrift des Anbieters eingeben.';
		if (Object.keys(errors).length)
			return fail(400, { errors, input: Object.fromEntries(data) as Record<string, string> });

		const today = todayBerlin();
		const options = new Set(LETTER_OPTIONS.filter((o) => formString(data, o) === 'on'));
		const letter = cancellationLetter({
			sender,
			recipient,
			place: formString(data, 'place'),
			today,
			contractName: item.name,
			customerNumber: item.customerNumber,
			mandateReference: item.mandateReference,
			iban: null,
			end: contract.cancelledOn ? null : terminationEnd({ ...contract, cancelledOn: null }, today),
			options
		});
		const actor = locals.user!;
		if (formString(data, 'remember') === 'on')
			await db.transaction(async (tx) => {
				await tx
					.update(users)
					.set({ postalAddress: sender, updatedAt: new Date() })
					.where(eq(users.id, actor.id));
				await audit(tx, {
					actor,
					entityType: 'user',
					action: 'update',
					entityId: actor.id,
					entityLabel: 'Anschrift',
					after: { postalAddress: `${sender.street}, ${sender.postalCode} ${sender.city}` }
				});
			});
		let id: string;
		try {
			id = await storeAttachment(actor, item.id, await renderLetter(letter), letter.fileName);
		} catch (e) {
			if (e instanceof RecurringError) return fail(400, { message: e.message });
			throw e;
		}
		redirect(303, `/dauerposten/${item.id}/kuendigung?anhang=${id}`);
	},

	cancelled: async ({ locals, params }) => {
		await editableContract(locals.user, params.id);
		try {
			await markCancelled(locals.user!, params.id, todayBerlin());
		} catch (e) {
			if (e instanceof RecurringError) return fail(400, { message: e.message });
			throw e;
		}
		redirect(303, `/dauerposten/${params.id}`);
	}
};
