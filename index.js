// get initial N and p values
const nInput = document.getElementById("n");
const pInput = document.getElementById("p");
const mInput = document.getElementById("m");
const m0Input = document.getElementById("m0");

// create enum for graph types
const GraphType = {
  ERDOS_RENYI: "erdos_renyi",
  BARABASI_ALBERT: "barabasi_albert",
};

let currentGraphType = GraphType.ERDOS_RENYI;
updateParametersSection();

// on change of graph type, update the graph
const graphTypeSelect = document.getElementById("model-select");
graphTypeSelect.addEventListener("change", (event) => {
  const newGraphType = event.target.value;
  if (newGraphType !== currentGraphType) {
    currentGraphType = newGraphType;
    updateParametersSection();
    updateGraph();
  }
});

function updateParametersSection() {
  if (currentGraphType === GraphType.ERDOS_RENYI) {
    document.getElementById("erdos-renyi-parameters").style.display = "flex";
    document.getElementById("barabasi-albert-parameters").style.display =
      "none";
  } else {
    document.getElementById("erdos-renyi-parameters").style.display = "none";
    document.getElementById("barabasi-albert-parameters").style.display =
      "flex";
  }
}

function createGraph() {
  if (currentGraphType === GraphType.ERDOS_RENYI) {
    return createErdosRenyiGraph();
  } else {
    return createBarabasiAlbertGraph();
  }
}

function updateMetrics() {
  const nodes = cy.nodes().length;
  const edges = cy.edges().length;
  const avgDegree = (2 * edges) / nodes;
  const maxDegree = cy.nodes().reduce((acc, node) => {
    const degree = node.degree();
    return degree > acc ? degree : acc;
  }, 0);

  document.getElementById("nodes-value").innerText = nodes;
  document.getElementById("edges-value").innerText = edges;
  document.getElementById("avg-degree-value").innerText = avgDegree.toFixed(2);
  document.getElementById("max-degree-value").innerText = maxDegree;
}

function createErdosRenyiGraph() {
  const N = parseInt(nInput.value);
  const p = parseFloat(pInput.value);
  const edges = [];

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (Math.random() < p) {
        edges.push({ group: "edges", data: { source: i, target: j } });
      }
    }
  }

  const nodes = Array.from({ length: N }, (_, i) => ({
    group: "nodes",
    data: { id: i },
  }));

  const elements = nodes.concat(edges);

  return elements;
}

function createBarabasiAlbertGraph() {
  const N = parseInt(nInput.value);
  const m0 = parseInt(m0Input.value);
  const m = parseInt(mInput.value);

  const nodes = Array.from({ length: m0 }, (_, i) => ({
    group: "nodes",
    data: { id: i },
  }));

  const edges = [];

  for (let i = 0; i < m0; i++) {
    for (let j = i + 1; j < m0; j++) {
      edges.push({ group: "edges", data: { source: i, target: j } });
    }
  }

  for (let i = m0; i < N; i++) {
    const newEdges = [];
    const degrees = new Map();

    for (let j = 0; j < i; j++) {
      const degree = cy.$(`node[id="${j}"]`).degree();
      degrees.set(j, degree);
    }

    const sum = Array.from(degrees.values()).reduce((a, b) => a + b, 0);

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

  const elements = nodes.concat(edges);

  return elements;
}

cytoscape.use(cytoscapeCola);
const cy = cytoscape({
  container: document.getElementById("cy"), // container to render in

  elements: createGraph(),

  style: [
    // the stylesheet for the graph
    {
      selector: "node",
      style: {
        "background-color": "#7888ff",
        label: "data(id)",
        "font-family": "Roboto",
        "font-size": 8,
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

nInput.addEventListener("input", updateGraphNodes);
pInput.addEventListener("input", updateGraphEdgesBasedOnP);
mInput.addEventListener("input", updateGraphNodes);
m0Input.addEventListener("input", updateGraphNodes);

updateMetrics();
