import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const dev = process.argv.includes('--dev');

// 可选素材覆盖：assets/manifest.json 存在时，将外部贴图内联成 data URL。
// 这样 dist/index.html 仍然是单文件，并且没有素材时自动回退到程序化美术。
function buildAssetMap() {
  const root = 'assets';
  const manifestPath = path.join(root, 'manifest.json');
  const map = { items: {}, chars: {} };
  if (fs.existsSync(manifestPath)) {
    let manifest = {};
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      console.warn(`[assets] manifest.json 解析失败：${err.message}`);
      manifest = {};
    }
    const inline = (rel) => {
      if (!rel || typeof rel !== 'string') return null;
      const file = path.join(root, rel);
      if (!fs.existsSync(file)) {
        console.warn(`[assets] 缺少文件：${file}`);
        return null;
      }
      const ext = path.extname(file).toLowerCase();
      const mime = ext === '.png' ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
        : ext === '.webp' ? 'image/webp'
        : ext === '.gif' ? 'image/gif'
        : 'application/octet-stream';
      return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
    };
    for (const [key, rel] of Object.entries(manifest.items || {})) {
      const url = inline(rel);
      if (url) map.items[key] = url;
    }
    for (const [key, cfg] of Object.entries(manifest.chars || {})) {
      const conf = typeof cfg === 'string' ? {} : { ...cfg };
      const url = inline(conf.src || cfg);
      if (url) map.chars[key] = { ...conf, src: url };
    }
  }
  fs.mkdirSync('src/generated', { recursive: true });
  fs.writeFileSync(
    'src/generated/assets.js',
    `// 由 build.mjs 自动生成，请勿手动修改\nexport const ASSET_MAP = ${JSON.stringify(map)};\n`
  );
  const itemCount = Object.keys(map.items).length;
  const charCount = Object.keys(map.chars).length;
  if (itemCount || charCount) {
    console.log(`[assets] 已内联 ${itemCount} 个装备图标 / ${charCount} 个角色贴图`);
  }
}

buildAssetMap();

const res = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: !dev,
  format: 'iife',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
});

const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = fs.readFileSync('src/index.html', 'utf8');
if (!template.includes('<!--APP_SCRIPT-->')) {
  throw new Error('src/index.html 缺少 <!--APP_SCRIPT--> 占位符');
}
const html = template.replace('<!--APP_SCRIPT-->', () => `<script>${js}</script>`);

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
