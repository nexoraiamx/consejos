import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TOTAL_FRAMES = 4020; // 67 seconds @ 60fps
const HTML_PATH = "file:///Users/juanpablogarcia/Desktop/red/marketing/video-launch/index.html";

// Scene boundary definitions
const SCENES = [
  { name: "clip_01_hero", start: 0, end: 299 },          // 5s (300 frames)
  { name: "clip_02_landing", start: 300, end: 659 },      // 6s (360 frames)
  { name: "clip_03_comunidades", start: 660, end: 1019 },  // 6s (360 frames)
  { name: "clip_04_publicaciones", start: 1020, end: 1499 },// 8s (480 frames)
  { name: "clip_05_multimedia", start: 1500, end: 2099 },  // 10s (600 frames)
  { name: "clip_06_expertos", start: 2100, end: 2579 },    // 8s (480 frames)
  { name: "clip_07_perfil", start: 2580, end: 2939 },      // 6s (360 frames)
  { name: "clip_08_notificaciones", start: 2940, end: 3239 },// 5s (300 frames)
  { name: "clip_09_onboarding", start: 3240, end: 3539 },  // 5s (300 frames)
  { name: "clip_10_final", start: 3540, end: 4019 }        // 8s (480 frames)
];

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const framesDir = "/Users/juanpablogarcia/Desktop/red/marketing/video-launch/clips/frames";
  const clipsDir = "/Users/juanpablogarcia/Desktop/red/marketing/video-launch/clips";

  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }

  const puppeteer = require("puppeteer-core");

  console.log("Iniciando renderizador de video de Consejos...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  console.log(`Cargando plantilla en browser: ${HTML_PATH}`);
  await page.goto(HTML_PATH, { waitUntil: "networkidle2" });
  await delay(1000);

  // Render loops
  console.log(`Renderizando ${TOTAL_FRAMES} fotogramas a 60fps...`);
  
  // We can render in parallel batches of 5 to speed it up!
  const batchSize = 10;
  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    // Set current frame on the page
    await page.evaluate((f: number) => {
      // @ts-ignore
      window.setFrame(f);
    }, frame);

    const destPath = path.join(framesDir, `frame_${String(frame).padStart(5, "0")}.jpg`);
    await page.screenshot({ path: destPath, type: "jpeg", quality: 98 });

    if (frame % 100 === 0 || frame === TOTAL_FRAMES - 1) {
      console.log(`  -> Fotograma ${frame + 1}/${TOTAL_FRAMES} renderizado.`);
    }
  }

  console.log("Cerrando navegador Chrome...");
  await browser.close();

  // ----------------------------------------------------
  // COMPILACIÓN FFmpeg DE LOS CLIPS INDIVIDUALES
  // ----------------------------------------------------
  console.log("\nCompilando clips individuales con FFmpeg...");
  for (const scene of SCENES) {
    const clipPath = path.join(clipsDir, `${scene.name}.mp4`);
    console.log(`  -> Generando ${scene.name}.mp4 (fotogramas ${scene.start} a ${scene.end})...`);
    
    // Command to take sequence starting at scene.start
    const cmd = `ffmpeg -y -r 60 -f image2 -start_number ${scene.start} -i ${framesDir}/frame_%05d.jpg -vframes ${scene.end - scene.start + 1} -c:v libx264 -pix_fmt yuv420p ${clipPath}`;
    execSync(cmd);
    console.log(`     Listo: ${clipPath}`);
  }

  // ----------------------------------------------------
  // COMPILACIÓN FFmpeg DEL VIDEO COMPLETO (SIN AUDIO)
  // ----------------------------------------------------
  console.log("\nCompilando video completo (sin audio)...");
  const videoNoAudioPath = path.join(clipsDir, "consejos-launch-noaudio.mp4");
  const fullVideoCmd = `ffmpeg -y -r 60 -f image2 -start_number 0 -i ${framesDir}/frame_%05d.jpg -vframes ${TOTAL_FRAMES} -c:v libx264 -pix_fmt yuv420p ${videoNoAudioPath}`;
  execSync(fullVideoCmd);
  console.log(`Listo: ${videoNoAudioPath}`);

  console.log("\nLimpiando fotogramas PNG temporales para ahorrar espacio...");
  // Clear the frames folder
  fs.readdirSync(framesDir).forEach(file => {
    fs.unlinkSync(path.join(framesDir, file));
  });
  fs.rmdirSync(framesDir);
  console.log("Fotogramas eliminados con éxito.");
  
  console.log("\n¡Renderizado y compilación de clips completada con éxito!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error en renderizado:", err);
  process.exit(1);
});
