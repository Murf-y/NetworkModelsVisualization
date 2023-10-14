const GraphType = {
  ERDOS_RENYI: "erdos-renyi",
  BARABASI_ALBERT: "barabasi-albert",
};

class Visualizer {
  constructor(graphType) {
    this.graphType = graphType;
    // for the layout
    this.sideBarManager = new SideBarManager(graphType, (graphType) => {
      this.updateGraphType(graphType);
    });

    cytoscape.use(cytoscapeCola);
    this.initializeGraph();
    this.sideBarManager.updateMetrics(this.cy);
  }

  updateGraphType(graphType) {
    this.graphType = graphType;
    // delete the old cy instance
    this.cy.destroy();
    this.initializeGraph();
    this.sideBarManager.changeGraphType(graphType);
    this.sideBarManager.updateMetrics(this.cy);
  }

  initializeGraph() {
    this.cy = cytoscape({
      container: document.getElementById("cy"),
      elements: this.creataGraph(),

      style: [
        // the stylesheet for the graph
        {
          selector: "node",
          style: {
            "background-color": "#7888ff",
            label: "data(id)",
            "font-family": "Roboto",
            "font-size": 6,
          },
        },

        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#bfe0ff",
          },
        },
      ],

      layout: {
        name: "cola",
        nodeSpacing: 20,
      },

      minZoom: 0.4,
      maxZoom: 2,
    });
  }

  creataGraph() {
    if (this.graphType === GraphType.ERDOS_RENYI) {
      return this.createErdosRenyiGraph();
    } else {
      return this.createBarabasiAlbertGraph();
    }
  }

  createErdosRenyiGraph() {
    const N = this.sideBarManager.getN();
    const p = this.sideBarManager.getP();

    console.log("Creating graph with N = ", N, " and p = ", p);
    const edges = [];

    const nodes = Array.from({ length: N }, (_, i) => ({
      group: "nodes",
      data: { id: i },
    }));

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (Math.random() <= p) {
          edges.push({ group: "edges", data: { source: i, target: j } });
        }
      }
    }

    const elements = nodes.concat(edges);

    return elements;
  }

  createBarabasiAlbertGraph() {
    const N = this.sideBarManager.getN();
    const m0 = this.sideBarManager.getM0();
    const m = this.sideBarManager.getM();

    console.log(
      "Creating graph with N = ",
      N,
      " and m0 = ",
      m0,
      " and m = ",
      m
    );

    const nodes = Array.from({ length: m0 }, (_, i) => ({
      group: "nodes",
      data: { id: i },
    }));

    const edges = [];
    const degrees = new Array(N).fill(0); // Initialize the degree array.

    for (let i = 0; i < m0; i++) {
      for (let j = i + 1; j < m0; j++) {
        edges.push({ group: "edges", data: { source: i, target: j } });
        degrees[i] += 1; // Update the degree for node i.
        degrees[j] += 1; // Update the degree for node j.
      }
    }

    for (let i = m0; i < N; i++) {
      const newEdges = [];
      const sum = degrees.reduce((a, b) => a + b, 0);

      for (let j = 0; j < m; j++) {
        const r = Math.random();
        let acc = 0;

        for (let k = 0; k < i; k++) {
          acc += degrees[k] / sum;

          if (r < acc) {
            newEdges.push({ group: "edges", data: { source: i, target: k } });
            degrees[i] += 1;
            degrees[k] += 1;
            break;
          }
        }
      }

      nodes.push({ group: "nodes", data: { id: i } });
      edges.push(...newEdges);
    }

    const elements = nodes.concat(edges);

    return elements;
  }
}

class SideBarManager {
  constructor(graphType, updateParentCallback) {
    this.graphType = graphType;
    this.updateParentCallback = updateParentCallback;
    this.nInput = document.getElementById("n");
    this.pInput = document.getElementById("p");
    this.mInput = document.getElementById("m");
    this.m0Input = document.getElementById("m0");
    this.graphTypeSelect = document.getElementById("model-select");

    this.nInput.addEventListener("change", () => {
      this.updateParentCallback(this.graphType);
    });

    this.graphTypeSelect.addEventListener("change", (event) => {
      const newGraphType = event.target.value;
      if (newGraphType !== this.graphType) {
        this.graphType = newGraphType;
        this.updateParametersSection();
        this.updateParentCallback(this.graphType);
      }
    });

    this.updateParametersSection();
  }

  changeGraphType(graphType) {
    // Requires the caller to update the metrics
    this.graphType = graphType;
    this.updateParametersSection();
  }

  updateParametersSection() {
    if (this.graphType === GraphType.ERDOS_RENYI) {
      document.getElementById("erdos-renyi-parameters").style.display = "flex";
      document.getElementById("barabasi-albert-parameters").style.display =
        "none";
    } else {
      document.getElementById("erdos-renyi-parameters").style.display = "none";
      document.getElementById("barabasi-albert-parameters").style.display =
        "flex";
    }
  }

  updateMetrics(cyInstance) {
    const nodes = cyInstance.nodes().length;
    const edges = cyInstance.edges().length;
    const avgDegree = (2 * edges) / nodes;
    let maxDegree = 0;

    for (let i = 0; i < nodes; i++) {
      const degree = cyInstance.$(`node[id="${i}"]`).degree();
      if (degree > maxDegree) {
        maxDegree = degree;
      }
    }

    document.getElementById("nodes-value").innerText = nodes;
    document.getElementById("edges-value").innerText = edges;
    document.getElementById("avg-degree-value").innerText =
      avgDegree.toFixed(2);
    document.getElementById("max-degree-value").innerText = maxDegree;
  }

  getN() {
    return parseInt(this.nInput.value);
  }

  getP() {
    return parseFloat(this.pInput.value);
  }

  getM() {
    return parseInt(this.mInput.value);
  }

  getM0() {
    return parseInt(this.m0Input.value);
  }
}

function updateGraphNodes() {
  const oldN = cy.nodes().length;
  const newN = parseInt(nInput.value);

  if (newN > oldN) {
    const nodes = Array.from({ length: newN - oldN }, (_, i) => ({
      group: "nodes",
      data: { id: oldN + i },
    }));

    cy.add(nodes);

    // add edges

    if (currentGraphType === GraphType.BARABASI_ALBERT) {
      const m0 = parseInt(m0Input.value);
      const m = parseInt(mInput.value);

      const newEdges = [];
      const degrees = new Map();

      for (let j = 0; j < oldN; j++) {
        const degree = cy.$(`node[id="${j}"]`).degree();
        degrees.set(j, degree);
      }

      const sum = Array.from(degrees.values()).reduce((a, b) => a + b, 0);

      for (let i = oldN; i < newN; i++) {
        const newEdges = [];

        for (let j = 0; j < m; j++) {
          const r = Math.random();
          let acc = 0;

          for (let k = 0; k < i; k++) {
            acc += degrees.get(k) / sum;

            if (r < acc) {
              newEdges.push({ group: "edges", data: { source: i, target: k } });
              break;
            }
          }
        }

        nodes.push({ group: "nodes", data: { id: i } });
        edges.push(...newEdges);
      }

      cy.add(newEdges);
    } else {
      const p = parseFloat(pInput.value);
      const edges = [];

      for (let i = 0; i < newN; i++) {
        for (let j = i + 1; j < newN; j++) {
          if (Math.random() < p) {
            edges.push({ group: "edges", data: { source: i, target: j } });
          }
        }
      }
      cy.add(edges);
    }
  } else {
    const nodes = cy.nodes().slice(newN);
    cy.remove(nodes);
  }

  const layout = cy.layout({
    name: "cola",
    nodeSpacing: 20,
  });

  layout.run();

  updateMetrics();
}

function updateGraphEdgesBasedOnP() {
  const p = parseFloat(pInput.value);
  const nodes = cy.nodes().length;

  // go through all edges and remove them
  const edges = cy.edges();
  cy.remove(edges);

  // add new edges
  const newEdges = [];

  for (let i = 0; i < nodes; i++) {
    for (let j = i + 1; j < nodes; j++) {
      if (Math.random() < p) {
        newEdges.push({ group: "edges", data: { source: i, target: j } });
      }
    }
  }

  cy.add(newEdges);
  const layout = cy.layout({
    name: "cola",
    nodeSpacing: 20,
  });

  layout.run();

  updateMetrics();
}

const visualizer = new Visualizer(GraphType.ERDOS_RENYI);
