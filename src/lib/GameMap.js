import { constrainMapOffsets, getVisibleTileRange, isMapPointInViewport, zoomAroundPoint } from './mapMath.js';

export default class GameMap {
    // Performance optimization methods
    throttle(func, limit) {
        let lastFunc;
        let lastRan;
        const throttled = function() {
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
        throttled.cancel = () => {
            clearTimeout(lastFunc);
            lastFunc = null;
        };
        return throttled;
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
        this.tileElements = new Map();
        this.pinElements = new Map();
        this.selectedLocationId = null;
        this.locationReturnFocus = null;
        this.visibleTiles = new Set();
        this.pendingUnloads = new Map();
        this.tileUnloadDelay = 750;
        this.failedTiles = new Map();
        this.maxRetries = 3;
        this.tileQueue = [];
        this.queuedTiles = new Set();
        this.activeTileLoads = new Map();
        this.retryTimers = new Map();
        this.tileRemovalTimers = new Set();
        this.eventCleanups = [];
        this.destroyed = false;
        this.performanceFrameId = null;
        this.resizeFrameId = null;
        this.focusFrameId = null;
        this.viewportWidth = 0;
        this.viewportHeight = 0;
        this.devicePerformance = this.detectDevicePerformance();
        this.throttleTiming = this.calculateOptimalThrottleTiming();
        this.throttledUpdateTiles = this.throttle(() => this.updateVisibleTiles(), this.throttleTiming);
        this.lastZoom = null;
        this.tilesHidden = false;
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
                    const rendererEnum = debugInfo.UNMASKED_RENDERER_WEBGL;
                    const renderer = typeof rendererEnum === 'number' ? gl.getParameter(rendererEnum) : '';
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
            if (this.performanceFrameId !== null) return;
            let frameCount = 0;
            let lastTime = performance.now();
            const monitor = () => {
                try {
                    if (this.destroyed) return;
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
                    this.performanceFrameId = requestAnimationFrame(monitor);
                } catch (e) {
                    console.error('Performance monitoring error:', e);
                }
            };
            this.performanceFrameId = requestAnimationFrame(monitor);
        } catch (e) {
            console.error('Failed to start performance monitoring:', e);
        }
    }

    adaptToPerformance(condition) {
        if (condition === 'degraded') {
            this.throttleTiming = Math.min(500, this.throttleTiming * 1.5);
        } else if (condition === 'improved') {
            this.throttleTiming = Math.max(50, this.throttleTiming * 0.8);
        }
        this.throttledUpdateTiles.cancel?.();
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

        // Rendering/compositing hints to reduce flicker during transforms
        if (this.mapGrid) {
            this.mapGrid.style.willChange = 'transform';
            this.mapGrid.style.backfaceVisibility = 'hidden';
            this.mapGrid.style.transformStyle = 'flat';
        }
        if (this.pinLayer) {
            this.pinLayer.style.willChange = 'transform';
            this.pinLayer.style.backfaceVisibility = 'hidden';
            this.pinLayer.style.transformStyle = 'flat';
        }
        this.getCanvasRect();
    }

    getCanvasRect() {
        const rect = this.mapCanvas.getBoundingClientRect();
        this.viewportWidth = rect.width;
        this.viewportHeight = rect.height;
        return rect;
    }

    listen(target, type, handler, options) {
        if (!target) return;
        target.addEventListener(type, handler, options);
        this.eventCleanups.push(() => target.removeEventListener(type, handler, options));
    }

    setupEventListeners() {
        this.listen(document.getElementById('toggleControls'), 'click', (event) => this.toggleControls(event.detail === 0));
        this.listen(document.getElementById('zoomIn'), 'click', () => this.zoomIn());
        this.listen(document.getElementById('zoomOut'), 'click', () => this.zoomOut());
        this.listen(document.getElementById('resetView'), 'click', () => this.resetView());
        this.listen(document.getElementById('debugWorldMap'), 'click', () => {
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
        this.listen(document.getElementById('toggleDebug'), 'click', () => {
            this.toggleDebugMode();
            this.updateDebugButtonState();
        });
        this.listen(document.getElementById('searchBtn'), 'click', () => this.search());
        this.listen(this.searchInput, 'keydown', (e) => { if (e.key === 'Enter') this.search(); });
        this.listen(document.getElementById('closeInfo'), 'click', () => this.hideLocationInfo(true));
        this.listen(this.mapCanvas, 'mousedown', (e) => this.startDrag(e));
        this.listen(this.mapCanvas, 'mousemove', (e) => this.drag(e));
        this.listen(this.mapCanvas, 'mouseup', () => this.endDrag());
        this.listen(this.mapCanvas, 'mouseleave', () => this.endDrag());
        this.listen(this.mapCanvas, 'click', (e) => this.handleMapClick(e));
        this.listen(this.mapCanvas, 'touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.listen(this.mapCanvas, 'touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.listen(this.mapCanvas, 'touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.listen(this.mapCanvas, 'touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
        this.listen(this.mapCanvas, 'wheel', (e) => this.handleWheel(e), { passive: false });
        this.listen(window, 'resize', () => this.handleResize());
        this.listen(document, 'keydown', (e) => this.handleKeyPress(e));
    }

    createGrid() {
        const totalWidth = this.config.gridWidth * this.config.tileSize;
        const totalHeight = this.config.gridHeight * this.config.tileSize;
        this.mapGrid.style.width = totalWidth + 'px';
        this.mapGrid.style.height = totalHeight + 'px';
        this.createWorldMapElement();
    }

    createWorldMapElement() {
        this.worldMapElements = null;
        this.currentWorldMapLevel = null;
        this.worldMapLoadingStates = null;
        this.worldMapElement = document.createElement('img');
        this.worldMapElement.className = 'world-map-image world-map-single';
        this.worldMapElement.alt = '';
        this.worldMapElement.setAttribute('aria-hidden', 'true');
        this.worldMapElement.decoding = 'async';
        this.worldMapElement.fetchPriority = 'low';
        this.worldMapElement.style.cssText = 'position:absolute;top:0;left:0;opacity:0;pointer-events:none;z-index:10;image-rendering:auto;transform-origin:top left;';

        this.mapGrid.appendChild(this.worldMapElement);
        this.worldMapElement.onload = () => this.worldMapElement?.classList.add('loaded');
        this.worldMapElement.onerror = () => this.worldMapElement?.classList.add('error');
    }

    getOrCreateTile(row, col) {
        const tileKey = `${row}-${col}`;
        const existing = this.tileElements.get(tileKey);
        if (existing) return existing;

        const tile = document.createElement('div');
        const tilePosition = this.getTilePosition(row, col);
        tile.className = 'map-tile';
        tile.dataset.row = row;
        tile.dataset.col = col;
        tile.style.left = tilePosition.x + 'px';
        tile.style.top = tilePosition.y + 'px';
        tile.style.width = this.config.tileSize + 'px';
        tile.style.height = this.config.tileSize + 'px';
        this.tileElements.set(tileKey, tile);
        this.mapGrid.appendChild(tile);
        return tile;
    }

    updateWorldMapSource() {
        if (!this.worldMapElement) return;
        const levels = Object.values(this.config.worldMaps).sort((a, b) => b.threshold - a.threshold);
        const level = levels.find((candidate) => this.zoom >= candidate.threshold) || levels[levels.length - 1];
        if (!level || this.currentWorldMapLevel === level.path) return;

        const totalMapWidth = this.config.gridWidth * this.config.tileSize;
        const totalMapHeight = this.config.gridHeight * this.config.tileSize;
        this.currentWorldMapLevel = level.path;
        this.worldMapElement.classList.remove('loaded', 'error');
        this.worldMapElement.style.width = `${level.size.width}px`;
        this.worldMapElement.style.height = `${level.size.height}px`;
        this.worldMapElement.style.transform = `scale(${totalMapWidth / level.size.width}, ${totalMapHeight / level.size.height})`;
        this.worldMapElement.src = level.path;
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
        if (this.destroyed || this.isWorldMapView) return;
        const canvas = this.getCanvasRect();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const leftBound = -this.offsetX / this.zoom;
        const topBound = -this.offsetY / this.zoom;
        const rightBound = leftBound + canvasWidth / this.zoom;
        const bottomBound = topBound + canvasHeight / this.zoom;
        let bufferTiles = 1;
        switch (this.devicePerformance.tier) {
            case 'ultra': bufferTiles = 1; break;
            case 'high': bufferTiles = 1; break;
            case 'medium': bufferTiles = 0.75; break;
            case 'low': bufferTiles = 0.5; break;
        }
        const currentVisible = new Set();
        const tilesToLoad = [];
        const centerX = leftBound + (rightBound - leftBound) / 2;
        const centerY = topBound + (bottomBound - topBound) / 2;
        const addVisibleTile = (row, col) => {
            const tileKey = `${row}-${col}`;
            currentVisible.add(tileKey);
            if (this.pendingUnloads.has(tileKey)) {
                clearTimeout(this.pendingUnloads.get(tileKey));
                this.pendingUnloads.delete(tileKey);
            }
            if (this.loadedTiles.has(tileKey) || this.activeTileLoads.has(tileKey) || this.queuedTiles.has(tileKey)) return;

            if (this.failedTiles.has(tileKey)) {
                const failedAt = this.failedTiles.get(tileKey);
                if (Date.now() - failedAt <= 60000) {
                    const tile = this.getOrCreateTile(row, col);
                    tile.classList.add('missing');
                    return;
                }
                this.failedTiles.delete(tileKey);
            }

            const tilePosition = this.getTilePosition(row, col);
            const tileCenterX = tilePosition.x + this.config.tileSize / 2;
            const tileCenterY = tilePosition.y + this.config.tileSize / 2;
            tilesToLoad.push({
                row,
                col,
                priority: 'normal',
                distance: Math.hypot(tileCenterX - centerX, tileCenterY - centerY),
            });
        };

        if (Object.keys(this.config.subfolderOffsets).length === 0) {
            const range = getVisibleTileRange({
                offsetX: this.offsetX,
                offsetY: this.offsetY,
                zoom: this.zoom,
                viewportWidth: canvasWidth,
                viewportHeight: canvasHeight,
                tileSize: this.config.tileSize,
                gridWidth: this.config.gridWidth,
                gridHeight: this.config.gridHeight,
                bufferTiles,
            });
            if (range) {
                for (let row = range.startRow; row <= range.endRow; row++) {
                    for (let col = range.startCol; col <= range.endCol; col++) addVisibleTile(row, col);
                }
            }
        } else {
            const buffer = this.config.tileSize * bufferTiles;
            for (let row = 0; row < this.config.gridHeight; row++) {
                for (let col = 0; col < this.config.gridWidth; col++) {
                    const position = this.getTilePosition(row, col);
                    if (position.x + this.config.tileSize >= leftBound - buffer && position.x <= rightBound + buffer &&
                        position.y + this.config.tileSize >= topBound - buffer && position.y <= bottomBound + buffer) {
                        addVisibleTile(row, col);
                    }
                }
            }
        }

        const previousVisible = this.visibleTiles;
        this.visibleTiles = currentVisible;
        this.cancelObsoleteTileWork(currentVisible);
        previousVisible.forEach(tileKey => {
            if (!currentVisible.has(tileKey) && !this.pendingUnloads.has(tileKey)) {
                this.scheduleUnloadWithPerformanceControl(tileKey);
            }
        });
        this.loadTilesWithPerformanceControl(tilesToLoad);
    }

    loadTilesWithPerformanceControl(tilesToLoad) {
        tilesToLoad.forEach((tile) => {
            const tileKey = `${tile.row}-${tile.col}`;
            if (this.queuedTiles.has(tileKey) || this.activeTileLoads.has(tileKey) || this.loadedTiles.has(tileKey)) return;
            this.queuedTiles.add(tileKey);
            this.tileQueue.push(tile);
        });
        this.tileQueue.sort((a, b) => {
            if (a.priority === 'retry' && b.priority !== 'retry') return -1;
            if (b.priority === 'retry' && a.priority !== 'retry') return 1;
            return a.distance - b.distance;
        });
        this.pumpTileQueue();
    }

    pumpTileQueue() {
        if (this.destroyed || this.isWorldMapView) {
            this.updateLoadingIndicator();
            return;
        }
        const maxConcurrent = this.devicePerformance.capabilities.concurrentConnections;
        while (this.activeTileLoads.size < maxConcurrent && this.tileQueue.length > 0) {
            const nextTile = this.tileQueue.shift();
            const tileKey = `${nextTile.row}-${nextTile.col}`;
            this.queuedTiles.delete(tileKey);
            if (!this.visibleTiles.has(tileKey) || this.loadedTiles.has(tileKey)) continue;
            this.loadTile(nextTile.row, nextTile.col, nextTile.retryCount || 0);
        }
        this.updateLoadingIndicator();
    }

    updateLoadingIndicator() {
        if (!this.loadingIndicator) return;
        const pending = this.activeTileLoads.size + this.tileQueue.length;
        if (this.destroyed || this.isWorldMapView || pending === 0) {
            this.loadingIndicator.classList.remove('visible');
            return;
        }
        const loadedVisible = Array.from(this.visibleTiles).filter((tileKey) => this.loadedTiles.has(tileKey)).length;
        this.loadingIndicator.textContent = `Loading map ${loadedVisible} / ${this.visibleTiles.size}`;
        this.loadingIndicator.classList.add('visible');
    }

    cancelObsoleteTileWork(visibleTiles) {
        this.tileQueue = this.tileQueue.filter(({ row, col }) => {
            const tileKey = `${row}-${col}`;
            if (visibleTiles.has(tileKey)) return true;
            this.queuedTiles.delete(tileKey);
            return false;
        });
        this.activeTileLoads.forEach((_request, tileKey) => {
            if (!visibleTiles.has(tileKey)) this.cancelTileRequest(tileKey);
        });
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
        return row >= 0 && row < this.config.gridHeight && col >= 0 && col < this.config.gridWidth;
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
        this.cancelAllTileRequests();
        this.clearPendingUnloads();
        this.mapGrid.innerHTML = '';
        this.tileElements.clear();
        this.loadedTiles.clear();
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

    toggleControls(focusPanel = false) {
        if (this.controlsVisible) this.hideControls(true);
        else this.showControls(focusPanel);
    }

    scheduleFocus(element) {
        if (this.focusFrameId !== null) cancelAnimationFrame(this.focusFrameId);
        this.focusFrameId = requestAnimationFrame(() => {
            this.focusFrameId = null;
            if (!this.destroyed && element?.isConnected) element.focus({ preventScroll: true });
        });
    }

    showControls(focusPanel = false) {
        this.controlsVisible = true;
        const controlsPanel = document.getElementById('mapControls');
        controlsPanel.classList.add('visible');
        controlsPanel.setAttribute('aria-hidden', 'false');
        this.mapContainer.classList.add('controls-open');
        const toggleButton = document.getElementById('toggleControls');
        toggleButton.classList.add('active');
        toggleButton.setAttribute('aria-expanded', 'true');
        toggleButton.setAttribute('aria-label', 'Close map controls');
        if (focusPanel) this.scheduleFocus(this.searchInput);
    }

    hideControls(restoreFocus = false) {
        this.controlsVisible = false;
        const controlsPanel = document.getElementById('mapControls');
        controlsPanel.classList.remove('visible');
        controlsPanel.setAttribute('aria-hidden', 'true');
        this.mapContainer.classList.remove('controls-open');
        const toggleButton = document.getElementById('toggleControls');
        toggleButton.classList.remove('active');
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.setAttribute('aria-label', 'Open map controls');
        if (restoreFocus && controlsPanel.contains(document.activeElement)) this.scheduleFocus(toggleButton);
    }

    handleTouchStart(e) {
        e.preventDefault?.();
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
        e.preventDefault?.();
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
        const rect = this.getCanvasRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        newZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, newZoom));
        const offsets = zoomAroundPoint({
            zoom: this.zoom,
            newZoom,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            pointX: x,
            pointY: y,
        });
        this.offsetX = offsets.offsetX;
        this.offsetY = offsets.offsetY;
        this.zoom = newZoom;
        this.updateTransform();
    }

    handleKeyPress(e) {
        const tagName = e.target.tagName;
        const isTypingTarget = e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName);
        if (e.key === 'Escape') {
            e.preventDefault?.();
            this.hideControls(true);
            this.hideLocationInfo(true);
            return;
        }
        if (isTypingTarget || tagName === 'BUTTON') return;
        const panStep = e.shiftKey ? 240 : 80;
        switch(e.key) {
            case ' ':
                e.preventDefault();
                this.toggleControls(true);
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
            case 'ArrowLeft':
                e.preventDefault();
                this.offsetX += panStep;
                this.updateTransform();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.offsetX -= panStep;
                this.updateTransform();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.offsetY += panStep;
                this.updateTransform();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.offsetY -= panStep;
                this.updateTransform();
                break;
            case 'h':
            case 'H':
                if (e.ctrlKey || e.metaKey) return;
                this.toggleControls(true);
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
            this.updateWorldMapSource();
            this.worldMapElement.style.opacity = '1';
            this.worldMapElement.style.pointerEvents = 'auto';
            this.tileElements.forEach(tile => { tile.style.opacity = '0'; });
        } else {
            this.isWorldMapView = false;
            this.worldMapElement.style.opacity = '0';
            this.worldMapElement.style.pointerEvents = 'none';
            this.tileElements.forEach(tile => { if (tile.classList.contains('loaded')) tile.style.opacity = '1'; });
        }
    }

    getWorldMapStats() { return {}; }
    getWorldMapLoadingStatus() { return this.worldMapLoadingStates; }
    reloadFailedWorldMaps() { /* no-op: using single world map */ }

    debugWorldMapVisibility() {}
    updateWorldMapImage(imagePath) { this.config.worldMapPath = imagePath; this.worldMapElement.src = imagePath; }

    loadTile(row, col, retryCount = 0) {
        if (this.destroyed || this.isWorldMapView) return;
        const tileKey = `${row}-${col}`;
        if (!this.visibleTiles.has(tileKey) || this.activeTileLoads.has(tileKey)) return;
        const tile = this.getOrCreateTile(row, col);
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
        tile.classList.remove('error', 'unloaded', 'missing');
        tile.classList.add('loading');
        const img = new Image();
        img.decoding = 'async';
        const tilePath = this.getTilePath(row, col);
        const request = { img, timeoutId: null, row, col, retryCount };
        this.activeTileLoads.set(tileKey, request);

        const finish = () => {
            if (this.activeTileLoads.get(tileKey) !== request) return false;
            clearTimeout(request.timeoutId);
            img.onload = null;
            img.onerror = null;
            img.onabort = null;
            this.activeTileLoads.delete(tileKey);
            return true;
        };
        const fail = () => {
            if (!finish()) return;
            img.src = '';
            this.handleTileLoadError(row, col, retryCount);
            this.pumpTileQueue();
        };

        request.timeoutId = setTimeout(fail, 8000);
        img.onload = () => {
            if (!finish()) return;
            if (!this.destroyed && this.visibleTiles.has(tileKey) && !tile.classList.contains('unloaded')) {
                const imageUrl = `url("${img.src}")`;
                tile.style.backgroundImage = imageUrl;
                tile.classList.remove('loading', 'error');
                tile.classList.add('loaded');
                tile.style.opacity = '1';
                this.loadedTiles.set(tileKey, img.src);
                this.failedTiles.delete(tileKey);
            }
            this.pumpTileQueue();
        };
        img.onerror = fail;
        img.onabort = fail;
        img.src = tilePath;
    }

    handleTileLoadError(row, col, retryCount) {
        const tileKey = `${row}-${col}`;
        if (this.destroyed) return;
        const tile = this.getOrCreateTile(row, col);
        if (retryCount < this.maxRetries) {
            const retryDelay = retryCount === 0 ? 500 : Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
            tile.classList.remove('loading');
            tile.classList.add('error');
            const retryTimer = setTimeout(() => {
                this.retryTimers.delete(tileKey);
                if (this.visibleTiles.has(tileKey) && !this.loadedTiles.has(tileKey)) {
                    this.loadTilesWithPerformanceControl([{
                        row,
                        col,
                        retryCount: retryCount + 1,
                        priority: 'retry',
                        distance: 0,
                    }]);
                }
            }, retryDelay);
            this.retryTimers.set(tileKey, retryTimer);
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

    cancelTileRequest(tileKey) {
        const request = this.activeTileLoads.get(tileKey);
        if (!request) return;
        clearTimeout(request.timeoutId);
        request.img.onload = null;
        request.img.onerror = null;
        request.img.onabort = null;
        request.img.src = '';
        this.activeTileLoads.delete(tileKey);
        const tile = this.tileElements.get(tileKey);
        tile?.classList.remove('loading');
        this.pumpTileQueue();
    }

    cancelAllTileRequests() {
        this.tileQueue = [];
        this.queuedTiles.clear();
        Array.from(this.activeTileLoads.keys()).forEach((tileKey) => this.cancelTileRequest(tileKey));
        this.retryTimers.forEach((timeoutId) => clearTimeout(timeoutId));
        this.retryTimers.clear();
    }

    unloadTile(tileKey) {
        if (this.visibleTiles.has(tileKey)) return;
        this.cancelTileRequest(tileKey);
        const tile = this.tileElements.get(tileKey);
        if (!tile) { this.loadedTiles.delete(tileKey); return; }
        if (tile.classList.contains('unloaded')) return;
        tile.classList.add('unloaded');
        tile.style.opacity = '0';
        const removalTimer = setTimeout(() => {
            this.tileRemovalTimers.delete(removalTimer);
            if (tile.classList.contains('unloaded') && !this.visibleTiles.has(tileKey)) {
                tile.remove();
                this.tileElements.delete(tileKey);
            }
        }, 200);
        this.tileRemovalTimers.add(removalTimer);
        this.loadedTiles.delete(tileKey);
    }

    createPins() {
        this.pinLayer.innerHTML = '';
        this.pinElements.clear();
        this.locations.forEach(location => {
            const pin = document.createElement('button');
            pin.type = 'button';
            pin.className = `map-pin ${location.type}`;
            pin.style.left = location.x + 'px';
            pin.style.top = location.y + 'px';
            pin.dataset.locationId = location.id;
            pin.dataset.waypointName = location.name;
            pin.setAttribute('aria-label', location.name);
            pin.setAttribute('aria-controls', 'locationInfo');
            pin.setAttribute('aria-expanded', 'false');
            pin.title = location.name;
            pin.addEventListener('click', (e) => { e.stopPropagation(); this.showLocationInfo(location); });
            this.pinElements.set(String(location.id), pin);
            this.pinLayer.appendChild(pin);
        });
    }

    updatePinTabOrder() {
        this.locations.forEach((location) => {
            const pin = this.pinElements.get(String(location.id));
            if (!pin) return;
            const isInViewport = isMapPointInViewport({
                x: location.x,
                y: location.y,
                offsetX: this.offsetX,
                offsetY: this.offsetY,
                zoom: this.zoom,
                viewportWidth: this.viewportWidth,
                viewportHeight: this.viewportHeight,
                padding: 24,
            });
            const nextState = isInViewport ? 'true' : 'false';
            if (pin.dataset.inViewport === nextState) return;
            pin.dataset.inViewport = nextState;
            pin.tabIndex = isInViewport ? 0 : -1;
            pin.setAttribute('aria-hidden', isInViewport ? 'false' : 'true');
        });
    }

    updateTransform() {
        const constrained = constrainMapOffsets({
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            zoom: this.zoom,
            viewportWidth: this.viewportWidth,
            viewportHeight: this.viewportHeight,
            mapWidth: this.config.gridWidth * this.config.tileSize,
            mapHeight: this.config.gridHeight * this.config.tileSize,
        });
        this.offsetX = constrained.offsetX;
        this.offsetY = constrained.offsetY;
        const transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
        this.mapGrid.style.transform = transform;
        this.pinLayer.style.transform = transform;
        this.updatePinTabOrder();
        if (this.lastZoom === null || this.zoom !== this.lastZoom) {
            this.updateMapView();
            this.lastZoom = this.zoom;
        }
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
        const tilesToRetry = failedTileKeys.flatMap(tileKey => {
            const [row, col] = tileKey.split('-').map(Number);
            return this.visibleTiles.has(tileKey) ? [{ row, col, priority: 'retry', distance: 0 }] : [];
        });
        this.loadTilesWithPerformanceControl(tilesToRetry);
    }

    getTileLoadingStatus() {
        const status = {
            totalTiles: this.config.gridWidth * this.config.gridHeight,
            loadedTiles: this.loadedTiles.size,
            visibleTiles: this.visibleTiles.size,
            activeRequests: this.activeTileLoads.size,
            queuedRequests: this.tileQueue.length,
            failedTiles: this.failedTiles.size,
            pendingUnloads: this.pendingUnloads.size,
        };
        return status;
    }

    reloadVisibleTiles() {
        this.cancelAllTileRequests();
        this.loadedTiles.clear();
        this.failedTiles.clear();
        this.tileElements.forEach(tile => {
            tile.style.backgroundImage = '';
            tile.classList.remove('loaded', 'loading', 'error', 'unloaded', 'missing');
            tile.style.backgroundColor = '';
        });
        const tiles = Array.from(this.visibleTiles, (tileKey) => {
            const [row, col] = tileKey.split('-').map(Number);
            return { row, col, priority: 'normal', distance: 0 };
        });
        this.loadTilesWithPerformanceControl(tiles);
    }

    updateMapView() {
        const shouldShowWorldMap = this.zoom < this.config.worldMapThreshold;
        if (shouldShowWorldMap) {
            this.updateWorldMapSource();
            if (!this.isWorldMapView) {
                const rect = this.getCanvasRect();
                const viewCenterX = (rect.width / 2 - this.offsetX) / this.zoom;
                const viewCenterY = (rect.height / 2 - this.offsetY) / this.zoom;
                this.isWorldMapView = true;
                if (this.worldMapElement) {
                    this.worldMapElement.style.opacity = '1';
                    this.worldMapElement.style.pointerEvents = 'auto';
                }
                this.cancelAllTileRequests();
                const tilesToRelease = this.visibleTiles;
                this.visibleTiles = new Set();
                tilesToRelease.forEach((tileKey) => this.scheduleUnloadWithPerformanceControl(tileKey));
                this.offsetX = rect.width / 2 - (viewCenterX * this.zoom);
                this.offsetY = rect.height / 2 - (viewCenterY * this.zoom);
                const transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
                this.mapGrid.style.transform = transform;
                this.pinLayer.style.transform = transform;
                if (!this.tilesHidden) {
                    this.tileElements.forEach(tile => { tile.style.opacity = '0'; });
                    this.tilesHidden = true;
                }
            }
        } else if (this.isWorldMapView) {
            this.isWorldMapView = false;
            if (this.worldMapElement) {
                this.worldMapElement.style.opacity = '0';
                this.worldMapElement.style.pointerEvents = 'none';
            }
            if (this.tilesHidden) {
                this.tileElements.forEach(tile => { if (tile.classList.contains('loaded')) tile.style.opacity = '1'; });
                this.tilesHidden = false;
            }
            this.updateVisibleTiles();
        }
    }

    startDrag(e) {
        this.isDragging = true;
        this.mapCanvas.classList.add('dragging');
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        e.preventDefault?.();
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
        e.preventDefault?.();
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
        const rect = this.getCanvasRect();
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
            const rect = this.getCanvasRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const offsets = zoomAroundPoint({
                zoom: this.zoom,
                newZoom,
                offsetX: this.offsetX,
                offsetY: this.offsetY,
                pointX: mouseX,
                pointY: mouseY,
            });
            this.offsetX = offsets.offsetX;
            this.offsetY = offsets.offsetY;
            this.zoom = newZoom;
            this.updateTransform();
        }
    }

    zoomIn() { const zoomFactor = 1.2; const newZoom = Math.min(this.config.maxZoom, this.zoom * zoomFactor); this.zoomToLevel(newZoom); }
    zoomOut() { const zoomFactor = 1.2; const newZoom = Math.max(this.config.minZoom, this.zoom / zoomFactor); this.zoomToLevel(newZoom); }
    zoomToLevel(newZoom) {
        const rect = this.getCanvasRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const offsets = zoomAroundPoint({
            zoom: this.zoom,
            newZoom,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            pointX: centerX,
            pointY: centerY,
        });
        this.offsetX = offsets.offsetX;
        this.offsetY = offsets.offsetY;
        this.zoom = newZoom;
        this.updateTransform();
    }

    resetView() { this.zoom = this.config.initialZoom; this.clearPendingUnloads(); this.centerMap(); }
    centerMap() {
        const rect = this.getCanvasRect();
        const mapWidth = this.config.gridWidth * this.config.tileSize * this.zoom;
        const mapHeight = this.config.gridHeight * this.config.tileSize * this.zoom;
        this.offsetX = (rect.width - mapWidth) / 2;
        this.offsetY = (rect.height - mapHeight) / 2;
        this.updateTransform();
    }

    search() {
        const query = this.searchInput.value.toLowerCase().trim();
        const status = document.getElementById('searchStatus');
        if (!query) {
            if (status) status.textContent = 'Enter a location name or description.';
            return;
        }
        const location = this.locations.find(loc => loc.name.toLowerCase().includes(query) || loc.description.toLowerCase().includes(query));
        if (location) {
            if (status) status.textContent = `Showing ${location.name}.`;
            this.zoomToLevel(this.config.initialZoom);
            this.panToLocation(location);
            this.showLocationInfo(location);
        } else if (status) {
            status.textContent = `No locations match “${this.searchInput.value.trim()}”.`;
        }
    }

    panToLocation(location) {
        const rect = this.getCanvasRect();
        const targetX = location.x * this.zoom;
        const targetY = location.y * this.zoom;
        this.offsetX = rect.width / 2 - targetX;
        this.offsetY = rect.height / 2 - targetY;
        this.updateTransform();
    }

    showLocationInfo(location) {
        if (!this.locationInfo.classList.contains('hidden') && this.selectedLocationId !== location.id) {
            this.pinElements.get(String(this.selectedLocationId))?.setAttribute('aria-expanded', 'false');
            this.pinElements.get(String(this.selectedLocationId))?.classList.remove('selected');
        }
        if (this.locationInfo.classList.contains('hidden')) this.locationReturnFocus = document.activeElement;
        this.selectedLocationId = location.id;
        const selectedPin = this.pinElements.get(String(location.id));
        selectedPin?.setAttribute('aria-expanded', 'true');
        selectedPin?.classList.add('selected');
        const heading = document.getElementById('locationName');
        heading.textContent = location.name;
        document.getElementById('locationDescription').textContent = location.description;
        this.locationInfo.classList.remove('hidden');
        this.locationInfo.setAttribute('aria-hidden', 'false');
        this.scheduleFocus(heading);
    }

    hideLocationInfo(restoreFocus = false) {
        this.locationInfo.classList.add('hidden');
        this.locationInfo.setAttribute('aria-hidden', 'true');
        const selectedPin = this.pinElements.get(String(this.selectedLocationId));
        selectedPin?.setAttribute('aria-expanded', 'false');
        selectedPin?.classList.remove('selected');
        this.selectedLocationId = null;
        if (restoreFocus && this.locationReturnFocus?.isConnected) {
            const controlsPanel = document.getElementById('mapControls');
            const focusTarget = !this.controlsVisible && controlsPanel.contains(this.locationReturnFocus)
                ? document.getElementById('toggleControls')
                : this.locationReturnFocus;
            this.scheduleFocus(focusTarget);
        }
        this.locationReturnFocus = null;
    }

    handleResize() {
        if (this.resizeFrameId !== null) cancelAnimationFrame(this.resizeFrameId);
        this.resizeFrameId = requestAnimationFrame(() => {
            this.resizeFrameId = null;
            if (this.destroyed) return;
            this.getCanvasRect();
            this.updateTransform();
        });
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.createGrid();
        this.createPins();
        this.centerMap();
        this.updateDebugButtonState();
        this.hideControls();
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.eventCleanups.splice(0).forEach((cleanup) => cleanup());
        this.throttledUpdateTiles.cancel?.();
        this.cancelAllTileRequests();
        this.clearPendingUnloads();
        this.tileRemovalTimers.forEach((timeoutId) => clearTimeout(timeoutId));
        this.tileRemovalTimers.clear();
        this.stopMemoryMonitoring();
        if (this.performanceFrameId !== null) {
            cancelAnimationFrame(this.performanceFrameId);
            this.performanceFrameId = null;
        }
        if (this.resizeFrameId !== null) {
            cancelAnimationFrame(this.resizeFrameId);
            this.resizeFrameId = null;
        }
        if (this.focusFrameId !== null) {
            cancelAnimationFrame(this.focusFrameId);
            this.focusFrameId = null;
        }
        if (this.worldMapElement) {
            this.worldMapElement.onload = null;
            this.worldMapElement.onerror = null;
        }
        this.tileElements.clear();
        this.pinElements.clear();
        this.loadedTiles.clear();
        this.visibleTiles.clear();
        this.mapGrid?.replaceChildren();
        this.pinLayer?.replaceChildren();
    }
}
