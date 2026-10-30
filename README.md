# Danbooru Selecter

[日本語](README_JA.md)

A ComfyUI node for building a prompt from Japanese Danbooru tag labels and custom presets.

## Installation

Place this folder at **ComfyUI/custom_nodes/ComfyUI-danbooru-selecter**, then restart ComfyUI and refresh the browser. No additional dependencies are required.

## Usage

1. Add **PALEALLOY / Prompt → Danbooru Selecter**.
2. Japanese or English search covers all categories regardless of the dropdown selections. Choosing a category or section shows its tags regardless of the search text. The last control used determines the results; both the search text and dropdown selections are retained.
3. Click tags to add them in selection order; their color indicates selection. Click a selected tag to remove it. The right-hand ↗ opens its Danbooru page in a new tab. Entries without a URL do not show a link icon.
4. Connect the **STRING** output to a text input such as CLIP Text Encode.

The node includes a prompt preview, copy, clear, separator, and underscore replacement controls. Selection and formatting settings are saved in the workflow. Multiple nodes keep separate selections.

Comma is the default separator. Pipe produces **{a|b}**; semicolon produces **a;b**. No trailing separator is added. Normal tag parentheses are escaped; custom preset weighting syntax is preserved.

## Tag data

Keep category JSON files in **json/** and custom preset JSON files in **custom/**. The supplied Japanese JSON structure is supported. All category files are discovered automatically; **json/index.json** defines category hierarchy and order. One dropdown groups categories by parent; deeper levels appear as “parent › child”. Display names come from the translated category JSON files. Unlisted files appear under the final unclassified group. Custom presets keep their existing presentation. Restart ComfyUI and refresh the browser after changing data.

Custom presets may contain multiple tags and weighting syntax. Selectable groups open their matching category when its data exists.

Load **example_workflows/tag_picker.json** for a saved selection example. This node generates text only; models interpret tag and wildcard syntax independently.
