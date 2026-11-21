function elementFor(node: EventTarget | Node | null): Element | null {
	if (!node || !("nodeType" in node)) return null;
	return node.nodeType === 1 ? node as Element : (node as Node).parentElement;
}

/** Read only the current selection in the pane that was actually right-clicked. */
export function selectedTextAt(doc: Document, target: EventTarget | null, embedded = false): string {
	const element = elementFor(target);
	if (!element) return "";
	const pane = element.closest(".workspace-leaf-content") ?? (embedded ? doc.body : null);
	if (!pane || element.closest(".wordnet-dictionary-view")) return "";
	if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
		const input = element as HTMLInputElement | HTMLTextAreaElement;
		if (input.tagName === "INPUT" && (input as HTMLInputElement).type === "password") return "";
		if (input.selectionStart === null || input.selectionEnd === null) return "";
		return input.value.slice(input.selectionStart, input.selectionEnd);
	}
	const selection = doc.getSelection();
	if (!selection || selection.isCollapsed || !selection.rangeCount ||
		!selection.anchorNode || !selection.focusNode ||
		!pane.contains(selection.anchorNode) || !pane.contains(selection.focusNode)) return "";
	try {
		if (!selection.getRangeAt(0).intersectsNode(element)) return "";
		return selection.toString();
	} catch { return ""; }
}
