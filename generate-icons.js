const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = 'C:\\Users\\thejo\\.gemini\\antigravity\\brain\\2ec03152-225e-4364-95c0-4d31fb0184bb\\finoria_app_icon_1773079941015.png';
const ANDROID_RES = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

const sizes = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

// Also for anydpi-v26 adaptive icon placeholder
const adaptiveSizes = [
  { dir: 'mipmap-mdpi',    size: 108 },
  { dir: 'mipmap-hdpi',    size: 162 },
  { dir: 'mipmap-xhdpi',   size: 216 },
  { dir: 'mipmap-xxhdpi',  size: 324 },
  { dir: 'mipmap-xxxhdpi', size: 432 },
];

async function run() {
  for (const { dir, size } of sizes) {
    const outPath = path.join(ANDROID_RES, dir, 'ic_launcher.png');
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(outPath);
    console.log(`✓ ${dir}/ic_launcher.png (${size}x${size})`);

    const outRound = path.join(ANDROID_RES, dir, 'ic_launcher_round.png');
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(outRound);
    console.log(`✓ ${dir}/ic_launcher_round.png (${size}x${size})`);
  }

  // foreground for adaptive icons
  for (const { dir, size } of adaptiveSizes) {
    const outFg = path.join(ANDROID_RES, dir, 'ic_launcher_foreground.png');
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 10, g: 16, b: 33, alpha: 1 } })
      .png()
      .toFile(outFg);
    console.log(`✓ ${dir}/ic_launcher_foreground.png (${size}x${size})`);
  }

  // Splash screen (1024x1024 centered with dark padding)
  const splashDirs = [
    { dir: 'drawable-port-mdpi',    w: 320,  h: 480  },
    { dir: 'drawable-port-hdpi',    w: 480,  h: 800  },
    { dir: 'drawable-port-xhdpi',   w: 720,  h: 1280 },
    { dir: 'drawable-port-xxhdpi',  w: 960,  h: 1600 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  ];

  const iconSize = (w) => Math.round(w * 0.45);

  for (const { dir, w, h } of splashDirs) {
    const sz = iconSize(w);
    const outSplash = path.join(ANDROID_RES, dir, 'splash.png');
    await sharp({
        create: { width: w, height: h, channels: 4, background: { r: 10, g: 16, b: 33, alpha: 1 } }
      })
      .composite([{
        input: await sharp(SOURCE).resize(sz, sz, { fit: 'contain', background: { r: 10, g: 16, b: 33, alpha: 1 } }).png().toBuffer(),
        gravity: 'center'
      }])
      .png()
      .toFile(outSplash);
    console.log(`✓ ${dir}/splash.png (${w}x${h})`);
  }

  console.log('\n✅ All icon and splash assets generated!');
}

run().catch(console.error);
