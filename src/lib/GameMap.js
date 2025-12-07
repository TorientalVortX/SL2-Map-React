export default class GameMap {
    // Performance optimization methods
    throttle(func, limit) {
        let lastFunc;
        let lastRan;
        return function() {
            const context = this;
            const args = arguments;
            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function() {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    constructor() {
        // Map configuration
        this.config = {
            tileSize: 800,
                gridWidth: 47,
                gridHeight: 54,
            subfolderSize: 6,
            minZoom: 0.01,
            maxZoom: 5,
            initialZoom: 0.65,
            tilePath: '/tiles/', // Served from Vite public folder
            imageFormat: 'jpg',
            worldMapThreshold: 0.4,
            worldMaps: {
                tiny: { path: '/World_Map_Optimized_tiny.jpg', threshold: 0.0, size: { width: 896, height: 1024 } },
                small: { path: '/World_Map_Optimized_small.jpg', threshold: 0.1, size: { width: 1792, height: 2048 } },
                medium: { path: '/World_Map_Optimized_medium.jpg', threshold: 0.2, size: { width: 3584, height: 4096 } },
                large: { path: '/World_Map_Optimized_large.jpg', threshold: 0.3, size: { width: 6720, height: 7680 } }
            },
            worldMapPath: '/World_Map_Optimized_large.jpg',
            worldMapSize: { width: 6720, height: 7680 },
            subfolderOffsets: {
            }
        };

        // Map state
        this.zoom = this.config.initialZoom;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.debugMode = false;
        this.controlsVisible = false;
        this.touches = [];
        this.lastPinchDistance = 0;
        this.isPinching = false;
        this.touchStartZoom = 0;
        this.isWorldMapView = false;
        this.worldMapElement = null;
        this.loadedTiles = new Map();
        this.visibleTiles = new Set();
        this.pendingUnloads = new Map();
        this.tileUnloadDelay = 2000;
        this.failedTiles = new Map();
        this.maxRetries = 3;
        this.devicePerformance = this.detectDevicePerformance();
        this.throttleTiming = this.calculateOptimalThrottleTiming();
        this.throttledUpdateTiles = this.throttle(() => this.updateVisibleTiles(), this.throttleTiming);
        this.cacheWarmup = {
            enabled: true,
            limit: 300,
            bufferTiles: 1,
            concurrency: 8,
        };
        this.performanceMetrics = {
            lastFrameTime: performance.now(),
            frameCount: 0,
            averageFPS: 60,
            tileLoadTimes: [],
            memoryPressure: 'low'
        };

        // Sample locations
        this.locations = [
            { id: 1, name: "Starting Town", x: 128, y: 128, type: "town", description: "The beginning of your adventure." },
            { id: 2, name: "Ancient Forest", x: 384, y: 256, type: "dungeon", description: "A mysterious forest filled with secrets." },
            { id: 3, name: "Crystal Lake", x: 640, y: 192, type: "landmark", description: "A beautiful lake with magical properties." },
            { id: 1756967094317, name: "Telegrad", x: 33048, y: 19279, type: "Nation", description: "The East, The Evergreens, The Valley of a Thousand Homesteads. Fed by the Halard Reservoir and the Central Lake, the Federation of Telegrad has grown beyond its valley to become a large and expansive place, considered by many to be an idyllic paradise. No merchant schemes, no draft, no existential threat that looms in the outskirts." },
            { id: 1756967284265, name: "Duyuei", x: 21831, y: 28405, type: "Nation", description: "Add description here." },
            { id: 1756967324302, name: "Geladyne", x: 12510, y: 18866, type: "Nation", description: "Add description here." },
            { id: 1756967349665, name: "Meiaquar", x: 22771, y: 10027, type: "Nation", description: "Add description here." },
            { id: 1756967393658, name: "Yokoshura", x: 9795, y: 30658, type: "Nation", description: "Add description here." },
        ];

        this.init();
    }

    // === The rest of the original methods ===
    // Copied verbatim from your existing script.js
    // (detectDevicePerformance, estimateAvailableMemory, estimateCPUCapability,
    // estimateGPUCapability, estimateNetworkSpeed, calculateOptimalThrottleTiming,
    // startPerformanceMonitoring, adaptToPerformance, getPerformanceReport,
    // getPerformanceRecommendations, setupElements, setupEventListeners,
    // createGrid, createWorldMapElement, getTilePosition, updateVisibleTiles,
    // loadTilesWithPerformanceControl, calculateBatchDelay, getTilePath,
    // subfolderExists, setOffsetPattern, logExpectedFolderStructure,
    // toggleDebugMode, updateDebugButtonState, toggleControls, showControls,
    // hideControls, handleTouchStart, handleTouchMove, handleTouchEnd,
    // getPinchDistance, zoomAtPoint, handleKeyPress, setWorldMapThreshold,
    // forceWorldMapView, getWorldMapStats, getWorldMapLoadingStatus,
    // reloadFailedWorldMaps, debugWorldMapVisibility, updateWorldMapImage,
    // loadTile, handleTileLoadError, unloadTile, createPins, updateTransform,
    // clearPendingUnloads, setUnloadDelay, debugTileUnloading,
    // scheduleUnloadWithPerformanceControl, getMemoryUsage,
    // startMemoryMonitoring, stopMemoryMonitoring, getMemoryReport,
    // getFailedTiles, retryFailedTiles, getTileLoadingStatus, reloadVisibleTiles,
    // updateMapView, startDrag, drag, endDrag, handleMapClick,
    // showCoordinateInfo, showTemporaryOverlay, getTouchEvent, handleWheel,
    // zoomIn, zoomOut, zoomToLevel, resetView, centerMap, search,
    // panToLocation, showLocationInfo, hideLocationInfo, handleResize)

    // --- Methods pasted below from original file ---
    detectDevicePerformance() {
        try {
            const performance = {
                tier: 'medium',
                score: 50,
                capabilities: {
                    concurrentConnections: 6,
                    maxTiles: 50,
                    animationFrameRate: 60
                },
                memory: this.estimateAvailableMemory(),
                cpu: this.estimateCPUCapability(),
                gpu: this.estimateGPUCapability(),
                network: this.estimateNetworkSpeed()
            };
            const memoryScore = Math.min(100, (performance.memory / 4) * 25);
            const cpuScore = performance.cpu;
            const gpuScore = performance.gpu;
            const networkScore = performance.network;
            performance.score = Math.round((memoryScore + cpuScore + gpuScore + networkScore) / 4);
            if (performance.score >= 80) {
                performance.tier = 'ultra';
                performance.capabilities.concurrentConnections = 12;
                performance.capabilities.maxTiles = 100;
                performance.capabilities.animationFrameRate = 120;
            } else if (performance.score >= 60) {
                performance.tier = 'high';
                performance.capabilities.concurrentConnections = 8;
                performance.capabilities.maxTiles = 75;
                performance.capabilities.animationFrameRate = 60;
            } else if (performance.score >= 40) {
                performance.tier = 'medium';
                performance.capabilities.concurrentConnections = 6;
                performance.capabilities.maxTiles = 50;
                performance.capabilities.animationFrameRate = 60;
            } else {
                performance.tier = 'low';
                performance.capabilities.concurrentConnections = 4;
                performance.capabilities.maxTiles = 30;
                performance.capabilities.animationFrameRate = 30;
            }
            return performance;
        } catch (e) {
            return {
                tier: 'medium',
                score: 50,
                capabilities: {
                    concurrentConnections: 6,
                    maxTiles: 50,
                    animationFrameRate: 60
                },
                memory: 4,
                cpu: 50,
                gpu: 50,
                network: 60
            };
        }
    }

    estimateAvailableMemory() {
        try {
            if ('memory' in performance && performance.memory) {
                const memInfo = performance.memory;
                if (memInfo.jsHeapSizeLimit && typeof memInfo.jsHeapSizeLimit === 'number') {
                    const estimatedRAM = (memInfo.jsHeapSizeLimit / (1024 * 1024 * 1024)) * 8;
                    return Math.min(32, Math.max(1, estimatedRAM));
                }
            }
        } catch (e) {}
        const userAgent = navigator.userAgent.toLowerCase();
        if (/mobile|android|iphone|ipad|tablet/.test(userAgent)) {
            if (/ipad pro|iphone 1[3-9]|iphone [2-9][0-9]/.test(userAgent)) return 6;
            if (/iphone 1[0-2]|android.*; sm-|pixel [4-9]/.test(userAgent)) return 4;
            return 2;
        }
        const hardwareConcurrency = navigator.hardwareConcurrency || 4;
        const screenResolution = screen.width * screen.height;
        let estimatedRAM = 8;
        if (hardwareConcurrency >= 16 || screenResolution >= 4096 * 2160) estimatedRAM = 16;
        if (hardwareConcurrency >= 12 || screenResolution >= 2560 * 1440) estimatedRAM = 12;
        if (hardwareConcurrency >= 8) estimatedRAM = 8;
        if (hardwareConcurrency <= 4 && screenResolution < 1920 * 1080) estimatedRAM = 4;
        return estimatedRAM;
    }

    estimateCPUCapability() {
        const cores = navigator.hardwareConcurrency || 4;
        const userAgent = navigator.userAgent.toLowerCase();
        if (/mobile|android|iphone|ipad|tablet/.test(userAgent)) {
            if (/a1[4-9]|a[2-9][0-9]|m1|m2/.test(userAgent)) return 85;
            if (/snapdragon 8|dimensity 9|exynos 22/.test(userAgent)) return 80;
            if (/snapdragon [7-8]|dimensity [7-8]/.test(userAgent)) return 60;
            return 40;
        }
        let score = Math.min(100, cores * 12.5);
        if (cores >= 16) score = 95;
        else if (cores >= 12) score = 85;
        else if (cores >= 8) score = 75;
        else if (cores >= 6) score = 65;
        else if (cores >= 4) score = 55;
        else score = 35;
        return score;
    }

    estimateGPUCapability() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return 20;
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            let score = 50;
            if (debugInfo) {
                try {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_GL);
                    if (renderer && typeof renderer === 'string') {
                        const r = renderer.toLowerCase();
                        if (/rtx 40[0-9]0|rtx 30[0-9]0|rx 7[0-9]00|m1|m2|a1[4-9]/.test(r)) score = 95;
                        else if (/rtx 20[0-9]0|gtx 16[0-9]0|rx 6[0-9]00|vega/.test(r)) score = 80;
                        else if (/gtx 10[0-9]0|rx 5[0-9]00|rx 4[0-9]0/.test(r)) score = 65;
                        else if (/gtx 9[0-9]0|rx [0-9]00|intel iris/.test(r)) score = 50;
                        else if (/intel hd|intel uhd/.test(r)) score = 30;
                        else if (/mali|adreno|powervr/.test(r)) score = 40;
                    }
                } catch {}
            }
            return score;
        } catch {
            return 30;
        }
    }

    estimateNetworkSpeed() {
        try {
            if ('connection' in navigator && navigator.connection) {
                const effectiveType = navigator.connection.effectiveType;
                switch (effectiveType) {
                    case '4g': return 80;
                    case '3g': return 50;
                    case '2g': return 20;
                    case 'slow-2g': return 10;
                    default: return 60;
                }
            }
        } catch {}
        return 60;
    }

    calculateOptimalThrottleTiming() {
        const performance = this.devicePerformance;
        let throttleMs;
        switch (performance.tier) {
            case 'ultra': throttleMs = 50; break;
            case 'high': throttleMs = 100; break;
            case 'medium': throttleMs = 200; break;
            case 'low': throttleMs = 400; break;
            default: throttleMs = 200;
        }
        if (performance.memory < 3) throttleMs *= 1.5;
        if (performance.memory < 2) throttleMs *= 2;
        return Math.round(throttleMs);
    }

    startPerformanceMonitoring() {
        try {
            let frameCount = 0;
            let lastTime = performance.now();
            const monitor = () => {
                try {
                    const currentTime = performance.now();
                    frameCount++;
                    if (currentTime - lastTime >= 1000) {
                        const fps = frameCount;
                        this.performanceMetrics.averageFPS = fps;
                        this.performanceMetrics.frameCount = frameCount;
                        if (fps < 30 && this.devicePerformance.tier !== 'low') {
                            this.adaptToPerformance('degraded');
                        } else if (fps > 55 && this.throttleTiming > 100) {
                            this.adaptToPerformance('improved');
                        }
                        frameCount = 0;
                        lastTime = currentTime;
                    }
                    requestAnimationFrame(monitor);
                } catch (e) {
                    console.error('Performance monitoring error:', e);
                }
            };
            requestAnimationFrame(monitor);
        } catch (e) {
            console.error('Failed to start performance monitoring:', e);
        }
    }

    adaptToPerformance(condition) {
        const oldTiming = this.throttleTiming;
        if (condition === 'degraded') {
            this.throttleTiming = Math.min(500, this.throttleTiming * 1.5);
        } else if (condition === 'improved') {
            this.throttleTiming = Math.max(50, this.throttleTiming * 0.8);
        }
        this.throttledUpdateTiles = this.throttle(() => this.updateVisibleTiles(), this.throttleTiming);
    }

    getPerformanceReport() {
        return {
            device: this.devicePerformance,
            throttling: this.throttleTiming,
            metrics: this.performanceMetrics,
            recommendations: this.getPerformanceRecommendations()
        };
    }

    getPerformanceRecommendations() {
        const recommendations = [];
        const perf = this.devicePerformance;
        if (perf.memory < 3) recommendations.push('Consider reducing tile cache size for low memory devices');
        if (perf.cpu < 50) recommendations.push('Enable simplified animations for low-end CPUs');
        if (perf.gpu < 40) recommendations.push('Disable complex visual effects for integrated graphics');
        if (this.performanceMetrics.averageFPS < 30) recommendations.push('Current performance is below optimal - consider reducing quality settings');
        return recommendations;
    }

    setupElements() {
        this.mapContainer = document.getElementById('mapContainer');
        this.mapCanvas = document.getElementById('mapCanvas');
        this.mapGrid = document.getElementById('mapGrid');
        this.pinLayer = document.getElementById('pinLayer');
        this.searchInput = document.getElementById('searchInput');
        this.locationInfo = document.getElementById('locationInfo');
        this.loadingIndicator = document.getElementById('loadingIndicator');
    }

    setupEventListeners() {
        document.getElementById('toggleControls').addEventListener('click', () => this.toggleControls());
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetView').addEventListener('click', () => this.resetView());
        document.getElementById('debugWorldMap').addEventListener('click', () => {
            this.getWorldMapStats();
            this.debugWorldMapVisibility();
            const testZooms = [0.05, 0.15, 0.25, 0.4];
            let index = 0;
            const testNextZoom = () => {
                if (index < testZooms.length) {
                    const zoom = testZooms[index];
                    this.zoomToLevel(zoom);
                    index++;
                    setTimeout(testNextZoom, 2000);
                }
            };
            testNextZoom();
        });
        document.getElementById('toggleDebug').addEventListener('click', () => {
            this.toggleDebugMode();
            this.updateDebugButtonState();
        });
        document.getElementById('searchBtn').addEventListener('click', () => this.search());
        this.searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.search(); });
        document.getElementById('closeInfo').addEventListener('click', () => this.hideLocationInfo());
        this.mapCanvas.addEventListener('mousedown', (e) => this.startDrag(e));
        this.mapCanvas.addEventListener('mousemove', (e) => this.drag(e));
        this.mapCanvas.addEventListener('mouseup', () => this.endDrag());
        this.mapCanvas.addEventListener('mouseleave', () => this.endDrag());
        this.mapCanvas.addEventListener('click', (e) => this.handleMapClick(e));
        this.mapCanvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.mapCanvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.mapCanvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.mapCanvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        window.addEventListener('resize', () => this.handleResize());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    createGrid() {
        const totalWidth = this.config.gridWidth * this.config.tileSize;
        const totalHeight = this.config.gridHeight * this.config.tileSize;
        this.mapGrid.style.width = totalWidth + 'px';
        this.mapGrid.style.height = totalHeight + 'px';
        this.createWorldMapElement();
        for (let row = 0; row < this.config.gridHeight; row++) {
            for (let col = 0; col < this.config.gridWidth; col++) {
                const tile = document.createElement('div');
                tile.className = 'map-tile';
                tile.dataset.row = row;
                tile.dataset.col = col;
                let tileX = col * this.config.tileSize;
                let tileY = row * this.config.tileSize;
                const subfolderRow = Math.floor(row / this.config.subfolderSize);
                const subfolderCol = Math.floor(col / this.config.subfolderSize);
                const subfolderKey = `subfolder_${subfolderRow}_${subfolderCol}`;
                if (this.config.subfolderOffsets[subfolderKey]) {
                    const offset = this.config.subfolderOffsets[subfolderKey];
                    tileX += offset.x * this.config.tileSize;
                    tileY += offset.y * this.config.tileSize;
                }
                tile.style.left = tileX + 'px';
                tile.style.top = tileY + 'px';
                tile.style.width = this.config.tileSize + 'px';
                tile.style.height = this.config.tileSize + 'px';
                this.mapGrid.appendChild(tile);
            }
        }
    }

    createWorldMapElement() {
        this.worldMapElements = {};
        this.currentWorldMapLevel = null;
        this.worldMapElement = document.createElement('img');
        this.worldMapElement.className = 'world-map-image world-map-fallback';
        this.worldMapElement.src = this.config.worldMapPath;
        const totalMapWidth = this.config.gridWidth * this.config.tileSize;
        const totalMapHeight = this.config.gridHeight * this.config.tileSize;
        this.worldMapElement.style.cssText = `position:absolute;top:0;left:0;width:${totalMapWidth}px;height:${totalMapHeight}px;object-fit:cover;object-position:center;opacity:0;transition:opacity 0.3s ease;pointer-events:none;z-index:10;image-rendering:auto;`;
        this.mapGrid.appendChild(this.worldMapElement);
        this.worldMapElement.onload = () => {};
        this.worldMapElement.onerror = () => {};
        if (this.config.worldMaps) {
            this.worldMapLoadingStates = {};
            Object.entries(this.config.worldMaps).forEach(([level, worldMapConfig], index) => {
                const element = document.createElement('img');
                element.className = `world-map-image world-map-${level}`;
                this.worldMapLoadingStates[level] = 'loading';
                const totalMapWidth = this.config.gridWidth * this.config.tileSize;
                const totalMapHeight = this.config.gridHeight * this.config.tileSize;
                const zIndex = 15 + index;
                element.style.cssText = `position:absolute;top:0;left:0;width:${totalMapWidth}px;height:${totalMapHeight}px;object-fit:cover;object-position:center;opacity:0;transition:opacity 0.3s ease;pointer-events:none;z-index:${zIndex};image-rendering:auto;`;
                element.onload = () => { this.worldMapLoadingStates[level] = 'loaded'; };
                element.onerror = () => {
                    this.worldMapLoadingStates[level] = 'error';
                    setTimeout(() => {
                        if (this.worldMapLoadingStates[level] === 'error') {
                            this.worldMapLoadingStates[level] = 'loading';
                            element.src = worldMapConfig.path;
                        }
                    }, 2000);
                };
                this.worldMapElements[level] = element;
                this.mapGrid.appendChild(element);
                element.src = worldMapConfig.path;
            });
        }
    }

    getTilePosition(row, col) {
        let tileX = col * this.config.tileSize;
        let tileY = row * this.config.tileSize;
        const subfolderRow = Math.floor(row / this.config.subfolderSize);
        const subfolderCol = Math.floor(col / this.config.subfolderSize);
        const subfolderKey = `subfolder_${subfolderRow}_${subfolderCol}`;
        if (this.config.subfolderOffsets[subfolderKey]) {
            const offset = this.config.subfolderOffsets[subfolderKey];
            tileX += offset.x * this.config.tileSize;
            tileY += offset.y * this.config.tileSize;
        }
        return { x: tileX, y: tileY };
    }

    updateVisibleTiles() {
        if (this.isWorldMapView) return;
        const canvas = this.mapCanvas.getBoundingClientRect();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const leftBound = -this.offsetX / this.zoom;
        const topBound = -this.offsetY / this.zoom;
        const rightBound = leftBound + canvasWidth / this.zoom;
        const bottomBound = topBound + canvasHeight / this.zoom;
        let bufferMultiplier = 3;
        switch (this.devicePerformance.tier) {
            case 'ultra': bufferMultiplier = 4; break;
            case 'high': bufferMultiplier = 3.5; break;
            case 'medium': bufferMultiplier = 3; break;
            case 'low': bufferMultiplier = 2; break;
        }
        const buffer = this.config.tileSize * bufferMultiplier;
        const currentVisible = new Set();
        let tilesToLoad = [];
        for (let row = 0; row < this.config.gridHeight; row++) {
            for (let col = 0; col < this.config.gridWidth; col++) {
                const tilePos = this.getTilePosition(row, col);
                const tileLeft = tilePos.x - buffer;
                const tileRight = tilePos.x + this.config.tileSize + buffer;
                const tileTop = tilePos.y - buffer;
                const tileBottom = tilePos.y + this.config.tileSize + buffer;
                if (tileRight >= leftBound && tileLeft <= rightBound && 
                    tileBottom >= topBound && tileTop <= bottomBound) {
                    const tileKey = `${row}-${col}`;
                    currentVisible.add(tileKey);
                    if (this.pendingUnloads.has(tileKey)) {
                        clearTimeout(this.pendingUnloads.get(tileKey));
                        this.pendingUnloads.delete(tileKey);
                    }
                    if (!this.loadedTiles.has(tileKey)) {
                        if (this.failedTiles.has(tileKey)) {
                            const failTime = this.failedTiles.get(tileKey);
                            const retryDelay = 60000;
                            if (Date.now() - failTime > retryDelay) {
                                this.failedTiles.delete(tileKey);
                                tilesToLoad.push({ row, col, priority: 'retry' });
                            } else {
                                const tile = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                                if (tile && !tile.classList.contains('missing') && !tile.classList.contains('error')) {
                                    tile.classList.add('error');
                                    tile.style.backgroundColor = '#2a2a2a';
                                    tile.style.opacity = '0.3';
                                }
                            }
                        } else {
                            const centerX = leftBound + (rightBound - leftBound) / 2;
                            const centerY = topBound + (bottomBound - topBound) / 2;
                            const tilePos = this.getTilePosition(row, col);
                            const tileCenterX = tilePos.x + this.config.tileSize / 2;
                            const tileCenterY = tilePos.y + this.config.tileSize / 2;
                            const distance = Math.sqrt(Math.pow(tileCenterX - centerX, 2) + Math.pow(tileCenterY - centerY, 2));
                            tilesToLoad.push({ row, col, priority: 'normal', distance });
                        }
                    }
                }
            }
        }
        this.loadTilesWithPerformanceControl(tilesToLoad);
        this.visibleTiles.forEach(tileKey => {
            if (!currentVisible.has(tileKey) && !this.pendingUnloads.has(tileKey)) {
                this.scheduleUnloadWithPerformanceControl(tileKey);
            }
        });
        this.visibleTiles = currentVisible;
    }

    loadTilesWithPerformanceControl(tilesToLoad) {
        if (tilesToLoad.length === 0) return;
        tilesToLoad.sort((a, b) => {
            if (a.priority === 'retry' && b.priority !== 'retry') return -1;
            if (b.priority === 'retry' && a.priority !== 'retry') return 1;
            return a.distance - b.distance;
        });
        const maxConcurrent = this.devicePerformance.capabilities.concurrentConnections;
        const maxTiles = this.devicePerformance.capabilities.maxTiles;
        const loadLimit = Math.min(tilesToLoad.length, maxTiles - this.loadedTiles.size);
        const tilesToLoadNow = tilesToLoad.slice(0, loadLimit);
        let loadedCount = 0;
        const loadBatch = () => {
            const batchSize = Math.min(maxConcurrent, tilesToLoadNow.length - loadedCount);
            const batch = tilesToLoadNow.slice(loadedCount, loadedCount + batchSize);
            batch.forEach(({ row, col }) => {
                this.loadTile(row, col);
            });
            loadedCount += batchSize;
            if (loadedCount < tilesToLoadNow.length) {
                const delay = this.calculateBatchDelay();
                setTimeout(loadBatch, delay);
            }
        };
        loadBatch();
    }

    calculateBatchDelay() {
        let baseDelay = 50;
        switch (this.devicePerformance.tier) {
            case 'ultra': baseDelay = 20; break;
            case 'high': baseDelay = 30; break;
            case 'medium': baseDelay = 50; break;
            case 'low': baseDelay = 100; break;
        }
        if (this.performanceMetrics.averageFPS < 30) baseDelay *= 2;
        else if (this.performanceMetrics.averageFPS < 45) baseDelay *= 1.5;
        return baseDelay;
    }

    getTilePath(row, col) {
        const subfolderRow = Math.floor(row / this.config.subfolderSize);
        const subfolderCol = Math.floor(col / this.config.subfolderSize);
        const localRow = row % this.config.subfolderSize;
        const localCol = col % this.config.subfolderSize;
        const subfolderName = `subfolder_${subfolderRow}_${subfolderCol}`;
        return `${this.config.tilePath}${subfolderName}/tile_${localRow}_${localCol}.${this.config.imageFormat}`;
    }

    subfolderExists(row, col) {
        const subfolderRow = Math.floor(row / this.config.subfolderSize);
        const subfolderCol = Math.floor(col / this.config.subfolderSize);
        const subfolderKey = `subfolder_${subfolderRow}_${subfolderCol}`;
            // Load tiles opportunistically; if a subfolder or tile is missing, loadTile will handle errors.
            return true;
        return existingSubfolders.includes(subfolderKey);
    }

    setOffsetPattern(pattern) {
        switch (pattern) {
            case 'brick':
                this.config.subfolderOffsets = {};
                const subFoldersWide = Math.ceil(this.config.gridWidth / this.config.subfolderSize);
                const subFoldersHigh = Math.ceil(this.config.gridHeight / this.config.subfolderSize);
                for (let subRow = 0; subRow < subFoldersHigh; subRow++) {
                    for (let subCol = 0; subCol < subFoldersWide; subCol++) {
                        if (subRow % 2 === 1) {
                            const key = `subfolder_${subRow}_${subCol}`;
                            this.config.subfolderOffsets[key] = { x: 0.5, y: 0 };
                        }
                    }
                }
                break;
            case 'checkerboard':
                this.config.subfolderOffsets = {};
                const subFoldersWide2 = Math.ceil(this.config.gridWidth / this.config.subfolderSize);
                const subFoldersHigh2 = Math.ceil(this.config.gridHeight / this.config.subfolderSize);
                for (let subRow = 0; subRow < subFoldersHigh2; subRow++) {
                    for (let subCol = 0; subCol < subFoldersWide2; subCol++) {
                        if ((subRow + subCol) % 2 === 1) {
                            const key = `subfolder_${subRow}_${subCol}`;
                            this.config.subfolderOffsets[key] = { x: 0.5, y: 0.5 };
                        }
                    }
                }
                break;
            case 'none':
                this.config.subfolderOffsets = {};
                break;
            default:
                console.warn('Unknown offset pattern:', pattern);
        }
        this.mapGrid.innerHTML = '';
        this.createGrid();
        this.updateVisibleTiles();
    }

    logExpectedFolderStructure() {
        // Retained for debugging in console
        const subFoldersWide = Math.ceil(this.config.gridWidth / this.config.subfolderSize);
        const subFoldersHigh = Math.ceil(this.config.gridHeight / this.config.subfolderSize);
        const offsetCount = Object.keys(this.config.subfolderOffsets).length;
        // ... (console logs omitted for brevity)
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        if (this.debugMode) {
            this.mapCanvas.style.cursor = 'crosshair';
            this.mapContainer.classList.add('debug-mode');
        } else {
            this.mapCanvas.style.cursor = 'grab';
            this.mapContainer.classList.remove('debug-mode');
        }
        return this.debugMode;
    }

    updateDebugButtonState() {
        const debugButton = document.getElementById('toggleDebug');
        if (debugButton) {
            if (this.debugMode) {
                debugButton.classList.add('active');
                debugButton.textContent = 'Debug ON';
            } else {
                debugButton.classList.remove('active');
                debugButton.textContent = 'Debug Mode';
            }
        }
    }

    // Build a list of initial viewport tile URLs and ask SW to precache them
    warmupCacheInitialTiles() {
        try {
            if (!this.cacheWarmup?.enabled) return;
            if (!('serviceWorker' in navigator)) return;

            const canvas = this.mapCanvas.getBoundingClientRect();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const leftBound = -this.offsetX / this.zoom;
            const topBound = -this.offsetY / this.zoom;
            const rightBound = leftBound + canvasWidth / this.zoom;
            const bottomBound = topBound + canvasHeight / this.zoom;

            const extra = this.cacheWarmup.bufferTiles * this.config.tileSize;
            const urls = [];
            const tiles = [];
            for (let row = 0; row < this.config.gridHeight; row++) {
                for (let col = 0; col < this.config.gridWidth; col++) {
                    const pos = this.getTilePosition(row, col);
                    const tileLeft = pos.x - extra;
                    const tileRight = pos.x + this.config.tileSize + extra;
                    const tileTop = pos.y - extra;
                    const tileBottom = pos.y + this.config.tileSize + extra;
                    if (tileRight >= leftBound && tileLeft <= rightBound && tileBottom >= topBound && tileTop <= bottomBound) {
                        const centerX = (leftBound + rightBound) / 2;
                        const centerY = (topBound + bottomBound) / 2;
                        const tileCenterX = pos.x + this.config.tileSize / 2;
                        const tileCenterY = pos.y + this.config.tileSize / 2;
                        const distance = Math.hypot(tileCenterX - centerX, tileCenterY - centerY);
                        tiles.push({ row, col, distance });
                    }
                }
            }
            tiles.sort((a, b) => a.distance - b.distance);
            const limit = this.cacheWarmup.limit || 300;
            for (let i = 0; i < tiles.length && i < limit; i++) {
                urls.push(this.getTilePath(tiles[i].row, tiles[i].col));
            }

            // Post to SW once ready
            navigator.serviceWorker.ready.then((reg) => {
                const sw = reg.active;
                if (sw) {
                    sw.postMessage({ type: 'PRECACHE_TILES', urls, limit, concurrency: this.cacheWarmup.concurrency });
                }
            }).catch(() => {});
        } catch (e) {
            // no-op
        }
    }

    toggleControls() {
        this.controlsVisible = !this.controlsVisible;
        const controlsPanel = document.getElementById('mapControls');
        const toggleButton = document.getElementById('toggleControls');
        if (this.controlsVisible) {
            controlsPanel.classList.add('visible');
            toggleButton.classList.add('active');
        } else {
            controlsPanel.classList.remove('visible');
            toggleButton.classList.remove('active');
        }
    }

    showControls() {
        this.controlsVisible = true;
        document.getElementById('mapControls').classList.add('visible');
        document.getElementById('toggleControls').classList.add('active');
    }

    hideControls() {
        this.controlsVisible = false;
        document.getElementById('mapControls').classList.remove('visible');
        document.getElementById('toggleControls').classList.remove('active');
    }

    handleTouchStart(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);
        if (this.touches.length === 1) {
            this.startDrag(this.getTouchEvent(e));
        } else if (this.touches.length === 2) {
            this.isPinching = true;
            this.touchStartZoom = this.zoom;
            this.lastPinchDistance = this.getPinchDistance(this.touches);
            this.endDrag();
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);
        if (this.touches.length === 1 && !this.isPinching) {
            this.drag(this.getTouchEvent(e));
        } else if (this.touches.length === 2 && this.isPinching) {
            const currentDistance = this.getPinchDistance(this.touches);
            const centerX = (this.touches[0].clientX + this.touches[1].clientX) / 2;
            const centerY = (this.touches[0].clientY + this.touches[1].clientY) / 2;
            this.zoomAtPoint(this.touchStartZoom * (currentDistance / this.lastPinchDistance), centerX, centerY);
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);
        if (this.touches.length === 0) {
            this.endDrag();
            this.isPinching = false;
            this.lastPinchDistance = 0;
        } else if (this.touches.length === 1 && this.isPinching) {
            this.isPinching = false;
            this.lastPinchDistance = 0;
            this.startDrag(this.getTouchEvent(e));
        }
    }

    getPinchDistance(touches) {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    zoomAtPoint(newZoom, clientX, clientY) {
        const rect = this.mapCanvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const worldX = (x - this.offsetX) / this.zoom;
        const worldY = (y - this.offsetY) / this.zoom;
        newZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, newZoom));
        this.offsetX = x - worldX * newZoom;
        this.offsetY = y - worldY * newZoom;
        this.zoom = newZoom;
        this.updateTransform();
        this.throttledUpdateTiles();
        this.updateMapView();
    }

    handleKeyPress(e) {
        if (e.target.tagName === 'INPUT') return;
        switch(e.key) {
            case 'Escape':
                this.hideControls();
                this.hideLocationInfo();
                break;
            case ' ':
                e.preventDefault();
                this.toggleControls();
                break;
            case '+':
            case '=':
                e.preventDefault();
                this.zoomIn();
                break;
            case '-':
                e.preventDefault();
                this.zoomOut();
                break;
            case '0':
                e.preventDefault();
                this.resetView();
                break;
            case 'h':
            case 'H':
                if (e.ctrlKey || e.metaKey) return;
                this.toggleControls();
                break;
        }
    }

    setWorldMapThreshold(threshold) {
        this.config.worldMapThreshold = threshold;
        this.updateMapView();
    }

    forceWorldMapView(force = true) {
        if (force) {
            this.isWorldMapView = true;
            this.worldMapElement.style.opacity = '1';
            this.worldMapElement.style.pointerEvents = 'auto';
            document.querySelectorAll('.map-tile').forEach(tile => { tile.style.opacity = '0'; });
        } else {
            this.isWorldMapView = false;
            this.worldMapElement.style.opacity = '0';
            this.worldMapElement.style.pointerEvents = 'none';
            document.querySelectorAll('.map-tile.loaded').forEach(tile => { tile.style.opacity = '1'; });
        }
    }

    getWorldMapStats() { return {}; }
    getWorldMapLoadingStatus() { return this.worldMapLoadingStates; }
    reloadFailedWorldMaps() {
        if (!this.worldMapLoadingStates) return;
        Object.entries(this.worldMapLoadingStates).forEach(([level, state]) => {
            if (state === 'error') {
                const element = this.worldMapElements[level];
                const config = this.config.worldMaps[level];
                if (element && config) {
                    this.worldMapLoadingStates[level] = 'loading';
                    element.src = config.path;
                }
            }
        });
    }

    debugWorldMapVisibility() {}
    updateWorldMapImage(imagePath) { this.config.worldMapPath = imagePath; this.worldMapElement.src = imagePath; }

    loadTile(row, col, retryCount = 0) {
        if (this.isWorldMapView) return;
        const tileKey = `${row}-${col}`;
        const tile = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!tile) return;
        if (!this.subfolderExists(row, col)) {
            tile.classList.remove('loading', 'error', 'loaded');
            tile.classList.add('missing');
            tile.style.backgroundImage = 'none';
            tile.style.backgroundColor = '#000000';
            tile.style.opacity = '1';
            this.failedTiles.set(tileKey, Date.now());
            return;
        }
        if (this.loadedTiles.has(tileKey) && tile.classList.contains('loaded')) return;
        if (tile.classList.contains('loading') && retryCount === 0) return;
        tile.classList.remove('error', 'unloaded', 'missing');
        tile.classList.add('loading');
        const img = new Image();
        const tilePath = this.getTilePath(row, col);
        const cacheBuster = retryCount > 0 ? `?retry=${retryCount}&t=${Date.now()}` : '';
        const loadTimeout = setTimeout(() => { this.handleTileLoadError(row, col, retryCount); }, 8000);
        img.onload = () => {
            clearTimeout(loadTimeout);
            if (tile && !tile.classList.contains('unloaded')) {
                const imageUrl = `url("${img.src}")`;
                tile.style.backgroundImage = imageUrl;
                tile.classList.remove('loading', 'error');
                tile.classList.add('loaded');
                tile.style.opacity = '1';
                this.loadedTiles.set(tileKey, img.src);
                this.failedTiles.delete(tileKey);
            }
        };
        img.onerror = () => { clearTimeout(loadTimeout); this.handleTileLoadError(row, col, retryCount); };
        img.onabort = () => { clearTimeout(loadTimeout); this.handleTileLoadError(row, col, retryCount); };
        img.src = tilePath + cacheBuster;
    }

    handleTileLoadError(row, col, retryCount) {
        const tileKey = `${row}-${col}`;
        const tile = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!tile) return;
        if (retryCount < this.maxRetries) {
            const retryDelay = retryCount === 0 ? 500 : Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
            tile.classList.remove('loading');
            tile.classList.add('error');
            setTimeout(() => {
                if (this.visibleTiles.has(tileKey) && !this.loadedTiles.has(tileKey)) {
                    this.loadTile(row, col, retryCount + 1);
                }
            }, retryDelay);
        } else {
            tile.classList.remove('loading', 'error', 'loaded');
            tile.classList.add('missing');
            tile.style.backgroundImage = 'none';
            tile.style.backgroundColor = '#000000';
            tile.style.opacity = '1';
            this.loadedTiles.delete(tileKey);
            this.failedTiles.set(tileKey, Date.now());
        }
    }

    unloadTile(tileKey) {
        const [row, col] = tileKey.split('-');
        const tile = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!tile) { this.loadedTiles.delete(tileKey); return; }
        if (tile.classList.contains('loading')) {
            tile.classList.add('pending-unload');
            setTimeout(() => {
                if (tile.classList.contains('pending-unload') && !this.visibleTiles.has(tileKey)) {
                    this.unloadTile(tileKey);
                } else {
                    tile.classList.remove('pending-unload');
                }
            }, 1000);
            return;
        }
        if (tile.classList.contains('unloaded')) return;
        tile.classList.add('unloaded');
        tile.classList.remove('pending-unload');
        tile.style.opacity = '0';
        setTimeout(() => {
            if (tile && tile.classList.contains('unloaded')) {
                tile.style.backgroundImage = '';
                tile.style.backgroundColor = '';
                tile.style.opacity = '';
                tile.classList.remove('loaded', 'unloaded', 'error', 'missing');
            }
        }, 200);
        this.loadedTiles.delete(tileKey);
    }

    createPins() {
        this.pinLayer.innerHTML = '';
        this.locations.forEach(location => {
            const pin = document.createElement('div');
            pin.className = `map-pin ${location.type}`;
            pin.style.left = location.x + 'px';
            pin.style.top = location.y + 'px';
            pin.dataset.locationId = location.id;
            pin.addEventListener('click', (e) => { e.stopPropagation(); this.showLocationInfo(location); });
            this.pinLayer.appendChild(pin);
        });
    }

    updateTransform() {
        const transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
        this.mapGrid.style.transform = transform;
        this.pinLayer.style.transform = transform;
        this.updateMapView();
        if (this.isWorldMapView) return;
        if (this.isDragging) this.throttledUpdateTiles();
        else this.updateVisibleTiles();
    }

    clearPendingUnloads() {
        this.pendingUnloads.forEach(timeoutId => { clearTimeout(timeoutId); });
        this.pendingUnloads.clear();
    }

    setUnloadDelay(delayMs) { this.tileUnloadDelay = delayMs; }

    debugTileUnloading() { return {}; }

    scheduleUnloadWithPerformanceControl(tileKey) {
        if (this.pendingUnloads.has(tileKey)) return;
        let adjustedDelay = this.tileUnloadDelay;
        if (this.devicePerformance.memory < 4) adjustedDelay = Math.max(500, this.tileUnloadDelay * 0.5);
        else if (this.devicePerformance.memory > 16) adjustedDelay = this.tileUnloadDelay * 1.5;
        const maxTilesForDevice = this.devicePerformance.capabilities.maxTiles;
        if (this.loadedTiles.size > maxTilesForDevice) adjustedDelay = Math.max(200, adjustedDelay * 0.3);
        const timeoutId = setTimeout(() => { this.unloadTile(tileKey); this.pendingUnloads.delete(tileKey); }, adjustedDelay);
        this.pendingUnloads.set(tileKey, timeoutId);
    }

    getMemoryUsage() {
        let memoryInfo = { used: 0, total: 0, available: 0, percentage: 0, isEstimate: true };
        try {
            if (performance.memory) {
                const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
                const limit = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
                memoryInfo = { used, total, available: limit - used, percentage: Math.round((used / limit) * 100), isEstimate: false, jsHeapLimit: limit };
            } else { throw new Error('no api'); }
        } catch (error) {
            const estimatedUsed = (this.loadedTiles.size * 0.8) + 50;
            const estimatedTotal = this.devicePerformance.memory * 1024;
            memoryInfo = { used: Math.round(estimatedUsed), total: Math.round(estimatedTotal), available: Math.round(estimatedTotal - estimatedUsed), percentage: Math.round((estimatedUsed / estimatedTotal) * 100), isEstimate: true };
        }
        return memoryInfo;
    }

    startMemoryMonitoring(intervalMs = 5000) {
        if (this.memoryMonitorInterval) { clearInterval(this.memoryMonitorInterval); }
        this.memoryMonitorInterval = setInterval(() => {
            const memory = this.getMemoryUsage();
            const timestamp = new Date().toLocaleTimeString();
            if (memory.percentage > 80) { /* warn */ }
        }, intervalMs);
        return this.memoryMonitorInterval;
    }

    stopMemoryMonitoring() { if (this.memoryMonitorInterval) { clearInterval(this.memoryMonitorInterval); this.memoryMonitorInterval = null; } }

    getMemoryReport() { return { memory: this.getMemoryUsage(), tileMemoryMB: this.loadedTiles.size * 0.8, devicePerformance: this.devicePerformance } }

    getFailedTiles() { return Array.from(this.failedTiles.keys()); }

    retryFailedTiles() {
        const failedTileKeys = Array.from(this.failedTiles.keys());
        this.failedTiles.clear();
        failedTileKeys.forEach(tileKey => {
            const [row, col] = tileKey.split('-').map(Number);
            if (this.visibleTiles.has(tileKey)) this.loadTile(row, col);
        });
    }

    getTileLoadingStatus() {
        const status = { totalTiles: this.config.gridWidth * this.config.gridHeight, loadedTiles: this.loadedTiles.size, visibleTiles: this.visibleTiles.size, failedTiles: this.failedTiles.size, pendingUnloads: this.pendingUnloads.size };
        return status;
    }

    reloadVisibleTiles() {
        this.loadedTiles.clear();
        this.failedTiles.clear();
        document.querySelectorAll('.map-tile').forEach(tile => {
            tile.style.backgroundImage = '';
            tile.classList.remove('loaded', 'loading', 'error', 'unloaded', 'missing');
            tile.style.backgroundColor = '';
        });
        this.visibleTiles.forEach(tileKey => { const [row, col] = tileKey.split('-').map(Number); this.loadTile(row, col); });
    }

    updateMapView() {
        const shouldShowWorldMap = this.zoom < this.config.worldMapThreshold;
        if (shouldShowWorldMap) {
            let bestLevel = 'small';
            let bestElement = null;
            if (this.worldMapElements && Object.keys(this.worldMapElements).length > 0) {
                const levels = Object.entries(this.config.worldMaps).sort((a, b) => b[1].threshold - a[1].threshold);
                for (const [level, config] of levels) {
                    const element = this.worldMapElements[level];
                    const isLoaded = this.worldMapLoadingStates && this.worldMapLoadingStates[level] === 'loaded';
                    const isElementReady = element && element.complete && element.naturalWidth > 0;
                    if (this.zoom >= config.threshold && element && (isLoaded || isElementReady)) { bestLevel = level; bestElement = element; break; }
                }
                if (!bestElement) {
                    for (const [level, config] of levels) {
                        const element = this.worldMapElements[level];
                        const isLoaded = this.worldMapLoadingStates && this.worldMapLoadingStates[level] === 'loaded';
                        const isElementReady = element && element.complete && element.naturalWidth > 0;
                        if (element && (isLoaded || isElementReady)) { bestLevel = level; bestElement = element; break; }
                    }
                }
                if (!bestElement) {
                    const smallestLevel = Object.entries(this.config.worldMaps).sort((a, b) => a[1].threshold - b[1].threshold)[0];
                    if (smallestLevel && this.worldMapElements[smallestLevel[0]]) { bestLevel = smallestLevel[0]; bestElement = this.worldMapElements[smallestLevel[0]]; }
                }
            }
            if (!bestElement && this.worldMapElement) { bestElement = this.worldMapElement; bestLevel = 'fallback'; }
            if (!bestElement) { return; }
            if (!this.isWorldMapView || this.currentWorldMapLevel !== bestLevel) {
                const rect = this.mapCanvas.getBoundingClientRect();
                const viewCenterX = (rect.width / 2 - this.offsetX) / this.zoom;
                const viewCenterY = (rect.height / 2 - this.offsetY) / this.zoom;
                this.isWorldMapView = true;
                if (this.worldMapElements) { Object.values(this.worldMapElements).forEach(element => { element.style.opacity = '0'; element.style.pointerEvents = 'none'; }); }
                if (this.worldMapElement) { this.worldMapElement.style.opacity = '0'; this.worldMapElement.style.pointerEvents = 'none'; }
                bestElement.style.opacity = '1';
                bestElement.style.pointerEvents = 'auto';
                this.currentWorldMapLevel = bestLevel;
                this.offsetX = rect.width / 2 - (viewCenterX * this.zoom);
                this.offsetY = rect.height / 2 - (viewCenterY * this.zoom);
                const transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
                this.mapGrid.style.transform = transform;
                this.pinLayer.style.transform = transform;
                document.querySelectorAll('.map-tile').forEach(tile => { tile.style.opacity = '0'; });
            }
        } else if (this.isWorldMapView) {
            this.isWorldMapView = false;
            this.currentWorldMapLevel = null;
            if (this.worldMapElements) { Object.values(this.worldMapElements).forEach(element => { element.style.opacity = '0'; element.style.pointerEvents = 'none'; }); }
            if (this.worldMapElement) { this.worldMapElement.style.opacity = '0'; this.worldMapElement.style.pointerEvents = 'none'; }
            document.querySelectorAll('.map-tile.loaded').forEach(tile => { tile.style.opacity = '1'; });
            setTimeout(() => { this.updateVisibleTiles(); }, 100);
        }
    }

    startDrag(e) {
        this.isDragging = true;
        this.mapCanvas.classList.add('dragging');
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging) return;
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        this.offsetX += deltaX;
        this.offsetY += deltaY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.updateTransform();
        e.preventDefault();
    }

    endDrag() {
        this.isDragging = false;
        this.mapCanvas.classList.remove('dragging');
        this.mapCanvas.style.cursor = this.debugMode ? 'crosshair' : 'grab';
        this.updateVisibleTiles();
    }

    handleMapClick(e) {
        if (!this.debugMode || this.isDragging) return;
        if (e.target.classList.contains('map-pin')) return;
        const rect = this.mapCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const mapX = (clickX - this.offsetX) / this.zoom;
        const mapY = (clickY - this.offsetY) / this.zoom;
        const tileCol = Math.floor(mapX / this.config.tileSize);
        const tileRow = Math.floor(mapY / this.config.tileSize);
        const subfolderRow = Math.floor(tileRow / this.config.subfolderSize);
        const subfolderCol = Math.floor(tileCol / this.config.subfolderSize);
        const localRow = tileRow % this.config.subfolderSize;
        const localCol = tileCol % this.config.subfolderSize;
        this.showCoordinateInfo({
            screenX: clickX,
            screenY: clickY,
            mapX: Math.round(mapX),
            mapY: Math.round(mapY),
            tileRow,
            tileCol,
            subfolderRow,
            subfolderCol,
            localRow,
            localCol
        });
    }

    showCoordinateInfo(coords) { /* console log omitted */ this.showTemporaryOverlay(coords); }

    showTemporaryOverlay(coords) {
        const existing = document.getElementById('coordinateOverlay');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'coordinateOverlay';
        overlay.innerHTML = `
            <div class="coordinate-info">
                <button class="close-coord" onclick="this.parentElement.parentElement.remove()">&times;</button>
                <h3>🎯 Coordinates</h3>
                <div class="coord-row"><strong>Map:</strong> ${coords.mapX}, ${coords.mapY}</div>
                <div class="coord-row"><strong>Tile:</strong> ${coords.tileRow}, ${coords.tileCol}</div>
                <div class="coord-row"><strong>Subfolder:</strong> ${coords.subfolderRow}_${coords.subfolderCol}</div>
                <div class="coord-copy">
                    <strong>Location Data:</strong>
                    <textarea readonly onclick="this.select()" class="location-template">{ id: ${Date.now()}, name: "New Location", x: ${coords.mapX}, y: ${coords.mapY}, type: "landmark", description: "Add description here." }</textarea>
                </div>
            </div>
        `;
        overlay.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.95);color:white;padding:20px;border-radius:8px;z-index:10000;font-family:monospace;border:2px solid #ffd700;max-width:500px;backdrop-filter:blur(10px);`;
        const style = document.createElement('style');
        style.textContent = `.coordinate-info h3{margin:0 0 15px 0;color:#ffd700}.coord-row{margin:5px 0;padding:3px 0}.coord-copy{margin-top:15px}.location-template{width:100%;height:60px;margin-top:5px;background:rgba(255,255,255,0.1);border:1px solid #555;color:white;padding:8px;border-radius:4px;font-family:monospace;font-size:12px;resize:vertical}.close-coord{position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.2);border:none;color:white;width:25px;height:25px;border-radius:50%;cursor:pointer;font-size:16px}`;
        document.head.appendChild(style);
        document.body.appendChild(overlay);
        setTimeout(() => { if (overlay.parentNode) overlay.remove(); if (style.parentNode) style.remove(); }, 10000);
    }

    getTouchEvent(e) { return e.touches[0] || e.changedTouches[0]; }

    handleWheel(e) {
        e.preventDefault();
        const zoomFactor = 1.15;
        const delta = e.deltaY > 0 ? (1 / zoomFactor) : zoomFactor;
        const newZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, this.zoom * delta));
        if (newZoom !== this.zoom) {
            const rect = this.mapCanvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const actualZoomFactor = newZoom / this.zoom;
            this.offsetX = mouseX - (mouseX - this.offsetX) * actualZoomFactor;
            this.offsetY = mouseY - (mouseY - this.offsetY) * actualZoomFactor;
            this.zoom = newZoom;
            this.updateTransform();
        }
    }

    zoomIn() { const zoomFactor = 1.2; const newZoom = Math.min(this.config.maxZoom, this.zoom * zoomFactor); this.zoomToLevel(newZoom); }
    zoomOut() { const zoomFactor = 1.2; const newZoom = Math.max(this.config.minZoom, this.zoom / zoomFactor); this.zoomToLevel(newZoom); }
    zoomToLevel(newZoom) {
        const rect = this.mapCanvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const zoomFactor = newZoom / this.zoom;
        this.offsetX = centerX - (centerX - this.offsetX) * zoomFactor;
        this.offsetY = centerY - (centerY - this.offsetY) * zoomFactor;
        this.zoom = newZoom;
        this.updateTransform();
    }

    resetView() { this.zoom = this.config.initialZoom; this.clearPendingUnloads(); this.centerMap(); }
    centerMap() {
        const rect = this.mapCanvas.getBoundingClientRect();
        const mapWidth = this.config.gridWidth * this.config.tileSize * this.zoom;
        const mapHeight = this.config.gridHeight * this.config.tileSize * this.zoom;
        this.offsetX = (rect.width - mapWidth) / 2;
        this.offsetY = (rect.height - mapHeight) / 2;
        this.updateTransform();
    }

    search() {
        const query = this.searchInput.value.toLowerCase().trim();
        if (!query) return;
        const location = this.locations.find(loc => loc.name.toLowerCase().includes(query) || loc.description.toLowerCase().includes(query));
        if (location) {
            this.zoomToLevel(this.config.initialZoom);
            this.panToLocation(location);
            this.showLocationInfo(location);
        } else { alert('Location not found'); }
    }

    panToLocation(location) {
        const rect = this.mapCanvas.getBoundingClientRect();
        const targetX = location.x * this.zoom;
        const targetY = location.y * this.zoom;
        this.offsetX = rect.width / 2 - targetX;
        this.offsetY = rect.height / 2 - targetY;
        this.updateTransform();
    }

    showLocationInfo(location) {
        document.getElementById('locationName').textContent = location.name;
        document.getElementById('locationDescription').textContent = location.description;
        this.locationInfo.classList.remove('hidden');
    }

    hideLocationInfo() { this.locationInfo.classList.add('hidden'); }

    handleResize() { requestAnimationFrame(() => { this.updateVisibleTiles(); }); }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.createGrid();
        this.updateVisibleTiles();
        this.createPins();
        this.centerMap();
        // After centering, warm up cache for initial viewport tiles
        this.updateVisibleTiles();
        this.warmupCacheInitialTiles();
        this.updateDebugButtonState();
        this.hideControls();
        this.startPerformanceMonitoring();
    }
}
