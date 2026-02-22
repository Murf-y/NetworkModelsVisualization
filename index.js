/* ==============================================
   NETLAB — Network Simulator
   Graph generation, metrics, UI control
   ============================================== */

const GraphType = {
  ERDOS_RENYI: "erdos-renyi",
  BARABASI_ALBERT: "barabasi-albert",
  WATTS_STROGATZ: "watts-strogatz",
};

const MODEL_NAMES = {
  [GraphType.ERDOS_RENYI]: "Erdős–Rényi",
  [GraphType.BARABASI_ALBERT]: "Barabási–Albert",
  [GraphType.WATTS_STROGATZ]: "Watts–Strogatz",
};

// ── Chart.js Global Defaults ──
Chart.defaults.color = "#8888a0";
Chart.defaults.borderColor = "rgba(255, 255, 255, 0.05)";
Chart.defaults.font.family = "'JetBrains Mono', monospace";
Chart.defaults.font.size = 9;

// ── Utilities ──
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function updateSliderProgress(input) {
  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty("--progress", pct + "%");
}

// ══════════════════════════════════════════════
//  Visualizer — graph engine
// ══════════════════════════════════════════════
class Visualizer {
  constructor(graphType) {
    this.graphType = graphType;
    this.panel = new PanelManager(graphType, (gt) => this.updateGraphType(gt));

    cytoscape.use(cytoscapeCola);
    this.panel.updateMetrics(this.initializeGraph());
  }

  updateGraphType(graphType) {
    this.graphType = graphType;
    if (this.cy) this.cy.destroy();
    this.initializeGraph();
    this.panel.updateMetrics(this.cy);
  }

  initializeGraph() {
    this.cy = cytoscape({
      container: document.getElementById("cy"),
      elements: this.createGraph(),

      style: [
        {
          selector: "node",
          style: {
            "background-color": "#44cc38",
            "border-width": 0,
            label: "data(id)",
            "font-family": "'JetBrains Mono', monospace",
            "font-size": 5,
            color: "rgba(224, 224, 240, 0.45)",
            "text-margin-y": -6,
            "text-halign": "center",
            "text-valign": "top",
            width: 8,
            height: 8,
            "transition-property": "opacity, background-color, width, height",
            "transition-duration": "0.15s",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "rgba(46, 144, 37, 0.1)",
            "curve-style": "bezier",
            "transition-property": "opacity, line-color, width",
            "transition-duration": "0.15s",
          },
        },
        {
          selector: ".faded",
          style: { opacity: 0.06 },
        },
        {
          selector: ".highlight-node",
          style: {
            "background-color": "#ff2d6f",
            width: 14,
            height: 14,
            "font-size": 7,
            color: "rgba(255, 255, 255, 0.8)",
          },
        },
        {
          selector: ".highlight-neighbor",
          style: {
            "background-color": "#44cc38",
            width: 10,
            height: 10,
          },
        },
        {
          selector: ".highlight-edge",
          style: {
            "line-color": "rgba(46, 144, 37, 0.55)",
            width: 2,
          },
        },
      ],

      layout: {
        name: "cola",
        nodeSpacing: 20,
        animate: false,
        maxSimulationTime: 1500,
      },

      minZoom: 0.3,
      maxZoom: 3,
    });

    // ── Hover interactions ──
    this.cy.on("mouseover", "node", (e) => {
      const node = e.target;
      const hood = node.neighborhood().add(node);

      this.cy.elements().addClass("faded");
      hood.removeClass("faded");
      node.addClass("highlight-node");
      hood.nodes().not(node).addClass("highlight-neighbor");
      hood.edges().addClass("highlight-edge");
    });

    this.cy.on("mouseout", "node", () => {
      this.cy
        .elements()
        .removeClass("faded highlight-node highlight-neighbor highlight-edge");
    });

    this.cy.on("tap", (e) => {
      if (e.target === this.cy) {
        this.cy
          .elements()
          .removeClass(
            "faded highlight-node highlight-neighbor highlight-edge",
          );
      }
    });

    // ── Compute degree data ──
    const degrees = {};
    this.cy.nodes().forEach((node) => {
      let d = 0;
      node.neighborhood().forEach((nb) => {
        if (nb._private.group === "nodes") d++;
      });
      degrees[node.id()] = d;
    });

    const maxDegree = Math.max(0, ...Object.values(degrees));

    const degreeData = Array.from({ length: maxDegree + 1 }, (_, i) => ({
      degree: i,
      count: 0,
    }));
    Object.values(degrees).forEach((d) => {
      if (degreeData[d]) degreeData[d].count++;
    });

    // ── Clustering coefficients ──
    const clusterCoeffs = [];
    this.cy.nodes().forEach((node) => {
      const neighbors = node.neighborhood();
      const degree = node.degree();

      if (degree < 2) {
        clusterCoeffs.push(0);
        return;
      }

      let edgesBetween = 0;
      neighbors.forEach((nb) => {
        if (nb._private.group === "nodes") {
          nb.neighborhood().forEach((nnb) => {
            if (
              nnb._private.group === "nodes" &&
              nnb.id() !== node.id() &&
              neighbors.has(nnb)
            ) {
              edgesBetween++;
            }
          });
        }
      });

      clusterCoeffs.push((2 * edgesBetween) / (degree * (degree - 1)));
    });

    const freqMap = {};
    clusterCoeffs.forEach((v) => {
      freqMap[v] = (freqMap[v] || 0) + 1;
    });

    const uniqueVals = Object.keys(freqMap)
      .map(parseFloat)
      .sort((a, b) => a - b);
    const frequencies = uniqueVals.map((v) => freqMap[v]);

    // ── Render charts ──
    this.renderCharts(degreeData, uniqueVals, frequencies);

    // ── Scale nodes by degree ──
    if (this.panel.shouldScaleNodes && maxDegree > 0) {
      this.cy.nodes().forEach((node) => {
        const d = degrees[node.id()] || 0;
        const size = 5 + 18 * (d / maxDegree);
        node.style({ width: size, height: size });
      });
    }

    return this.cy;
  }

  renderCharts(degreeData, uniqueVals, frequencies) {
    if (this.lineChart) this.lineChart.destroy();
    if (this.barChart) this.barChart.destroy();
    if (this.clusterChart) this.clusterChart.destroy();

    const chartOpts = (xLabel, yLabel) => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          title: { display: true, text: xLabel, font: { size: 8 } },
          grid: { color: "rgba(255,255,255,0.03)" },
          ticks: { font: { size: 7 } },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: yLabel, font: { size: 8 } },
          grid: { color: "rgba(255,255,255,0.03)" },
          ticks: { font: { size: 7 } },
        },
      },
    });

    this.lineChart = new Chart(
      document.getElementById("degree-distribution-line"),
      {
        type: "line",
        data: {
          labels: degreeData.map((d) => d.degree),
          datasets: [
            {
              data: degreeData.map((d) => d.count),
              borderColor: "#44cc38",
              backgroundColor: "rgba(46, 144, 37, 0.08)",
              borderWidth: 1.5,
              pointRadius: 2,
              pointBackgroundColor: "#2e9025",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: chartOpts("Degree", "Count"),
      },
    );

    this.barChart = new Chart(
      document.getElementById("degree-distribution-bar"),
      {
        type: "bar",
        data: {
          labels: degreeData.map((d) => d.degree),
          datasets: [
            {
              data: degreeData.map((d) => d.count),
              backgroundColor: "rgba(46, 144, 37, 0.4)",
              borderColor: "rgba(46, 144, 37, 0.7)",
              borderWidth: 1,
              borderRadius: 2,
            },
          ],
        },
        options: chartOpts("Degree", "Count"),
      },
    );

    this.clusterChart = new Chart(
      document.getElementById("clustering-coefficient-chart"),
      {
        type: "line",
        data: {
          labels: uniqueVals.map((v) => v.toFixed(2)),
          datasets: [
            {
              data: frequencies,
              borderColor: "#ff2d6f",
              backgroundColor: "rgba(255, 45, 111, 0.08)",
              borderWidth: 1.5,
              pointRadius: 2,
              pointBackgroundColor: "#ff2d6f",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: chartOpts("Clustering Coeff.", "Count"),
      },
    );
  }

  // ── Graph generators ──

  createGraph() {
    switch (this.graphType) {
      case GraphType.ERDOS_RENYI:
        return this.createErdosRenyiGraph();
      case GraphType.BARABASI_ALBERT:
        return this.createBarabasiAlbertGraph();
      case GraphType.WATTS_STROGATZ:
        return this.createWattsStrogatzGraph();
    }
  }

  createErdosRenyiGraph() {
    const N = this.panel.getN();
    const p = this.panel.getP();

    const nodes = Array.from({ length: N }, (_, i) => ({
      group: "nodes",
      data: { id: i },
    }));

    const edges = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (Math.random() <= p)
          edges.push({ group: "edges", data: { source: i, target: j } });
      }
    }

    return nodes.concat(edges);
  }

  createBarabasiAlbertGraph() {
    const N = this.panel.getN();
    let m0 = this.panel.getM0();
    let m = this.panel.getM();

    // Clamp silently
    if (m0 >= N) m0 = N - 1;
    if (m > m0) m = m0;

    const nodes = Array.from({ length: m0 }, (_, i) => ({
      group: "nodes",
      data: { id: i },
    }));

    const edges = [];
    const degrees = new Array(N).fill(0);

    // Complete graph among initial nodes
    for (let i = 0; i < m0; i++) {
      for (let j = i + 1; j < m0; j++) {
        edges.push({ group: "edges", data: { source: i, target: j } });
        degrees[i]++;
        degrees[j]++;
      }
    }

    // Preferential attachment
    for (let i = m0; i < N; i++) {
      const sum = degrees.reduce((a, b) => a + b, 0);
      for (let j = 0; j < m; j++) {
        const r = Math.random();
        let acc = 0;
        for (let k = 0; k < i; k++) {
          acc += degrees[k] / sum;
          if (r < acc) {
            edges.push({ group: "edges", data: { source: i, target: k } });
            degrees[i]++;
            degrees[k]++;
            break;
          }
        }
      }
      nodes.push({ group: "nodes", data: { id: i } });
    }

    return nodes.concat(edges);
  }

  createWattsStrogatzGraph() {
    const N = this.panel.getN();
    const k = this.panel.getK();
    const p = this.panel.getPWatts();

    const nodes = Array.from({ length: N }, (_, i) => ({
      group: "nodes",
      data: { id: i },
    }));

    const edges = [];

    // Ring lattice
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < i + k / 2 + 1; j++) {
        const target = j % N;
        if (i !== target)
          edges.push({ group: "edges", data: { source: i, target } });
      }
    }

    // Rewiring
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < i + k / 2 + 1; j++) {
        if (Math.random() < p) {
          let newTarget = Math.floor(Math.random() * N);
          if (newTarget === i) newTarget = (newTarget + 1) % N;
          edges.push({
            group: "edges",
            data: { source: i, target: newTarget },
          });
        }
      }
    }

    return nodes.concat(edges);
  }
}

// ══════════════════════════════════════════════
//  PanelManager — UI controls & events
// ══════════════════════════════════════════════
class PanelManager {
  constructor(graphType, onUpdate) {
    this.graphType = graphType;
    this.shouldScaleNodes = true;
    this.onUpdate = onUpdate;

    // ── DOM references ──
    this.els = {
      n: document.getElementById("n"),
      p: document.getElementById("p"),
      m0: document.getElementById("m0"),
      m: document.getElementById("m"),
      k: document.getElementById("k"),
      pWatts: document.getElementById("p-watts"),
    };

    this.outputs = {
      n: document.getElementById("n-val"),
      p: document.getElementById("p-val"),
      m0: document.getElementById("m0-val"),
      m: document.getElementById("m-val"),
      k: document.getElementById("k-val"),
      pWatts: document.getElementById("pw-val"),
    };

    this.paramSections = {
      [GraphType.ERDOS_RENYI]: document.getElementById("er-params"),
      [GraphType.BARABASI_ALBERT]: document.getElementById("ba-params"),
      [GraphType.WATTS_STROGATZ]: document.getElementById("ws-params"),
    };

    this.modelNameEl = document.getElementById("model-name");
    this.chartsContainer = document.getElementById("charts");
    this.regenBtn = document.getElementById("regenerate");

    // ── Initialize slider progress fills ──
    Object.values(this.els).forEach(updateSliderProgress);

    // ── Debounced graph update (for slider dragging) ──
    const debouncedUpdate = debounce(() => this.onUpdate(this.graphType), 120);

    // ── Slider events ──
    const sliderPairs = [
      [this.els.n, this.outputs.n, (v) => v],
      [this.els.p, this.outputs.p, (v) => parseFloat(v).toFixed(2)],
      [this.els.m0, this.outputs.m0, (v) => v],
      [this.els.m, this.outputs.m, (v) => v],
      [this.els.k, this.outputs.k, (v) => v],
      [this.els.pWatts, this.outputs.pWatts, (v) => parseFloat(v).toFixed(2)],
    ];

    sliderPairs.forEach(([input, output, fmt]) => {
      input.addEventListener("input", () => {
        output.textContent = fmt(input.value);
        updateSliderProgress(input);
        debouncedUpdate();
      });
    });

    // ── Model tabs ──
    document.getElementById("model-tabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".tab");
      if (!tab) return;
      this.selectModel(tab.dataset.model);
    });

    // ── Toggles ──
    document
      .getElementById("degree-distribution-switch")
      .addEventListener("change", (e) => {
        this.chartsContainer.style.display = e.target.checked ? "flex" : "none";
      });

    document
      .getElementById("node-size-switch")
      .addEventListener("change", (e) => {
        this.shouldScaleNodes = e.target.checked;
        this.onUpdate(this.graphType);
      });

    // ── Regenerate button ──
    this.regenBtn.addEventListener("click", () => this.triggerRegen());

    // ── Keyboard shortcuts ──
    document.addEventListener("keydown", (e) => {
      // Don't capture when typing in inputs
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          this.triggerRegen();
          break;
        case "Digit1":
          this.selectModel(GraphType.ERDOS_RENYI);
          break;
        case "Digit2":
          this.selectModel(GraphType.BARABASI_ALBERT);
          break;
        case "Digit3":
          this.selectModel(GraphType.WATTS_STROGATZ);
          break;
      }
    });

    // ── Mobile panel toggle ──
    const panelToggle = document.getElementById("panel-toggle");
    const panel = document.getElementById("panel");

    panelToggle.addEventListener("click", () => {
      panel.classList.toggle("open");
    });

    document.getElementById("canvas-area").addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        panel.classList.remove("open");
      }
    });

    // ── Initial state ──
    this.updateParamVisibility();
  }

  selectModel(model) {
    if (model === this.graphType) return;
    this.graphType = model;
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.toggle("active", t.dataset.model === model));
    this.modelNameEl.textContent = MODEL_NAMES[model];
    this.updateParamVisibility();
    this.onUpdate(model);
  }

  triggerRegen() {
    this.regenBtn.classList.remove("pulse");
    void this.regenBtn.offsetWidth; // force reflow for re-triggering animation
    this.regenBtn.classList.add("pulse");
    this.onUpdate(this.graphType);
  }

  updateParamVisibility() {
    Object.entries(this.paramSections).forEach(([type, el]) => {
      el.hidden = type !== this.graphType;
    });
  }

  // ── Metrics calculation ──
  updateMetrics(cyInstance) {
    const nodes = cyInstance.nodes();
    const numNodes = nodes.length;
    const numEdges = cyInstance.edges().length;
    const avgDegree = numNodes > 0 ? (2 * numEdges) / numNodes : 0;
    const density =
      numNodes > 1 ? (2 * numEdges) / (numNodes * (numNodes - 1)) : 0;

    // Per-node degrees
    const degrees = {};
    nodes.forEach((node) => {
      let d = 0;
      node.neighborhood().forEach((nb) => {
        if (nb._private.group === "nodes") d++;
      });
      degrees[node.id()] = d;
    });
    const maxDeg = Math.max(0, ...Object.values(degrees));

    // Average clustering coefficient
    let clusterSum = 0;
    nodes.forEach((node) => {
      const neighbors = node.neighborhood();
      const degree = node.degree();
      if (degree < 2) return;

      let edgesBetween = 0;
      neighbors.forEach((nb) => {
        if (nb._private.group === "nodes") {
          nb.neighborhood().forEach((nnb) => {
            if (
              nnb._private.group === "nodes" &&
              nnb.id() !== node.id() &&
              neighbors.has(nnb)
            ) {
              edgesBetween++;
            }
          });
        }
      });
      clusterSum += (2 * edgesBetween) / (degree * (degree - 1));
    });

    if (isNaN(clusterSum)) clusterSum = 0;
    const avgClustering = numNodes > 0 ? clusterSum / numNodes : 0;

    // Average path length
    const dists = [];
    nodes.forEach((node) => {
      cyInstance.elements().bfs({
        roots: node,
        visit: (v, e, u, i, depth) => {
          if (depth > 0) dists.push(depth);
        },
      });
    });

    const avgPath =
      numNodes > 1
        ? (dists.reduce((a, b) => a + b, 0) / numNodes) * (numNodes - 1)
        : 0;

    // Update DOM
    document.getElementById("nodes-value").textContent = numNodes;
    document.getElementById("edges-value").textContent = numEdges;
    document.getElementById("avg-degree-value").textContent =
      avgDegree.toFixed(2);
    document.getElementById("density-value").textContent = density.toFixed(2);
    document.getElementById("max-degree-value").textContent = maxDeg;
    document.getElementById("avg-clustering-coefficient-value").textContent =
      isNaN(avgClustering) ? "0.00" : avgClustering.toFixed(2);
    document.getElementById("avg-path-length-value").textContent = isNaN(
      avgPath,
    )
      ? "0.00"
      : avgPath.toFixed(2);
  }

  // ── Getters ──
  getN() {
    return parseInt(this.els.n.value);
  }
  getP() {
    return parseFloat(this.els.p.value);
  }
  getM0() {
    return parseInt(this.els.m0.value);
  }
  getM() {
    return parseInt(this.els.m.value);
  }
  getK() {
    return parseInt(this.els.k.value);
  }
  getPWatts() {
    return parseFloat(this.els.pWatts.value);
  }
}

// ── Boot ──
const visualizer = new Visualizer(GraphType.ERDOS_RENYI);
