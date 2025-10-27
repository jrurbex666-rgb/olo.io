import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createDecoderForPage(page) {
  // Prüfen ob urbexology-Decoder direkt vorhanden
  const direct = await page.evaluate(() => !!(window.a0_0x55209e || window.a0_0x446d));
  if (direct) {
    return async (index) => {
      const num =
        typeof index === "string" && index.startsWith("0x")
          ? parseInt(index, 16)
          : Number(index);
      return await page.evaluate((n) => {
        const fn = window.a0_0x55209e || window.a0_0x446d;
        try {
          return fn(n);
        } catch {
          try {
            return fn(n, null);
          } catch {
            return null;
          }
        }
      }, num);
    };
  }

  // Fallback: a0_0x345b()
  const arr = await page.evaluate(() => {
    try {
      const fn = window.a0_0x345b;
      if (typeof fn === "function") {
        const a = fn();
        if (Array.isArray(a)) return a;
      }
    } catch {}
    return null;
  });

  if (!arr) throw new Error("Decoder konnte nicht gefunden werden.");

  const OFFSET = 0xd0;
  return async (index) => {
    const num =
      typeof index === "string" && index.startsWith("0x")
        ? parseInt(index, 16)
        : Number(index);
    const i = num - OFFSET;
    return arr[i] ?? null;
  };
}

// Hauptlogik
(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Ziel-URL mit gültigem Token öffnen
  await page.goto("https://urbexology.com/?token=DEIN_TOKEN_HIER", {
    waitUntil: "networkidle2",
  });

  console.log("🌍 Seite geladen, initialisiere Decoder…");
  const decode = await createDecoderForPage(page);
  console.log("✅ Decoder bereit.");

  // Abfang-Logik im Browser injizieren
  await page.exposeFunction("saveDecodedData", async (polygonName, data) => {
    const dir = path.join(__dirname, "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const file = path.join(dir, `fetch_${polygonName}.json`);
    fs.appendFileSync(file, JSON.stringify(data, null, 2) + ",\n", "utf-8");
    console.log(`💾 Daten gespeichert: ${file}`);
  });

  await page.evaluate(() => {
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await origFetch(...args);
      const url = args[0];
      if (typeof url === "string" && url.includes("/fetch2")) {
        const cloned = res.clone();
        cloned
          .json()
          .then(async (data) => {
            try {
              const polygonName =
                window.currentPolygonName || "unknown_polygon";
              // Die Daten enthalten vermutlich codierte Strings in data.data
              // hier nur weitergeben an Node
              window.saveDecodedData(polygonName, data);
            } catch (e) {
              console.error("Fehler bei saveDecodedData:", e);
            }
          })
          .catch((err) =>
            console.error("Fehler beim Lesen fetch2 Antwort:", err)
          );
      }
      return res;
    };
  });

  console.log("🛰 fetch2-Interceptor aktiv – bewege jetzt die Karte…");

  // Hier kannst du Polygon-Namen aus cv.js iterieren:
  const polygons = await page.evaluate(() => {
    if (window.polygons) return Object.keys(window.polygons);
    return [];
  });
  console.log("Bekannte Polygonbereiche:", polygons);

  // Manuell oder automatisiert über Polygone iterieren:
  // z. B. Kamera nacheinander in die Bounds fliegen lassen
  for (const poly of polygons) {
    console.log(`🔹 Bereich: ${poly}`);
    await page.evaluate((name) => {
      window.currentPolygonName = name;
      // optional: Karte bewegen, um fetch2 auszulösen
    }, poly);
    await new Promise((r) => setTimeout(r, 4000));
  }

  console.log("⏹ Sammeln abgeschlossen. Dateien liegen unter ./data/");
  // await browser.close();
})();
