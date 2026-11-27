// The round plus button above the tab bar (phones). It opens the quick entry – unless the page
// takes it over: the booking list opens its own, complete form with it, so there is one plus
// on the screen, not two.
type Takeover = { label: string; run: () => void };

// Raw: the takeover is compared by identity when it is given back (a proxy would not match).
let current = $state.raw<Takeover | null>(null);

/** What the page wants the plus button to do (null: the quick entry). */
export function fabTakeover(): Takeover | null {
	return current;
}

/**
 * Takes the plus button over for the page; call the returned function to give it back (as the
 * cleanup of an `$effect`, so it never runs on the server).
 */
export function takeFab(label: string, run: () => void): () => void {
	const mine = { label, run };
	current = mine;
	return () => {
		if (current === mine) current = null;
	};
}
