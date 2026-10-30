import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { readState, itemKey, formatPrompt, searchItems } from "./format.js";
import { categoryGroups } from "./categories.js";

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("selecter.css", import.meta.url).href;
document.head.append(stylesheet);

let catalogPromise;
function getCatalog() {
    if (!catalogPromise) {
        catalogPromise = api.fetchApi("/danbooru-selecter/catalog").then(response => {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
        }).catch(error => {
            catalogPromise = null;
            throw error;
        });
    }
    return catalogPromise;
}

function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function createSelecter(node) {
    const widget = node.widgets.find(item => item.name === "state");
    widget.type = "converted-widget";
    widget.computeSize = () => [0, -4];
    widget.draw = () => {};

    const root = element("div", "dss");
    const search = element("input", "dss-search");
    search.type = "search";
    search.placeholder = "全カテゴリから日本語・英語でタグを検索";
    search.setAttribute("aria-label", "タグを検索");
    const filters = element("div", "dss-filters");
    const category = element("select");
    category.setAttribute("aria-label", "カテゴリ");
    const section = element("select");
    section.setAttribute("aria-label", "セクション");
    filters.append(category, section);
    const status = element("div", "dss-status", "タグを読み込み中…");
    status.setAttribute("role", "status");
    const browser = element("div", "dss-browser");
    const list = element("div", "dss-list");
    const more = element("button", "dss-more", "さらに表示");
    browser.append(list, more);

    const selectionHeader = element("div", "dss-selection-header");
    const count = element("strong", "", "選択中 0");
    const clear = element("button", "dss-clear", "全解除");
    selectionHeader.append(count, clear);
    const chosen = element("div", "dss-chosen");
    chosen.setAttribute("aria-label", "選択中のタグ");
    const settings = element("div", "dss-settings");
    const separatorLabel = element("label", "", "区切り ");
    const separator = element("select");
    for (const [value, label] of [["comma", "カンマ"], ["pipe", "パイプ {a|b}"], ["semicolon", "セミコロン"]]) {
        const option = element("option", "", label);
        option.value = value;
        separator.append(option);
    }
    separatorLabel.append(separator);
    const underscoresLabel = element("label");
    const underscores = element("input");
    underscores.type = "checkbox";
    underscoresLabel.append(underscores, document.createTextNode("_ → スペース"));
    settings.append(separatorLabel, underscoresLabel);
    const preview = element("textarea", "dss-preview");
    preview.readOnly = true;
    preview.rows = 3;
    preview.setAttribute("aria-label", "出力プロンプト");
    const footer = element("div", "dss-footer");
    const hint = element("span", "", "STRING");
    const copy = element("button", "", "コピー");
    footer.append(hint, copy);
    root.append(search, filters, status, browser, selectionHeader, chosen, settings, preview, footer);

    const events = new AbortController();
    const listen = (target, type, callback) => target.addEventListener(type, callback, { signal: events.signal });
    let categories = [], allItems = [], results = [], limit = 200, removed = false;
    let state = null;
    let resultMode = "category";
    let searchTimer, noticeTimer;
    let errorMessage = "";

    function notice(message) {
        clearTimeout(noticeTimer);
        hint.textContent = message;
        noticeTimer = setTimeout(() => { hint.textContent = "STRING"; }, 2200);
    }

    function syncSelection() {
        let error = "";
        try {
            state = readState(widget.value);
            preview.value = formatPrompt(state);
        } catch (cause) {
            state = null;
            preview.value = "";
            error = cause.message;
        }
        clear.disabled = !state?.selected.length;
        copy.disabled = !state;
        separator.disabled = underscores.disabled = !state;
        if (!state) {
            count.textContent = "保存データを確認してください";
            chosen.replaceChildren(element("span", "dss-empty", error));
            return;
        }
        const selectedKeys = new Set(state.selected.map(itemKey));
        for (const input of list.querySelectorAll("input[type=checkbox]")) {
            input.checked = selectedKeys.has(input.dataset.key);
        }
        separator.value = state.separator;
        underscores.checked = state.remove_underscores;
        count.textContent = "選択中 " + state.selected.length;
        chosen.replaceChildren();
        for (const item of state.selected) {
            const chip = element("button", "dss-chip", item.label || item.tag);
            chip.title = item.tag;
            chip.setAttribute("aria-label", (item.label || item.tag) + " を解除");
            chip.append(element("span", "", " ×"));
            chip.dataset.key = itemKey(item);
            chosen.append(chip);
        }
    }

    function commit(next) {
        const value = JSON.stringify(next);
        if (value === widget.value) return;
        const graph = node.graph;
        graph?.beforeChange();
        try {
            widget.value = value;
            widget.callback?.(value);
            graph?.change();
            node.setDirtyCanvas(true, true);
            syncSelection();
        } finally {
            graph?.afterChange();
        }
    }

    function appendTagLink(row, item) {
        if (typeof item.link !== "string" || !/^https?:\/\/danbooru\.donmai\.us\//i.test(item.link)) return;
        const link = element("a", "dss-tag-link", "↗");
        link.href = item.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = "Danbooruで開く（新しいタブ）";
        link.setAttribute("aria-label", item.label + " のDanbooruページ（新しいタブ）");
        row.append(link);
    }

    function renderItems() {
        list.replaceChildren();
        const selectedKeys = new Set(state?.selected.map(itemKey) ?? []);
        for (const item of results.slice(0, limit)) {
            if (item.target) {
                const button = element("button", "dss-group", item.label + " →");
                const exists = categories.some(value => value.id === item.target);
                button.disabled = !exists;
                button.title = exists ? "カテゴリを開く" : "このカテゴリのデータがありません";
                button.dataset.target = item.target;
                const row = element("div", "dss-tag");
                row.append(button);
                appendTagLink(row, item);
                list.append(row);
                continue;
            }
            const row = element("div", "dss-tag");
            const toggle = element("label", "dss-tag-toggle");
            toggle.title = item.tag + "\n" + item.category + " / " + item.section;
            const input = element("input");
            input.type = "checkbox";
            input.dataset.key = itemKey(item);
            input.checked = selectedKeys.has(itemKey(item));
            const text = element("span", "dss-tag-text");
            text.append(element("span", "dss-tag-name", item.label));
            toggle.append(input, text);
            row.append(toggle);
            appendTagLink(row, item);
            list.append(row);
        }
        if (!results.length) list.append(element("p", "dss-empty", errorMessage || "該当するタグがありません"));
        more.hidden = results.length <= limit;
        more.textContent = "さらに表示（残り " + Math.max(0, results.length - limit) + "）";
        status.textContent = errorMessage || results.length + " 件" + (results.length > limit ? " · " + limit + " 件表示" : "");
    }

    function updateResults() {
        limit = 200;
        let items = allItems;
        if (resultMode === "category") {
            if (category.value) items = items.filter(item => item.categoryId === category.value);
            if (section.value) items = items.filter(item => item.section === section.value);
        }
        const seen = new Set();
        results = searchItems(items, resultMode === "search" ? search.value : "").filter(item => {
            const key = item.target || itemKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        renderItems();
        browser.scrollTop = 0;
    }

    function updateSections() {
        section.replaceChildren(element("option", "", "すべてのセクション"));
        section.firstChild.value = "";
        section.value = "";
        const current = categories.find(item => item.id === category.value);
        for (const name of new Set(current?.sections.map(item => item.name) ?? [])) {
            const option = element("option", "", name);
            option.value = name;
            section.append(option);
        }
        section.disabled = !current;
    }

    listen(chosen, "click", event => {
        const chip = event.target.closest(".dss-chip");
        if (chip && state) commit({ ...state, selected: state.selected.filter(item => itemKey(item) !== chip.dataset.key) });
    });
    listen(list, "click", event => {
        const button = event.target.closest(".dss-group");
        if (!button || button.disabled) return;
        category.value = button.dataset.target;
        updateSections();
        showCategoryResults();
    });
    listen(list, "change", event => {
        const input = event.target;
        if (input.type !== "checkbox" || !state) return;
        const item = results.find(value => itemKey(value) === input.dataset.key);
        const remaining = state.selected.filter(value => itemKey(value) !== input.dataset.key);
        const selected = input.checked
            ? [...remaining, { tag: item.tag, label: item.label, literal: item.literal }]
            : remaining;
        commit({ ...state, selected });
    });
    function showCategoryResults() {
        clearTimeout(searchTimer);
        resultMode = "category";
        updateResults();
    }
    listen(search, "focus", () => {
        if (!search.value.trim()) return;
        clearTimeout(searchTimer);
        resultMode = "search";
        updateResults();
    });
    listen(search, "input", () => {
        clearTimeout(searchTimer);
        resultMode = "search";
        searchTimer = setTimeout(updateResults, 120);
    });
    listen(search, "keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            clearTimeout(searchTimer);
            resultMode = "search";
            updateResults();
        }
    });
    listen(category, "change", () => { updateSections(); showCategoryResults(); });
    listen(section, "change", showCategoryResults);
    listen(more, "click", () => { limit += 200; renderItems(); });
    listen(clear, "click", () => {
        if (state?.selected.length) commit({ ...state, selected: [] });
    });
    listen(separator, "change", () => {
        if (state) commit({ ...state, separator: separator.value });
    });
    listen(underscores, "change", () => {
        if (state) commit({ ...state, remove_underscores: underscores.checked });
    });
    listen(copy, "click", async () => {
        try {
            await navigator.clipboard.writeText(preview.value);
            if (!removed) notice("コピーしました");
        } catch {
            if (!removed) notice("出力欄からコピーしてください");
        }
    });
    for (const type of ["pointerdown", "wheel", "keydown"]) listen(root, type, event => event.stopPropagation());

    const display = node.addDOMWidget("danbooru_selecter", "danbooru_selecter", root, {
        serialize: false, hideOnZoom: false, getMinHeight: () => 480,
    });
    display.serialize = false;
    node.size = [480, 670];
    const configure = node.onConfigure;
    node.onConfigure = function (...args) {
        const result = configure?.apply(this, args);
        syncSelection();
        return result;
    };
    const onRemoved = node.onRemoved;
    node.onRemoved = function (...args) {
        removed = true;
        clearTimeout(searchTimer);
        clearTimeout(noticeTimer);
        events.abort();
        return onRemoved?.apply(this, args);
    };
    syncSelection();
    getCatalog().then(data => {
        if (removed) return;
        categories = data;
        category.append(element("option", "", "すべてのカテゴリ"));
        category.firstChild.value = "";
        for (const entry of categoryGroups(categories)) {
            const group = element("optgroup");
            group.label = entry.label;
            for (const value of entry.options) {
                const option = element("option", "", value.label);
                option.value = value.id;
                group.append(option);
            }
            category.append(group);
        }
        allItems = categories.flatMap(value => value.sections.flatMap(section =>
            section.items.map(item => ({ ...item, categoryId: value.id, category: value.name, section: section.name })),
        ));
        updateSections();
        updateResults();
        syncSelection();
    }).catch(error => {
        if (removed) return;
        errorMessage = "一覧を読み込めません。ComfyUIを再起動してください: " + error.message;
        status.textContent = errorMessage;
    });
}

app.registerExtension({
    name: "PALEALLOY.DanbooruSelecter",
    nodeCreated(node) {
        if (node.comfyClass === "PalealloyDanbooruSelecter") createSelecter(node);
    },
});
