const GraphType = {
  ERDOS_RENYI: "erdos-renyi",
  BARABASI_ALBERT: "barabasi-albert",
  WATTS_STROGATZ: "watts-strogatz",
};

class Visualizer {
  constructor(graphType) {
    this.graphType = graphType;
    // for the layout
    this.sideBarManager = new SideBarManager(graphType, (graphType) => {
      this.updateGraphType(graphType);
    });

    cytoscape.use(cytoscapeCola);
    this.sideBarManager.updateMetrics(this.initializeGraph());
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

        {
          selector: ".faded",
          style: {
            opacity: 0.25,
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

    this.cy.on("mouseover", "node", (event) => {
      const node = event.target;
      const neighborhood = node.neighborhood().add(node);

      this.cy.elements().addClass("faded");
      neighborhood.removeClass("faded");
    });

    this.cy.on("mouseout", "node", (event) => {
      const node = event.target;
      const neighborhood = node.neighborhood().add(node);

      this.cy.elements().removeClass("faded");
      neighborhood.removeClass("faded");
    });

    this.cy.on("tap", (event) => {
      if (event.target === this.cy) {
        this.cy.elements().removeClass("faded");
      }
    });

    const degrees = {};
    this.cy.nodes().forEach((node) => {
      const neighbors = node.neighborhood();
      for (let i = 0; i < neighbors.length; i++) {
        if (neighbors[i]._private.group === "nodes") {
          if (degrees[node.id()]) {
            degrees[node.id()] += 1;
          } else {
            degrees[node.id()] = 1;
          }
        }
      }
    });
    const maxDegree = Math.max(...Object.values(degrees));

    const degreeData = Array.from({ length: maxDegree + 1 }, (_, i) => ({
      degree: i,
      count: 0,
    }));

    Object.values(degrees).forEach((degree) => {
      degreeData[degree].count += 1;
    });

    const clusteringCoefficients = [];
    this.cy.nodes().forEach((node) => {
      // neighbors will contain node neighbors of i + the edge between them
      const neighbors = node.neighborhood();
      const degree = node.degree();

      if (degree < 2) {
        clusteringCoefficients.push(0);
        return;
      }

      let edgesBetweenNeighbors = 0;

      neighbors.forEach((neighbor) => {
        if (neighbor._private.group === "nodes") {
          const neighborNeighbors = neighbor.neighborhood();
          neighborNeighbors.forEach((neighborNeighbor) => {
            if (neighborNeighbor._private.group === "nodes") {
              if (neighborNeighbor.id() !== node.id()) {
                if (neighbors.has(neighborNeighbor)) {
                  edgesBetweenNeighbors += 1;
                }
              }
            }
          });
        }
      });

      clusteringCoefficients.push(
        (2 * edgesBetweenNeighbors) / (degree * (degree - 1))
      );
    });

    const frequencyMap = {};
    clusteringCoefficients.forEach((value) => {
      if (frequencyMap[value]) {
        frequencyMap[value] += 1;
      } else {
        frequencyMap[value] = 1;
      }
    });

    // Sort the unique values
    const uniqueValues = Object.keys(frequencyMap)
      .map(parseFloat)
      .sort((a, b) => a - b);
    const frequencies = uniqueValues.map((value) => frequencyMap[value]);

    const lineChartCanvas = document.getElementById("degree-distribution-line");
    const barChartCanvas = document.getElementById("degree-distribution-bar");
    const clusteringCoefficientCanvas = document.getElementById(
      "clustering-coefficient-chart"
    );

    if (this.linechart) {
      this.linechart.destroy();
    }

    if (this.barChart) {
      this.barChart.destroy();
    }

    if (this.clusteringCoefficientChart) {
      this.clusteringCoefficientChart.destroy();
    }

    this.linechart = new Chart(lineChartCanvas, {
      type: "line",
      data: {
        labels: degreeData.map((data) => data.degree),
        datasets: [
          {
            label: "Degree Distribution",
            data: degreeData.map((data) => data.count),
            backgroundColor: "rgba(252, 73, 111, 0.7)",
            borderColor: "rgba(252, 73, 111, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          x: {
            title: {
              display: true,
              text: "Degree",
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Frequency",
            },
          },
        },
      },
    });
    this.barChart = new Chart(barChartCanvas, {
      type: "bar",
      data: {
        labels: degreeData.map((data) => data.degree),
        datasets: [
          {
            label: "Degree Distribution",
            data: degreeData.map((data) => data.count),
            backgroundColor: "rgba(75, 192, 192, 1)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          x: {
            title: {
              display: true,
              text: "Degree",
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Frequency",
            },
          },
        },
      },
    });

    this.clusteringCoefficientChart = new Chart(clusteringCoefficientCanvas, {
      type: "line",
      data: {
        labels: uniqueValues.map((value) => value.toFixed(2)), // Format as desired
        datasets: [
          {
            label: "Frequency",
            data: frequencies,
            backgroundColor: "rgb(255,159,64)",
            borderColor: "rgb(255,159,64)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Frequency",
            },
          },
          x: {
            title: {
              display: true,
              text: "Clustering Coefficient",
            },
          },
        },
      },
    });

    if (this.sideBarManager.shouldScaleNodes) {
      // scale each node based on its degree
      const nodes = this.cy.nodes();
      const minSize = 5;
      const maxSize = 20;
      nodes.forEach((node) => {
        const degree = node.degree();
        const scale = minSize + (maxSize - minSize) * (degree / maxDegree);

        node.style({
          width: scale,
          height: scale,
        });
      });
    }

    return this.cy;
  }

  creataGraph() {
    if (this.graphType === GraphType.ERDOS_RENYI) {
      return this.createErdosRenyiGraph();
    } else if (this.graphType === GraphType.BARABASI_ALBERT) {
      return this.createBarabasiAlbertGraph();
    } else {
      return this.createWattsStrogatzGraph();
    }
  }

  createErdosRenyiGraph() {
    const N = this.sideBarManager.getN();
    const p = this.sideBarManager.getP();

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

    // make sure that m0 is smaller than N
    if (m0 >= N) {
      alert("m0 must be smaller than N");
      return;
    }

    if (m > m0) {
      alert("m must be smaller than m0");
      return;
    }

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

  createWattsStrogatzGraph() {
    const N = this.sideBarManager.getN();
    const k = this.sideBarManager.getK();
    const p = this.sideBarManager.getPWatts();

    const nodes = Array.from({ length: N }, (_, i) => ({
      group: "nodes",
      data: { id: i },
    }));

    const edges = [];

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < i + k / 2 + 1; j++) {
        const target = j % N;
        if (i !== target) {
          edges.push({ group: "edges", data: { source: i, target: target } });
        }
      }
    }

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < i + k / 2 + 1; j++) {
        if (Math.random() < p) {
          let newTarget = Math.floor(Math.random() * N);

          if (newTarget === i) {
            newTarget = (newTarget + 1) % N;
          }

          edges.push({
            group: "edges",
            data: { source: i, target: newTarget },
          });
        }
      }
    }

    const elements = nodes.concat(edges);

    return elements;
  }
}

class SideBarManager {
  constructor(graphType, updateParentCallback) {
    this.graphType = graphType;
    this.shouldScaleNodes = true;
    this.updateParentCallback = updateParentCallback;
    this.nInput = document.getElementById("n");
    this.pInput = document.getElementById("p");
    this.mInput = document.getElementById("m");
    this.m0Input = document.getElementById("m0");
    this.kInput = document.getElementById("k");
    this.pWattsInput = document.getElementById("p-watts");

    this.graphTypeSelect = document.getElementById("model-select");
    this.degreeDistributionSwitch = document.getElementById(
      "degree-distribution-switch"
    );
    this.nodeSizeSwitch = document.getElementById("node-size-switch");

    this.nInput.addEventListener("change", () => {
      this.updateParentCallback(this.graphType);
    });
    this.pInput.addEventListener("change", () => {
      if (this.pInput.value > 1) {
        this.pInput.value = 1;
      } else if (this.pInput.value < 0) {
        this.pInput.value = 0;
      }

      this.updateParentCallback(this.graphType);
    });
    this.m0Input.addEventListener("change", () => {
      this.updateParentCallback(this.graphType);
    });
    this.mInput.addEventListener("change", () => {
      this.updateParentCallback(this.graphType);
    });

    this.kInput.addEventListener("change", () => {
      // Make sure that k is even
      if (this.kInput.value % 2 === 1) {
        this.kInput.value = parseInt(this.kInput.value) + 1;
      }
      this.updateParentCallback(this.graphType);
    });

    this.pWattsInput.addEventListener("change", () => {
      if (this.pWattsInput.value > 1) {
        this.pWattsInput.value = 1;
      } else if (this.pWattsInput.value < 0) {
        this.pWattsInput.value = 0;
      }

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

    this.degreeDistributionSwitch.addEventListener("change", (event) => {
      const checked = event.target.checked;
      if (!checked) {
        document.getElementById("degree-distribution").style.display = "none";
      } else {
        document.getElementById("degree-distribution").style.display = "flex";
      }
    });

    this.nodeSizeSwitch.addEventListener("change", (event) => {
      const checked = event.target.checked;
      if (!checked) {
        this.shouldScaleNodes = false;
      } else {
        this.shouldScaleNodes = true;
      }
      this.updateParentCallback(this.graphType);
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
      document.getElementById("watts-strogatz-parameters").style.display =
        "none";
    } else if (this.graphType === GraphType.BARABASI_ALBERT) {
      document.getElementById("erdos-renyi-parameters").style.display = "none";
      document.getElementById("barabasi-albert-parameters").style.display =
        "flex";
      document.getElementById("watts-strogatz-parameters").style.display =
        "none";
    } else {
      document.getElementById("erdos-renyi-parameters").style.display = "none";
      document.getElementById("barabasi-albert-parameters").style.display =
        "none";
      document.getElementById("watts-strogatz-parameters").style.display =
        "flex";
    }
  }

  updateMetrics(cyInstance) {
    const numberOfNodes = cyInstance.nodes().length;
    const edges = cyInstance.edges().length;
    const avgDegree = (2 * edges) / numberOfNodes;
    let maxDegree = 0;

    const nodes = cyInstance.nodes();
    const degrees = {};
    nodes.forEach((node) => {
      const neighbors = node.neighborhood();
      for (let i = 0; i < neighbors.length; i++) {
        if (neighbors[i]._private.group === "nodes") {
          if (degrees[node.id()]) {
            degrees[node.id()] += 1;
          } else {
            degrees[node.id()] = 1;
          }
        }
      }
    });

    maxDegree = Math.max(...Object.values(degrees));

    let sum = 0;
    nodes.forEach((node) => {
      // neighbors will contain node neighbors of i + the edge between them
      const neighbors = node.neighborhood();
      const degree = node.degree();

      if (degree < 2) {
        return;
      }

      let edgesBetweenNeighbors = 0;

      neighbors.forEach((neighbor) => {
        if (neighbor._private.group === "nodes") {
          const neighborNeighbors = neighbor.neighborhood();
          neighborNeighbors.forEach((neighborNeighbor) => {
            if (neighborNeighbor._private.group === "nodes") {
              if (neighborNeighbor.id() !== node.id()) {
                if (neighbors.has(neighborNeighbor)) {
                  edgesBetweenNeighbors += 1;
                }
              }
            }
          });
        }
      });

      sum += (2 * edgesBetweenNeighbors) / (degree * (degree - 1));
    });

    if (isNaN(sum)) {
      sum = 0;
    }

    const avgClusteringCoefficient = sum / numberOfNodes;

    // calculate avg path length
    const distances = [];
    nodes.forEach((node) => {
      const bfs = cyInstance.elements().bfs({
        roots: node,
        visit: (v, e, u, i, depth) => {
          if (depth > 0) {
            distances.push(depth);
          }
        },
      });
    });

    const avgPathLength =
      (distances.reduce((a, b) => a + b, 0) / numberOfNodes) *
      (numberOfNodes - 1);

    const density = (2 * edges) / (numberOfNodes * (numberOfNodes - 1));

    document.getElementById("nodes-value").innerText = numberOfNodes;
    document.getElementById("edges-value").innerText = edges;
    document.getElementById("avg-degree-value").innerText =
      avgDegree.toFixed(2);
    document.getElementById("density-value").innerText = density.toFixed(2);
    document.getElementById("max-degree-value").innerText = maxDegree;
    document.getElementById("avg-clustering-coefficient-value").innerText =
      avgClusteringCoefficient.toFixed(2);
    document.getElementById("avg-path-length-value").innerText =
      avgPathLength.toFixed(2);
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

  getK() {
    return parseInt(this.kInput.value);
  }

  getPWatts() {
    return parseFloat(this.pWattsInput.value);
  }
}

const visualizer = new Visualizer(GraphType.ERDOS_RENYI);
