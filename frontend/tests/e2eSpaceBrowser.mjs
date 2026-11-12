/**
 * BeatCode Space — Live Browser E2E & Performance Verification Suite (Proof C15)
 *
 * Drives the real browser via Maestri Portal ("BeatCode Space") against the live
 * Next.js frontend (http://127.0.0.1:3000) and FastAPI backend (http://127.0.0.1:8000)
 * to validate all 15 E2E acceptance checks from SPACE-01..SPACE-10 plus performance metrics.
 */

import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const PORTAL_NAME = process.env.BEATCODE_PORTAL_NAME || "BeatCode Space";
const FRONTEND_URL = process.env.BEATCODE_FRONTEND_URL || "http://127.0.0.1:3000";
const BACKEND_URL = process.env.BEATCODE_BACKEND_URL || "http://127.0.0.1:8000";

function runPortal(args) {
  const out = execFileSync("maestri", ["portal", ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out.trim();
}

function evalInPortal(jsExpr) {
  const raw = runPortal(["evaluate", PORTAL_NAME, jsExpr]);
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function waitForCondition(description, jsPredicate, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = evalInPortal(`Boolean(${jsPredicate})`);
    if (res === true || res === "true") {
      return Date.now() - start;
    }
    sleep(250);
  }
  throw new Error(`Timeout waiting for E2E condition: ${description}`);
}

async function main() {
  console.log("=== BeatCode Space Live Browser E2E Verification (C15) ===");

  // 0. Verify backend API health and live contract
  const apiStart = performance.now();
  const resArtists = await fetch(
    `${BACKEND_URL}/api/graph?time_range=medium_term&graph_mode=artists&limit=50&demo=true`
  );
  assert.equal(resArtists.status, 200, "Backend /api/graph (artists demo) must return 200");
  const artistsData = await resArtists.json();
  const apiLatencyMs = Math.round(performance.now() - apiStart);
  assert.ok(artistsData.nodes.length >= 20, "Artists demo graph must return >= 20 real nodes");
  assert.ok(artistsData.links.length >= 20, "Artists demo graph must return >= 20 links");

  const resBipartite = await fetch(
    `${BACKEND_URL}/api/graph?time_range=medium_term&graph_mode=bipartite&limit=50&demo=true`
  );
  assert.equal(resBipartite.status, 200, "Backend /api/graph (bipartite demo) must return 200");
  const bipartiteData = await resBipartite.json();
  const genreNodes = bipartiteData.nodes.filter((n) => n.node_type === "genre");
  assert.ok(genreNodes.length > 0, "Bipartite graph must include genre stellar core nodes");
  assert.ok(
    genreNodes.every((g) => Number.isInteger(g.connected_artists_count) && g.connected_artists_count >= 1),
    "Every genre node must include integer connected_artists_count >= 1"
  );

  // 1. Navigate portal to Welcome screen & clear storage for deterministic test start
  runPortal(["resize", PORTAL_NAME, "1440", "900"]);
  runPortal(["navigate", PORTAL_NAME, FRONTEND_URL]);
  runPortal(["logs-start", PORTAL_NAME]);
  evalInPortal(`window.localStorage.clear(); true`);
  runPortal(["reload", PORTAL_NAME]);

  await waitForCondition(
    "Welcome screen enter-demo-btn visible",
    `document.querySelector('[data-testid="enter-demo-btn"]')`
  );

  // 2. Click "Explorar demonstração" to enter 3D BeatCode Space
  const loadStart = Date.now();
  evalInPortal(`document.querySelector('[data-testid="enter-demo-btn"]').click(); true`);

  const stageLoadMs = await waitForCondition(
    "3D stage canvas and accessible planet list rendered",
    `document.querySelector('[data-testid="beatcode-space-stage"] canvas') && document.querySelectorAll('[data-testid^="planet-list-item-"]').length > 10`
  );
  sleep(800);

  // 3. Verify initial 3D state, HUD controls, constellations, and accessible catalog
  const initialState = evalInPortal(`JSON.stringify({
    depth: document.querySelector('[data-testid="exploration-depth-badge"]')?.textContent?.trim(),
    canvasCount: document.querySelectorAll('[data-testid="beatcode-space-stage"] canvas').length,
    planetListCount: document.querySelectorAll('[data-testid^="planet-list-item-"]').length,
    hasCameraDock: Boolean(document.querySelector('[data-testid="space-camera-dock"]')),
    hasInspector: Boolean(document.querySelector('[data-testid="space-inspector-panel"]')),
    inspectorText: document.querySelector('[data-testid="space-inspector-panel"]')?.textContent || ""
  })`);

  assert.equal(initialState.depth, "Universo", "Initial exploration depth must be 'Universo'");
  assert.ok(initialState.canvasCount >= 1, "3D WebGL canvas must be mounted inside stage");
  assert.equal(initialState.planetListCount, artistsData.nodes.length, "Accessible planet catalog must list all visible planets");
  assert.equal(initialState.hasCameraDock, true, "360° camera dock must be visible");
  assert.ok(/Modularidade Q/i.test(initialState.inspectorText), "Inspector must display Modularidade Q telemetry");
  assert.ok(/\[INFERÊNCIA BEATCODE\]/i.test(initialState.inspectorText), "Inspector must display [INFERÊNCIA BEATCODE] badge");

  // 4. Test Constellation / Star System Focus ("Sistema Estelar")
  evalInPortal(`(() => {
    const clusterBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Focar câmera no sistema estelar'));
    if (clusterBtn) clusterBtn.click();
    return Boolean(clusterBtn);
  })()`);
  sleep(300);
  const clusterDepth = evalInPortal(
    `document.querySelector('[data-testid="exploration-depth-badge"]')?.textContent?.trim()`
  );
  assert.equal(clusterDepth, "Sistema Estelar", "Focusing a constellation must update depth to 'Sistema Estelar'");

  // 5. Test Planet Selection (Bridge Artist "Gorillaz") & Provenance + 4-Attribute Breakdown
  evalInPortal(`(() => {
    const bridgeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Clique para viajar até esta ponte cósmica'));
    if (bridgeBtn) bridgeBtn.click();
    return Boolean(bridgeBtn);
  })()`);
  sleep(400);

  const selectedPlanetState = evalInPortal(`JSON.stringify({
    depth: document.querySelector('[data-testid="exploration-depth-badge"]')?.textContent?.trim(),
    hasDossier: Boolean(document.querySelector('[data-testid="planet-inspector-details"]')),
    dossierText: document.querySelector('[data-testid="planet-inspector-details"]')?.textContent || "",
    centerBtnDisabled: document.querySelector('button[aria-label="Centralizar Planeta"]')?.disabled
  })`);

  assert.equal(selectedPlanetState.depth, "Órbita Planetária", "Selecting a planet must set depth to 'Órbita Planetária'");
  assert.equal(selectedPlanetState.hasDossier, true, "Planet dossier section must open on selection");
  assert.equal(selectedPlanetState.centerBtnDisabled, false, "'Centralizar Planeta' button must be enabled when planet is selected");
  assert.ok(selectedPlanetState.dossierText.includes("[DADO SPOTIFY]"), "Dossier must show [DADO SPOTIFY] provenance badge");
  assert.ok(selectedPlanetState.dossierText.includes("[INFERÊNCIA BEATCODE]"), "Dossier must show [INFERÊNCIA BEATCODE] provenance badge");
  assert.ok(selectedPlanetState.dossierText.includes("Gênero (0.65g)"), "Dossier must display 0.65g genre weight component");
  assert.ok(selectedPlanetState.dossierText.includes("Colaboração (0.25c)"), "Dossier must display 0.25c collaboration component");
  assert.ok(selectedPlanetState.dossierText.includes("Audição (0.10t)"), "Dossier must display 0.10t co-listening component");

  // 6. Test 1-Hop and 2-Hop Planetary Navigation
  const beforeHopTitle = evalInPortal(
    `document.querySelector('[data-testid="planet-inspector-details"] h3')?.textContent?.trim()`
  );
  const hopClicked = evalInPortal(`(() => {
    const dossier = document.querySelector('[data-testid="planet-inspector-details"]');
    const hopBtn = Array.from(dossier?.querySelectorAll('button') || []).find(
      b => b.title && (b.title.startsWith('Selecionar ') || b.title.startsWith('Navegar para '))
    );
    if (hopBtn) {
      hopBtn.click();
      return true;
    }
    return false;
  })()`);
  sleep(300);
  const afterHopTitle = evalInPortal(
    `document.querySelector('[data-testid="planet-inspector-details"] h3')?.textContent?.trim()`
  );
  assert.equal(hopClicked, true, "1-hop/2-hop neighbor button must be clickable");
  assert.notEqual(afterHopTitle, beforeHopTitle, "Clicking 1-hop/2-hop neighbor must navigate to that planet");

  // 7. Test Search Input & "/" Keyboard Shortcut
  evalInPortal(`(() => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    return true;
  })()`);
  sleep(150);
  const searchFocused = evalInPortal(
    `document.activeElement === document.querySelector('input[type="search"]')`
  );
  assert.equal(searchFocused, true, "Pressing '/' must focus the spatial search input");

  runPortal(["fill", PORTAL_NAME, 'input[type="search"]', "Radiohead"]);
  sleep(300);
  const searchResultClicked = evalInPortal(`(() => {
    const option = document.querySelector('[role="listbox"] [role="option"]');
    if (option) {
      option.click();
      return true;
    }
    return false;
  })()`);
  assert.equal(searchResultClicked, true, "Search listbox must display and select matching planet 'Radiohead'");
  const currentSelectedTitle = evalInPortal(
    `document.querySelector('[data-testid="planet-inspector-details"] h3')?.textContent?.trim()`
  );
  assert.equal(currentSelectedTitle, "Radiohead", "Selecting 'Radiohead' from search must open Radiohead in Inspector");

  // 8. Test 3D <-> 2D View Mode Toggle State Preservation
  evalInPortal(`(() => {
    const map2dBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('2D Mapa'));
    if (map2dBtn) map2dBtn.click();
    return true;
  })()`);
  sleep(500);
  const stateIn2D = evalInPortal(`JSON.stringify({
    selectedTitle: document.querySelector('[data-testid="planet-inspector-details"] h3')?.textContent?.trim(),
    hasCanvas: Boolean(document.querySelector('[data-testid="beatcode-space-stage"] canvas')),
    map2dPressed: Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('2D Mapa'))?.getAttribute('aria-pressed')
  })`);
  assert.equal(stateIn2D.map2dPressed, "true", "'2D Mapa' button must have aria-pressed='true'");
  assert.equal(stateIn2D.selectedTitle, "Radiohead", "Switching to 2D Mapa must preserve selected planet 'Radiohead'");
  assert.equal(stateIn2D.hasCanvas, true, "2D Canvas must be rendered");

  // Switch back to 3D Espacial
  evalInPortal(`(() => {
    const space3dBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('3D Espacial'));
    if (space3dBtn) space3dBtn.click();
    return true;
  })()`);
  sleep(500);
  const stateBackIn3D = evalInPortal(
    `document.querySelector('[data-testid="planet-inspector-details"] h3')?.textContent?.trim()`
  );
  assert.equal(stateBackIn3D, "Radiohead", "Switching back to 3D Espacial must preserve selected planet 'Radiohead'");

  // 9. Test Bipartite Mode ("Artistas + Gêneros") & Node Type Filter ("Gêneros")
  evalInPortal(`(() => {
    const bipBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Artistas + Gêneros');
    if (bipBtn) bipBtn.click();
    return true;
  })()`);
  await waitForCondition(
    "Bipartite mode loaded with genre nodes",
    `document.querySelector('[data-testid="space-inspector-panel"]')?.textContent.includes('Grafo Bipartido')`
  );
  sleep(400);

  evalInPortal(`(() => {
    const genreFilterBtn = Array.from(document.querySelectorAll('[aria-label="Filtrar por tipo de astro"] button')).find(b => b.textContent?.trim() === 'Gêneros');
    if (genreFilterBtn) genreFilterBtn.click();
    return true;
  })()`);
  sleep(300);

  // Select a Genre Stellar Core from the accessible list
  evalInPortal(`(() => {
    const firstGenreBtn = document.querySelector('[data-testid^="planet-list-item-"]');
    if (firstGenreBtn) firstGenreBtn.click();
    return Boolean(firstGenreBtn);
  })()`);
  sleep(300);
  const genreSelectedText = evalInPortal(
    `document.querySelector('[data-testid="planet-inspector-details"]')?.textContent || ""`
  );
  assert.ok(
    genreSelectedText.includes("Núcleo Estelar · Gênero") &&
      genreSelectedText.includes("Artistas conectados a este hub:"),
    "Selecting a genre node in bipartite mode must display 'Núcleo Estelar · Gênero' and 'Artistas conectados a este hub'"
  );

  // Restore "Todos" and "Artistas" mode
  evalInPortal(`(() => {
    const allFilterBtn = Array.from(document.querySelectorAll('[aria-label="Filtrar por tipo de astro"] button')).find(b => b.textContent?.trim() === 'Todos');
    if (allFilterBtn) allFilterBtn.click();
    const artBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Artistas');
    if (artBtn) artBtn.click();
    return true;
  })()`);
  await waitForCondition(
    "Artists mode restored",
    `document.querySelectorAll('[data-testid^="planet-list-item-"]').length >= 20`
  );

  // 10. Test Reduced Motion Accessibility & Responsive Viewport (Mobile 390x844 -> Desktop 1440x900)
  evalInPortal(`document.querySelector('button[aria-label="Movimento Reduzido"]')?.click(); true`);
  sleep(200);
  const reducedMotionActive = evalInPortal(`JSON.stringify({
    pressed: document.querySelector('button[aria-label="Movimento Reduzido"]')?.getAttribute('aria-pressed'),
    autoOrbitDisabled: document.querySelector('button[aria-label="Auto-Órbita"]')?.disabled
  })`);
  assert.equal(reducedMotionActive.pressed, "true", "Movimento Reduzido toggle must set aria-pressed='true'");
  assert.equal(reducedMotionActive.autoOrbitDisabled, true, "Auto-Órbita must be disabled when Movimento Reduzido is active");
  // Restore normal motion
  evalInPortal(`document.querySelector('button[aria-label="Movimento Reduzido"]')?.click(); true`);

  // Responsive check at 390x844 (Mobile)
  runPortal(["resize", PORTAL_NAME, "390", "844"]);
  sleep(300);
  const mobileViewport = evalInPortal(`JSON.stringify({
    innerWidth: window.innerWidth,
    stageVisible: Boolean(document.querySelector('[data-testid="beatcode-space-stage"]')),
    inspectorVisible: Boolean(document.querySelector('[data-testid="space-inspector-panel"]'))
  })`);
  assert.equal(mobileViewport.innerWidth, 390, "Mobile viewport width must be 390px");
  assert.equal(mobileViewport.stageVisible, true, "Stage must remain visible on mobile viewport");
  assert.equal(mobileViewport.inspectorVisible, true, "Inspector must remain accessible on mobile viewport");

  // Restore 1440x900 desktop viewport and select a planet for visual showcase on canvas
  runPortal(["resize", PORTAL_NAME, "1440", "900"]);
  sleep(400);
  evalInPortal(`document.querySelector('[data-testid^="planet-list-item-"]')?.click(); true`);
  sleep(400);

  // 11. Collect Performance & Memory Telemetry and Check Console Logs
  const perfMetrics = evalInPortal(`JSON.stringify({
    domNodes: document.querySelectorAll('*').length,
    jsHeapUsedMB: performance.memory ? Math.round((performance.memory.usedJSHeapSize / 1048576) * 10) / 10 : null,
    jsHeapTotalMB: performance.memory ? Math.round((performance.memory.totalJSHeapSize / 1048576) * 10) / 10 : null
  })`);

  const consoleLogs = runPortal(["logs", PORTAL_NAME]);
  const severeErrors = consoleLogs
    .split("\n")
    .filter((line) => /error|uncaught|exception/i.test(line) && !/favicon/i.test(line));
  assert.equal(severeErrors.length, 0, `Browser console must have 0 errors, got: ${severeErrors.join("; ")}`);

  console.log("Performance Telemetry:", {
    apiLatencyMs,
    stageLoadMs: stageLoadMs || Date.now() - loadStart,
    domNodes: perfMetrics.domNodes,
    jsHeapUsedMB: perfMetrics.jsHeapUsedMB,
    jsHeapTotalMB: perfMetrics.jsHeapTotalMB,
    artistsNodes: artistsData.nodes.length,
    artistsLinks: artistsData.links.length,
    bipartiteNodes: bipartiteData.nodes.length,
    bipartiteLinks: bipartiteData.links.length,
  });
  console.log(
    "E2E_BROWSER_VERIFIED: 3D/2D stage, planet selection, camera HUD, and Inspector verified in headless browser"
  );
}

main().catch((err) => {
  console.error("E2E_BROWSER_FAILED:", err);
  process.exit(1);
});
