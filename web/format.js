export const DEFAULT_STATE = { version: 1, selected: [], separator: "comma", remove_underscores: true };

export function readState(value) {
    const state = JSON.parse(value);
    if (state?.version !== 1 || !Array.isArray(state.selected)) throw new Error("保存データの形式が不正です");
    return state;
}

export function itemKey(item) {
    return JSON.stringify([item.tag, Boolean(item.literal)]);
}

export function formatPrompt(state) {
    const seen = new Set();
    const tags = [];
    for (const item of state.selected) {
        const key = itemKey(item);
        if (seen.has(key) || !item.tag.trim()) continue;
        seen.add(key);
        let text = item.literal ? item.tag : decodeURIComponent(item.tag);
        if (state.remove_underscores) text = text.replaceAll("_", " ");
        if (!item.literal) text = text.replace(/(?<!\\)([()])/g, "\\$1");
        tags.push(text);
    }
    const text = tags.join({ comma: ", ", pipe: "|", semicolon: ";" }[state.separator]);
    return text && state.separator === "pipe" ? `{${text}}` : text;
}

export function searchItems(items, query) {
    const words = query.toLowerCase().replaceAll("_", " ").trim().split(/\s+/);
    return items.filter(item => words.every(word =>
        `${item.label} ${item.tag} ${item.category} ${item.section}`.toLowerCase().replaceAll("_", " ").includes(word),
    ));
}
