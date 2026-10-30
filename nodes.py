from comfy_api.latest import io

from .prompt import DEFAULT_STATE, build_prompt


class DanbooruSelecter(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="PalealloyDanbooruSelecter",
            display_name="Danbooru Selecter",
            category="PALEALLOY / Prompt",
            inputs=[io.String.Input(
                "state", default=DEFAULT_STATE, socketless=True, dynamic_prompts=False,
                tooltip="Selected tags and formatting settings. Edited in the tag picker.",
            )],
            outputs=[io.String.Output("prompt", display_name="STRING")],
        )

    @classmethod
    def execute(cls, state=DEFAULT_STATE):
        return io.NodeOutput(build_prompt(state))
