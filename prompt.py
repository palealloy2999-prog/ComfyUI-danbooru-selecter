import json
import re
from urllib.parse import unquote

DEFAULT_STATE = '{"version":1,"selected":[],"separator":"comma","remove_underscores":true}'
SEPARATORS = {"comma": ", ", "pipe": "|", "semicolon": ";"}


def build_prompt(state):
    data = json.loads(state)
    if not isinstance(data, dict) or data.get("version") != 1:
        raise ValueError("Unsupported Danbooru Selecter state version")
    selected = data.get("selected", [])
    if not isinstance(selected, list):
        raise ValueError("selected must be a list")
    separator = SEPARATORS[data.get("separator", "comma")]
    result = []
    seen = set()
    for item in selected:
        tag = item["tag"]
        if not isinstance(tag, str):
            raise ValueError("tag must be a string")
        literal = item.get("literal", False)
        key = (tag, literal)
        if key in seen or not tag.strip():
            continue
        seen.add(key)
        text = tag if literal else unquote(tag)
        if data.get("remove_underscores", True):
            text = text.replace("_", " ")
        if not literal:
            text = re.sub(r"(?<!\\)([()])", r"\\\1", text)
        result.append(text)
    text = separator.join(result)
    return "{" + text + "}" if text and data.get("separator") == "pipe" else text
