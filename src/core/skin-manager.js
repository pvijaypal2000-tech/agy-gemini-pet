'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const STATES = ['idle', 'working', 'happy', 'sweat', 'poked'];

const BUILTIN_SKIN_META = {
  'catgirl-classic': {
    id: 'catgirl-classic',
    name: '蓝紫星喵娘',
    subtitle: '中文二创经典 · 粉金异色瞳猫耳',
    tag: '经典二创',
    builtin: true,
    order: 1,
    pixelated: false,
    recommendedSoundPack: 'meow-bell',
    accentColors: ['#60a5fa', '#a78bfa'],
    greeting: ['蓝紫星喵娘已就位 ✦', '哼，今天也要把缓存命中率拉满喵！'],
    pokeLines: [
      ['别戳啦，Token 在烧着呢！', '哼，再戳我可要收猫粮费了喵～'],
      ['没偷偷跑去喂蓝色小鲸鱼吧？', '有 Gemini 蓝紫猫娘盯着还不够嘛！✦'],
      ['反重力能量满格待机中～', '双击我或者点脚下胶囊可以看完整账单哦'],
      ['记得常看上下文水位！', '太胖的话开个新会话或 /compact 最省额度啦'],
      ['tokless + agy-fast 双开加持中', '今天的缓存命中率一定要漂漂亮亮的✨']
    ],
    moodLines: {
      cacheCliff: '缓存断层啦！检查是不是改了顶部规则喵 💦',
      highCtx: '上下文 {ctxPct}% 啦！再塞下去要失忆了喵 💦',
      cacheHigh: '哼，缓存命中这么稳，还不快夸夸我 ✨',
      fast: '反重力加速全开！嗖一下写完啦 ✨'
    }
  },
  'catgirl-argon': {
    id: 'catgirl-argon',
    name: '辉光霓虹喵娘',
    subtitle: 'Gemini Argon 霓虹紫粉限定版',
    tag: '霓虹限定',
    builtin: true,
    order: 2,
    pixelated: false,
    recommendedSoundPack: 'cyber-sci',
    accentColors: ['#e879f9', '#38bdf8'],
    greeting: ['Argon 辉光管已通电 ✦', '霓虹猫娘全频段接管监控，请下达指令！'],
    pokeLines: [
      ['滋滋——辉光管充能中！', '别乱戳天线，会漏出紫色电弧的喵⚡'],
      ['夜深写代码就得配赛博霓虹', '切到 Lo-Fi 电钢音效包超治愈哦'],
      ['监测到高能输出波动 ✦', '今天预算进度条都帮你盯紧啦'],
      ['再戳我就要切换高功率模式了！', '哼，其实还挺喜欢你来找我玩的']
    ],
    moodLines: {
      cacheCliff: '警告：检测到前缀缓存断层波动 ⚡',
      highCtx: '上下文负载 {ctxPct}%！建议开启新会话减压 ⚡',
      cacheHigh: '辉光缓存完美共振，省流率拉满 ✦',
      fast: '超频输出达成！霓虹星环全速运转 ✨'
    }
  },
  'pixel-retro': {
    id: 'pixel-retro',
    name: '像素星喵娘',
    subtitle: '16-Bit 复古像素 · 程序员情怀',
    tag: '复古像素',
    builtin: true,
    order: 3,
    pixelated: true,
    recommendedSoundPack: 'arcade-8bit',
    accentColors: ['#818cf8', '#f472b6'],
    greeting: ['PLAYER 1 READY! ✦', '8-Bit 星喵已投币上线，配复古音效超带感！'],
    pokeLines: [
      ['BEEP BOOP! 别戳像素点啦！', '小心把我戳掉帧了喵 >_<'],
      ['ACHIEVEMENT UNLOCKED ✦', '点击猫娘次数 +1，摸鱼指数上升中'],
      ['HP（上下文余量）监控正常！', '记得多用骨架读取省蓝条（Token）哦'],
      ['切到 8-Bit 电玩音效包试试？', '每完成一轮都有吃金币的快乐！']
    ],
    moodLines: {
      cacheCliff: 'WARNING! CACHE MISS! 缓存连击断了！💦',
      highCtx: 'DANGER! 上下文 {ctxPct}% 即将爆槽！快存档开新局！',
      cacheHigh: 'COMBO MAX! 缓存连击完美命中！+1000 PTS ✨',
      fast: 'SPEED RUN! 极速输出达成！✨'
    }
  },
  'star-slime': {
    id: 'star-slime',
    name: '反重力星团子',
    subtitle: '失重软萌四角星 · 矢量高清治愈系',
    tag: '极简萌物',
    builtin: true,
    order: 4,
    pixelated: false,
    recommendedSoundPack: 'glass-droplet',
    accentColors: ['#93c5fd', '#c4b5fd'],
    greeting: ['咕啾～四角星团子飘来啦 ✦', '软绵绵陪你写代码写论文，绝不打扰～'],
    pokeLines: [
      ['咕啾～好痒呀 (>_<)', '被捏扁啦，弹回来继续发光✨'],
      ['失重漂浮中… zZZ', '只要有新消息我就立刻亮起来哦'],
      ['今天也要注意休息眼睛呀', '上下文太满的时候我会冒汗提醒你滴'],
      ['蓝紫星光充能 100% ✦', '点我脚下的小胶囊可以看今天花了多少 Token']
    ],
    moodLines: {
      cacheCliff: '咕呜…缓存突然掉了一块，好像有点浪费 💦',
      highCtx: '团子快装不下啦（{ctxPct}%）！开个新对话减减肥吧 💦',
      cacheHigh: '咕啾～缓存软软地接住了，超省 Token ✨',
      fast: '咻——星光团子光速送达！✨'
    }
  },
  'google-fourcolor': {
    id: 'google-fourcolor',
    name: '四色双子星灵',
    subtitle: '谷歌红黄蓝绿双星 · 极简科技风',
    tag: '谷歌四色',
    builtin: true,
    order: 5,
    pixelated: false,
    recommendedSoundPack: 'starlight',
    accentColors: ['#4285f4', '#fbbc05'],
    greeting: ['双子星双人组上线 ✦', '大星盯额度、小星盯网速，分工明确！'],
    pokeLines: [
      ['双子星同步闪烁中 ✦✧', '红黄蓝绿四色能量平衡良好～'],
      ['主星与伴星正在协奏', '双击我们可以查看 7 日用量柱状图哦'],
      ['Prefix Cache 就像轨道惯性', '别在中途大改顶部规则就能一直滑行省流！'],
      ['想换音效风格？', '点开面板里的「音效」标签随便拧旋钮哦']
    ],
    moodLines: {
      cacheCliff: '轨道抖动！检测到缓存命中断层 💦',
      highCtx: '轨道载重 {ctxPct}%，建议切换新会话保持轻盈 ✦',
      cacheHigh: '四色星轨稳定滑行，缓存复用率极佳 ✨',
      fast: '双子星超光速传输完成！✨'
    }
  }
};

class SkinManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.skinsRoot = path.join(projectRoot, 'assets', 'skins');
    this.legacySpritesDir = path.join(projectRoot, 'assets', 'sprites');
    this.soundsCustomDir = path.join(projectRoot, 'assets', 'sounds', 'custom');
    this._ensureInit();
  }

  _ensureInit() {
    fs.mkdirSync(this.skinsRoot, { recursive: true });
    fs.mkdirSync(this.soundsCustomDir, { recursive: true });

    // Migrate legacy assets/sprites/* into assets/skins/catgirl-classic/
    const classicDir = path.join(this.skinsRoot, 'catgirl-classic');
    if (!fs.existsSync(classicDir) && fs.existsSync(this.legacySpritesDir)) {
      fs.mkdirSync(classicDir, { recursive: true });
      for (const st of STATES) {
        const src = path.join(this.legacySpritesDir, `${st}.png`);
        const dst = path.join(classicDir, `${st}.png`);
        if (fs.existsSync(src)) fs.copyFileSync(src, dst);
      }
    }

    for (const [id, meta] of Object.entries(BUILTIN_SKIN_META)) {
      const dir = path.join(this.skinsRoot, id);
      const manifestPath = path.join(dir, 'skin.json');
      if (fs.existsSync(dir) && !fs.existsSync(manifestPath)) {
        fs.writeFileSync(manifestPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
      }
    }
  }

  _findStateImage(dir, stateName) {
    const exts = ['.png', '.svg', '.webp', '.gif', '.jpg', '.jpeg'];
    for (const ext of exts) {
      const p = path.join(dir, `${stateName}${ext}`);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  _parseSpritesheetManifest(dir, meta) {
    // Supports both native skin.json `spritesheet` and community Petdex `pet.json` (8x9 or custom grid)
    const petJsonPath = path.join(dir, 'pet.json');
    let sheetCfg = meta.spritesheet || null;

    if (!sheetCfg && fs.existsSync(petJsonPath)) {
      try {
        const pj = JSON.parse(fs.readFileSync(petJsonPath, 'utf8'));
        const cols = Number(pj.cols || pj.columns || pj.grid?.cols || pj.grid?.columns || 8);
        const rows = Number(pj.rows || pj.grid?.rows || 9);
        const fps = Number(pj.fps || pj.frameRate || 8);
        const candidates = [
          pj.spritesheet,
          pj.sprite,
          pj.atlas,
          pj.image,
          'spritesheet.png',
          'spritesheet.webp',
          'sheet.png',
          'atlas.png'
        ].filter(Boolean);
        let sheetFile = null;
        for (const c of candidates) {
          const p = path.join(dir, String(c));
          if (fs.existsSync(p)) {
            sheetFile = p;
            break;
          }
        }
        if (!sheetFile) {
          const imgs = fs.readdirSync(dir).filter((f) => /\.(png|webp|jpg|jpeg)$/i.test(f));
          if (imgs.length > 0) sheetFile = path.join(dir, imgs[0]);
        }

        if (sheetFile) {
          // Map semantic states from Petdex animations/states or sensible default rows
          const anims = pj.animations || pj.states || {};
          const pickRow = (keys, fallbackRow) => {
            for (const k of keys) {
              const entry = anims[k];
              if (entry !== undefined && entry !== null) {
                if (typeof entry === 'number') return { row: entry, frames: cols };
                if (typeof entry === 'object') {
                  const row = Number(entry.row ?? entry.y ?? fallbackRow);
                  const frames = Number(entry.frames ?? entry.frameCount ?? entry.count ?? cols);
                  return { row: Math.min(rows - 1, Math.max(0, row)), frames: Math.max(1, Math.min(cols, frames)) };
                }
              }
            }
            return { row: Math.min(rows - 1, fallbackRow), frames: cols };
          };

          sheetCfg = {
            file: path.basename(sheetFile),
            cols,
            rows,
            fps,
            states: {
              idle: pickRow(['idle', 'sit', 'stand', 'default'], 0),
              working: pickRow(['working', 'run', 'walk', 'typing', 'inferring', 'thinking'], Math.min(rows - 1, 1)),
              happy: pickRow(['happy', 'jump', 'celebrate', 'cheer', 'love'], Math.min(rows - 1, 2)),
              sweat: pickRow(['sweat', 'alert', 'hurt', 'fail', 'error', 'shock'], Math.min(rows - 1, 3)),
              poked: pickRow(['poked', 'click', 'pet', 'pat', 'shy', 'interact'], Math.min(rows - 1, 4)),
              sleeping: pickRow(['sleeping', 'sleep', 'doze', 'rest'], Math.min(rows - 1, 5))
            }
          };
          if (!meta.name || meta.name === meta.id) {
            meta.name = String(pj.name || pj.displayName || meta.id).slice(0, 20);
          }
          if (pj.description) meta.subtitle = String(pj.description).slice(0, 42);
          meta.tag = 'Petdex 动图';
          meta.pixelated = pj.pixelated !== false;
        }
      } catch {}
    }

    if (!sheetCfg || !sheetCfg.file) return null;
    const absFile = path.join(dir, sheetCfg.file);
    if (!fs.existsSync(absFile)) return null;
    const mtime = (() => {
      try { return Math.floor(fs.statSync(absFile).mtimeMs); } catch { return 0; }
    })();
    return {
      ...sheetCfg,
      url: `${pathToFileURL(absFile).href}?v=${mtime}`
    };
  }

  listSkins() {
    this._ensureInit();
    let dirs = [];
    try {
      dirs = fs.readdirSync(this.skinsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      return [];
    }

    const list = [];
    for (const d of dirs) {
      const id = d.name;
      const dir = path.join(this.skinsRoot, id);

      let meta = BUILTIN_SKIN_META[id]
        ? { ...BUILTIN_SKIN_META[id] }
        : {
            id,
            name: id,
            subtitle: '本地导入自定义形象',
            tag: '自定义',
            builtin: false,
            order: 99,
            pixelated: false,
            recommendedSoundPack: 'starlight',
            accentColors: ['#60a5fa', '#a78bfa'],
            greeting: [`${id} 已上线 ✦`, '双击或点脚下胶囊看完整监测账单～'],
            pokeLines: [
              ['戳我干嘛呀～', '我正帮你盯着 Antigravity 呢 ✦'],
              ['记得常看上下文水位哦', '太满时新开对话最省额度！']
            ],
            moodLines: {
              cacheCliff: '检测到缓存断层，检查是否中途改动了规则 💦',
              highCtx: '上下文已达 {ctxPct}%，建议开新对话或 /compact 💦',
              cacheHigh: '缓存命中率超高，非常省流 ✨',
              fast: '输出速度起飞啦！✨'
            }
          };

      const manifestPath = path.join(dir, 'skin.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          meta = { ...meta, ...parsed, id };
        } catch {}
      }

      const spritesheet = this._parseSpritesheetManifest(dir, meta);
      const idleFile = this._findStateImage(dir, 'idle');
      if (!idleFile && !spritesheet) continue;

      const states = {};
      const stateFiles = {};
      if (idleFile) {
        for (const st of STATES) {
          const file = this._findStateImage(dir, st) || idleFile;
          const mtime = (() => {
            try { return Math.floor(fs.statSync(file).mtimeMs); } catch { return 0; }
          })();
          states[st] = `${pathToFileURL(file).href}?v=${mtime}`;
          stateFiles[st] = path.basename(file);
        }
      }

      list.push({
        ...meta,
        dir,
        mode: spritesheet ? 'spritesheet' : 'images',
        spritesheet,
        previewUrl: idleFile ? states.idle : spritesheet.url,
        states,
        stateFiles
      });
    }

    list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
    return list;
  }

  importPetdexFolder(sourceFolder) {
    if (!sourceFolder || !fs.existsSync(sourceFolder)) {
      throw new Error('Folder not found');
    }
    const base = path.basename(sourceFolder).replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '').slice(0, 18) || 'petdex';
    const id = `petdex-${base}-${Date.now()}`;
    const destDir = path.join(this.skinsRoot, id);
    fs.mkdirSync(destDir, { recursive: true });

    const files = fs.readdirSync(sourceFolder, { withFileTypes: true }).filter((f) => f.isFile());
    let copiedImg = null;
    let hasManifest = false;
    for (const f of files) {
      if (/\.(json|png|webp|gif|jpg|jpeg|svg)$/i.test(f.name)) {
        fs.copyFileSync(path.join(sourceFolder, f.name), path.join(destDir, f.name));
        if (f.name.toLowerCase() === 'pet.json' || f.name.toLowerCase() === 'skin.json') hasManifest = true;
        if (!copiedImg && /\.(png|webp|jpg|jpeg)$/i.test(f.name)) copiedImg = f.name;
      }
    }

    if (!hasManifest && copiedImg) {
      // Auto-generate a standard spritesheet manifest if user picked a raw sprite-strip folder
      const fallbackManifest = {
        id,
        name: base,
        subtitle: '导入的精灵图集（可在目录内编辑 skin.json 调行列）',
        tag: '精灵图',
        builtin: false,
        pixelated: true,
        spritesheet: {
          file: copiedImg,
          cols: 4,
          rows: 1,
          fps: 8,
          states: {
            idle: { row: 0, frames: 4 },
            working: { row: 0, frames: 4 },
            happy: { row: 0, frames: 4 },
            sweat: { row: 0, frames: 4 },
            poked: { row: 0, frames: 4 },
            sleeping: { row: 0, frames: 4 }
          }
        }
      };
      fs.writeFileSync(path.join(destDir, 'skin.json'), JSON.stringify(fallbackManifest, null, 2) + '\n', 'utf8');
    }

    return id;
  }

  importCustomSkin(sourceImagePath, displayName) {
    if (!sourceImagePath || !fs.existsSync(sourceImagePath)) {
      throw new Error('Image file not found');
    }
    const ext = path.extname(sourceImagePath).toLowerCase() || '.png';
    const baseName = (displayName || path.basename(sourceImagePath, ext)).trim().slice(0, 20) || '自定义形象';
    const id = `custom-${Date.now()}`;
    const dir = path.join(this.skinsRoot, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(sourceImagePath, path.join(dir, `idle${ext}`));

    const meta = {
      id,
      name: baseName,
      subtitle: '本地导入自定义形象（支持按状态替换）',
      tag: '自定义',
      builtin: false,
      order: 100,
      pixelated: false,
      recommendedSoundPack: 'starlight',
      accentColors: ['#60a5fa', '#f472b6'],
      greeting: [`${baseName} 报道 ✦`, '随时帮你盯着 Antigravity 额度与速度！'],
      pokeLines: [
        [`${baseName} 正在值班中 ✦`, '双击我或点脚下胶囊看完整面板'],
        ['戳一戳能量 +1！', '今天也要顺顺利利完成任务呀 ✨']
      ],
      moodLines: {
        cacheCliff: '检测到缓存断层啦 💦',
        highCtx: '上下文 {ctxPct}% 啦，注意及时开新会话哦 💦',
        cacheHigh: '缓存命中率好高，超省额度 ✨',
        fast: '极速输出完成！✨'
      }
    };
    fs.writeFileSync(path.join(dir, 'skin.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    return id;
  }

  replaceSkinState(skinId, stateName, sourceImagePath) {
    if (!STATES.includes(stateName)) throw new Error('Invalid state');
    const dir = path.join(this.skinsRoot, skinId);
    if (!fs.existsSync(dir)) throw new Error('Skin not found');
    const ext = path.extname(sourceImagePath).toLowerCase() || '.png';
    for (const oldExt of ['.png', '.svg', '.webp', '.gif', '.jpg', '.jpeg']) {
      const oldPath = path.join(dir, `${stateName}${oldExt}`);
      if (fs.existsSync(oldPath)) {
        try { fs.rmSync(oldPath, { force: true }); } catch {}
      }
    }
    fs.copyFileSync(sourceImagePath, path.join(dir, `${stateName}${ext}`));
    return true;
  }

  deleteCustomSkin(skinId) {
    if (!skinId || BUILTIN_SKIN_META[skinId]) return false;
    const dir = path.join(this.skinsRoot, skinId);
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }

  importCustomSound(eventKey, sourceAudioPath) {
    if (!sourceAudioPath || !fs.existsSync(sourceAudioPath)) {
      throw new Error('Audio file not found');
    }
    fs.mkdirSync(this.soundsCustomDir, { recursive: true });
    const ext = path.extname(sourceAudioPath).toLowerCase() || '.mp3';
    const safeName = `${eventKey}-${Date.now()}${ext}`;
    const dest = path.join(this.soundsCustomDir, safeName);
    fs.copyFileSync(sourceAudioPath, dest);
    return {
      fileName: path.basename(sourceAudioPath),
      url: pathToFileURL(dest).href,
      path: dest
    };
  }
}

module.exports = {
  SkinManager,
  BUILTIN_SKIN_META,
  STATES
};
