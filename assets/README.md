# 美术素材

本目录存放游戏运行时的贴图，构建时会被 `build.mjs` 内联成 data URL，所以 `dist/index.html` 仍是单文件。

## 当前素材

| 用途 | 来源 | 授权 |
| --- | --- | --- |
| 装备图标（80 张） | [DCSS / RLTiles](https://github.com/crawl/crawl/tree/master/crawl-ref/source/rltiles) | Public Domain |
| 三职业精灵表 | [Universal LPC Spritesheet Generator](https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator) | CC-BY-SA 3.0 / GPL 3.0 |

完整署名见 [`CREDITS.md`](./CREDITS.md)。公开发布时请保留该文件或等价的署名说明。

## 重新生成

```bash
python3 tools/fetch-assets.py          # 增量下载 + 合成
python3 tools/fetch-assets.py --force  # 忽略缓存重新下载
npm run build
```

依赖 Pillow（`pip install pillow`）与网络访问。下载缓存在 `.asset-tmp/cache/`，可随时删除。

## 目录

```
assets/
  manifest.json      贴图映射与精灵表布局（由脚本生成）
  items/<baseId>.png 装备图标，按装备基底 id 命名
  chars/<cls>.png    三职业精灵表
  CREDITS.md         素材署名
```

## manifest.json

```json
{
  "items": {
    "w_iron": "items/w_iron.png",
    "a_heavy": "items/a_heavy.png"
  },
  "chars": {
    "warrior": {
      "src": "chars/warrior.png",
      "frameW": 64,
      "frameH": 64,
      "cols": 8,
      "rows": 6,
      "walkFrames": 8,
      "attackFrames": 6,
      "walkDownRow": 0,
      "walkRightRow": 1,
      "walkUpRow": 2,
      "attackDownRow": 3,
      "attackRightRow": 4,
      "attackUpRow": 5,
      "flip": true,
      "fps": 10,
      "drawH": 76,
      "offsetY": 2
    }
  }
}
```

### items

- key 用装备基底 id（`w_iron`、`a_moon`…），也兼容部位名（`weapon`、`armor`…）作为兜底。
- 查找顺序：`baseId` → `slot`。
- 推荐 64×64 透明 PNG；渲染时使用最近邻采样，像素风不会被插值糊掉。
- 稀有度光效由游戏叠加，不需要为每一档品质单独出图。

### chars

- `src`：精灵表路径。
- `frameW` / `frameH` / `cols` / `rows`：单帧尺寸与表格尺寸。
- `walkDownRow` / `walkRightRow` / `walkUpRow`：三个行走方向的行号。
- `attackDownRow` / `attackRightRow` / `attackUpRow`：攻击动作所在行，缺省时回退到 `attackRightRow`。
- `walkFrames` / `attackFrames` / `fps`：动画帧数与帧率。
- `flip`：只有单侧朝向时靠水平翻转得到另一侧。
- `drawH`：绘制高度（世界像素），默认 76；`offsetX` / `offsetY` 微调锚点。

## 换成别的素材

1. 把图按 `items/<baseId>.png`、`chars/<cls>.png` 放好（或改 `tools/fetch-assets.py` 里的映射表）。
2. 更新 `manifest.json` 的行号 / 帧数。
3. `npm run build`。

文件缺失或图片尚未解码完成时会自动回退到程序化美术，不会报错。
