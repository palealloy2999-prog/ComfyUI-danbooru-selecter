// Navigation is presentation only; category IDs and persisted tag state stay unchanged.
export function categoryGroups(categories) {
    const groups = [];
    const custom = categories.filter(item => item.source === "custom")
        .sort((a, b) => a.name.localeCompare(b.name, "ja"));
    if (custom.length) groups.push({ label: "カスタム定型文", options: custom.map(item => ({ id: item.id, label: item.name })) });

    const entries = categories.filter(item => item.source === "json").flatMap(item => {
        const navigation = item.navigation?.length ? item.navigation : [{ path: [], order: Infinity }];
        return navigation.map(value => ({ item, ...value }));
    }).sort((a, b) => a.order - b.order || a.item.name.localeCompare(b.item.name, "ja"));
    const byLabel = new Map();
    for (const { item, path } of entries) {
        const label = path[0] || "Danbooru タグ（未分類）";
        let group = byLabel.get(label);
        if (!group) {
            group = { label, options: [] };
            byLabel.set(label, group);
            groups.push(group);
        }
        // Native optgroup cannot nest; show deeper ancestors in the option text.
        group.options.push({ id: item.id, label: [...path.slice(1), item.name].join(" › ") });
    }
    return groups;
}
