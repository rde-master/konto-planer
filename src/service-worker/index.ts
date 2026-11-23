// Caches only the app shell (build output and static files) so the installed PWA starts fast.
// Financial data and pages are never cached: they always come from the server.
import { self } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `kp-shell-${version}`;
const SHELL = [...immutable.map((f) => f.path), ...assets.map((f) => f.path)];
// Manifest paths are relative to the base path; compare by absolute pathname.
const SHELL_SET = new Set<string>(SHELL.map((p) => new URL(p, self.registration.scope).pathname));

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin || !SHELL_SET.has(url.pathname)) return;

	event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});
