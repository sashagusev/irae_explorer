/**
 * irAE Trajectory Visualization - D3.js Charts
 */

// Maximum time for cumulative incidence curves (3 years = 1095 days)
const MAX_TIME_DAYS = 1095;

// Category color palette
const categoryColors = {
    "Skin and subcutaneous tissue disorders": "#e41a1c",
    "Gastrointestinal disorders": "#377eb8",
    "Endocrine disorders": "#4daf4a",
    "Musculoskeletal and connective tissue disorders": "#984ea3",
    "Respiratory, thoracic and mediastinal disorders": "#ff7f00",
    "Investigation": "#a65628",
    "Hepatobiliary disorders": "#f781bf",
    "Nervous system disorders": "#999999",
    "Blood and lymphatic system disorders": "#66c2a5",
    "Renal and urinary disorders": "#fc8d62",
    "Metabolism and nutrition disorders": "#8da0cb",
    "Cardiac disorders": "#e78ac3",
    "Eye disorders": "#a6d854",
    "Vascular disorders": "#ffd92f",
    "Other": "#888888"
};

// Severity colors
const severityColors = {
    "Mild": "#4daf4a",
    "Moderate": "#ff7f00",
    "Severe": "#e41a1c",
    "Life-threatening": "#984ea3"
};

// State colors for Sankey
const stateColors = {
    ...categoryColors,
    "Death": "#333333",
    "Censored": "#cccccc",
    "No Event": "#f0f0f0"
};

// Tooltip singleton
let tooltip = null;

function initTooltip() {
    if (!tooltip) {
        tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("display", "none");
    }
    return tooltip;
}

function showTooltip(html, event) {
    const tip = initTooltip();
    tip.html(html)
        .style("display", "block")
        .style("opacity", 1)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
}

function hideTooltip() {
    if (tooltip) {
        tooltip.style("opacity", 0).style("display", "none");
    }
}

/**
 * Cumulative Incidence Chart
 * Legend: smaller font, positioned to the right
 */
function renderCumulativeIncidenceChart(containerId, data, options = {}) {
    const container = d3.select(containerId);
    container.html("");

    // Create a flex container for chart + legend
    const wrapper = container.append("div")
        .style("display", "flex")
        .style("align-items", "flex-start")
        .style("gap", "20px");

    const chartContainer = wrapper.append("div");

    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
    const width = (options.width || 700) - margin.left - margin.right;
    const height = (options.height || 400) - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("class", "chart-svg");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Get color function
    const getColor = options.colorMap || ((key) => categoryColors[key] || "#999");

    // Find max incidence (capped at 3 years)
    let maxIncidence = 0;
    const curves = Object.entries(data);

    curves.forEach(([key, curve]) => {
        if (curve.times && curve.times.length > 0) {
            for (let i = 0; i < curve.times.length; i++) {
                if (curve.times[i] <= MAX_TIME_DAYS) {
                    maxIncidence = Math.max(maxIncidence, curve.cumulative_incidence[i]);
                }
            }
        }
    });

    maxIncidence = Math.min(Math.max(maxIncidence * 1.1, 0.1), 1);

    // Scales
    const xScale = d3.scaleLinear()
        .domain([0, MAX_TIME_DAYS])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, maxIncidence])
        .range([height, 0]);

    // Axes
    const xAxis = d3.axisBottom(xScale)
        .tickValues([0, 365, 730, 1095])
        .tickFormat(d => d === 0 ? '0' : d === 365 ? '1y' : d === 730 ? '2y' : '3y');

    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d3.format(".0%"));

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis)
        .append("text")
        .attr("x", width / 2)
        .attr("y", 40)
        .attr("fill", "#333")
        .attr("text-anchor", "middle")
        .text("Time from Treatment Start");

    g.append("g")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -45)
        .attr("fill", "#333")
        .attr("text-anchor", "middle")
        .text("Cumulative Incidence");

    // Grid lines
    g.append("g")
        .attr("class", "grid")
        .attr("opacity", 0.1)
        .call(d3.axisLeft(yScale)
            .ticks(5)
            .tickSize(-width)
            .tickFormat("")
        );

    // Step line generator
    const line = d3.line()
        .x(d => xScale(d.time))
        .y(d => yScale(d.value))
        .curve(d3.curveStepAfter);

    // Track visibility state
    const visibility = {};
    curves.forEach(([key]) => visibility[key] = true);

    // Draw curves
    curves.forEach(([key, curve]) => {
        if (!curve.times || curve.times.length === 0) return;

        const lineData = [];
        for (let i = 0; i < curve.times.length; i++) {
            if (curve.times[i] <= MAX_TIME_DAYS) {
                lineData.push({
                    time: curve.times[i],
                    value: curve.cumulative_incidence[i]
                });
            }
        }

        if (lineData.length === 0) return;

        // Confidence interval area
        if (curve.ci_lower && curve.ci_upper) {
            const areaData = [];
            for (let i = 0; i < curve.times.length; i++) {
                if (curve.times[i] <= MAX_TIME_DAYS) {
                    areaData.push({
                        time: curve.times[i],
                        lower: curve.ci_lower[i],
                        upper: curve.ci_upper[i]
                    });
                }
            }

            const area = d3.area()
                .x(d => xScale(d.time))
                .y0(d => yScale(d.lower))
                .y1(d => yScale(d.upper))
                .curve(d3.curveStepAfter);

            g.append("path")
                .datum(areaData)
                .attr("class", `ci-area ci-area-${key.replace(/\s+/g, '-')}`)
                .attr("fill", getColor(key))
                .attr("opacity", 0.1)
                .attr("d", area);
        }

        // Main line
        g.append("path")
            .datum(lineData)
            .attr("class", `curve curve-${key.replace(/\s+/g, '-')}`)
            .attr("fill", "none")
            .attr("stroke", getColor(key))
            .attr("stroke-width", 2)
            .attr("d", line);

        // Hover points
        g.selectAll(`.point-${key.replace(/\s+/g, '-')}`)
            .data(lineData)
            .enter()
            .append("circle")
            .attr("class", `point point-${key.replace(/\s+/g, '-')}`)
            .attr("cx", d => xScale(d.time))
            .attr("cy", d => yScale(d.value))
            .attr("r", 3)
            .attr("fill", getColor(key))
            .attr("opacity", 0)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("opacity", 1);
                showTooltip(`
                    <div class="label">${key}</div>
                    <div class="value">Time: ${Math.round(d.time)} days</div>
                    <div class="value">Incidence: ${(d.value * 100).toFixed(1)}%</div>
                `, event);
            })
            .on("mouseout", function() {
                d3.select(this).attr("opacity", 0);
                hideTooltip();
            });
    });

    // Legend - positioned to the right, smaller font
    const legend = wrapper.append("div")
        .attr("class", "legend-right")
        .style("font-size", "11px")
        .style("max-width", "200px");

    curves.forEach(([key, curve]) => {
        if (!curve.times || curve.times.length === 0) return;

        const item = legend.append("div")
            .attr("class", "legend-item")
            .style("cursor", "pointer")
            .style("margin-bottom", "4px")
            .style("display", "flex")
            .style("align-items", "center")
            .on("click", function() {
                visibility[key] = !visibility[key];
                const opacity = visibility[key] ? 1 : 0.1;
                const display = visibility[key] ? null : "none";

                d3.select(this).style("opacity", visibility[key] ? 1 : 0.4);
                g.selectAll(`.curve-${key.replace(/\s+/g, '-')}`).attr("opacity", opacity);
                g.selectAll(`.ci-area-${key.replace(/\s+/g, '-')}`).attr("opacity", visibility[key] ? 0.1 : 0);
                g.selectAll(`.point-${key.replace(/\s+/g, '-')}`).style("display", display);
            });

        item.append("div")
            .style("width", "14px")
            .style("height", "3px")
            .style("background-color", getColor(key))
            .style("margin-right", "6px")
            .style("flex-shrink", "0");

        item.append("span")
            .style("line-height", "1.2")
            .text(`${key} (n=${curve.n_events || 0})`);
    });
}

/**
 * Sankey Diagram
 */
function renderSankeyDiagram(containerId, data, options = {}) {
    const container = d3.select(containerId);
    container.html("");

    if (!data || !data.nodes || !data.links || data.links.length === 0) {
        container.append("div")
            .attr("class", "no-data")
            .text("Insufficient data for Sankey diagram");
        return;
    }

    const margin = { top: 20, right: 20, bottom: 30, left: 20 };
    const width = (options.width || 900) - margin.left - margin.right;
    const height = (options.height || 500) - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create sankey generator
    const sankey = d3.sankey()
        .nodeId(d => d.index)
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[0, 0], [width, height]]);

    // Generate layout
    const graph = sankey({
        nodes: data.nodes.map((d, i) => ({ ...d, index: i })),
        links: data.links.map(d => ({ ...d }))
    });

    // Draw links
    svg.append("g")
        .selectAll(".sankey-link")
        .data(graph.links)
        .enter()
        .append("path")
        .attr("class", "sankey-link")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => stateColors[d.source.name] || "#999")
        .attr("stroke-width", d => Math.max(1, d.width))
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke-opacity", 0.7);
            showTooltip(`
                <div class="label">${d.source.name} \u2192 ${d.target.name}</div>
                <div class="value">Patients: ${d.value}</div>
            `, event);
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke-opacity", 0.4);
            hideTooltip();
        });

    // Draw nodes
    const node = svg.append("g")
        .selectAll(".sankey-node")
        .data(graph.nodes)
        .enter()
        .append("g")
        .attr("class", "sankey-node");

    node.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => Math.max(1, d.y1 - d.y0))
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => stateColors[d.name] || "#999")
        .on("mouseover", function(event, d) {
            showTooltip(`
                <div class="label">${d.name}</div>
                <div class="value">Patients: ${d.value}</div>
            `, event);
        })
        .on("mouseout", hideTooltip);

    node.append("text")
        .attr("class", "sankey-node-label")
        .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
        .text(d => d.name.length > 20 ? d.name.substring(0, 18) + "..." : d.name)
        .style("font-size", "10px");

    // Time point labels
    const timePoints = data.time_points || [0, 90, 180, 270, 365];
    const xPositions = [...new Set(graph.nodes.map(d => d.x0))].sort((a, b) => a - b);

    svg.append("g")
        .selectAll(".time-label")
        .data(timePoints)
        .enter()
        .append("text")
        .attr("x", (d, i) => xPositions[i] || 0)
        .attr("y", height + 20)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(d => `${d} days`);
}

/**
 * Heatmap for Hazard Ratios
 * Colors: HR > 1 = red, HR < 1 = blue
 * Gray out non-significant cells (p > 0.05)
 */
function renderHRHeatmap(containerId, data, options = {}) {
    const container = d3.select(containerId);
    container.html("");

    const rows = Object.keys(data);
    if (rows.length === 0) {
        container.append("div")
            .attr("class", "no-data")
            .text("Insufficient data for heatmap");
        return;
    }

    const cols = Object.keys(data[rows[0]]);
    const cellSize = options.cellSize || 50;
    const labelWidth = options.labelWidth || 150;

    const margin = { top: labelWidth, right: 20, bottom: 20, left: labelWidth };
    const width = cols.length * cellSize;
    const height = rows.length * cellSize;

    const gradientId = 'hr-gradient-' + Math.random().toString(36).substr(2, 9);

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Color scale for HR: blue (< 1) - white (1) - red (> 1)
    // Using interpolateRdBu reversed so that high values are red
    const colorScale = d3.scaleDiverging()
        .domain([0.25, 1, 4])
        .interpolator(t => d3.interpolateRdBu(1 - t))  // Reverse the interpolator
        .clamp(true);

    const nsColor = "#e0e0e0";

    // Draw cells
    rows.forEach((rowKey, i) => {
        cols.forEach((colKey, j) => {
            const cell = data[rowKey][colKey];
            const hr = cell.hr;
            const isDiagonal = cell.diagonal;
            const pValue = cell.p_value;
            const isSignificant = pValue !== null && pValue <= 0.05;

            let fillColor;
            if (isDiagonal) {
                fillColor = "#f0f0f0";
            } else if (hr === null) {
                fillColor = "#eee";
            } else if (!isSignificant) {
                fillColor = nsColor;
            } else {
                fillColor = colorScale(hr);
            }

            const rect = svg.append("rect")
                .attr("class", "heatmap-cell")
                .attr("x", j * cellSize)
                .attr("y", i * cellSize)
                .attr("width", cellSize - 1)
                .attr("height", cellSize - 1)
                .attr("fill", fillColor);

            if (!isDiagonal && hr !== null) {
                rect.on("mouseover", function(event) {
                    showTooltip(`
                        <div class="label">${rowKey} \u2192 ${colKey}</div>
                        <div class="value">HR: ${hr.toFixed(2)}</div>
                        ${cell.ci_lower ? `<div class="value">95% CI: ${cell.ci_lower.toFixed(2)} - ${cell.ci_upper.toFixed(2)}</div>` : ''}
                        ${pValue !== null ? `<div class="value">p-value: ${pValue < 0.001 ? '<0.001' : pValue.toFixed(3)}${!isSignificant ? ' (n.s.)' : ''}</div>` : ''}
                    `, event);
                })
                .on("mouseout", hideTooltip);

                const textColor = !isSignificant ? "#666" : (hr > 2 || hr < 0.5 ? "white" : "#333");
                svg.append("text")
                    .attr("x", j * cellSize + cellSize / 2)
                    .attr("y", i * cellSize + cellSize / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("fill", textColor)
                    .style("font-size", "10px")
                    .text(hr.toFixed(1));
            } else if (isDiagonal) {
                svg.append("text")
                    .attr("x", j * cellSize + cellSize / 2)
                    .attr("y", i * cellSize + cellSize / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("fill", "#999")
                    .style("font-size", "10px")
                    .text("-");
            }
        });
    });

    // Row labels
    svg.selectAll(".row-label")
        .data(rows)
        .enter()
        .append("text")
        .attr("class", "heatmap-label")
        .attr("x", -5)
        .attr("y", (d, i) => i * cellSize + cellSize / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .text(d => d.length > 20 ? d.substring(0, 18) + "..." : d);

    // Column labels
    svg.selectAll(".col-label")
        .data(cols)
        .enter()
        .append("text")
        .attr("class", "heatmap-label")
        .attr("x", (d, i) => i * cellSize + cellSize / 2)
        .attr("y", -5)
        .attr("transform", (d, i) => `rotate(-45, ${i * cellSize + cellSize / 2}, -5)`)
        .attr("text-anchor", "start")
        .text(d => d.length > 20 ? d.substring(0, 18) + "..." : d);

    // Color scale legend
    const legendWidth = 200;
    const legendHeight = 15;

    const legendContainer = container.append("div")
        .style("margin-top", "10px")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "20px");

    const legendSvg = legendContainer.append("svg")
        .attr("width", legendWidth + 100)
        .attr("height", 40);

    const defs = legendSvg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", gradientId);

    // Gradient: blue (0.25) -> white (1) -> red (4)
    gradient.selectAll("stop")
        .data([
            { offset: "0%", color: colorScale(0.25) },
            { offset: "50%", color: colorScale(1) },
            { offset: "100%", color: colorScale(4) }
        ])
        .enter()
        .append("stop")
        .attr("offset", d => d.offset)
        .attr("stop-color", d => d.color);

    legendSvg.append("rect")
        .attr("x", 30)
        .attr("y", 5)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", `url(#${gradientId})`);

    legendSvg.append("text")
        .attr("x", 30)
        .attr("y", 32)
        .style("font-size", "10px")
        .text("0.25");

    legendSvg.append("text")
        .attr("x", 30 + legendWidth / 2)
        .attr("y", 32)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text("1.0");

    legendSvg.append("text")
        .attr("x", 30 + legendWidth)
        .attr("y", 32)
        .attr("text-anchor", "end")
        .style("font-size", "10px")
        .text("4.0+");

    legendSvg.append("text")
        .attr("x", 30 + legendWidth + 10)
        .attr("y", 15)
        .style("font-size", "10px")
        .text("HR");

    // Non-significant legend
    const nsLegend = legendContainer.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "5px")
        .style("font-size", "12px");

    nsLegend.append("div")
        .style("width", "20px")
        .style("height", "15px")
        .style("background-color", nsColor)
        .style("border", "1px solid #ccc");

    nsLegend.append("span")
        .text("p > 0.05");
}

/**
 * Sortable Table
 */
function initSortableTable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const headers = table.querySelectorAll('th');
    const tbody = table.querySelector('tbody');

    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const isAscending = header.classList.contains('sorted-asc');

            headers.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));

            rows.sort((a, b) => {
                const aVal = a.cells[index].textContent.trim();
                const bVal = b.cells[index].textContent.trim();

                const aNum = parseFloat(aVal.replace(/[^0-9.-]/g, ''));
                const bNum = parseFloat(bVal.replace(/[^0-9.-]/g, ''));

                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAscending ? aNum - bNum : bNum - aNum;
                }

                return isAscending
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            });

            header.classList.add(isAscending ? 'sorted-desc' : 'sorted-asc');

            rows.forEach(row => tbody.appendChild(row));
        });
    });
}

/**
 * HR Table with bidirectional HRs
 */
function renderHRTable(containerId, data, options = {}) {
    const container = d3.select(containerId);
    container.html("");

    if (!data || data.length === 0) {
        container.append("div")
            .attr("class", "no-data")
            .text("Insufficient data for HR table");
        return;
    }

    const table = container.append("table")
        .attr("class", "data-table hr-table")
        .attr("id", "hr-table");

    const hasBidirectional = data[0] && data[0].hr_reverse !== undefined;

    const thead = table.append("thead");
    const headerRow = thead.append("tr");

    if (hasBidirectional) {
        headerRow.selectAll("th")
            .data(["Category", "HR (Other→This)", "95% CI", "p-value", "HR (This→Other)", "95% CI", "p-value"])
            .enter()
            .append("th")
            .text(d => d);
    } else {
        headerRow.selectAll("th")
            .data(["Comparison Category", "HR", "95% CI", "p-value"])
            .enter()
            .append("th")
            .text(d => d);
    }

    const tbody = table.append("tbody");

    data.forEach(row => {
        const tr = tbody.append("tr");

        tr.append("td").text(row.comparison_category);

        if (row.hr !== null) {
            const hrCell = tr.append("td")
                .attr("class", "numeric")
                .text(row.hr.toFixed(2));

            if (row.hr > 1.5) hrCell.classed("hr-high", true);
            if (row.hr < 0.67) hrCell.classed("hr-low", true);

            tr.append("td")
                .attr("class", "numeric")
                .text(`${row.ci_lower.toFixed(2)} - ${row.ci_upper.toFixed(2)}`);

            const pCell = tr.append("td")
                .attr("class", "numeric")
                .text(row.p_value < 0.001 ? '<0.001' : row.p_value.toFixed(3));

            if (row.p_value < 0.05) pCell.classed("significant", true);
        } else {
            tr.append("td").attr("class", "numeric").text("-");
            tr.append("td").attr("class", "numeric").text("-");
            tr.append("td").attr("class", "numeric").text("-");
        }

        if (hasBidirectional) {
            if (row.hr_reverse !== null) {
                const hrReverseCell = tr.append("td")
                    .attr("class", "numeric")
                    .text(row.hr_reverse.toFixed(2));

                if (row.hr_reverse > 1.5) hrReverseCell.classed("hr-high", true);
                if (row.hr_reverse < 0.67) hrReverseCell.classed("hr-low", true);

                tr.append("td")
                    .attr("class", "numeric")
                    .text(`${row.ci_lower_reverse.toFixed(2)} - ${row.ci_upper_reverse.toFixed(2)}`);

                const pReverseCell = tr.append("td")
                    .attr("class", "numeric")
                    .text(row.p_value_reverse < 0.001 ? '<0.001' : row.p_value_reverse.toFixed(3));

                if (row.p_value_reverse < 0.05) pReverseCell.classed("significant", true);
            } else {
                tr.append("td").attr("class", "numeric").text("-");
                tr.append("td").attr("class", "numeric").text("-");
                tr.append("td").attr("class", "numeric").text("-");
            }
        }
    });

    initSortableTable("hr-table");
}

/**
 * Render a simple association table
 */
function renderAssociationTable(containerId, data, options = {}) {
    const container = d3.select(containerId);
    container.html("");

    if (!data || data.length === 0) {
        container.append("div")
            .attr("class", "no-data")
            .text("No significant associations found");
        return;
    }

    const tableId = options.tableId || 'assoc-table-' + Math.random().toString(36).substr(2, 9);

    const table = container.append("table")
        .attr("class", "data-table hr-table")
        .attr("id", tableId);

    const thead = table.append("thead");
    thead.append("tr")
        .selectAll("th")
        .data([options.nameColumn || "Name", "HR", "95% CI", "p-value"])
        .enter()
        .append("th")
        .text(d => d);

    const tbody = table.append("tbody");

    data.forEach(row => {
        const tr = tbody.append("tr");

        tr.append("td").text(row.name);

        const hrCell = tr.append("td")
            .attr("class", "numeric")
            .text(row.hr.toFixed(2));

        if (row.hr > 1.5) hrCell.classed("hr-high", true);
        if (row.hr < 0.67) hrCell.classed("hr-low", true);

        tr.append("td")
            .attr("class", "numeric")
            .text(`${row.ci_lower.toFixed(2)} - ${row.ci_upper.toFixed(2)}`);

        const pCell = tr.append("td")
            .attr("class", "numeric")
            .text(row.p_value < 0.001 ? '<0.001' : row.p_value.toFixed(3));

        if (row.p_value < 0.05) pCell.classed("significant", true);
    });

    initSortableTable(tableId);
}

// Export functions for use in templates
window.iraeCharts = {
    renderCumulativeIncidenceChart,
    renderSankeyDiagram,
    renderHRHeatmap,
    renderHRTable,
    renderAssociationTable,
    initSortableTable,
    categoryColors,
    severityColors,
    stateColors
};
