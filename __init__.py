from aiohttp import web
from server import PromptServer
from comfy_api.latest import ComfyExtension

from .catalog import load_catalog
from .nodes import DanbooruSelecter

WEB_DIRECTORY = "./web"


@PromptServer.instance.routes.get("/danbooru-selecter/catalog")
async def catalog(request):
    return web.json_response(load_catalog())


class DanbooruSelecterExtension(ComfyExtension):
    async def get_node_list(self):
        return [DanbooruSelecter]


async def comfy_entrypoint():
    return DanbooruSelecterExtension()
