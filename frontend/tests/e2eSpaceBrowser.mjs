/**
 * BeatCode Space — Live Browser E2E & Performance Verification Suite (Proofs C15, C16, C18, C19)
 *
 * Drives the real browser via Maestri Portal against the live Next.js frontend (http://127.0.0.1:3000)
 * and FastAPI backend (http://127.0.0.1:8000) to validate all acceptance checks:
 * - Graphify 3D Knowledge Graph UI terminology
 * - Linear listening proportionality (C16) via window.__BEATCODE_GRAPH_API__
 * - Genre graphs auto-switch to bipartite, projected genre-genre edges & neighborhood navigation (C18)
 * - Camera zoom & position stability during hover regression proof (C19)
 * - 3D/2D toggle, accessible catalog, search & "/" shortcut, reduced-motion & mobile responsiveness
 */

import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

function resolvePortalName() {
  if (process.env.BEATCODE_PORTAL_NAME) return process.env.BEATCODE_PORTAL_NAME;
  try {
    const listOut = execFileSync("maestri", ["list"], { encoding: "utf-8" });
    const match = listOut.match(/name:\s*"([^"]*BeatCode Space[^"]*)"/i);
    if (match) return match[1];
  } catch {}
  return "BeatCode Space";
}

const PORTAL_NAME = resolvePortalName();
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

async function waitForCondition(description, jsPredicate, timeoutMs = 12000) {
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
  console.log(`=== BeatCode Space Live Browser E2E Verification (Portal: "${PORTAL_NAME}") ===`);

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

  // 3. Verify initial 3D state, Graphify terminology, HUD controls, and accessible catalog
  const initialState = evalInPortal(`JSON.stringify({
    depth: document.querySelector('[data-testid="exploration-depth-badge"]')?.textContent?.trim(),
    canvasCount: document.querySelectorAll('[data-testid="beatcode-space-stage"] canvas').length,
    planetListCount: document.querySelectorAll('[data-testid^="planet-list-item-"]').length,
    hasCameraDock: Boolean(document.querySelector('[data-testid="space-camera-dock"]')),
    hasInspector: Boolean(document.querySelector('[data-testid="space-inspector-panel"]')),
    inspectorText: document.querySelector('[data-testid="space-inspector-panel"]')?.textContent || ""
  })`);

  assert.equal(initialState.depth, "Rede Completa", "Initial exploration depth must be 'Rede Completa'");
  assert.ok(initialState.canvasCount >= 1, "3D WebGL canvas must be mounted inside stage");
  assert.equal(initialState.planetListCount, artistsData.nodes.length, "Accessible planet catalog must list all visible planets");
  assert.equal(initialState.hasCameraDock, true, "360° camera dock must be visible");
  assert.ok(/Modularidade Q/i.test(initialState.inspectorText), "Inspector must display Modularidade Q telemetry");
  assert.ok(/\[INFERÊNCIA BEATCODE\]/i.test(initialState.inspectorText), "Inspector must display [INFERÊNCIA BEATCODE] badge");

  // 4. Test Knowledge Cluster Focus ("Cluster de Conhecimento")
  evalInPortal(`(() => {
    const clusterBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && (b.title.includes('Focar câmera no') || b.title.includes('Cluster')));
    if (clusterBtn) clusterBtn.click();
    return Boolean(clusterBtn);
  })()`);
  sleep(400);
  const clusterDepth = evalInPortal(
    `document.querySelector('[data-testid="exploration-depth-badge"]')?.textContent?.trim()`
  );
  assert.ok(
    clusterDepth === "Cluster de Conhecimento" || clusterDepth === "Cluster",
    `Focusing a cluster must update depth to 'Cluster de Conhecimento' or 'Cluster', got: '${clusterDepth}'`
  );

  // 5. Test Node Selection (Bridge Artist) & Provenance + 4-Attribute Breakdown ("Foco no Nó")
  evalInPortal(`(() => {
    const bridgeBtn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent && (
        b.textContent.includes('Clique para focar neste nó ponte') ||
        b.textContent.includes('Clique para viajar até esta ponte cósmica') ||
        b.textContent.includes('Gorillaz')
      )
    );
    if (bridgeBtn) {
      bridgeBtn.click();
      return true;
    }
    const firstPlanet = document.querySelector('[data-testid^="planet-list-item-"]');
    if (firstPlanet) {
      firstPlanet.click();
      return true;
    }
    return false;
  })()`);
  sleep(400);

  const selectedPlanetState = evalInPortal(`JSON.stringify({
    depth: document.querySelector('[data-testid="exploration-depth-badge"]')?.textContent?.trim(),
    hasDossier: Boolean(document.querySelector('[data-testid="planet-inspector-details"]')),
    dossierText: document.querySelector('[data-testid="planet-inspector-details"]')?.textContent || "",
    centerBtnDisabled: (document.querySelector('button[aria-label="Foco no Nó"]') || document.querySelector('button[aria-label="Centralizar Nó"]') || document.querySelector('button[aria-label="Centralizar Planeta"]'))?.disabled
  })`);

  assert.equal(selectedPlanetState.depth, "Foco no Nó", "Selecting a planet must set depth to 'Foco no Nó'");
  assert.equal(selectedPlanetState.hasDossier, true, "Planet dossier section must open on selection");
  assert.equal(selectedPlanetState.centerBtnDisabled, false, "'Foco no Nó' button must be enabled when planet is selected");
  assert.ok(selectedPlanetState.dossierText.includes("[DADO SPOTIFY]"), "Dossier must show [DADO SPOTIFY] provenance badge");
  assert.ok(selectedPlanetState.dossierText.includes("[INFERÊNCIA BEATCODE]"), "Dossier must show [INFERÊNCIA BEATCODE] provenance badge");
  assert.ok(selectedPlanetState.dossierText.includes("Gênero (0.65g)"), "Dossier must display 0.65g genre weight component");
  assert.ok(selectedPlanetState.dossierText.includes("Colaboração (0.25c)"), "Dossier must display 0.25c collaboration component");
  assert.ok(selectedPlanetState.dossierText.includes("Audição (0.10t)"), "Dossier must display 0.10t co-listening component");

  // 6. Test 1-Hop and 2-Hop Node Navigation
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
  sleep(400);
  const afterHopTitle = evalInPortal(
    `document.querySelector('[data-testid="planet-inspector-details"] h3')?.textContent?.trim()`
  );
  assert.equal(hopClicked, true, "1-hop/2-hop neighbor button must be clickable");
  assert.notEqual(afterHopTitle, beforeHopTitle, "Clicking 1-hop/2-hop neighbor must navigate to that node");

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

  // 8. Test 3D <-> 2D View Mode Toggle State Preservation ("Grafo 3D" <-> "Mapa 2D")
  evalInPortal(`(() => {
    const map2dBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Mapa 2D') || b.textContent?.includes('2D Mapa'));
    if (map2dBtn) map2dBtn.click();
    return true;
  })()`);
  sleep(500);
  const stateIn2D = evalInPortal(`JSON.stringify({
    selectedTitle: document.querySelector('[data-testid="planet-inspector-details"] h3')?.textContent?.trim(),
    hasCanvas: Boolean(document.querySelector('[data-testid="beatcode-space-stage"] canvas')),
    map2dPressed: Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Mapa 2D') || b.textContent?.includes('2D Mapa'))?.getAttribute('aria-pressed')
  })`);
  assert.equal(stateIn2D.map2dPressed, "true", "'Mapa 2D' button must have aria-pressed='true'");
  assert.equal(stateIn2D.selectedTitle, "Radiohead", "Switching to Mapa 2D must preserve selected planet 'Radiohead'");
  assert.equal(stateIn2D.hasCanvas, true, "2D Canvas must be rendered");

  // Switch back to Grafo 3D
  evalInPortal(`(() => {
    const space3dBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Grafo 3D') || b.textContent?.includes('3D Grafo') || b.textContent?.includes('3D Espacial'));
    if (space3dBtn) space3dBtn.click();
    return true;
  })()`);
  sleep(500);
  const stateBackIn3D = evalInPortal(
    `document.querySelector('[data-testid="planet-inspector-details"] h3')?.textContent?.trim()`
  );
  assert.equal(stateBackIn3D, "Radiohead", "Switching back to Grafo 3D must preserve selected planet 'Radiohead'");

  // 9. PROVA E2E DE PROPORCIONALIDADE ÀS ESCUTAS NO NAVEGADOR (C16)
  console.log("Checking E2E linear listening proportionality via window.__BEATCODE_GRAPH_API__...");
  const propCheck = evalInPortal(`(() => {
    const api = window.__BEATCODE_GRAPH_API__;
    if (!api || typeof api.getNodeVisualProps !== "function") {
      return { error: "window.__BEATCODE_GRAPH_API__.getNodeVisualProps unavailable" };
    }
    const p16 = api.getNodeVisualProps("a16");
    const p1 = api.getNodeVisualProps("a1");
    const p4 = api.getNodeVisualProps("a4");
    const p9 = api.getNodeVisualProps("a9");
    return {
      d16: p16?.dimension,
      d1: p1?.dimension,
      d4: p4?.dimension,
      d9: p9?.dimension,
      r16: p16?.radius,
      r1: p1?.radius,
      r4: p4?.radius,
      r9: p9?.radius,
      l16: p16?.listeningCount,
      l1: p1?.listeningCount,
      l4: p4?.listeningCount,
      l9: p9?.listeningCount
    };
  })()`);

  assert.ok(!propCheck.error, propCheck.error || "Proportionality props check failed");
  assert.equal(propCheck.d16 / propCheck.d1, 1.5, "D(a16)/D(a1) must equal 1.5 (1500 vs 1000)");
  assert.equal(propCheck.d1 / propCheck.d9, 2.0, "D(a1)/D(a9) must equal 2.0 (1000 vs 500)");
  assert.ok(Math.abs(propCheck.d1 / propCheck.d4 - 4 / 3) < 1e-9, "D(a1)/D(a4) must equal 4/3 within 1e-9 (1000 vs 750)");
  console.log("PROPORTIONALITY_VERIFIED:", propCheck);

  // 10. PROVA E2E DE GRAFOS DE GÊNEROS & NAVEGAÇÃO GÊNERO -> ARTISTA (C18)
  console.log("Checking E2E genre graph auto-switch and neighborhood navigation...");
  // Estando no modo 'Artistas', clique diretamente no botão de filtro 'Gêneros'
  evalInPortal(`(() => {
    const artModeBtn = Array.from(document.querySelectorAll('[aria-label="Modo de topologia do grafo"] button, button')).find(b => b.textContent?.trim() === 'Artistas');
    if (artModeBtn) artModeBtn.click();
    return true;
  })()`);
  sleep(400);

  evalInPortal(`(() => {
    const filterGroup = document.querySelector('[aria-label="Filtrar por tipo de nó"]');
    const genreBtn = Array.from(filterGroup ? filterGroup.querySelectorAll('button') : document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Gêneros');
    if (genreBtn) genreBtn.click();
    return Boolean(genreBtn);
  })()`);

  await waitForCondition(
    "Graph mode automatically switches to bipartite on genre filter",
    `window.__BEATCODE_GRAPH_API__ && window.__BEATCODE_GRAPH_API__.getFilteredStats().graphMode === 'bipartite'`
  );
  sleep(500);

  const genreStats = evalInPortal(`window.__BEATCODE_GRAPH_API__.getFilteredStats()`);
  assert.equal(genreStats.graphMode, "bipartite", "Graph mode must auto-switch to 'bipartite'");
  assert.equal(genreStats.nodeTypeFilter, "genre", "Node type filter must be 'genre'");
  assert.ok(genreStats.visibleLinks > 0, "visibleLinks must be > 0 (projected genre-genre links)");
  assert.ok(genreStats.linkTypes.includes("genre-genre"), "linkTypes must contain 'genre-genre'");

  // Select a genre node from the visible list
  evalInPortal(`(() => {
    const genreItem = document.querySelector('[data-testid^="planet-list-item-"]');
    if (genreItem) genreItem.click();
    return Boolean(genreItem);
  })()`);
  sleep(500);

  const genreInspector = evalInPortal(`JSON.stringify({
    dossierText: document.querySelector('[data-testid="planet-inspector-details"]')?.textContent || "",
    hasDossier: Boolean(document.querySelector('[data-testid="planet-inspector-details"]'))
  })`);

  assert.ok(
    genreInspector.dossierText.includes("Hub Semântico · Gênero"),
    "Inspector must display 'Hub Semântico · Gênero'"
  );
  assert.ok(
    /escutas|ranking|artistas|L_i/i.test(genreInspector.dossierText),
    "Inspector must display listening count, artists count, or ranking metrics"
  );
  assert.ok(
    genreInspector.dossierText.includes("Artistas conectados a este gênero") ||
      genreInspector.dossierText.includes("Artistas conectados a este hub"),
    "Inspector must display connected artists section"
  );

  // Click on a connected artist in the Inspector to validate genre -> artist navigation
  const navigatedToArtist = evalInPortal(`(() => {
    const dossier = document.querySelector('[data-testid="planet-inspector-details"]');
    if (!dossier) return false;
    const buttons = Array.from(dossier.querySelectorAll('button')).filter(b =>
      b.title && b.title.startsWith('Selecionar ') && !b.title.includes('ponte')
    );
    // Connected artists have mixed case names (e.g. 'Arcade Fire', 'Beach House')
    const chosen = buttons.find(b => {
      const name = b.title.replace('Selecionar ', '').trim();
      return /[a-z]/.test(name);
    }) || buttons[0];
    if (chosen) {
      chosen.click();
      return true;
    }
    return false;
  })()`);
  assert.equal(navigatedToArtist, true, "Clicking connected artist must trigger navigation");

  await waitForCondition(
    "Inspector updates to artist node",
    `(() => {
      const d = document.querySelector('[data-testid="planet-inspector-details"]')?.textContent || "";
      return d.includes("Nó do Grafo · Artista") || (!d.includes("Hub Semântico · Gênero") && d.includes("escutas"));
    })()`,
    8000
  );

  const inspectorAfterNav = evalInPortal(
    `document.querySelector('[data-testid="planet-inspector-details"]')?.textContent || ""`
  );
  assert.ok(
    inspectorAfterNav.includes("Nó do Grafo · Artista") || !inspectorAfterNav.includes("Hub Semântico · Gênero"),
    "Navigation from genre must open artist details in Inspector"
  );

  // Restore 'Todos' and 'Artistas' mode
  evalInPortal(`(() => {
    const filterGroup = document.querySelector('[aria-label="Filtrar por tipo de nó"]');
    const allFilterBtn = Array.from(filterGroup ? filterGroup.querySelectorAll('button') : document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Todos');
    if (allFilterBtn) allFilterBtn.click();
    const artBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Artistas');
    if (artBtn) artBtn.click();
    return true;
  })()`);
  await waitForCondition(
    "Restored to Artists mode with all visible",
    `document.querySelectorAll('[data-testid^="planet-list-item-"]').length >= 20`
  );
  sleep(500);

  // 11. PROVA E2E DE REGRESSÃO DO ZOOM NO HOVER (C19)
  console.log("Checking E2E hover zoom regression proof (C19)...");
  // 1. Em 'Rede Completa', clique 2 vezes em button[aria-label="Aproximar Zoom"] e aguarde 450ms
  evalInPortal(`(() => {
    const overviewBtn = document.querySelector('button[aria-label="Rede Completa"]') ||
      document.querySelector('button[aria-label="Visão Geral"]') ||
      Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Rede Completa'));
    if (overviewBtn) overviewBtn.click();
    return true;
  })()`);
  sleep(450);

  evalInPortal(`(() => {
    const zoomInBtn = document.querySelector('button[aria-label="Aproximar Zoom"]') ||
      document.querySelector('button[aria-label="Zoom +"]') ||
      Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('Aproximar') || b.textContent?.includes('Zoom +'));
    if (zoomInBtn) {
      zoomInBtn.click();
      zoomInBtn.click();
    }
    return Boolean(zoomInBtn);
  })()`);
  sleep(450);

  // 2. Capture camBefore = window.__BEATCODE_GRAPH_API__.getCameraState()
  const camBefore = evalInPortal(`window.__BEATCODE_GRAPH_API__.getCameraState()`);
  assert.ok(camBefore && Number.isFinite(camBefore.distance), "camBefore must be a valid camera state");

  // 3. Acione hover sequencial em múltiplos nós ('a16', 'a1', 'a4', null) e dispare pointermove/mousemove
  evalInPortal(`(() => {
    const api = window.__BEATCODE_GRAPH_API__;
    const stageCanvas = document.querySelector('[data-testid="beatcode-space-stage"] canvas');

    api.triggerHoverNodeById('a16');
    if (stageCanvas) stageCanvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 200, clientY: 200 }));

    setTimeout(() => {
      api.triggerHoverNodeById('a1');
      if (stageCanvas) stageCanvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 300, clientY: 300 }));
    }, 100);

    setTimeout(() => {
      api.triggerHoverNodeById('a4');
      if (stageCanvas) stageCanvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 400, clientY: 400 }));
    }, 200);

    setTimeout(() => {
      api.triggerHoverNodeById(null);
      if (stageCanvas) stageCanvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 50, clientY: 50 }));
    }, 300);

    return true;
  })()`);
  sleep(450);

  // 4. Capture camAfter = window.__BEATCODE_GRAPH_API__.getCameraState() and prove 100% invariance
  const camAfter = evalInPortal(`window.__BEATCODE_GRAPH_API__.getCameraState()`);
  assert.ok(camAfter && Number.isFinite(camAfter.distance), "camAfter must be a valid camera state");

  assert.ok(
    Math.abs(camAfter.x - camBefore.x) < 1e-6 &&
      Math.abs(camAfter.y - camBefore.y) < 1e-6 &&
      Math.abs(camAfter.z - camBefore.z) < 1e-6 &&
      Math.abs(camAfter.distance - camBefore.distance) < 1e-6,
    `Camera zoom and 3D position must remain 100% unchanged during hover! Before: ${JSON.stringify(camBefore)} After: ${JSON.stringify(camAfter)}`
  );
  console.log("HOVER_ZOOM_STABILITY_VERIFIED:", { camBefore, camAfter });

  // 5. Em seguida, clique em button[aria-label="Visão Geral"] e confirme que o reset explícito funciona
  evalInPortal(`(() => {
    const resetBtn = document.querySelector('button[aria-label="Visão Geral"]') ||
      document.querySelector('button[aria-label="Rede Completa"]') ||
      Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('Rede Completa') || b.textContent?.includes('Rede Completa'));
    if (resetBtn) resetBtn.click();
    return Boolean(resetBtn);
  })()`);
  sleep(500);

  const camReset = evalInPortal(`window.__BEATCODE_GRAPH_API__.getCameraState()`);
  assert.ok(
    Math.abs(camReset.distance - camAfter.distance) > 0.01 || camReset.explorationDepth === "Rede Completa",
    "Explicit reset overview must trigger camera transition"
  );

  // 12. Test Reduced Motion Accessibility & Responsive Viewport (Mobile 390x844 -> Desktop 1440x900)
  evalInPortal(`document.querySelector('button[aria-label="Movimento Reduzido"]')?.click(); true`);
  sleep(200);
  const reducedMotionActive = evalInPortal(`JSON.stringify({
    pressed: document.querySelector('button[aria-label="Movimento Reduzido"]')?.getAttribute('aria-pressed'),
    autoOrbitDisabled: (document.querySelector('button[aria-label="Rotação 360°"]') || document.querySelector('button[aria-label="Auto-Órbita"]'))?.disabled
  })`);
  assert.equal(reducedMotionActive.pressed, "true", "Movimento Reduzido toggle must set aria-pressed='true'");
  assert.equal(reducedMotionActive.autoOrbitDisabled, true, "Rotação 360° must be disabled when Movimento Reduzido is active");
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

  // Restore 1440x900 desktop viewport
  runPortal(["resize", PORTAL_NAME, "1440", "900"]);
  sleep(400);

  // 13. Collect Performance & Memory Telemetry and Check Console Logs
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
    "E2E_BROWSER_VERIFIED: All proofs C15, C16, C18, C19 verified in live browser portal"
  );
}

main().catch((err) => {
  console.error("E2E_BROWSER_FAILED:", err);
  process.exit(1);
});
