import json
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).parent


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def group_target(tag):
    decoded = unquote(tag)
    if decoded.lower().startswith("tag_group:"):
        return "json/" + decoded.split(":", 1)[1]
    if decoded.lower().startswith("pool group:"):
        return "json/pool_group_" + decoded.split(":", 1)[1].strip().lower()
    return None



def add_navigation(categories):
    index_path = ROOT / "json" / "index.json"
    if not index_path.exists():
        return
    by_id = {category["id"]: category for category in categories}
    order = 0

    def visit(nodes, parents):
        nonlocal order
        for node in nodes:
            category = by_id.get("json/" + node.get("tag", ""))
            name = category["name"] if category else node["label"].strip()
            if category:
                category.setdefault("navigation", []).append({"path": parents, "order": order})
                order += 1
            visit(node.get("children", []), [*parents, name])

    visit(read_json(index_path), [])


def load_catalog():
    categories = []
    for source in ("custom", "json"):
        for path in sorted((ROOT / source).glob("*.json")):
            if path.stem == "index":
                continue
            data = read_json(path)
            sections = []
            for section in data.get("セクション一覧", []):
                items = []
                for item in section.get("タグ一覧", []):
                    tag = item.get("tag", "")
                    if not isinstance(tag, str) or not tag.strip():
                        continue
                    items.append({
                        "tag": tag,
                        "label": str(item.get("label", tag)),
                        "literal": source == "custom" or bool(item.get("original")),
                        "target": group_target(tag),
                        "link": item.get("link", ""),
                    })
                sections.append({"name": section.get("セクション名", "その他"), "items": items})
            categories.append({
                "id": f"{source}/{path.stem}",
                "name": data.get("カテゴリ名", path.stem),
                "source": source,
                "sections": sections,
            })
    add_navigation(categories)
    return categories
