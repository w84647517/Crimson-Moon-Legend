#!/usr/bin/env python3
"""抓取并合成免费开源素材，生成 assets/manifest.json。

素材来源（均可免费商用）：
  * 装备图标：Dungeon Crawl Stone Soup (DCSS) 的 RLTiles，公有领域 (public domain)
    https://github.com/crawl/crawl/tree/master/crawl-ref/source/rltiles
  * 角色贴图：Universal LPC Spritesheet Character Generator，CC-BY-SA 3.0 / GPL 3.0
    https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator

用法：
    python3 tools/fetch-assets.py            # 增量下载，已存在的文件不重复拉取
    python3 tools/fetch-assets.py --force    # 强制重新下载
"""

import json
import os
import sys
import time
import urllib.request
from io import BytesIO

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
ITEMS_DIR = os.path.join(ASSETS, 'items')
CHARS_DIR = os.path.join(ASSETS, 'chars')
CACHE = os.path.join(ROOT, '.asset-tmp', 'cache')

DCSS = 'https://cdn.jsdelivr.net/gh/crawl/crawl@master/crawl-ref/source/rltiles/'
LPC = 'https://cdn.jsdelivr.net/gh/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator@master/spritesheets/'
# jsDelivr 对个别文件会返回 403，用 GitHub raw 作为兜底
DCSS_RAW = 'https://raw.githubusercontent.com/crawl/crawl/master/crawl-ref/source/rltiles/'
LPC_RAW = 'https://raw.githubusercontent.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets/'

FORCE = '--force' in sys.argv

# --------------------------------------------------------------------------
# 装备图标：baseId -> DCSS 图块路径
# 每个基底给一张不同贴图，让木剑 / 铁剑 / 裁决之刃在外观上就有明显区别。
# --------------------------------------------------------------------------
ITEM_TILES = {
    # 武器
    'w_wood':   'item/weapon/quarterstaff.png',
    'w_stick':  'item/weapon/staff.png',
    'w_iron':   'item/weapon/long_sword1.png',
    'w_axe':    'item/weapon/hand_axe1.png',
    'w_wand':   'item/staff/staff04.png',
    'w_tao':    'item/weapon/quarterstaff2.png',
    'w_moon':   'item/weapon/long_sword2.png',
    'w_bone':   'item/staff/staff-artefact4.png',
    'w_fan':    'item/misc/misc_fan.png',
    'w_judge':  'item/weapon/executioner_axe1.png',
    'w_soul':   'item/staff/staff-artefact1.png',
    'w_dragon': 'item/weapon/scimitar3.png',
    'w_blood':  'item/weapon/demon_blade.png',
    'w_tooth':  'item/weapon/athame3.png',
    'w_rage':   'item/weapon/war_axe3.png',
    'w_sky':    'item/weapon/greatsword3.png',
    'w_flame':  'item/staff/staff-artefact6.png',
    'w_tao2':   'item/weapon/blessed_blade.png',

    # 衣服
    'a_cloth':   'item/armour/robe1.png',
    'a_light':   'item/armour/leather_armour1.png',
    'a_robe':    'item/armour/robe_ego1.png',
    'a_heavy':   'item/armour/chain_mail2.png',
    'a_ghost':   'item/armour/shadow_dragon_armour.png',
    'a_fashen':  'item/armour/robe_ego2.png',
    'a_sky':     'item/armour/crystal_plate2.png',
    'a_thunder': 'item/armour/storm_dragon_armour.png',
    'a_moon':    'item/armour/golden_dragon_armour.png',
    'a_myth':    'item/armour/quicksilver_dragon_armour.png',

    # 头盔
    'h_cloth':  'item/armour/headgear/hat_archer.png',
    'h_bronze': 'item/armour/headgear/helmet1.png',
    'h_magic':  'item/armour/headgear/wizard_hat.png',
    'h_iron':   'item/armour/headgear/helmet5.png',
    'h_war':    'item/armour/headgear/helmet_art2.png',
    'h_sky':    'item/armour/headgear/helmet_ego4.png',

    # 项链
    'n_glass': 'item/amulet/fluorescent.png',
    'n_coral': 'item/amulet/garnet.png',
    'n_life':  'item/amulet/emerald.png',
    'n_demon': 'item/amulet/bone.png',
    'n_war':   'item/amulet/golden.png',
    'n_moon':  'item/amulet/ruby.png',

    # 手镯（用护臂 / 圆盾代替）
    'b_iron':   'item/armour/glove1.png',
    'b_silver': 'item/armour/glove2.png',
    'b_tao':    'item/armour/glove3.png',
    'b_power':  'item/armour/glove4.png',
    'b_war':    'item/armour/glove5.png',
    'b_dragon': 'item/armour/shields/buckler3.png',
    'b_iron2':   'item/armour/glove1.png',
    'b_silver2': 'item/armour/glove2.png',
    'b_tao2':    'item/armour/glove3.png',
    'b_power2':  'item/armour/glove4.png',
    'b_war2':    'item/armour/glove5.png',
    'b_dragon2': 'item/armour/shields/buckler3.png',

    # 戒指
    'r_copper': 'item/ring/copper.png',
    'r_iron':   'item/ring/iron.png',
    'r_magic':  'item/ring/gold_blue.png',
    'r_power':  'item/ring/gold_red.png',
    'r_war':    'item/ring/diamond.png',
    'r_moon':   'item/ring/moonstone.png',
    'r_copper2': 'item/ring/copper.png',
    'r_iron2':   'item/ring/iron.png',
    'r_magic2':  'item/ring/gold_blue.png',
    'r_power2':  'item/ring/gold_red.png',
    'r_war2':    'item/ring/diamond.png',
    'r_moon2':   'item/ring/moonstone.png',

    # 靴子
    's_straw':   'item/armour/boots1.png',
    's_leather': 'item/armour/boots2.png',
    's_light':   'item/armour/boots_ego1.png',
    's_wind':    'item/armour/boots_art1.png',
    's_war':     'item/armour/boots_ego2.png',
    's_cloud':   'item/armour/boots_art2.png',

    # 勋章（圆盾 / 宝珠，读作徽章）
    'm_novice': 'item/armour/shields/buckler1.png',
    'm_brave':  'item/armour/shields/buckler2.png',
    'm_elite':  'item/armour/shields/orb_randart4.png',
    'm_king':   'item/armour/shields/orb_randart3.png',
    'm_legend': 'item/armour/shields/orb_randart2.png',
}

# 腰带没有现成图块，从胸甲中间裁一条横带，读作腰带 / 护腰。
BELT_TILES = {
    't_cloth':   'item/armour/robe1.png',
    't_leather': 'item/armour/leather_armour2.png',
    't_iron':    'item/armour/chain_mail3.png',
    't_power':   'item/armour/plate3.png',
    't_war':     'item/armour/plate1.png',
}

# --------------------------------------------------------------------------
# 角色：LPC 图层。合成顺序自下而上。
# --------------------------------------------------------------------------
CHAR_LAYERS = {
    'warrior': [
        'body/bodies/male/light.png',
        'legs/pants/male/charcoal.png',
        'feet/boots/male/brown.png',
        'torso/armour/plate/male/gold.png',
        'head/heads/human/male/light.png',
        'hair/plain/male/dark_brown.png',
    ],
    'mage': [
        'body/bodies/female/light.png',
        'legs/pants/female/black.png',
        'feet/boots/female/black.png',
        'torso/clothes/robe/female/purple.png',
        'head/heads/human/female/light.png',
        'hair/long/female/dark_brown.png',
    ],
    'taoist': [
        'body/bodies/male/light.png',
        'legs/pants/male/black.png',
        'feet/boots/male/black.png',
        'torso/clothes/longsleeve/longsleeve/male/white.png',
        'head/heads/human/male/light.png',
        'hair/plain/male/black.png',
    ],
}

# 源表行号：8=上 9=左 10=下 11=右（已用镜像关系验证 9 <-> 11）
WALK_SRC = {'down': 10, 'left': 9, 'right': 11, 'up': 8}
SLASH_SRC = {'down': 14, 'left': 13, 'right': 15, 'up': 12}

# 输出表：8 列 × 6 行
CHAR_COLS = 8
WALK_FRAMES = 8
ATTACK_FRAMES = 6
OUT_ROWS = [
    ('walkDown', WALK_SRC['down'], WALK_FRAMES, False),
    ('walkRight', WALK_SRC['right'], WALK_FRAMES, False),
    ('walkUp', WALK_SRC['up'], WALK_FRAMES, False),
    ('attackDown', SLASH_SRC['down'], ATTACK_FRAMES, True),
    ('attackRight', SLASH_SRC['right'], ATTACK_FRAMES, True),
    ('attackUp', SLASH_SRC['up'], ATTACK_FRAMES, True),
]
FRAME = 64


def fetch(url, cache_name=None):
    """带磁盘缓存的下载；返回 bytes。jsDelivr 失败时回退到 GitHub raw。"""
    os.makedirs(CACHE, exist_ok=True)
    name = cache_name or url.rsplit('/', 1)[-1]
    path = os.path.join(CACHE, name)
    if os.path.exists(path) and os.path.getsize(path) > 0 and not FORCE:
        return open(path, 'rb').read()

    urls = [url]
    if url.startswith(DCSS):
        urls.append(DCSS_RAW + url[len(DCSS):])
    elif url.startswith(LPC):
        urls.append(LPC_RAW + url[len(LPC):])

    last = None
    for candidate in urls:
        for attempt in range(3):
            try:
                req = urllib.request.Request(candidate, headers={'User-Agent': 'cq-asset-fetch/1.0'})
                with urllib.request.urlopen(req, timeout=45) as r:
                    data = r.read()
                Image.open(BytesIO(data)).load()  # 校验 PNG 完整
                open(path, 'wb').write(data)
                time.sleep(0.05)
                return data
            except Exception as exc:  # noqa: BLE001
                last = exc
                time.sleep(0.6 * (attempt + 1))
    raise RuntimeError(f'下载失败 {url}: {last}')


def to_rgba(data):
    return Image.open(BytesIO(data)).convert('RGBA')


def build_items():
    os.makedirs(ITEMS_DIR, exist_ok=True)
    written = {}

    for base_id, rel in sorted(ITEM_TILES.items()):
        img = to_rgba(fetch(DCSS + rel, 'dcss-' + rel.replace('/', '_')))
        img = img.resize((64, 64), Image.NEAREST)
        out = os.path.join(ITEMS_DIR, base_id + '.png')
        img.save(out, optimize=True)
        written[base_id] = f'items/{base_id}.png'

    for base_id, rel in sorted(BELT_TILES.items()):
        img = to_rgba(fetch(DCSS + rel, 'dcss-' + rel.replace('/', '_')))
        bbox = img.getbbox() or (0, 0, img.width, img.height)
        x0, y0, x1, y1 = bbox
        band_h = max(6, int((y1 - y0) * 0.34))
        cy = (y0 + y1) // 2
        top = max(y0, cy - band_h // 2)
        band = img.crop((x0, top, x1, min(y1, top + band_h)))
        # 横向拉满 + 纵向放大，做成腰带比例
        band = band.resize((30, min(26, max(8, int(band.height * 1.7)))), Image.NEAREST)
        canvas = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        pos = ((32 - band.width) // 2, (32 - band.height) // 2)
        # 1px 深色描边，让裁切出来的横带读起来像一条腰带
        outline = Image.new('RGBA', band.size, (22, 15, 10, 255))
        outline.putalpha(band.split()[3].filter(ImageFilter.MaxFilter(3)))
        canvas.alpha_composite(outline, pos)
        canvas.alpha_composite(band, pos)
        canvas.resize((64, 64), Image.NEAREST).save(
            os.path.join(ITEMS_DIR, base_id + '.png'), optimize=True)
        written[base_id] = f'items/{base_id}.png'

    print(f'[items] {len(written)} 张图标')
    return written


def build_chars():
    os.makedirs(CHARS_DIR, exist_ok=True)
    out = {}

    for cls, layers in CHAR_LAYERS.items():
        imgs = []
        for rel in layers:
            imgs.append(to_rgba(fetch(LPC + rel, 'lpc-' + rel.replace('/', '_'))))

        sheet = Image.new('RGBA', (CHAR_COLS * FRAME, len(OUT_ROWS) * FRAME), (0, 0, 0, 0))
        for row_idx, (_key, src_row, frames, _attack) in enumerate(OUT_ROWS):
            for col in range(frames):
                cell = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
                for im in imgs:
                    if src_row * FRAME + FRAME > im.height:
                        continue
                    cell.alpha_composite(im.crop((
                        col * FRAME, src_row * FRAME,
                        col * FRAME + FRAME, src_row * FRAME + FRAME)))
                sheet.alpha_composite(cell, (col * FRAME, row_idx * FRAME))

        path = os.path.join(CHARS_DIR, cls + '.png')
        sheet.save(path, optimize=True)
        out[cls] = {
            'src': f'chars/{cls}.png',
            'frameW': FRAME,
            'frameH': FRAME,
            'cols': CHAR_COLS,
            'rows': len(OUT_ROWS),
            'walkFrames': WALK_FRAMES,
            'attackFrames': ATTACK_FRAMES,
            'walkDownRow': 0,
            'walkRightRow': 1,
            'walkUpRow': 2,
            'attackDownRow': 3,
            'attackRightRow': 4,
            'attackUpRow': 5,
            'flip': True,
            'fps': 10,
            'drawH': 76,
            'offsetY': 2,
        }
        print(f'[chars] {cls}: {sheet.width}x{sheet.height}')

    return out


def write_manifest(items, chars):
    manifest = {'items': items, 'chars': chars}
    with open(os.path.join(ASSETS, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print('[manifest] assets/manifest.json')


CREDITS = """# 素材来源与授权

本项目运行时素材全部来自可免费使用的开源素材库，构建时会内联进 `dist/index.html`。

## 装备图标 —— RLTiles / Dungeon Crawl Stone Soup

- 来源：<https://github.com/crawl/crawl>（`crawl-ref/source/rltiles/`）
- 上游：<http://rltiles.sourceforge.net/>
- 授权：**Public Domain（公有领域）**，可商用、无需署名
- 处理：32×32 图块用最近邻放大到 64×64；腰带类从胸甲图块裁取横向护腰条

## 角色贴图 —— Universal LPC Spritesheet Character Generator

- 来源：<https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator>
- 上游：<https://opengameart.org/content/lpc-collection>（Liberated Pixel Cup）
- 授权：**CC-BY-SA 3.0 / GPL 3.0 双许可**，需保留署名并以相同方式共享
- 处理：按职业叠加 身体 / 护腿 / 靴子 / 衣服 / 头部 / 头发 图层，
  抽取行走 8 帧与劈砍 6 帧，重排为 8 列 × 6 行精灵表

请保留本文件，或在公开分发时于显著位置注明以上署名。

## 重新生成

```bash
python3 tools/fetch-assets.py          # 增量下载
python3 tools/fetch-assets.py --force  # 强制重下
npm run build
```
"""


def main():
    try:
        items = build_items()
        chars = build_chars()
    except Exception as exc:  # noqa: BLE001
        print(f'错误：{exc}', file=sys.stderr)
        print('提示：本脚本需要网络访问与 Pillow（pip install pillow）', file=sys.stderr)
        raise SystemExit(1)
    write_manifest(items, chars)
    with open(os.path.join(ASSETS, 'CREDITS.md'), 'w', encoding='utf-8') as f:
        f.write(CREDITS)
    print('[credits] assets/CREDITS.md')


if __name__ == '__main__':
    main()
