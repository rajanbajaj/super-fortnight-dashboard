// CSV data will be loaded and processed
let stockData = [];
let filteredData = [];
let canvas, ctx;
let chartArea = { x: 80, y: 60, width: 0, height: 0 };

// Interactive chart variables
let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let panOffsetX = 0;
let panOffsetY = 0;
let zoomLevel = 1;
let zoomCenterX = 0;
let zoomCenterY = 0;
let hoveredIndex = -1;
let crosshairX = -1;
let crosshairY = -1;
let lastCrosshairX = -1;
let lastCrosshairY = -1;
let crosshairEnabled = true;
let crosshairSnapToCandles = true;
let crosshairAnimationFrame = null;
let isFullscreen = false;
let originalChartContainer = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Range-based panning variables
let visibleStartIndex = 0;
let visibleEndIndex = 0;
let maxVisiblePoints = 50;
let panningSensitivity = 1.0; // Number of data points to show at once

// Cluster colors - vibrant and distinct
const clusterColors = {
    0: { main: '#00ff88', shadow: 'rgba(0, 255, 136, 0.3)' },
    1: { main: '#ff6b6b', shadow: 'rgba(255, 107, 107, 0.3)' },
    2: { main: '#4ecdc4', shadow: 'rgba(78, 205, 196, 0.3)' },
    3: { main: '#ffe66d', shadow: 'rgba(255, 230, 109, 0.3)' },
    4: { main: '#ff9ff3', shadow: 'rgba(255, 159, 243, 0.3)' },
    5: { main: '#a8e6cf', shadow: 'rgba(168, 230, 207, 0.3)' },
    6: { main: '#ffd93d', shadow: 'rgba(255, 217, 61, 0.3)' },
    7: { main: '#6c5ce7', shadow: 'rgba(108, 92, 231, 0.3)' }
};

// Default colors when cluster coloring is disabled
const defaultColors = {
    bullish: { main: '#00ff88', shadow: 'rgba(0, 255, 136, 0.3)' },
    bearish: { main: '#ff6b6b', shadow: 'rgba(255, 107, 107, 0.3)' },
    neutral: { main: '#4ecdc4', shadow: 'rgba(78, 205, 196, 0.3)' }
};

// Get color for data point based on cluster or price movement
function getDataColor(data) {
    const showClusterColorsElement = document.getElementById('showClusterColors');
    const showClusterColors = showClusterColorsElement ? showClusterColorsElement.checked : true;
    
    if (showClusterColors) {
        // Use cluster-based colors
        const cluster = data.predicted_cluster || 0;
        return clusterColors[cluster] || clusterColors[0];
    } else {
        // Use simple bullish/bearish colors
        if (data.close > data.open) {
            return defaultColors.bullish;
        } else if (data.close < data.open) {
            return defaultColors.bearish;
        } else {
            return defaultColors.neutral;
        }
    }
}


// Initialize the application
function init() {
    setupCanvas();
    setupInteractiveChart(); // Set up interactive features
    generateSampleData(); // Start with sample data
    syncOverlayControls(); // Sync overlay controls with main controls
    updateControlVisibility();
    updateStats();
    updateLegend();
    updateChart();
    
    // Initialize visible range after data is loaded
    initializeVisibleRange();
    
    // Initialize settings
    updatePanelOpacity();
    updateMinimizeButtons();
    updatePanelVisibility();
    updateMaxVisiblePoints();
    updatePanningSensitivity();
    
    // Load saved settings
    const settingsLoaded = loadSettings();
    if (settingsLoaded) {
        showStatus('📂 Settings loaded from localStorage', 'success');
        // Update chart with loaded settings
        updateChart();
        updateStats();
        updateLegend();
    }
}

function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('dataStatus');
    statusDiv.className = type;
    statusDiv.innerHTML = message;
    setTimeout(() => {
        statusDiv.innerHTML = '';
        statusDiv.className = '';
    }, 5000);
}

function loadCSVData() {
    const csvInput = document.getElementById('csvInput');
    if (!csvInput) {
        showStatus('❌ CSV input element not found', 'error');
        return;
    }
    const csvContent = csvInput.value.trim();
    if (!csvContent) {
        showStatus('⚠️ Please paste CSV data first', 'error');
        return;
    }

    try {
        stockData = [];
        const lines = csvContent.split('\n');
        if (lines.length < 2) {
            throw new Error('CSV must have at least a header and one data row');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Validate required headers
        const requiredHeaders = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
        }

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            if (values.length !== headers.length) {
                console.warn(`Row ${i + 1} has ${values.length} values but expected ${headers.length}`);
                continue;
            }

            const row = {};
            headers.forEach((header, index) => {
                let value = values[index];
                
                // Parse numeric values
                if (['open', 'high', 'low', 'close', 'volume', 'predicted_cluster'].includes(header)) {
                    value = parseFloat(value) || 0;
                }
                
                row[header] = value;
            });
            
            // Convert timestamp to Date object
            if (row.timestamp) {
                row.date = new Date(row.timestamp);
                if (isNaN(row.date.getTime())) {
                    console.warn(`Invalid date in row ${i + 1}: ${row.timestamp}`);
                    continue;
                }
            }
            
            // Set default cluster if not provided
            if (row.predicted_cluster === undefined) {
                row.predicted_cluster = 0;
            }
            
            stockData.push(row);
        }
        
        if (stockData.length === 0) {
            throw new Error('No valid data rows found');
        }

        // Update feature selectors based on CSV headers
        updateFeatureSelectors(headers);
        
        // Update cluster filters based on available clusters
        updateClusterFilters();
        
        // Reinitialize visible range for new data
        initializeVisibleRange();
        
        updateChart();
        updateStats();
        updateLegend();
        showStatus(`✅ Successfully loaded ${stockData.length} data points`, 'success');
        
    } catch (error) {
        console.error('Error parsing CSV:', error);
        showStatus(`❌ Error parsing CSV: ${error.message}`, 'error');
    }
}

function updateFeatureSelectors(headers) {
    // Get all numeric features from the data
    const numericFeatures = [];
    const excludeHeaders = ['timestamp', 'predicted_cluster', 'date'];
    
    // Check which headers contain numeric data by sampling the first few rows
    if (stockData.length > 0) {
        headers.forEach(header => {
            if (!excludeHeaders.includes(header.toLowerCase())) {
                // Check if the first few values are numeric
                const sampleValues = stockData.slice(0, Math.min(5, stockData.length))
                    .map(row => row[header]);
                const isNumeric = sampleValues.every(val => 
                    val !== null && val !== undefined && !isNaN(parseFloat(val))
                );
                if (isNumeric) {
                    numericFeatures.push(header);
                }
            }
        });
    } else {
        // Fallback to standard features if no data
        numericFeatures.push('open', 'high', 'low', 'close', 'volume');
    }
    
    // Add timestamp as an option for X-axis
    const xAxisOptions = ['timestamp', ...numericFeatures];
    const yAxisOptions = [...numericFeatures];
    const histogramOptions = [...numericFeatures];
    
    // Update X-axis selector
    const xAxisSelect = document.getElementById('xAxis');
    if (xAxisSelect) {
        xAxisSelect.innerHTML = '';
        xAxisOptions.forEach(feature => {
            const option = document.createElement('option');
            option.value = feature;
            option.textContent = feature.charAt(0).toUpperCase() + feature.slice(1);
            xAxisSelect.appendChild(option);
        });
    }
    
    // Update Y-axis selector
    const yAxisSelect = document.getElementById('yAxis');
    if (yAxisSelect) {
        yAxisSelect.innerHTML = '';
        yAxisOptions.forEach(feature => {
            const option = document.createElement('option');
            option.value = feature;
            option.textContent = feature.charAt(0).toUpperCase() + feature.slice(1);
            yAxisSelect.appendChild(option);
        });
    }
    
    // Update histogram selector
    const histogramSelect = document.getElementById('histogramFeature');
    if (histogramSelect) {
        histogramSelect.innerHTML = '';
        histogramOptions.forEach(feature => {
            const option = document.createElement('option');
            option.value = feature;
            option.textContent = feature.charAt(0).toUpperCase() + feature.slice(1);
            histogramSelect.appendChild(option);
        });
    }
}

function updateClusterFilters() {
    if (stockData.length === 0) return;
    
    // Get unique clusters from the data
    const uniqueClusters = [...new Set(stockData.map(d => d.predicted_cluster || 0))].sort((a, b) => a - b);
    
    // Update main cluster filter
    const mainClusterFilter = document.getElementById('clusterFilter');
    if (mainClusterFilter) {
        mainClusterFilter.innerHTML = '<option value="all">All Clusters</option>';
        uniqueClusters.forEach(cluster => {
            const option = document.createElement('option');
            option.value = cluster;
            option.textContent = `Cluster ${cluster}`;
            mainClusterFilter.appendChild(option);
        });
    }
    
    // Update overlay cluster filter
    const overlayClusterFilter = document.getElementById('overlayClusterFilter');
    if (overlayClusterFilter) {
        overlayClusterFilter.innerHTML = '<option value="all">All</option>';
        uniqueClusters.forEach(cluster => {
            const option = document.createElement('option');
            option.value = cluster;
            option.textContent = `Cluster ${cluster}`;
            overlayClusterFilter.appendChild(option);
        });
    }
}

function clearData() {
    const csvInput = document.getElementById('csvInput');
    if (csvInput) {
        csvInput.value = '';
    }
    stockData = [];
    filteredData = [];
    updateChart();
    updateStats();
    updateLegend();
    showStatus('🗑️ Data cleared', 'success');
}

function handleNumRowsChange() {
    // Update the chart with new number of rows
    updateChart();
}

function generateSampleData() {
    const numRowsElement = document.getElementById('numRows');
    const numRows = numRowsElement ? parseInt(numRowsElement.value) : 200;
    stockData = [];
    const startDate = new Date('2024-09-06');
    let lastPrice = 520;
    
    for (let i = 0; i < numRows; i++) {
        const date = new Date(startDate.getTime() + i * 3600000); // Add hours
        
        // Create more realistic price movement
        const volatility = 0.02;
        const trend = Math.sin(i / 50) * 0.001;
        const randomChange = (Math.random() - 0.5) * volatility;
        const priceChange = (trend + randomChange) * lastPrice;
        
        const open = lastPrice;
        const close = open + priceChange;
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        
        lastPrice = close;
        
        stockData.push({
            date: date,
            timestamp: date.toISOString(),
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume: Math.floor(Math.random() * 2000000) + 500000,
            predicted_cluster: Math.floor(Math.random() * 4)
        });
    }
    
    // Update feature selectors for sample data
    const sampleHeaders = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'predicted_cluster'];
    updateFeatureSelectors(sampleHeaders);
    
    // Update cluster filters based on available clusters
    updateClusterFilters();
    
    // Reinitialize visible range for new data
    initializeVisibleRange();
    
    updateChart();
    updateStats();
    updateLegend();
    showStatus(`🎲 Generated ${stockData.length} sample data points`, 'success');
}

function setupCanvas() {
    // Use fullscreen canvas if in fullscreen mode
    if (isFullscreen && window.fullscreenCanvas) {
        canvas = window.fullscreenCanvas;
    } else {
    canvas = document.getElementById('candlestickChart');
    }
    
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    
    ctx = canvas.getContext('2d');
    
    // Set reasonable resolution for better performance
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * 2; // 2x for high-DPI
    canvas.height = rect.height * 2; // 2x for high-DPI
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    // Calculate chart area
    chartArea.width = canvas.width - 160;
    chartArea.height = canvas.height - 120;
    
    // Set up high-DPI rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
}

function updateChart() {
    // Sync controls between main and overlay
    syncMainControls();
    syncOverlayControls();
    
    filterData();
    updateControlVisibility();
    drawChart();
    updateStats();
    updateOverlayStats();
    updateOverlayLegend();
    
    // Auto-save settings after chart updates
    saveSettings();
}

function redrawChart() {
    // Just redraw the chart without recalculating data
    drawChart();
}

function updateControlVisibility() {
    const chartTypeElement = document.getElementById('chartType');
    const chartType = chartTypeElement ? chartTypeElement.value : 'candlestick';
    const candleWidthGroup = document.getElementById('candleWidthGroup');
    const xAxisGroup = document.getElementById('xAxisGroup');
    const yAxisGroup = document.getElementById('yAxisGroup');
    const histogramGroup = document.getElementById('histogramGroup');
    
    // Show/hide controls based on chart type
    if (chartType === 'candlestick') {
        if (candleWidthGroup) candleWidthGroup.style.display = 'block';
        if (xAxisGroup) xAxisGroup.style.display = 'none';
        if (yAxisGroup) yAxisGroup.style.display = 'none';
        if (histogramGroup) histogramGroup.style.display = 'none';
    } else if (chartType === 'histogram') {
        if (candleWidthGroup) candleWidthGroup.style.display = 'none';
        if (xAxisGroup) xAxisGroup.style.display = 'none';
        if (yAxisGroup) yAxisGroup.style.display = 'none';
        if (histogramGroup) histogramGroup.style.display = 'block';
    } else { // scatter or line
        if (candleWidthGroup) candleWidthGroup.style.display = 'none';
        if (xAxisGroup) xAxisGroup.style.display = 'block';
        if (yAxisGroup) yAxisGroup.style.display = 'block';
        if (histogramGroup) histogramGroup.style.display = 'none';
    }
}

function filterData() {
    const clusterFilterElement = document.getElementById('clusterFilter');
    const candleTypeFilterElement = document.getElementById('candleTypeFilter');
    
    const clusterFilter = clusterFilterElement ? clusterFilterElement.value : 'all';
    const candleTypeFilter = candleTypeFilterElement ? candleTypeFilterElement.value : 'all';
    
    let filtered = [...stockData];
    
    // Add visibility flags instead of removing data
    filtered = filtered.map(d => {
        let visible = true;
    
        // Filter by cluster
        if (clusterFilter !== 'all') {
            const cluster = parseInt(clusterFilter);
            visible = visible && d.predicted_cluster === cluster;
        }
        
        // Filter by candle type (bullish/bearish)
        if (candleTypeFilter !== 'all') {
            if (candleTypeFilter === 'bullish') {
                visible = visible && d.close > d.open;
            } else if (candleTypeFilter === 'bearish') {
                visible = visible && d.close < d.open;
            }
        }
        
        return { ...d, visible };
    });
    
    filteredData = filtered;
}

function drawChart() {
    if (!ctx || filteredData.length === 0) {
        // Clear canvas and show message
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = '120px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No data to display', canvas.width / 2, canvas.height / 2);
            ctx.font = '80px Arial';
            ctx.fillText('Load CSV data or generate sample data', canvas.width / 2, canvas.height / 2 + 150);
        }
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(0, 20, 40, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply pan transformations only (zoom disabled)
    ctx.save();
    ctx.translate(panOffsetX, panOffsetY);
    // ctx.scale(zoomLevel, zoomLevel); // Disabled zoom scaling
    
    const chartTypeElement = document.getElementById('chartType');
    const chartType = chartTypeElement ? chartTypeElement.value : 'candlestick';
    
    if (chartType === 'candlestick') {
        drawCandlestickChart();
    } else if (chartType === 'scatter') {
        drawScatterChart();
    } else if (chartType === 'line') {
        drawLineChart();
    } else if (chartType === 'histogram') {
        drawHistogramChart();
    }
    
    ctx.restore();
    
    // Draw interactive elements (not affected by zoom/pan)
    drawCrosshair();
    drawTooltip();
}

function drawCandlestickChart() {
    const candleWidthElement = document.getElementById('candleWidth');
    const showVolumeElement = document.getElementById('showVolume');
    
    const candleWidth = candleWidthElement ? parseInt(candleWidthElement.value) : 8;
    const showVolume = showVolumeElement ? showVolumeElement.value === 'true' : false;
    
    if (stockData.length === 0) return;
    
    // Update visible range if needed
    updateVisibleRange();
    
    // Get the data points to display from original data
    const displayData = stockData.slice(visibleStartIndex, visibleEndIndex + 1);
    if (displayData.length === 0) return;
    
    // Filter display data based on current filters
    const filteredDisplayData = displayData.filter(d => {
        let visible = true;
        
        // Filter by cluster
        const clusterFilterElement = document.getElementById('clusterFilter');
        const clusterFilter = clusterFilterElement ? clusterFilterElement.value : 'all';
        if (clusterFilter !== 'all') {
            const cluster = parseInt(clusterFilter);
            visible = visible && d.predicted_cluster === cluster;
        }
        
        // Filter by candle type (bullish/bearish)
        const candleTypeFilterElement = document.getElementById('candleTypeFilter');
        const candleTypeFilter = candleTypeFilterElement ? candleTypeFilterElement.value : 'all';
        if (candleTypeFilter !== 'all') {
            if (candleTypeFilter === 'bullish') {
                visible = visible && d.close > d.open;
            } else if (candleTypeFilter === 'bearish') {
                visible = visible && d.close < d.open;
            }
        }
        
        return visible;
    });
    
    // Calculate scales based on visible data
    const priceData = displayData.map(d => [d.high, d.low]).flat();
    const maxPrice = Math.max(...priceData);
    const minPrice = Math.min(...priceData);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1;
    
    const volumeData = displayData.map(d => d.volume);
    const maxVolume = Math.max(...volumeData);
    
    const chartHeight = showVolume ? chartArea.height * 0.7 : chartArea.height;
    const volumeHeight = showVolume ? chartArea.height * 0.25 : 0;
    
    const xStep = chartArea.width / displayData.length;
    
    // Draw grid
    drawGrid(minPrice - padding, maxPrice + padding, chartHeight);
    
    // Draw candlesticks
    displayData.forEach((data, i) => {
        const x = chartArea.x + i * xStep + xStep / 2;
        const color = getDataColor(data);
        
        // Check if this data point should be visible based on filters
        let visible = true;
        
        // Filter by cluster
        const clusterFilterElement = document.getElementById('clusterFilter');
        const clusterFilter = clusterFilterElement ? clusterFilterElement.value : 'all';
        if (clusterFilter !== 'all') {
            const cluster = parseInt(clusterFilter);
            visible = visible && data.predicted_cluster === cluster;
        }
        
        // Filter by candle type (bullish/bearish)
        const candleTypeFilterElement = document.getElementById('candleTypeFilter');
        const candleTypeFilter = candleTypeFilterElement ? candleTypeFilterElement.value : 'all';
        if (candleTypeFilter !== 'all') {
            if (candleTypeFilter === 'bullish') {
                visible = visible && data.close > data.open;
            } else if (candleTypeFilter === 'bearish') {
                visible = visible && data.close < data.open;
            }
        }
        
        if (visible) {
            drawCandlestick(
                x, 
                data.open, 
                data.high, 
                data.low, 
                data.close,
                minPrice - padding,
                maxPrice + padding,
                chartHeight,
                candleWidth,
                color
            );
            
            // Draw volume bar if enabled
            if (showVolume) {
                drawVolumeBar(
                    x,
                    data.volume,
                    maxVolume,
                    chartArea.y + chartHeight + 40,
                    volumeHeight,
                    candleWidth,
                    color
                );
            }
        }
    });
    
    // Draw axes labels
    drawAxes(minPrice - padding, maxPrice + padding);
}

function drawScatterChart() {
    const xAxisElement = document.getElementById('xAxis');
    const yAxisElement = document.getElementById('yAxis');
    
    const xAxis = xAxisElement ? xAxisElement.value : 'timestamp';
    const yAxis = yAxisElement ? yAxisElement.value : 'close';
    
    if (stockData.length === 0) return;
    
    // Update visible range if needed
    updateVisibleRange();
    
    // Get the data points to display from original data
    const displayData = stockData.slice(visibleStartIndex, visibleEndIndex + 1);
    if (displayData.length === 0) return;
    
    // Get data for x and y axes, handling timestamps specially
    let xData, yData;
    
    if (xAxis === 'timestamp') {
        // Convert timestamps to numeric values (milliseconds)
        xData = displayData.map(d => {
            if (d.date) {
                return d.date.getTime();
            } else if (d.timestamp) {
                return new Date(d.timestamp).getTime();
            }
            return 0;
        });
    } else {
        xData = displayData.map(d => d[xAxis]);
    }
    
    if (yAxis === 'timestamp') {
        // Convert timestamps to numeric values (milliseconds)
        yData = displayData.map(d => {
            if (d.date) {
                return d.date.getTime();
            } else if (d.timestamp) {
                return new Date(d.timestamp).getTime();
            }
            return 0;
        });
    } else {
        yData = displayData.map(d => d[yAxis]);
    }
    
    const minX = Math.min(...xData);
    const maxX = Math.max(...xData);
    const minY = Math.min(...yData);
    const maxY = Math.max(...yData);
    
    const xRange = maxX - minX;
    const yRange = maxY - minY;
    const xPadding = xRange * 0.05;
    const yPadding = yRange * 0.05;
    
    // Draw grid
    drawCustomGrid(minX - xPadding, maxX + xPadding, minY - yPadding, maxY + yPadding);
    
    // Draw scatter points
    displayData.forEach((data, i) => {
        // Check if this data point should be visible based on filters
        let visible = true;
        
        // Filter by cluster
        const clusterFilterElement = document.getElementById('clusterFilter');
        const clusterFilter = clusterFilterElement ? clusterFilterElement.value : 'all';
        if (clusterFilter !== 'all') {
            const cluster = parseInt(clusterFilter);
            visible = visible && data.predicted_cluster === cluster;
        }
        
        // Filter by candle type (bullish/bearish)
        const candleTypeFilterElement = document.getElementById('candleTypeFilter');
        const candleTypeFilter = candleTypeFilterElement ? candleTypeFilterElement.value : 'all';
        if (candleTypeFilter !== 'all') {
            if (candleTypeFilter === 'bullish') {
                visible = visible && data.close > data.open;
            } else if (candleTypeFilter === 'bearish') {
                visible = visible && data.close < data.open;
            }
        }
        
        if (visible) {
            const color = getDataColor(data);
            
            // Get x and y values, handling timestamps
            let xValue, yValue;
            
            if (xAxis === 'timestamp') {
                xValue = data.date ? data.date.getTime() : new Date(data.timestamp).getTime();
            } else {
                xValue = data[xAxis];
            }
            
            if (yAxis === 'timestamp') {
                yValue = data.date ? data.date.getTime() : new Date(data.timestamp).getTime();
            } else {
                yValue = data[yAxis];
            }
            
            const x = chartArea.x + ((xValue - minX + xPadding) / (xRange + 2 * xPadding)) * chartArea.width;
            const y = chartArea.y + chartArea.height - ((yValue - minY + yPadding) / (yRange + 2 * yPadding)) * chartArea.height;
        
            // Draw point
            ctx.fillStyle = color.main;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fill();
            
            // Add glow effect
            ctx.shadowColor = color.shadow;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    });
    
    // Draw axes labels
    drawCustomAxes(minX - xPadding, maxX + xPadding, minY - yPadding, maxY + yPadding, xAxis, yAxis);
}

function drawLineChart() {
    const xAxisElement = document.getElementById('xAxis');
    const yAxisElement = document.getElementById('yAxis');
    const showClusterColorsElement = document.getElementById('showClusterColors');
    
    const xAxis = xAxisElement ? xAxisElement.value : 'timestamp';
    const yAxis = yAxisElement ? yAxisElement.value : 'close';
    const showClusterColors = showClusterColorsElement ? showClusterColorsElement.checked : true;
    
    if (stockData.length === 0) return;
    
    // Update visible range if needed
    updateVisibleRange();
    
    // Get the data points to display from original data
    const displayData = stockData.slice(visibleStartIndex, visibleEndIndex + 1);
    if (displayData.length === 0) return;
    
    // Get data for x and y axes, handling timestamps specially
    let xData, yData;
    
    if (xAxis === 'timestamp') {
        // Convert timestamps to numeric values (milliseconds)
        xData = displayData.map(d => {
            if (d.date) {
                return d.date.getTime();
            } else if (d.timestamp) {
                return new Date(d.timestamp).getTime();
            }
            return 0;
        });
    } else {
        xData = displayData.map(d => d[xAxis]);
    }
    
    if (yAxis === 'timestamp') {
        // Convert timestamps to numeric values (milliseconds)
        yData = displayData.map(d => {
            if (d.date) {
                return d.date.getTime();
            } else if (d.timestamp) {
                return new Date(d.timestamp).getTime();
            }
            return 0;
        });
    } else {
        yData = displayData.map(d => d[yAxis]);
    }
    
    const minX = Math.min(...xData);
    const maxX = Math.max(...xData);
    const minY = Math.min(...yData);
    const maxY = Math.max(...yData);
    
    const xRange = maxX - minX;
    const yRange = maxY - minY;
    const xPadding = xRange * 0.05;
    const yPadding = yRange * 0.05;
    
    // Draw grid
    drawCustomGrid(minX - xPadding, maxX + xPadding, minY - yPadding, maxY + yPadding);
    
    if (showClusterColors) {
    // Group data by cluster for different colored lines
    const clusterGroups = {};
    displayData.forEach((data, i) => {
        // Check if this data point should be visible based on filters
        let visible = true;
        
        // Filter by cluster
        const clusterFilterElement = document.getElementById('clusterFilter');
        const clusterFilter = clusterFilterElement ? clusterFilterElement.value : 'all';
        if (clusterFilter !== 'all') {
            const cluster = parseInt(clusterFilter);
            visible = visible && data.predicted_cluster === cluster;
        }
        
        // Filter by candle type (bullish/bearish)
        const candleTypeFilterElement = document.getElementById('candleTypeFilter');
        const candleTypeFilter = candleTypeFilterElement ? candleTypeFilterElement.value : 'all';
        if (candleTypeFilter !== 'all') {
            if (candleTypeFilter === 'bullish') {
                visible = visible && data.close > data.open;
            } else if (candleTypeFilter === 'bearish') {
                visible = visible && data.close < data.open;
            }
        }
        
        if (visible) {
            const cluster = data.predicted_cluster || 0;
            if (!clusterGroups[cluster]) {
                clusterGroups[cluster] = [];
            }
            // Get x and y values, handling timestamps
            let xValue, yValue;
            
            if (xAxis === 'timestamp') {
                xValue = data.date ? data.date.getTime() : new Date(data.timestamp).getTime();
            } else {
                xValue = data[xAxis];
            }
            
            if (yAxis === 'timestamp') {
                yValue = data.date ? data.date.getTime() : new Date(data.timestamp).getTime();
            } else {
                yValue = data[yAxis];
            }
            
            clusterGroups[cluster].push({
                x: xValue,
                y: yValue,
                index: i
            });
        }
    });
    
    // Draw lines for each cluster
    Object.keys(clusterGroups).forEach(cluster => {
        const group = clusterGroups[cluster];
        const color = clusterColors[cluster] || clusterColors[0];
        
        ctx.strokeStyle = color.main;
        ctx.lineWidth = 4;
        ctx.shadowColor = color.shadow;
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        group.forEach((point, i) => {
            const x = chartArea.x + ((point.x - minX + xPadding) / (xRange + 2 * xPadding)) * chartArea.width;
            const y = chartArea.y + chartArea.height - ((point.y - minY + yPadding) / (yRange + 2 * yPadding)) * chartArea.height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Draw points
        group.forEach(point => {
            const x = chartArea.x + ((point.x - minX + xPadding) / (xRange + 2 * xPadding)) * chartArea.width;
            const y = chartArea.y + chartArea.height - ((point.y - minY + yPadding) / (yRange + 2 * yPadding)) * chartArea.height;
            
            ctx.fillStyle = color.main;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();
        });
    });
    } else {
        // Draw single line with price-based coloring
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(78, 205, 196, 0.3)';
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        let firstPoint = true;
        displayData.forEach((data, i) => {
            // Check if this data point should be visible based on filters
            let visible = true;
            
            // Filter by cluster
            const clusterFilterElement = document.getElementById('clusterFilter');
        const clusterFilter = clusterFilterElement ? clusterFilterElement.value : 'all';
            if (clusterFilter !== 'all') {
                const cluster = parseInt(clusterFilter);
                visible = visible && data.predicted_cluster === cluster;
            }
            
            // Filter by candle type (bullish/bearish)
            const candleTypeFilterElement = document.getElementById('candleTypeFilter');
        const candleTypeFilter = candleTypeFilterElement ? candleTypeFilterElement.value : 'all';
            if (candleTypeFilter !== 'all') {
                if (candleTypeFilter === 'bullish') {
                    visible = visible && data.close > data.open;
                } else if (candleTypeFilter === 'bearish') {
                    visible = visible && data.close < data.open;
                }
            }
            
            if (visible) {
                // Get x and y values, handling timestamps
                let xValue, yValue;
                
                if (xAxis === 'timestamp') {
                    xValue = data.date ? data.date.getTime() : new Date(data.timestamp).getTime();
                } else {
                    xValue = data[xAxis];
                }
                
                if (yAxis === 'timestamp') {
                    yValue = data.date ? data.date.getTime() : new Date(data.timestamp).getTime();
                } else {
                    yValue = data[yAxis];
                }
                
                const x = chartArea.x + ((xValue - minX + xPadding) / (xRange + 2 * xPadding)) * chartArea.width;
                const y = chartArea.y + chartArea.height - ((yValue - minY + yPadding) / (yRange + 2 * yPadding)) * chartArea.height;
                
                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Draw points with individual colors
        displayData.forEach((data, i) => {
            // Check if this data point should be visible based on filters
            let visible = true;
            
            // Filter by cluster
            const clusterFilterElement = document.getElementById('clusterFilter');
        const clusterFilter = clusterFilterElement ? clusterFilterElement.value : 'all';
            if (clusterFilter !== 'all') {
                const cluster = parseInt(clusterFilter);
                visible = visible && data.predicted_cluster === cluster;
            }
            
            // Filter by candle type (bullish/bearish)
            const candleTypeFilterElement = document.getElementById('candleTypeFilter');
        const candleTypeFilter = candleTypeFilterElement ? candleTypeFilterElement.value : 'all';
            if (candleTypeFilter !== 'all') {
                if (candleTypeFilter === 'bullish') {
                    visible = visible && data.close > data.open;
                } else if (candleTypeFilter === 'bearish') {
                    visible = visible && data.close < data.open;
                }
            }
            
            if (visible) {
                // Get x and y values, handling timestamps
                let xValue, yValue;
                
                if (xAxis === 'timestamp') {
                    xValue = data.date ? data.date.getTime() : new Date(data.timestamp).getTime();
                } else {
                    xValue = data[xAxis];
                }
                
                if (yAxis === 'timestamp') {
                    yValue = data.date ? data.date.getTime() : new Date(data.timestamp).getTime();
                } else {
                    yValue = data[yAxis];
                }
                
                const x = chartArea.x + ((xValue - minX + xPadding) / (xRange + 2 * xPadding)) * chartArea.width;
                const y = chartArea.y + chartArea.height - ((yValue - minY + yPadding) / (yRange + 2 * yPadding)) * chartArea.height;
                const color = getDataColor(data);
                
                ctx.fillStyle = color.main;
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }
    
    // Draw axes labels
    drawCustomAxes(minX - xPadding, maxX + xPadding, minY - yPadding, maxY + yPadding, xAxis, yAxis);
}

function drawHistogramChart() {
    const featureElement = document.getElementById('histogramFeature');
    const showClusterColorsElement = document.getElementById('showClusterColors');
    
    const feature = featureElement ? featureElement.value : 'close';
    const showClusterColors = showClusterColorsElement ? showClusterColorsElement.checked : true;
    
    if (stockData.length === 0) return;
    
    // Update visible range if needed
    updateVisibleRange();
    
    // Get the data points to display from original data
    const displayData = stockData.slice(visibleStartIndex, visibleEndIndex + 1);
    if (displayData.length === 0) return;
    
    // Filter display data based on current filters
    const filteredDisplayData = displayData.filter(d => {
        let visible = true;
        
        // Filter by cluster
        const clusterFilterElement = document.getElementById('clusterFilter');
        const clusterFilter = clusterFilterElement ? clusterFilterElement.value : 'all';
        if (clusterFilter !== 'all') {
            const cluster = parseInt(clusterFilter);
            visible = visible && d.predicted_cluster === cluster;
        }
        
        // Filter by candle type (bullish/bearish)
        const candleTypeFilterElement = document.getElementById('candleTypeFilter');
        const candleTypeFilter = candleTypeFilterElement ? candleTypeFilterElement.value : 'all';
        if (candleTypeFilter !== 'all') {
            if (candleTypeFilter === 'bullish') {
                visible = visible && d.close > d.open;
            } else if (candleTypeFilter === 'bearish') {
                visible = visible && d.close < d.open;
            }
        }
        
        return visible;
    });
    
    const data = filteredDisplayData.map(d => d[feature]);
    
    const minValue = Math.min(...data);
    const maxValue = Math.max(...data);
    const range = maxValue - minValue;
    const numBins = Math.min(20, Math.floor(Math.sqrt(data.length)));
    const binWidth = range / numBins;
    
    // Create bins
    const bins = Array(numBins).fill(0);
    const binData = {};
    
    data.forEach((value, i) => {
        const binIndex = Math.min(Math.floor((value - minValue) / binWidth), numBins - 1);
        bins[binIndex]++;
        
        if (!binData[binIndex]) {
            binData[binIndex] = [];
        }
        binData[binIndex].push({
            value: value,
            data: filteredDisplayData[i]
        });
    });
    
    const maxCount = Math.max(...bins);
    const barWidth = chartArea.width / numBins;
    
    // Draw histogram bars
    bins.forEach((count, binIndex) => {
        if (count === 0) return;
        
        const x = chartArea.x + binIndex * barWidth;
        const height = (count / maxCount) * chartArea.height;
        const y = chartArea.y + chartArea.height - height;
        
        if (showClusterColors) {
        // Calculate cluster distribution for this bin
        const clusterCounts = {};
        binData[binIndex].forEach(item => {
                const cluster = item.data.predicted_cluster || 0;
                clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1;
        });
        
        // Draw stacked bars for each cluster
        let currentY = y;
        Object.keys(clusterCounts).forEach(cluster => {
            const clusterCount = clusterCounts[cluster];
            const clusterHeight = (clusterCount / count) * height;
            const color = clusterColors[cluster] || clusterColors[0];
            
            ctx.fillStyle = color.main;
            ctx.fillRect(x, currentY, barWidth * 0.8, clusterHeight);
            
            // Add border
            ctx.strokeStyle = color.main;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, currentY, barWidth * 0.8, clusterHeight);
            
            currentY += clusterHeight;
        });
        } else {
            // Draw single color bars based on price movement
            const bullishCount = binData[binIndex].filter(item => item.data.close > item.data.open).length;
            const bearishCount = binData[binIndex].filter(item => item.data.close < item.data.open).length;
            const dojiCount = binData[binIndex].filter(item => item.data.close === item.data.open).length;
            
            let currentY = y;
            
            // Draw bullish portion
            if (bullishCount > 0) {
                const bullishHeight = (bullishCount / count) * height;
                const color = defaultColors.bullish;
                ctx.fillStyle = color.main;
                ctx.fillRect(x, currentY, barWidth * 0.8, bullishHeight);
                ctx.strokeStyle = color.main;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, currentY, barWidth * 0.8, bullishHeight);
                currentY += bullishHeight;
            }
            
            // Draw bearish portion
            if (bearishCount > 0) {
                const bearishHeight = (bearishCount / count) * height;
                const color = defaultColors.bearish;
                ctx.fillStyle = color.main;
                ctx.fillRect(x, currentY, barWidth * 0.8, bearishHeight);
                ctx.strokeStyle = color.main;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, currentY, barWidth * 0.8, bearishHeight);
                currentY += bearishHeight;
            }
            
            // Draw doji portion
            if (dojiCount > 0) {
                const dojiHeight = (dojiCount / count) * height;
                const color = defaultColors.neutral;
                ctx.fillStyle = color.main;
                ctx.fillRect(x, currentY, barWidth * 0.8, dojiHeight);
                ctx.strokeStyle = color.main;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, currentY, barWidth * 0.8, dojiHeight);
            }
        }
    });
    
    // Draw axes labels
    drawHistogramAxes(minValue, maxValue, maxCount, feature);
}

function drawGrid(minPrice, maxPrice, chartHeight) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    
    // Horizontal grid lines
    for (let i = 0; i <= 10; i++) {
        const y = chartArea.y + (i / 10) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(chartArea.x, y);
        ctx.lineTo(chartArea.x + chartArea.width, y);
        ctx.stroke();
    }
    
    // Vertical grid lines
    const timeStep = Math.max(1, Math.floor(filteredData.length / 20));
    for (let i = 0; i < filteredData.length; i += timeStep) {
        const x = chartArea.x + (i / filteredData.length) * chartArea.width;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.y);
        ctx.lineTo(x, chartArea.y + chartHeight);
        ctx.stroke();
    }
}

function drawCandlestick(x, open, high, low, close, minPrice, maxPrice, chartHeight, width, color) {
    const priceRange = maxPrice - minPrice;
    const yScale = chartHeight / priceRange;
    
    const openY = chartArea.y + chartHeight - (open - minPrice) * yScale;
    const closeY = chartArea.y + chartHeight - (close - minPrice) * yScale;
    const highY = chartArea.y + chartHeight - (high - minPrice) * yScale;
    const lowY = chartArea.y + chartHeight - (low - minPrice) * yScale;
    
    const isGreen = close > open;
    const bodyHeight = Math.abs(closeY - openY);
    const bodyTop = Math.min(openY, closeY);
    
    // Draw shadow (wick)
    ctx.strokeStyle = color.main;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();
    
    // Draw body
    ctx.fillStyle = isGreen ? color.main : 'rgba(255, 0, 0, 0.8)';
    ctx.strokeStyle = color.main;
    ctx.lineWidth = 3;
    
    if (bodyHeight < 6) {
        // Draw as line for very small bodies
        ctx.beginPath();
        ctx.moveTo(x - width/2, openY);
        ctx.lineTo(x + width/2, openY);
        ctx.stroke();
    } else {
        // Draw rectangle body
        ctx.fillRect(x - width/2, bodyTop, width, bodyHeight);
        ctx.strokeRect(x - width/2, bodyTop, width, bodyHeight);
    }
    
    // Add glow effect
    ctx.shadowColor = color.shadow;
    ctx.shadowBlur = 20;
    ctx.strokeRect(x - width/2, bodyTop, width, bodyHeight);
    ctx.shadowBlur = 0;
}

function drawVolumeBar(x, volume, maxVolume, startY, maxHeight, width, color) {
    const height = (volume / maxVolume) * maxHeight;
    
    ctx.fillStyle = color.shadow;
    ctx.fillRect(x - width/2, startY + maxHeight - height, width, height);
    
    ctx.strokeStyle = color.main;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - width/2, startY + maxHeight - height, width, height);
}

function drawAxes(minPrice, maxPrice) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '48px Arial';
    ctx.textAlign = 'right';
    
    // Price labels
    for (let i = 0; i <= 10; i++) {
        const price = minPrice + (maxPrice - minPrice) * (i / 10);
        const y = chartArea.y + chartArea.height - (i / 10) * chartArea.height;
        ctx.fillText(price.toFixed(2), chartArea.x - 20, y + 15);
    }
    
    // Time labels
    ctx.textAlign = 'center';
    const timeStep = Math.max(1, Math.floor(filteredData.length / 10));
    for (let i = 0; i < filteredData.length; i += timeStep) {
        if (filteredData[i] && filteredData[i].date) {
            const x = chartArea.x + (i / filteredData.length) * chartArea.width;
            const timeStr = filteredData[i].date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
            ctx.fillText(timeStr, x, chartArea.y + chartArea.height + 50);
        }
    }
}

function drawCustomGrid(minX, maxX, minY, maxY) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    
    // Horizontal grid lines
    for (let i = 0; i <= 10; i++) {
        const y = chartArea.y + (i / 10) * chartArea.height;
        ctx.beginPath();
        ctx.moveTo(chartArea.x, y);
        ctx.lineTo(chartArea.x + chartArea.width, y);
        ctx.stroke();
    }
    
    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
        const x = chartArea.x + (i / 10) * chartArea.width;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.y);
        ctx.lineTo(x, chartArea.y + chartArea.height);
        ctx.stroke();
    }
}

function drawCustomAxes(minX, maxX, minY, maxY, xLabel, yLabel) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '48px Arial';
    ctx.textAlign = 'right';
    
    // Y-axis labels
    for (let i = 0; i <= 10; i++) {
        const value = minY + (maxY - minY) * (i / 10);
        const y = chartArea.y + chartArea.height - (i / 10) * chartArea.height;
        
        // Format timestamp values differently
        if (yLabel === 'timestamp') {
            const date = new Date(value);
            ctx.fillText(date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }), chartArea.x - 20, y + 15);
        } else {
        ctx.fillText(value.toFixed(2), chartArea.x - 20, y + 15);
        }
    }
    
    // X-axis labels
    ctx.textAlign = 'center';
    for (let i = 0; i <= 10; i++) {
        const value = minX + (maxX - minX) * (i / 10);
        const x = chartArea.x + (i / 10) * chartArea.width;
        
        // Format timestamp values differently
        if (xLabel === 'timestamp') {
            const date = new Date(value);
            ctx.fillText(date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }), x, chartArea.y + chartArea.height + 50);
        } else {
        ctx.fillText(value.toFixed(2), x, chartArea.y + chartArea.height + 50);
        }
    }
    
    // Axis titles
    ctx.textAlign = 'center';
    ctx.font = '60px Arial';
    ctx.fillText(yLabel, 30, chartArea.y + chartArea.height / 2);
    ctx.fillText(xLabel, chartArea.x + chartArea.width / 2, chartArea.y + chartArea.height + 100);
}

function drawHistogramAxes(minValue, maxValue, maxCount, feature) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '48px Arial';
    ctx.textAlign = 'right';
    
    // Y-axis labels (count)
    for (let i = 0; i <= 10; i++) {
        const count = (maxCount * i) / 10;
        const y = chartArea.y + chartArea.height - (i / 10) * chartArea.height;
        ctx.fillText(Math.round(count).toString(), chartArea.x - 20, y + 15);
    }
    
    // X-axis labels (value range)
    ctx.textAlign = 'center';
    for (let i = 0; i <= 10; i++) {
        const value = minValue + (maxValue - minValue) * (i / 10);
        const x = chartArea.x + (i / 10) * chartArea.width;
        ctx.fillText(value.toFixed(2), x, chartArea.y + chartArea.height + 50);
    }
    
    // Axis titles
    ctx.textAlign = 'center';
    ctx.font = '60px Arial';
    ctx.fillText('Count', 30, chartArea.y + chartArea.height / 2);
    ctx.fillText(feature, chartArea.x + chartArea.width / 2, chartArea.y + chartArea.height + 100);
}

function updateLegend() {
    const legend = document.getElementById('legend');
    if (!legend) return;
    
    legend.innerHTML = '';
    
    if (filteredData.length === 0) return;
    
    const showClusterColorsElement = document.getElementById('showClusterColors');
    const showClusterColors = showClusterColorsElement ? showClusterColorsElement.checked : true;
    
    if (showClusterColors) {
        // Show cluster information
        const uniqueClusters = [...new Set(filteredData.filter(d => d.visible).map(d => d.predicted_cluster || 0))].sort();
    
    uniqueClusters.forEach(cluster => {
        const color = clusterColors[cluster] || clusterColors[0];
            const count = filteredData.filter(d => d.visible && (d.predicted_cluster || 0) === cluster).length;
        
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color" style="background-color: ${color.main}"></div>
            <span>Cluster ${cluster} (${count} points)</span>
        `;
        legend.appendChild(item);
    });
    } else {
        // Show price movement information
        const visibleData = filteredData.filter(d => d.visible);
        const bullishCount = visibleData.filter(d => d.close > d.open).length;
        const bearishCount = visibleData.filter(d => d.close < d.open).length;
        const neutralCount = visibleData.filter(d => d.close === d.open).length;
        
        // Add bullish candles
        if (bullishCount > 0) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background-color: ${defaultColors.bullish.main}"></div>
                <span>Bullish (${bullishCount} candles)</span>
            `;
            legend.appendChild(item);
        }
        
        // Add bearish candles
        if (bearishCount > 0) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background-color: ${defaultColors.bearish.main}"></div>
                <span>Bearish (${bearishCount} candles)</span>
            `;
            legend.appendChild(item);
        }
        
        // Add neutral candles
        if (neutralCount > 0) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background-color: ${defaultColors.neutral.main}"></div>
                <span>Neutral (${neutralCount} candles)</span>
            `;
            legend.appendChild(item);
        }
    }
    
    // Add candle type information if filter is applied
    const candleTypeFilterElement = document.getElementById('candleTypeFilter');
    const candleTypeFilter = candleTypeFilterElement ? candleTypeFilterElement.value : 'all';
    if (candleTypeFilter !== 'all') {
        const candleTypeItem = document.createElement('div');
        candleTypeItem.className = 'legend-item';
        const candleTypeColor = candleTypeFilter === 'bullish' ? '#00ff88' : '#ff6b6b';
        const candleTypeLabel = candleTypeFilter === 'bullish' ? 'Bullish' : 'Bearish';
        candleTypeItem.innerHTML = `
            <div class="legend-color" style="background-color: ${candleTypeColor}"></div>
            <span>${candleTypeLabel} Candles Only</span>
        `;
        legend.appendChild(candleTypeItem);
    }
    
}

function updateStats() {
    const statsContainer = document.getElementById('stats');
    if (!statsContainer) return;
    
    if (filteredData.length === 0) {
        statsContainer.innerHTML = '<div class="stat-card"><div class="stat-value">No Data</div><div class="stat-label">Load data to see stats</div></div>';
        return;
    }
    
    // Only use visible data for calculations
    const visibleData = filteredData.filter(d => d.visible);
    const prices = visibleData.map(d => d.close);
    const volumes = visibleData.map(d => d.volume);
    
    if (visibleData.length === 0) {
        document.getElementById('stats').innerHTML = '<div class="stat-card"><div class="stat-value">No Visible Data</div><div class="stat-label">Adjust filters to see data</div></div>';
        return;
    }
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    
    // Calculate cluster distribution
    const clusterCounts = {};
    visibleData.forEach(d => {
        const cluster = d.predicted_cluster || 0;
        clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1;
    });
    
    // Calculate price movement statistics
    const bullishCount = visibleData.filter(d => d.close > d.open).length;
    const bearishCount = visibleData.filter(d => d.close < d.open).length;
    const neutralCount = visibleData.filter(d => d.close === d.open).length;
    
    let statsHtml = `
        <div class="stat-card">
            <div class="stat-value">${visibleData.length}</div>
            <div class="stat-label">Visible Points</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${filteredData.length}</div>
            <div class="stat-label">Total Points</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">₹${avgPrice.toFixed(2)}</div>
            <div class="stat-label">Avg Price</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">₹${minPrice.toFixed(2)}</div>
            <div class="stat-label">Min Price</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">₹${maxPrice.toFixed(2)}</div>
            <div class="stat-label">Max Price</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${(avgVolume / 1000000).toFixed(2)}M</div>
            <div class="stat-label">Avg Volume</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${Object.keys(clusterCounts).length}</div>
            <div class="stat-label">Active Clusters</div>
        </div>
    `;
    
    // Add price movement statistics
    if (bullishCount > 0) {
        statsHtml += `
            <div class="stat-card">
                <div class="stat-value" style="color: ${defaultColors.bullish.main}">${bullishCount}</div>
                <div class="stat-label">Bullish</div>
            </div>
        `;
    }
    
    if (bearishCount > 0) {
        statsHtml += `
            <div class="stat-card">
                <div class="stat-value" style="color: ${defaultColors.bearish.main}">${bearishCount}</div>
                <div class="stat-label">Bearish</div>
            </div>
        `;
    }
    
    if (neutralCount > 0) {
        statsHtml += `
            <div class="stat-card">
                <div class="stat-value" style="color: ${defaultColors.neutral.main}">${neutralCount}</div>
                <div class="stat-label">Neutral</div>
            </div>
        `;
    }
    
    statsContainer.innerHTML = statsHtml;
}


// Settings panel toggle
function toggleSettings() {
    const settingsPanel = document.getElementById('overlaySettingsPanel');
    settingsPanel.classList.toggle('hidden');
}

// Panel minimize/maximize functionality
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    const minimizeBtn = panel.querySelector('.minimize-btn');
    
    if (panel.classList.contains('minimized')) {
        panel.classList.remove('minimized');
        minimizeBtn.textContent = '−';
    } else {
        panel.classList.add('minimized');
        minimizeBtn.textContent = '+';
    }
}

// Update panel opacity
function updatePanelOpacity() {
    const opacityElement = document.getElementById('panelOpacity');
    const opacity = opacityElement ? opacityElement.value : '0.8';
    const opacityValue = document.getElementById('opacityValue');
    const panels = document.querySelectorAll('.overlay-panel');
    
    opacityValue.textContent = Math.round(opacity * 100) + '%';
    
    panels.forEach(panel => {
        panel.style.background = `rgba(0, 0, 0, ${opacity})`;
    });
}

// Update auto minimize setting
function updateAutoMinimize() {
    const autoMinimize = document.getElementById('autoMinimize').checked;
    const panels = document.querySelectorAll('.overlay-panel');
    
    if (autoMinimize) {
        // Auto minimize all panels after 5 seconds of inactivity
        let timeoutId;
        const resetTimeout = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                panels.forEach(panel => {
                    if (!panel.classList.contains('minimized')) {
                        panel.classList.add('minimized');
                        const minimizeBtn = panel.querySelector('.minimize-btn');
                        if (minimizeBtn) minimizeBtn.textContent = '+';
                    }
                });
            }, 5000);
        };
        
        // Reset timeout on any interaction
        panels.forEach(panel => {
            panel.addEventListener('mouseenter', resetTimeout);
            panel.addEventListener('click', resetTimeout);
        });
        
        resetTimeout();
    }
}

// Update minimize buttons visibility
function updateMinimizeButtons() {
    const showButtons = document.getElementById('showMinimizeButtons').checked;
    const minimizeButtons = document.querySelectorAll('.minimize-btn');
    
    minimizeButtons.forEach(btn => {
        btn.style.display = showButtons ? 'block' : 'none';
    });
}

// Update panel visibility based on checkboxes
function updatePanelVisibility() {
    const panels = {
        'chartPanel': document.getElementById('showChartPanel').checked,
        'filtersPanel': document.getElementById('showFiltersPanel').checked,
        'colorsPanel': document.getElementById('showColorsPanel').checked,
        'statsPanel': document.getElementById('showStatsPanel').checked,
        'legendPanel': document.getElementById('showLegendPanel').checked
    };
    
    // Show/hide individual panels
    Object.keys(panels).forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = panels[panelId] ? 'block' : 'none';
        }
    });
    
    // Left panel is always visible (no toggle button)
    const leftPanel = document.getElementById('overlayLeft');
    leftPanel.style.display = 'flex';
}

// Select all panels
function selectAllPanels() {
    const checkboxes = [
        'showChartPanel',
        'showFiltersPanel', 
        'showColorsPanel',
        'showStatsPanel',
        'showLegendPanel'
    ];
    
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    
    updatePanelVisibility();
}

// Deselect all panels
function deselectAllPanels() {
    const checkboxes = [
        'showChartPanel',
        'showFiltersPanel', 
        'showColorsPanel',
        'showStatsPanel',
        'showLegendPanel'
    ];
    
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = false;
        }
    });
    
    updatePanelVisibility();
}

// Sync overlay controls with main controls
function syncOverlayControls() {
    // Chart type
    const mainChartType = document.getElementById('chartType');
    const overlayChartType = document.getElementById('overlayChartType');
    if (mainChartType && overlayChartType) {
        overlayChartType.value = mainChartType.value;
    }
    
    
    // Candle width
    const mainCandleWidth = document.getElementById('candleWidth');
    const overlayCandleWidth = document.getElementById('overlayCandleWidth');
    if (mainCandleWidth && overlayCandleWidth) {
        overlayCandleWidth.value = mainCandleWidth.value;
    }
    
    // Cluster filter
    const mainClusterFilter = document.getElementById('clusterFilter');
    const overlayClusterFilter = document.getElementById('overlayClusterFilter');
    if (mainClusterFilter && overlayClusterFilter) {
        overlayClusterFilter.value = mainClusterFilter.value;
    }
    
    // Candle type filter
    const mainCandleTypeFilter = document.getElementById('candleTypeFilter');
    const overlayCandleTypeFilter = document.getElementById('overlayCandleTypeFilter');
    if (mainCandleTypeFilter && overlayCandleTypeFilter) {
        overlayCandleTypeFilter.value = mainCandleTypeFilter.value;
    }
    
    
    // Show cluster colors
    const mainShowClusterColors = document.getElementById('showClusterColors');
    const overlayShowClusterColors = document.getElementById('overlayShowClusterColors');
    if (mainShowClusterColors && overlayShowClusterColors) {
        overlayShowClusterColors.checked = mainShowClusterColors.checked;
    }
    
}

// Sync main controls with overlay controls
function syncMainControls() {
    // Chart type
    const mainChartType = document.getElementById('chartType');
    const overlayChartType = document.getElementById('overlayChartType');
    if (mainChartType && overlayChartType) {
        mainChartType.value = overlayChartType.value;
    }
    
    
    // Candle width
    const mainCandleWidth = document.getElementById('candleWidth');
    const overlayCandleWidth = document.getElementById('overlayCandleWidth');
    if (mainCandleWidth && overlayCandleWidth) {
        mainCandleWidth.value = overlayCandleWidth.value;
    }
    
    // Cluster filter
    const mainClusterFilter = document.getElementById('clusterFilter');
    const overlayClusterFilter = document.getElementById('overlayClusterFilter');
    if (mainClusterFilter && overlayClusterFilter) {
        mainClusterFilter.value = overlayClusterFilter.value;
    }
    
    // Candle type filter
    const mainCandleTypeFilter = document.getElementById('candleTypeFilter');
    const overlayCandleTypeFilter = document.getElementById('overlayCandleTypeFilter');
    if (mainCandleTypeFilter && overlayCandleTypeFilter) {
        mainCandleTypeFilter.value = overlayCandleTypeFilter.value;
    }
    
    
    // Show cluster colors
    const mainShowClusterColors = document.getElementById('showClusterColors');
    const overlayShowClusterColors = document.getElementById('overlayShowClusterColors');
    if (mainShowClusterColors && overlayShowClusterColors) {
        mainShowClusterColors.checked = overlayShowClusterColors.checked;
    }
    
}

// Update overlay stats
function updateOverlayStats() {
    const overlayStats = document.getElementById('overlayStats');
    if (!overlayStats) return;
    
    if (filteredData.length === 0) {
        overlayStats.innerHTML = '<div class="overlay-stat-item"><div class="overlay-stat-value">-</div><div class="overlay-stat-label">No Data</div></div>';
        return;
    }
    
    const visibleData = filteredData.filter(d => d.visible);
    const prices = visibleData.map(d => d.close);
    const volumes = visibleData.map(d => d.volume);
    
    const statsHtml = `
        <div class="overlay-stat-item">
            <div class="overlay-stat-value">${visibleData.length}</div>
            <div class="overlay-stat-label">Visible</div>
        </div>
        <div class="overlay-stat-item">
            <div class="overlay-stat-value">${prices.length > 0 ? prices[0].toFixed(2) : '-'}</div>
            <div class="overlay-stat-label">Current</div>
        </div>
        <div class="overlay-stat-item">
            <div class="overlay-stat-value">${prices.length > 0 ? Math.max(...prices).toFixed(2) : '-'}</div>
            <div class="overlay-stat-label">High</div>
        </div>
        <div class="overlay-stat-item">
            <div class="overlay-stat-value">${prices.length > 0 ? Math.min(...prices).toFixed(2) : '-'}</div>
            <div class="overlay-stat-label">Low</div>
        </div>
        <div class="overlay-stat-item">
            <div class="overlay-stat-value">${volumes.length > 0 ? (volumes.reduce((a, b) => a + b, 0) / volumes.length / 1000).toFixed(0) + 'K' : '-'}</div>
            <div class="overlay-stat-label">Avg Vol</div>
        </div>
    `;
    
    overlayStats.innerHTML = statsHtml;
}

// Update overlay legend
function updateOverlayLegend() {
    const overlayLegend = document.getElementById('overlayLegend');
    if (!overlayLegend) return;
    
    overlayLegend.innerHTML = '';
    
    const showClusterColors = document.getElementById('showClusterColors').checked;
    
    if (showClusterColors) {
        // Show cluster information
        const visibleData = filteredData.filter(d => d.visible);
        const clusterCounts = {};
        
        visibleData.forEach(d => {
            const cluster = d.predicted_cluster || 0;
            clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1;
        });
        
        Object.keys(clusterCounts).forEach(cluster => {
            const count = clusterCounts[cluster];
            const color = clusterColors[cluster] || clusterColors[0];
            
            const item = document.createElement('div');
            item.className = 'overlay-legend-item';
            item.innerHTML = `
                <div class="overlay-legend-color" style="background-color: ${color.main}"></div>
                <span>Cluster ${cluster} (${count})</span>
            `;
            overlayLegend.appendChild(item);
        });
    } else {
        // Show price movement information
        const visibleData = filteredData.filter(d => d.visible);
        const bullishCount = visibleData.filter(d => d.close > d.open).length;
        const bearishCount = visibleData.filter(d => d.close < d.open).length;
        const neutralCount = visibleData.filter(d => d.close === d.open).length;
        
        // Add bullish candles
        if (bullishCount > 0) {
            const item = document.createElement('div');
            item.className = 'overlay-legend-item';
            item.innerHTML = `
                <div class="overlay-legend-color" style="background-color: ${defaultColors.bullish.main}"></div>
                <span>Bullish (${bullishCount})</span>
            `;
            overlayLegend.appendChild(item);
        }
        
        // Add bearish candles
        if (bearishCount > 0) {
            const item = document.createElement('div');
            item.className = 'overlay-legend-item';
            item.innerHTML = `
                <div class="overlay-legend-color" style="background-color: ${defaultColors.bearish.main}"></div>
                <span>Bearish (${bearishCount})</span>
            `;
            overlayLegend.appendChild(item);
        }
        
        // Add neutral candles
        if (neutralCount > 0) {
            const item = document.createElement('div');
            item.className = 'overlay-legend-item';
            item.innerHTML = `
                <div class="overlay-legend-color" style="background-color: ${defaultColors.neutral.main}"></div>
                <span>Neutral (${neutralCount})</span>
            `;
            overlayLegend.appendChild(item);
        }
    }
}

// Click outside to close settings
document.addEventListener('click', (e) => {
    const settingsPanel = document.getElementById('overlaySettingsPanel');
    const settingsButton = document.querySelector('.overlay-settings');
    const resetButton = document.querySelector('.overlay-settings[onclick="resetChartToDefault()"]');
    
    if (!settingsPanel.contains(e.target) && !settingsButton.contains(e.target) && !resetButton.contains(e.target)) {
        settingsPanel.classList.add('hidden');
    }
});

// Interactive chart functions
function setupInteractiveChart() {
    // Use fullscreen canvas if in fullscreen mode
    const targetCanvas = (isFullscreen && window.fullscreenCanvas) ? window.fullscreenCanvas : canvas;
    
    if (!targetCanvas) {
        console.error('Canvas not found for interactive setup');
        return;
    }
    
    // Mouse events
    targetCanvas.addEventListener('mousedown', handleMouseDown);
    targetCanvas.addEventListener('mousemove', handleMouseMove);
    targetCanvas.addEventListener('mouseup', handleMouseUp);
    targetCanvas.addEventListener('mouseenter', handleMouseEnter);
    // Add wheel event listener that only works with modifier keys
    targetCanvas.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            handleWheel(e);
        }
        // Do nothing for normal scroll - allow page scrolling
    });
    targetCanvas.addEventListener('mouseleave', handleMouseLeave);
    
    // Touch events for mobile
    targetCanvas.addEventListener('touchstart', handleTouchStart);
    targetCanvas.addEventListener('touchmove', handleTouchMove);
    targetCanvas.addEventListener('touchend', handleTouchEnd);
}

function handleMouseDown(e) {
    const targetCanvas = (isFullscreen && window.fullscreenCanvas) ? window.fullscreenCanvas : canvas;
    const rect = targetCanvas.getBoundingClientRect();
    const scaleX = targetCanvas.width / rect.width;
    const scaleY = targetCanvas.height / rect.height;
    
    isMouseDown = true;
    isDragging = true;
    lastMouseX = (e.clientX - rect.left) * scaleX;
    lastMouseY = (e.clientY - rect.top) * scaleY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    canvas.style.cursor = 'grabbing';
}

function handleMouseMove(e) {
    const targetCanvas = (isFullscreen && window.fullscreenCanvas) ? window.fullscreenCanvas : canvas;
    const rect = targetCanvas.getBoundingClientRect();
    const scaleX = targetCanvas.width / rect.width;
    const scaleY = targetCanvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    let hoverChanged = false;
    
    // Snap crosshair to nearest candle if enabled
    if (crosshairSnapToCandles) {
        const snapped = snapCrosshairToCandle(mouseX, mouseY);
        
        // Update crosshair (in display coordinates)
        crosshairX = snapped.x / scaleX; // Convert back to display coordinates
        crosshairY = e.clientY - rect.top;
        
        // Update hovered index based on snapped position
        const newHoveredIndex = snapped.index;
        hoverChanged = newHoveredIndex !== hoveredIndex;
        hoveredIndex = newHoveredIndex;
    } else {
        // Update crosshair (in display coordinates) without snapping
        crosshairX = e.clientX - rect.left;
        crosshairY = e.clientY - rect.top;
        
        // Check if hovering over a data point
        const newHoveredIndex = getHoveredDataIndex(mouseX, mouseY);
        hoverChanged = newHoveredIndex !== hoveredIndex;
        hoveredIndex = newHoveredIndex;
    }
    
    if (isMouseDown && isDragging) {
        // Pan the visible range of the chart
        const deltaX = mouseX - lastMouseX;
        const deltaY = mouseY - lastMouseY;
        
        
        // Use horizontal movement to pan through data range
        if (Math.abs(deltaX) >= 1) { // Only pan if there's actual movement
            panVisibleRange(deltaX * panningSensitivity);
        }
        
        // Use vertical movement for price panning (optional)
        panOffsetY += deltaY;
        
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        
        updateChart(); // Full update to show new data range
    } else {
        // Update crosshair smoothly
        if (hoverChanged) {
            redrawChart();
        } else {
            updateCrosshairSmoothly();
        }
    }
}

function handleMouseUp(e) {
    isMouseDown = false;
    isDragging = false;
    const targetCanvas = (isFullscreen && window.fullscreenCanvas) ? window.fullscreenCanvas : canvas;
    targetCanvas.style.cursor = 'crosshair';
}

function handleWheel(e) {
    // Only handle scroll with modifier keys (Ctrl/Shift)
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
        e.preventDefault();
        
        const targetCanvas = (isFullscreen && window.fullscreenCanvas) ? window.fullscreenCanvas : canvas;
        const rect = targetCanvas.getBoundingClientRect();
        const scaleX = targetCanvas.width / rect.width;
        const scaleY = targetCanvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        // Adjust max visible points with scroll
        const maxVisiblePointsElement = document.getElementById('maxVisiblePoints');
        if (!maxVisiblePointsElement) return;
        
        const currentMaxPoints = parseInt(maxVisiblePointsElement.value);
        const step = 10; // Adjust by 10 points per scroll
        const newMaxPoints = e.deltaY > 0 
            ? Math.max(10, currentMaxPoints - step)
            : Math.min(200, currentMaxPoints + step);
        
        // Update the slider and trigger the update function
        maxVisiblePointsElement.value = newMaxPoints;
        updateMaxVisiblePoints();
    }
    // Do not prevent default when no modifier keys - allow normal page scrolling
}

function handleMouseLeave(e) {
    hoveredIndex = -1;
    crosshairX = -1;
    crosshairY = -1;
    redrawChart();
}

function handleMouseEnter(e) {
    // Initialize crosshair position when mouse enters canvas
    const targetCanvas = (isFullscreen && window.fullscreenCanvas) ? window.fullscreenCanvas : canvas;
    const rect = targetCanvas.getBoundingClientRect();
    const scaleX = targetCanvas.width / rect.width;
    const scaleY = targetCanvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    // Snap crosshair to nearest candle if enabled
    if (crosshairSnapToCandles) {
        const snapped = snapCrosshairToCandle(mouseX, mouseY);
        
        crosshairX = snapped.x / scaleX; // Convert back to display coordinates
        crosshairY = e.clientY - rect.top;
        hoveredIndex = snapped.index;
    } else {
        crosshairX = e.clientX - rect.left;
        crosshairY = e.clientY - rect.top;
        hoveredIndex = getHoveredDataIndex(mouseX, mouseY);
    }
    
    redrawChart();
}

function handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        lastMouseX = (touch.clientX - rect.left) * scaleX;
        lastMouseY = (touch.clientY - rect.top) * scaleY;
        isMouseDown = true;
        isDragging = true;
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && isMouseDown) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const mouseX = (touch.clientX - rect.left) * scaleX;
        const mouseY = (touch.clientY - rect.top) * scaleY;
        
        const deltaX = mouseX - lastMouseX;
        const deltaY = mouseY - lastMouseY;
        
        panOffsetX += deltaX;
        panOffsetY += deltaY;
        
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        
        redrawChart();
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    isMouseDown = false;
    isDragging = false;
}

function getHoveredDataIndex(mouseX, mouseY) {
    if (stockData.length === 0) return -1;
    
    const chartTypeElement = document.getElementById('chartType');
    const chartType = chartTypeElement ? chartTypeElement.value : 'candlestick';
    
    // Update visible range if needed
    updateVisibleRange();
    
    // Get the data points to display from original data
    const displayData = stockData.slice(visibleStartIndex, visibleEndIndex + 1);
    if (displayData.length === 0) return -1;
    
    // Transform mouse coordinates to account for pan only (zoom disabled)
    const transformedX = mouseX - panOffsetX;
    const transformedY = mouseY - panOffsetY;
    
    // Check if mouse is within chart area
    if (transformedX < chartArea.x || transformedX > chartArea.x + chartArea.width ||
        transformedY < chartArea.y || transformedY > chartArea.y + chartArea.height) {
        return -1;
    }
    
    // Calculate data spacing based on visible data
    const dataWidth = chartArea.width / displayData.length;
    const dataIndex = Math.floor((transformedX - chartArea.x) / dataWidth);
    
    if (dataIndex >= 0 && dataIndex < displayData.length) {
        const data = displayData[dataIndex];
        const x = chartArea.x + dataIndex * dataWidth;
        
        // Check if mouse is within the data point bounds
        if (chartType === 'candlestick') {
            const candleWidthElement = document.getElementById('candleWidth');
            const candleWidth = candleWidthElement ? parseInt(candleWidthElement.value) : 8;
            if (Math.abs(transformedX - x) <= candleWidth / 2) {
                return visibleStartIndex + dataIndex; // Return global index
            }
        } else {
            if (Math.abs(transformedX - x) <= dataWidth / 2) {
                return visibleStartIndex + dataIndex; // Return global index
            }
        }
    }
    
    return -1;
}

function drawCrosshair() {
    if (!crosshairEnabled || crosshairX < 0 || crosshairY < 0) return;
    
    // Scale crosshair coordinates to canvas resolution
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const scaledX = crosshairX * scaleX;
    const scaledY = crosshairY * scaleY;
    
    // Check if crosshair is within chart area
    if (scaledX < chartArea.x || scaledX > chartArea.x + chartArea.width ||
        scaledY < chartArea.y || scaledY > chartArea.y + chartArea.height) {
        return;
    }
    
    ctx.save();
    
    // Reset any transformations for crosshair drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Enable anti-aliasing for smoother lines
    ctx.imageSmoothingEnabled = true;
    
    // Draw crosshair with better visibility and anti-aliasing
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.lineCap = 'round';
    
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(scaledX + 0.5, chartArea.y);
    ctx.lineTo(scaledX + 0.5, chartArea.y + chartArea.height);
    ctx.stroke();
    
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(chartArea.x, scaledY + 0.5);
    ctx.lineTo(chartArea.x + chartArea.width, scaledY + 0.5);
    ctx.stroke();
    
    // Draw center dot for better visibility
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(scaledX, scaledY, 2.5, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw border around center dot
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(scaledX, scaledY, 2.5, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw candle highlight if hovering over a candle
    if (hoveredIndex >= 0) {
        const displayData = stockData.slice(visibleStartIndex, visibleEndIndex + 1);
        const xStep = chartArea.width / displayData.length;
        
        // Find which candle we're hovering over
        const candleIndex = hoveredIndex - visibleStartIndex;
        if (candleIndex >= 0 && candleIndex < displayData.length) {
            const candleX = chartArea.x + candleIndex * xStep + xStep / 2;
            
            // Draw a subtle highlight around the candle
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.rect(candleX - xStep/2, chartArea.y, xStep, chartArea.height);
            ctx.stroke();
        }
    }
    
    ctx.restore();
}

function drawTooltip() {
    if (hoveredIndex < 0 || stockData.length === 0) return;
    
    // Use the original stockData array with the correct index
    if (hoveredIndex >= stockData.length) return;
    
    const data = stockData[hoveredIndex];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = crosshairX * scaleX;
    const mouseY = crosshairY * scaleY;
    
    // Tooltip content
    const tooltipText = [
        `Time: ${new Date(data.timestamp).toLocaleString()}`,
        `Open: ${data.open.toFixed(2)}`,
        `High: ${data.high.toFixed(2)}`,
        `Low: ${data.low.toFixed(2)}`,
        `Close: ${data.close.toFixed(2)}`,
        `Volume: ${data.volume.toLocaleString()}`,
        `Cluster: ${data.predicted_cluster || 0}`
    ];
    
    // Calculate tooltip dimensions
    ctx.font = '12px Arial';
    const lineHeight = 16;
    const padding = 8;
    const maxWidth = Math.max(...tooltipText.map(text => ctx.measureText(text).width));
    const tooltipWidth = maxWidth + padding * 2;
    const tooltipHeight = tooltipText.length * lineHeight + padding * 2;
    
    // Position tooltip
    let tooltipX = mouseX + 10;
    let tooltipY = mouseY - tooltipHeight / 2;
    
    // Keep tooltip within canvas bounds
    if (tooltipX + tooltipWidth > canvas.width) {
        tooltipX = mouseX - tooltipWidth - 10;
    }
    if (tooltipY < 0) {
        tooltipY = 10;
    }
    if (tooltipY + tooltipHeight > canvas.height) {
        tooltipY = canvas.height - tooltipHeight - 10;
    }
    
    // Draw tooltip background
    ctx.save();
    
    // Reset transformations for tooltip
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    
    // Draw tooltip background with rounded corners
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
        ctx.fill();
    } else {
        ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    }
    
    // Draw tooltip border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
        ctx.stroke();
    } else {
        ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    }
    
    // Draw tooltip text
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '12px Arial';
    tooltipText.forEach((text, index) => {
        ctx.fillText(text, tooltipX + padding, tooltipY + padding + index * lineHeight);
    });
    
    ctx.restore();
}

function resetZoom() {
    zoomLevel = 1;
    panOffsetX = 0;
    panOffsetY = 0;
    updateChart();
}

function resetVisibleRange() {
    if (stockData.length === 0) return;
    
    // Reset to show the most recent data
    visibleEndIndex = stockData.length - 1;
    visibleStartIndex = Math.max(0, visibleEndIndex - maxVisiblePoints + 1);
    
    updateChart();
}

function resetChartToDefault() {
    // Reset all chart settings to default values
    resetZoom();
    resetVisibleRange();
    
    // Reset max visible points to default
    document.getElementById('maxVisiblePoints').value = 50;
    updateMaxVisiblePoints();
    
    // Reset panning sensitivity to default
    document.getElementById('panningSensitivity').value = 1.0;
    updatePanningSensitivity();
    
    // Reset panel opacity to default
    document.getElementById('panelOpacity').value = 0.8;
    updatePanelOpacity();
    
    // Reset all panel visibility to default (all visible)
    const panelCheckboxes = [
        'showChartPanel', 'showFiltersPanel', 'showColorsPanel', 
        'showStatsPanel', 'showLegendPanel'
    ];
    panelCheckboxes.forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    updatePanelVisibility();
    
    // Reset minimize state
    const minimizeButtons = document.querySelectorAll('.minimize-btn');
    minimizeButtons.forEach(btn => {
        btn.textContent = '−';
        btn.parentElement.classList.remove('minimized');
    });
    updateMinimizeButtons();
    
    // Reset chart type to default
    document.getElementById('chartType').value = 'candlestick';
    
    // Reset number of rows to default
    document.getElementById('numRows').value = 200;
    
    // Reset candle width to default
    document.getElementById('candleWidth').value = 8;
    
    // Reset cluster filter to all
    document.getElementById('clusterFilter').value = 'all';
    
    // Reset candle type filter to all
    document.getElementById('candleTypeFilter').value = 'all';
    
    
    // Reset cluster colors to show
    document.getElementById('showClusterColors').checked = true;
    
    
    // Clear saved settings
    localStorage.removeItem('chartSettings');
    
    // Update the chart with all reset values
    updateChart();
    updateStats();
    updateLegend();
    
    showStatus('🔄 Chart reset to default settings', 'success');
}

function saveSettings() {
    const maxVisiblePointsElement = document.getElementById('maxVisiblePoints');
    const panningSensitivityElement = document.getElementById('panningSensitivity');
    const panelOpacityElement = document.getElementById('panelOpacity');
    const showChartPanelElement = document.getElementById('showChartPanel');
    const showFiltersPanelElement = document.getElementById('showFiltersPanel');
    const showColorsPanelElement = document.getElementById('showColorsPanel');
    const showStatsPanelElement = document.getElementById('showStatsPanel');
    const showLegendPanelElement = document.getElementById('showLegendPanel');
    const chartTypeElement = document.getElementById('chartType');
    const numRowsElement = document.getElementById('numRows');
    const candleWidthElement = document.getElementById('candleWidth');
    const clusterFilterElement = document.getElementById('clusterFilter');
    const candleTypeFilterElement = document.getElementById('candleTypeFilter');
    const showClusterColorsElement = document.getElementById('showClusterColors');
    
    const settings = {
        // Chart display settings
        maxVisiblePoints: maxVisiblePointsElement ? parseInt(maxVisiblePointsElement.value) : 50,
        panningSensitivity: panningSensitivityElement ? parseFloat(panningSensitivityElement.value) : 1.0,
        panelOpacity: panelOpacityElement ? parseFloat(panelOpacityElement.value) : 0.8,
        
        // Panel visibility
        showChartPanel: showChartPanelElement ? showChartPanelElement.checked : true,
        showFiltersPanel: showFiltersPanelElement ? showFiltersPanelElement.checked : true,
        showColorsPanel: showColorsPanelElement ? showColorsPanelElement.checked : true,
        showStatsPanel: showStatsPanelElement ? showStatsPanelElement.checked : true,
        showLegendPanel: showLegendPanelElement ? showLegendPanelElement.checked : true,
        
        // Chart configuration
        chartType: chartTypeElement ? chartTypeElement.value : 'candlestick',
        numRows: numRowsElement ? parseInt(numRowsElement.value) : 200,
        candleWidth: candleWidthElement ? parseInt(candleWidthElement.value) : 8,
        
        // Filters
        clusterFilter: clusterFilterElement ? clusterFilterElement.value : 'all',
        candleTypeFilter: candleTypeFilterElement ? candleTypeFilterElement.value : 'all',
        showClusterColors: showClusterColorsElement ? showClusterColorsElement.checked : true,
        
        // Chart state
        zoomLevel: zoomLevel,
        panOffsetX: panOffsetX,
        panOffsetY: panOffsetY,
        visibleStartIndex: visibleStartIndex,
        visibleEndIndex: visibleEndIndex,
        crosshairEnabled: crosshairEnabled,
        crosshairSnapToCandles: crosshairSnapToCandles,
        isFullscreen: isFullscreen
    };
    
    localStorage.setItem('chartSettings', JSON.stringify(settings));
    // Save silently without notification
}

function loadSettings() {
    const savedSettings = localStorage.getItem('chartSettings');
    if (!savedSettings) return false;
    
    try {
        const settings = JSON.parse(savedSettings);
        
        // Load chart display settings
        if (settings.maxVisiblePoints) {
            document.getElementById('maxVisiblePoints').value = settings.maxVisiblePoints;
            updateMaxVisiblePoints();
        }
        
        if (settings.panningSensitivity) {
            document.getElementById('panningSensitivity').value = settings.panningSensitivity;
            updatePanningSensitivity();
        }
        
        if (settings.panelOpacity) {
            document.getElementById('panelOpacity').value = settings.panelOpacity;
            updatePanelOpacity();
        }
        
        // Load panel visibility
        const panelCheckboxes = [
            'showChartPanel', 'showFiltersPanel', 'showColorsPanel', 
            'showStatsPanel', 'showLegendPanel'
        ];
        panelCheckboxes.forEach(checkboxId => {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox && settings[checkboxId] !== undefined) {
                checkbox.checked = settings[checkboxId];
            }
        });
        updatePanelVisibility();
        
        // Load chart configuration
        if (settings.chartType) {
            document.getElementById('chartType').value = settings.chartType;
        }
        
        if (settings.numRows) {
            document.getElementById('numRows').value = settings.numRows;
        }
        
        if (settings.candleWidth) {
            document.getElementById('candleWidth').value = settings.candleWidth;
        }
        
        // Load filters
        if (settings.clusterFilter) {
            document.getElementById('clusterFilter').value = settings.clusterFilter;
        }
        
        if (settings.candleTypeFilter) {
            document.getElementById('candleTypeFilter').value = settings.candleTypeFilter;
        }
        
        if (settings.showClusterColors !== undefined) {
            document.getElementById('showClusterColors').checked = settings.showClusterColors;
        }
        
        // Load chart state
        if (settings.zoomLevel) {
            zoomLevel = settings.zoomLevel;
        }
        
        if (settings.panOffsetX !== undefined) {
            panOffsetX = settings.panOffsetX;
        }
        
        if (settings.panOffsetY !== undefined) {
            panOffsetY = settings.panOffsetY;
        }
        
        if (settings.visibleStartIndex !== undefined) {
            visibleStartIndex = settings.visibleStartIndex;
        }
        
        if (settings.visibleEndIndex !== undefined) {
            visibleEndIndex = settings.visibleEndIndex;
        }
        
        if (settings.crosshairEnabled !== undefined) {
            crosshairEnabled = settings.crosshairEnabled;
        }
        
        if (settings.crosshairSnapToCandles !== undefined) {
            crosshairSnapToCandles = settings.crosshairSnapToCandles;
        }
        
        if (settings.isFullscreen !== undefined) {
            isFullscreen = settings.isFullscreen;
        }
        
        return true;
    } catch (error) {
        console.error('Error loading settings:', error);
        return false;
    }
}

function clearSettings() {
    localStorage.removeItem('chartSettings');
    showStatus('🗑️ Settings cleared from localStorage', 'success');
}

function toggleCrosshair() {
    crosshairEnabled = !crosshairEnabled;
    if (crosshairEnabled) {
        showStatus('🎯 Crosshair enabled', 'success');
    } else {
        showStatus('🎯 Crosshair disabled', 'info');
    }
    redrawChart();
}

function toggleCrosshairSnap() {
    crosshairSnapToCandles = !crosshairSnapToCandles;
    if (crosshairSnapToCandles) {
        showStatus('🎯 Crosshair snap to candles enabled', 'success');
    } else {
        showStatus('🎯 Crosshair snap to candles disabled', 'info');
    }
    redrawChart();
}

function toggleFullscreen() {
    if (!isFullscreen) {
        enterFullscreen();
    } else {
        exitFullscreen();
    }
}

function enterFullscreen() {
    const chartContainer = document.querySelector('.chart-container');
    const canvas = document.getElementById('candlestickChart');
    
    if (!chartContainer || !canvas) {
        showStatus('❌ Chart container not found', 'error');
        return;
    }
    
    // Store original parent for restoration
    originalChartContainer = chartContainer.parentNode;
    
    // Create fullscreen container
    const fullscreenContainer = document.createElement('div');
    fullscreenContainer.id = 'fullscreen-container';
    fullscreenContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #0a0a0a;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    `;
    
    // Create fullscreen header
    const fullscreenHeader = document.createElement('div');
    fullscreenHeader.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        gap: 10px;
    `;
    
    // Add exit fullscreen button
    const exitBtn = document.createElement('button');
    exitBtn.innerHTML = '✕ Exit Fullscreen';
    exitBtn.style.cssText = `
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border: 1px solid #333;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;
    exitBtn.onclick = exitFullscreen;
    
    // Add instructions
    const instructions = document.createElement('div');
    instructions.innerHTML = 'Press ESC to exit fullscreen';
    instructions.style.cssText = `
        background: rgba(0, 0, 0, 0.8);
        color: #00ff88;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 12px;
        margin-right: 10px;
    `;
    
    fullscreenHeader.appendChild(instructions);
    fullscreenHeader.appendChild(exitBtn);
    
    // Clone the chart container
    const clonedContainer = chartContainer.cloneNode(true);
    clonedContainer.style.cssText = `
        width: 95vw;
        height: 90vh;
        margin: 0;
        position: relative;
    `;
    
    // Update canvas size for fullscreen
    const clonedCanvas = clonedContainer.querySelector('#candlestickChart');
    if (clonedCanvas) {
        clonedCanvas.style.width = '100%';
        clonedCanvas.style.height = '100%';
    }
    
    // Append to fullscreen container
    fullscreenContainer.appendChild(fullscreenHeader);
    fullscreenContainer.appendChild(clonedContainer);
    
    // Add to body
    document.body.appendChild(fullscreenContainer);
    
    // Update state
    isFullscreen = true;
    
    // Update button text
    const fullscreenBtn = document.querySelector('.overlay-settings[onclick="toggleFullscreen()"]');
    if (fullscreenBtn) {
        fullscreenBtn.innerHTML = '⛶ Exit Fullscreen';
    }
    
    // Setup canvas for fullscreen
    setupFullscreenCanvas(clonedCanvas);
    
    // Force chart update after a short delay to ensure canvas is ready
    setTimeout(() => {
        setupCanvas(); // This will now use the fullscreen canvas
        updateChart();
    }, 200);
    
    showStatus('⛶ Entered fullscreen mode', 'success');
}

function exitFullscreen() {
    const fullscreenContainer = document.getElementById('fullscreen-container');
    if (fullscreenContainer) {
        fullscreenContainer.remove();
    }
    
    // Update state
    isFullscreen = false;
    
    // Clear fullscreen canvas reference
    window.fullscreenCanvas = null;
    
    // Update button text
    const fullscreenBtn = document.querySelector('.overlay-settings[onclick="toggleFullscreen()"]');
    if (fullscreenBtn) {
        fullscreenBtn.innerHTML = '⛶ Fullscreen';
    }
    
    // Reinitialize canvas with original
    setupCanvas();
    updateChart();
    
    showStatus('⛶ Exited fullscreen mode', 'info');
}

function setupFullscreenCanvas(canvas) {
    if (!canvas) return;
    
    // Set canvas size for fullscreen
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    // Update chart area for fullscreen
    chartArea = {
        x: 80,
        y: 60,
        width: rect.width - 160,
        height: rect.height - 120
    };
    
    // Store reference to fullscreen canvas
    window.fullscreenCanvas = canvas;
    
    // Setup interactive features for fullscreen canvas
    setupInteractiveChart();
    
    // Force a complete chart update
    setTimeout(() => {
        // Ensure we're using the fullscreen canvas
        if (isFullscreen && window.fullscreenCanvas) {
            canvas = window.fullscreenCanvas;
            ctx = canvas.getContext('2d');
        }
        updateChart();
    }, 100);
}

function updateCrosshairSmoothly() {
    if (crosshairAnimationFrame) {
        cancelAnimationFrame(crosshairAnimationFrame);
    }
    
    crosshairAnimationFrame = requestAnimationFrame(() => {
        if (Math.abs(crosshairX - lastCrosshairX) > 1 || Math.abs(crosshairY - lastCrosshairY) > 1) {
            redrawChart();
            lastCrosshairX = crosshairX;
            lastCrosshairY = crosshairY;
        }
        crosshairAnimationFrame = null;
    });
}

function snapCrosshairToCandle(mouseX, mouseY) {
    if (stockData.length === 0) return { x: mouseX, y: mouseY, index: -1 };
    
    // Get the data points to display from original data
    const displayData = stockData.slice(visibleStartIndex, visibleEndIndex + 1);
    if (displayData.length === 0) return { x: mouseX, y: mouseY, index: -1 };
    
    const xStep = chartArea.width / displayData.length;
    
    // Find the nearest candle position
    let nearestIndex = -1;
    let minDistance = Infinity;
    
    for (let i = 0; i < displayData.length; i++) {
        const candleX = chartArea.x + i * xStep + xStep / 2;
        const distance = Math.abs(mouseX - candleX);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = i;
        }
    }
    
    if (nearestIndex >= 0) {
        const snappedX = chartArea.x + nearestIndex * xStep + xStep / 2;
        return { 
            x: snappedX, 
            y: mouseY, 
            index: visibleStartIndex + nearestIndex 
        };
    }
    
    return { x: mouseX, y: mouseY, index: -1 };
}

function saveSettingsWithNotification() {
    saveSettings();
    showStatus('💾 Settings saved to localStorage', 'success');
}

function panToMiddle() {
    if (stockData.length === 0) return;
    
    // Pan to the middle of the dataset
    const middleIndex = Math.floor(stockData.length / 2);
    panToPosition(middleIndex);
    updateChart();
}

function initializeVisibleRange() {
    if (stockData.length === 0) return;
    
    // Initialize visible range to show the last maxVisiblePoints from original data
    visibleEndIndex = stockData.length - 1;
    visibleStartIndex = Math.max(0, visibleEndIndex - maxVisiblePoints + 1);
    
    // Ensure we don't exceed the available data
    if (visibleEndIndex >= stockData.length) {
        visibleEndIndex = stockData.length - 1;
        visibleStartIndex = Math.max(0, visibleEndIndex - maxVisiblePoints + 1);
    }
    
    // If we have more data than maxVisiblePoints, ensure we can pan through all of it
    if (stockData.length > maxVisiblePoints) {
        // Start from the most recent data but allow panning through all
        visibleEndIndex = stockData.length - 1;
        visibleStartIndex = Math.max(0, visibleEndIndex - maxVisiblePoints + 1);
    }
    
}

function updateVisibleRange() {
    if (stockData.length === 0) return;
    
    // Use maxVisiblePoints directly without zoom level adjustment
    const adjustedMaxPoints = maxVisiblePoints;
    
    // Ensure visible range is within bounds
    visibleStartIndex = Math.max(0, Math.min(visibleStartIndex, stockData.length - 1));
    visibleEndIndex = Math.max(visibleStartIndex, Math.min(visibleEndIndex, stockData.length - 1));
    
    // Ensure we don't exceed the available data
    if (visibleEndIndex - visibleStartIndex + 1 > adjustedMaxPoints) {
        visibleEndIndex = visibleStartIndex + adjustedMaxPoints - 1;
    }
    
    // Ensure we don't go beyond available data
    if (visibleEndIndex >= stockData.length) {
        visibleEndIndex = stockData.length - 1;
        visibleStartIndex = Math.max(0, visibleEndIndex - adjustedMaxPoints + 1);
    }
}

function panVisibleRange(deltaX) {
    if (stockData.length === 0) return;
    
    // Calculate how many data points to move based on drag distance
    const dataWidth = chartArea.width / (visibleEndIndex - visibleStartIndex + 1);
    const pointsToMove = Math.round(deltaX / dataWidth);
    
    // Reduce sensitivity - only move if there's significant drag
    if (Math.abs(pointsToMove) < 0.5) return; // Ignore tiny movements
    
    // Calculate the range size
    const rangeSize = visibleEndIndex - visibleStartIndex + 1;
    
    // Update visible range - drag right moves to more recent data (higher indices)
    const newStartIndex = Math.max(0, visibleStartIndex + pointsToMove);
    const newEndIndex = Math.min(stockData.length - 1, newStartIndex + rangeSize - 1);
    
    // Ensure we don't go beyond available data
    if (newEndIndex >= stockData.length) {
        const adjustedEndIndex = stockData.length - 1;
        const adjustedStartIndex = Math.max(0, adjustedEndIndex - rangeSize + 1);
        visibleStartIndex = adjustedStartIndex;
        visibleEndIndex = adjustedEndIndex;
    } else if (newStartIndex < 0) {
        visibleStartIndex = 0;
        visibleEndIndex = Math.min(stockData.length - 1, rangeSize - 1);
    } else {
        visibleStartIndex = newStartIndex;
        visibleEndIndex = newEndIndex;
    }
    
}

function panToPosition(startIndex) {
    if (stockData.length === 0) return;
    
    const rangeSize = visibleEndIndex - visibleStartIndex + 1;
    const newStartIndex = Math.max(0, Math.min(startIndex, stockData.length - rangeSize));
    const newEndIndex = Math.min(stockData.length - 1, newStartIndex + rangeSize - 1);
    
    visibleStartIndex = newStartIndex;
    visibleEndIndex = newEndIndex;
    
}

function updateMaxVisiblePoints() {
    const slider = document.getElementById('maxVisiblePoints');
    const valueDisplay = document.getElementById('maxVisiblePointsValue');
    
    maxVisiblePoints = parseInt(slider.value);
    valueDisplay.textContent = maxVisiblePoints;
    
    // Recalculate visible range with new max points
    if (stockData.length === 0) return;
    
    // Use maxVisiblePoints directly without zoom level adjustment
    const adjustedMaxPoints = maxVisiblePoints;
    
    // Keep the current end index but adjust start index to fit new max points
    const currentRangeSize = visibleEndIndex - visibleStartIndex + 1;
    const newRangeSize = Math.min(adjustedMaxPoints, stockData.length);
    
    if (newRangeSize < currentRangeSize) {
        // Shrink the range from the start
        visibleStartIndex = Math.max(0, visibleEndIndex - newRangeSize + 1);
    } else if (newRangeSize > currentRangeSize) {
        // Expand the range from the start
        visibleStartIndex = Math.max(0, visibleEndIndex - newRangeSize + 1);
    }
    
    // Ensure we don't go beyond available data
    if (visibleEndIndex >= stockData.length) {
        visibleEndIndex = stockData.length - 1;
        visibleStartIndex = Math.max(0, visibleEndIndex - newRangeSize + 1);
    }
    
    
    updateChart();
    
    // Auto-save settings
    saveSettings();
}

function updatePanningSensitivity() {
    const slider = document.getElementById('panningSensitivity');
    const valueDisplay = document.getElementById('panningSensitivityValue');
    
    if (slider && valueDisplay) {
        panningSensitivity = parseFloat(slider.value);
        valueDisplay.textContent = panningSensitivity.toFixed(1);
        
        // Auto-save settings
        saveSettings();
    }
}

function adjustPanningSensitivity(delta) {
    const slider = document.getElementById('panningSensitivity');
    const valueDisplay = document.getElementById('panningSensitivityValue');
    
    if (slider && valueDisplay) {
        const newValue = Math.max(0.1, Math.min(5.0, panningSensitivity + delta));
        slider.value = newValue;
        panningSensitivity = newValue;
        valueDisplay.textContent = panningSensitivity.toFixed(1);
        
        // Auto-save settings
        saveSettings();
    }
}

function adjustMaxVisiblePoints(delta) {
    const slider = document.getElementById('maxVisiblePoints');
    const valueDisplay = document.getElementById('maxVisiblePointsValue');
    
    if (slider && valueDisplay) {
        const currentValue = parseInt(slider.value);
        const newValue = Math.max(10, Math.min(200, currentValue + delta));
        slider.value = newValue;
        updateMaxVisiblePoints();
        // Auto-save is handled in updateMaxVisiblePoints
    }
}

function debugChart() {
    console.log('Chart Debug Info:');
    console.log('Total data:', stockData.length);
    console.log('Filtered data:', filteredData.length);
    console.log('Visible data:', filteredData.filter(d => d.visible).length);
    console.log('Visible range:', visibleStartIndex, 'to', visibleEndIndex);
    console.log('Max visible points:', maxVisiblePoints);
    console.log('Zoom level:', zoomLevel);
    console.log('Pan offset:', panOffsetX, panOffsetY);
    console.log('Chart area:', chartArea);
    console.log('Canvas size:', canvas.width, canvas.height);
}

// Initialize when page loads
window.addEventListener('load', init);

// Handle window resize
window.addEventListener('resize', () => {
    setupCanvas();
    updateChart();
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Only handle shortcuts when not typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key) {
        case '1':
            setMaxVisiblePoints(20);
            break;
        case '2':
            setMaxVisiblePoints(50);
            break;
        case '3':
            setMaxVisiblePoints(100);
            break;
        case '4':
            setMaxVisiblePoints(200);
            break;
        case 'ArrowLeft':
            e.preventDefault();
            panVisibleRange(-10); // Pan left (to older data)
            updateChart();
            break;
        case 'ArrowRight':
            e.preventDefault();
            panVisibleRange(10); // Pan right (to newer data)
            updateChart();
            break;
        case 'Home':
            e.preventDefault();
            resetVisibleRange(); // Go to latest data
            break;
        case 'End':
            e.preventDefault();
            // Go to earliest data
            if (stockData.length > 0) {
                visibleStartIndex = 0;
                visibleEndIndex = Math.min(maxVisiblePoints - 1, stockData.length - 1);
                updateChart();
            }
            break;
        case '+':
        case '=':
            e.preventDefault();
            adjustPanningSensitivity(0.1);
            break;
        case '-':
            e.preventDefault();
            adjustPanningSensitivity(-0.1);
            break;
        case 'PageUp':
            e.preventDefault();
            adjustMaxVisiblePoints(10);
            break;
        case 'PageDown':
            e.preventDefault();
            adjustMaxVisiblePoints(-10);
            break;
        case 'r':
        case 'R':
            e.preventDefault();
            resetChartToDefault();
            break;
        case 'c':
        case 'C':
            e.preventDefault();
            toggleCrosshair();
            break;
        case 's':
        case 'S':
            e.preventDefault();
            toggleCrosshairSnap();
            break;
        case 'f':
        case 'F':
            e.preventDefault();
            toggleFullscreen();
            break;
        case 'Escape':
            if (isFullscreen) {
                e.preventDefault();
                exitFullscreen();
            }
            break;
    }
});

function setMaxVisiblePoints(value) {
    const slider = document.getElementById('maxVisiblePoints');
    const valueDisplay = document.getElementById('maxVisiblePointsValue');
    
    slider.value = value;
    maxVisiblePoints = value;
    valueDisplay.textContent = value;
    
    // Recalculate visible range with new max points
    if (stockData.length === 0) return;
    
    // Use maxVisiblePoints directly without zoom level adjustment
    const adjustedMaxPoints = maxVisiblePoints;
    
    // Keep the current end index but adjust start index to fit new max points
    const currentRangeSize = visibleEndIndex - visibleStartIndex + 1;
    const newRangeSize = Math.min(adjustedMaxPoints, stockData.length);
    
    if (newRangeSize < currentRangeSize) {
        // Shrink the range from the start
        visibleStartIndex = Math.max(0, visibleEndIndex - newRangeSize + 1);
    } else if (newRangeSize > currentRangeSize) {
        // Expand the range from the start
        visibleStartIndex = Math.max(0, visibleEndIndex - newRangeSize + 1);
    }
    
    // Ensure we don't go beyond available data
    if (visibleEndIndex >= stockData.length) {
        visibleEndIndex = stockData.length - 1;
        visibleStartIndex = Math.max(0, visibleEndIndex - newRangeSize + 1);
    }
    
    
    updateChart();
}