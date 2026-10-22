// 可选素材覆盖层：读取 build.mjs 生成的内联贴图映射
import { ASSET_MAP } from '../generated/assets.js';

const imageCache = new Map();

export const ASSETS = {
  map: ASSET_MAP,

  // 装备图标：优先按 baseId 精确匹配，其次按部位（slot）匹配
  itemUrl(item) {
    if (!item) return null;
    const items = ASSET_MAP.items || {};
    return items[item.baseId] || items[item.slot] || null;
  },

  charCfg(clsId) {
    return (ASSET_MAP.chars || {})[clsId] || null;
  },

  // data URL 图片异步解码，首帧未就绪时调用方应回退到程序化美术
  image(src) {
    if (!src) return null;
    let rec = imageCache.get(src);
    if (!rec) {
      const img = new Image();
      img.decoding = 'async';
      rec = { img, failed: false };
      img.onerror = () => { rec.failed = true; };
      img.src = src;
      imageCache.set(src, rec);
    }
    if (rec.failed) return null;
    return rec.img.complete && rec.img.naturalWidth > 0 ? rec.img : null;
  },
};
