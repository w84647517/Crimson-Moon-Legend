# 素材来源与授权

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
