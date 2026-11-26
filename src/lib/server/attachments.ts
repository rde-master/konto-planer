import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { recurringAttachments, users, type RecurringAttachment } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import type { Viewer } from './account-rules.js';
import { RecurringError, getRecurringFor, requireEditable } from './recurring.js';
import { attachmentError, cleanFileName } from './attachment-rules.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Attachments live in the data volume next to the backups. */
export function attachmentDir() {
	return path.resolve(
		process.env.ATTACHMENT_DIR || path.join(process.cwd(), 'data', 'attachments')
	);
}

function filePath(id: string) {
	if (!UUID.test(id)) throw new Error('invalid attachment id');
	return path.join(attachmentDir(), `${id}.pdf`);
}

export type AttachmentInfo = RecurringAttachment & { uploadedByName: string | null };

export async function listAttachments(recurringId: string): Promise<AttachmentInfo[]> {
	const rows = await db
		.select({ attachment: recurringAttachments, uploadedByName: users.name })
		.from(recurringAttachments)
		.leftJoin(users, eq(users.id, recurringAttachments.uploadedBy))
		.where(eq(recurringAttachments.recurringId, recurringId))
		.orderBy(asc(recurringAttachments.createdAt));
	return rows.map((r) => ({ ...r.attachment, uploadedByName: r.uploadedByName }));
}

/** Stores a PDF for an item the actor may edit. */
export async function addAttachment(
	actor: NonNullable<Actor> & Viewer,
	recurringId: string,
	file: File
) {
	return storeAttachment(actor, recurringId, new Uint8Array(await file.arrayBuffer()), file.name);
}

/** Stores a PDF (uploaded or created by the app) at a recurring item; returns its id. */
export async function storeAttachment(
	actor: NonNullable<Actor> & Viewer,
	recurringId: string,
	bytes: Uint8Array,
	name: string
): Promise<string> {
	const item = await requireEditable(actor, recurringId);
	const problem = attachmentError(bytes.byteLength, bytes);
	if (problem) throw new RecurringError(problem);

	const id = randomUUID();
	const fileName = cleanFileName(name);
	const target = filePath(id);
	await mkdir(attachmentDir(), { recursive: true });
	// Write to a temporary name first so a crash never leaves a half-written PDF.
	const tmp = `${target}.${randomUUID()}.tmp`;
	const handle = await open(tmp, 'wx', 0o600);
	try {
		await handle.writeFile(bytes);
		await handle.sync();
	} finally {
		await handle.close();
	}
	await rename(tmp, target);
	try {
		await db.transaction(async (tx) => {
			await tx.insert(recurringAttachments).values({
				id,
				recurringId,
				fileName,
				size: bytes.byteLength,
				uploadedBy: actor.id
			});
			await audit(tx, {
				actor,
				entityType: 'recurring',
				action: 'attachment_add',
				entityId: recurringId,
				entityLabel: item.name,
				after: { fileName, size: bytes.byteLength }
			});
		});
	} catch (e) {
		await rm(target, { force: true });
		throw e;
	}
	return id;
}

export async function deleteAttachment(
	actor: NonNullable<Actor> & Viewer,
	recurringId: string,
	attachmentId: string
) {
	const item = await requireEditable(actor, recurringId);
	if (!UUID.test(attachmentId)) throw new RecurringError('Anhang nicht gefunden.');
	await db.transaction(async (tx) => {
		const [removed] = await tx
			.delete(recurringAttachments)
			.where(
				and(
					eq(recurringAttachments.id, attachmentId),
					eq(recurringAttachments.recurringId, recurringId)
				)
			)
			.returning();
		if (!removed) throw new RecurringError('Anhang nicht gefunden.');
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: 'attachment_delete',
			entityId: recurringId,
			entityLabel: item.name,
			before: { fileName: removed.fileName, size: removed.size }
		});
	});
	await rm(filePath(attachmentId), { force: true });
}

/** The file for download, if the viewer may see the item; otherwise null (404). */
export async function openAttachment(viewer: Viewer, recurringId: string, attachmentId: string) {
	if (!UUID.test(attachmentId)) return null;
	const item = await getRecurringFor(viewer, recurringId);
	if (!item) return null;
	const [row] = await db
		.select()
		.from(recurringAttachments)
		.where(
			and(
				eq(recurringAttachments.id, attachmentId),
				eq(recurringAttachments.recurringId, recurringId)
			)
		);
	if (!row) return null;
	const file = filePath(row.id);
	try {
		const { size } = await stat(file);
		const body = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
		return { fileName: row.fileName, size, body };
	} catch {
		return null;
	}
}
