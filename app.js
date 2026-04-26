document.addEventListener('DOMContentLoaded', () => {
    const upload1 = document.getElementById('upload1');
    const upload2 = document.getElementById('upload2');
    
    const vid1 = document.getElementById('vid1');
    const vid2 = document.getElementById('vid2');
    
    const canvas1 = document.getElementById('canvas1');
    const ctx1 = canvas1.getContext('2d');
    const canvas2 = document.getElementById('canvas2');
    const ctx2 = canvas2.getContext('2d');
    
    const jogWheel1      = document.getElementById('jogWheel1');
    const jogWheel2      = document.getElementById('jogWheel2');
    const masterJogWheel = document.getElementById('masterJogWheel');
    let masterDuration = 0;

    // Individual Frame Buttons
    const prevFrameBtn1 = document.getElementById('prevFrameBtn1');
    const nextFrameBtn1 = document.getElementById('nextFrameBtn1');
    const prevFrameBtn2 = document.getElementById('prevFrameBtn2');
    const nextFrameBtn2 = document.getElementById('nextFrameBtn2');

    // Master Controls
    const timerDisplay = document.getElementById('timer');
    const resetBtn = document.getElementById('resetBtn');
    const prevFrameBtn = document.getElementById('prevFrameBtn');
    const nextFrameBtn = document.getElementById('nextFrameBtn');

    let syncOffset = 0;
    let timerOffset = 0;
    const frameTime = 0.033; // Approx 1 frame at 30fps

    // ── Drawing + zoom/pan overlay ────────────────────────────────────────────
    const drawCanvas1  = document.getElementById('drawCanvas1');
    const drawCanvas2  = document.getElementById('drawCanvas2');
    const drawModeBtn  = document.getElementById('drawModeBtn');
    const strokeColor  = document.getElementById('strokeColor');
    const strokeWidth  = document.getElementById('strokeWidth');
    const clearDrawBtn = document.getElementById('clearDrawBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');

    let drawMode = false;

    // Per-video zoom/pan transform (canvas-pixel units)
    const t1 = { scale: 1, x: 0, y: 0 };
    const t2 = { scale: 1, x: 0, y: 0 };

    const MIN_SCALE = 0.5;
    const MAX_SCALE = 8;

    function setupInteraction(dc, vc, transform) {
        let isDrawing = false;
        let isPanning = false;
        let pinching  = false;
        let lastX = 0, lastY = 0;
        let panStart  = { x: 0, y: 0, tx: 0, ty: 0 };
        let pinchData = { dist: 1, scale: 1, mx: 0, my: 0 };

        function canvasPos(e) {
            const rect = dc.getBoundingClientRect();
            const src  = e.touches ? e.touches[0] : e;
            return {
                x: (src.clientX - rect.left) * (dc.width  / rect.width),
                y: (src.clientY - rect.top)  * (dc.height / rect.height)
            };
        }

        function applyZoom(mx, my, newScale) {
            newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
            const ratio = newScale / transform.scale;
            transform.x = mx + (transform.x - mx) * ratio;
            transform.y = my + (transform.y - my) * ratio;
            transform.scale = newScale;
        }

        // Wheel → zoom toward cursor (always active)
        dc.addEventListener('wheel', (e) => {
            e.preventDefault();
            const p = canvasPos(e);
            applyZoom(p.x, p.y, transform.scale * (e.deltaY < 0 ? 1.1 : 0.9));
        }, { passive: false });

        // Double-click → reset this video's view
        dc.addEventListener('dblclick', () => {
            transform.scale = 1;
            transform.x = 0;
            transform.y = 0;
        });

        function onStart(e) {
            // Two-finger pinch start
            if (e.touches && e.touches.length >= 2) {
                e.preventDefault();
                pinching  = true;
                isDrawing = false;
                isPanning = false;
                pinchData.dist  = Math.hypot(
                    e.touches[1].clientX - e.touches[0].clientX,
                    e.touches[1].clientY - e.touches[0].clientY
                );
                pinchData.scale = transform.scale;
                const rect = dc.getBoundingClientRect();
                pinchData.mx = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * (dc.width  / rect.width);
                pinchData.my = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top)  * (dc.height / rect.height);
                return;
            }

            e.preventDefault();
            const p = canvasPos(e);

            if (drawMode) {
                if (dc.width !== vc.width || dc.height !== vc.height) {
                    dc.width  = vc.width;
                    dc.height = vc.height;
                }
                isDrawing = true;
                lastX = p.x;
                lastY = p.y;
                const dCtx = dc.getContext('2d');
                dCtx.beginPath();
                dCtx.arc(p.x, p.y, parseFloat(strokeWidth.value) / 2, 0, Math.PI * 2);
                dCtx.fillStyle = strokeColor.value;
                dCtx.fill();
            } else {
                isPanning = true;
                const src = e.touches ? e.touches[0] : e;
                panStart  = { x: src.clientX, y: src.clientY, tx: transform.x, ty: transform.y };
                dc.style.cursor = 'grabbing';
            }
        }

        function onMove(e) {
            // Pinch zoom
            if (pinching && e.touches && e.touches.length >= 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[1].clientX - e.touches[0].clientX,
                    e.touches[1].clientY - e.touches[0].clientY
                );
                applyZoom(pinchData.mx, pinchData.my, pinchData.scale * (dist / pinchData.dist));
                return;
            }

            if (isDrawing) {
                e.preventDefault();
                const p    = canvasPos(e);
                const dCtx = dc.getContext('2d');
                dCtx.beginPath();
                dCtx.moveTo(lastX, lastY);
                dCtx.lineTo(p.x, p.y);
                dCtx.strokeStyle = strokeColor.value;
                dCtx.lineWidth   = parseFloat(strokeWidth.value);
                dCtx.lineCap     = 'round';
                dCtx.lineJoin    = 'round';
                dCtx.stroke();
                lastX = p.x;
                lastY = p.y;
            } else if (isPanning) {
                e.preventDefault();
                const src  = e.touches ? e.touches[0] : e;
                const rect = dc.getBoundingClientRect();
                transform.x = panStart.tx + (src.clientX - panStart.x) * (dc.width  / rect.width);
                transform.y = panStart.ty + (src.clientY - panStart.y) * (dc.height / rect.height);
            }
        }

        function onStop() {
            isDrawing = false;
            isPanning = false;
            pinching  = false;
            dc.style.cursor = drawMode ? 'crosshair' : 'grab';
        }

        dc.addEventListener('mousedown',  onStart);
        dc.addEventListener('mousemove',  onMove);
        dc.addEventListener('mouseup',    onStop);
        dc.addEventListener('mouseleave', onStop);
        dc.addEventListener('touchstart', onStart, { passive: false });
        dc.addEventListener('touchmove',  onMove,  { passive: false });
        dc.addEventListener('touchend',   onStop);
    }

    setupInteraction(drawCanvas1, canvas1, t1);
    setupInteraction(drawCanvas2, canvas2, t2);

    drawModeBtn.addEventListener('click', () => {
        drawMode = !drawMode;
        drawModeBtn.textContent = drawMode ? '✏️ Drawing' : '✏️ Draw';
        drawModeBtn.classList.toggle('active', drawMode);
        const cu = drawMode ? 'crosshair' : 'grab';
        drawCanvas1.style.cursor = cu;
        drawCanvas2.style.cursor = cu;
    });

    clearDrawBtn.addEventListener('click', () => {
        drawCanvas1.getContext('2d').clearRect(0, 0, drawCanvas1.width, drawCanvas1.height);
        drawCanvas2.getContext('2d').clearRect(0, 0, drawCanvas2.width, drawCanvas2.height);
    });

    resetViewBtn.addEventListener('click', () => {
        t1.scale = 1; t1.x = 0; t1.y = 0;
        t2.scale = 1; t2.x = 0; t2.y = 0;
    });

    // ── Jog wheel ────────────────────────────────────────────────────────────
    function enableWheel(wheelEl) {
        wheelEl.classList.add('enabled');
    }

    function setupJogWheel(wheelEl, onStep) {
        let dragging = false;
        let lastClientX = 0;
        let angle = 0;
        let accumulator = 0;
        const sensitivity = frameTime / 5; // 5 px drag = 1 frame at 30 fps

        function clientX(e) {
            return e.touches ? e.touches[0].clientX : e.clientX;
        }

        function onStart(e) {
            if (!wheelEl.classList.contains('enabled')) return;
            e.preventDefault();
            dragging = true;
            lastClientX = clientX(e);
            accumulator = 0;
        }

        function onMove(e) {
            if (!dragging) return;
            e.preventDefault();
            const cx = clientX(e);
            const dx = cx - lastClientX;
            lastClientX = cx;

            angle += dx * 3; // 3 deg per pixel — visual feedback
            wheelEl.style.transform = `rotate(${angle}deg)`;

            accumulator += dx * sensitivity;
            if (Math.abs(accumulator) >= frameTime) {
                const frames = Math.trunc(accumulator / frameTime);
                accumulator -= frames * frameTime;
                onStep(frames * frameTime);
            }
        }

        function onStop() { dragging = false; }

        wheelEl.addEventListener('mousedown',  onStart);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onStop);
        wheelEl.addEventListener('touchstart', onStart, { passive: false });
        wheelEl.addEventListener('touchmove',  onMove,  { passive: false });
        wheelEl.addEventListener('touchend',   onStop);
    }

    // --- THE CANVAS RENDERER ---
    function renderCanvasLoop() {
        if (vid1.readyState >= 2) {
            ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
            ctx1.save();
            ctx1.translate(t1.x, t1.y);
            ctx1.scale(t1.scale, t1.scale);
            ctx1.drawImage(vid1, 0, 0, canvas1.width, canvas1.height);
            ctx1.restore();
        }
        if (vid2.readyState >= 2) {
            ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
            ctx2.save();
            ctx2.translate(t2.x, t2.y);
            ctx2.scale(t2.scale, t2.scale);
            ctx2.drawImage(vid2, 0, 0, canvas2.width, canvas2.height);
            ctx2.restore();
        }
        requestAnimationFrame(renderCanvasLoop);
    }
    
    requestAnimationFrame(renderCanvasLoop);

    function updateTimer(timeInSeconds) {
        if (isNaN(timeInSeconds)) return;
        const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
        const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
        const milliseconds = Math.floor((timeInSeconds % 1) * 100).toString().padStart(2, '0');
        timerDisplay.innerText = `${minutes}:${seconds}.${milliseconds}`;
    }

    // Handle Upload & Metadata
    function handleUpload(event, videoElement, canvasElement, isVideo1) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('video/')) return;

        videoElement.src = URL.createObjectURL(file);
        videoElement.load();

        videoElement.onloadedmetadata = () => {
            canvasElement.width  = videoElement.videoWidth  || 600;
            canvasElement.height = videoElement.videoHeight || 800;
            const drawEl = isVideo1 ? drawCanvas1 : drawCanvas2;
            drawEl.width  = canvasElement.width;
            drawEl.height = canvasElement.height;

            if (isVideo1) {
                masterDuration = videoElement.duration;
                resetBtn.disabled     = false;
                prevFrameBtn.disabled = false;
                nextFrameBtn.disabled = false;
                prevFrameBtn1.disabled = false;
                nextFrameBtn1.disabled = false;
                enableWheel(jogWheel1);
                enableWheel(masterJogWheel);
            } else {
                prevFrameBtn2.disabled = false;
                nextFrameBtn2.disabled = false;
                enableWheel(jogWheel2);
            }

            videoElement.pause();
            videoElement.currentTime = 0.01;
        };
    }

    upload1.addEventListener('change', (e) => handleUpload(e, vid1, canvas1, true));
    upload2.addEventListener('change', (e) => handleUpload(e, vid2, canvas2, false));

    // --- RESET FUNCTIONALITY ---
    resetBtn.addEventListener('click', () => {
        timerOffset = vid1.currentTime;
        updateTimer(0);
    });

    // --- INDIVIDUAL SCRUBBING ---
    function stepVid1(delta) {
        const t = Math.max(0, Math.min(vid1.currentTime + delta, vid1.duration || 0));
        vid1.currentTime = t;
        syncOffset = vid2.currentTime - vid1.currentTime;
        updateTimer(t - timerOffset);
    }

    function stepVid2(delta) {
        const t = Math.max(0, Math.min(vid2.currentTime + delta, vid2.duration || 0));
        vid2.currentTime = t;
        syncOffset = vid2.currentTime - vid1.currentTime;
    }

    prevFrameBtn1.addEventListener('click', () => stepVid1(-frameTime));
    nextFrameBtn1.addEventListener('click', () => stepVid1(frameTime));
    prevFrameBtn2.addEventListener('click', () => stepVid2(-frameTime));
    nextFrameBtn2.addEventListener('click', () => stepVid2(frameTime));

    setupJogWheel(jogWheel1, (delta) => stepVid1(delta));
    setupJogWheel(jogWheel2, (delta) => stepVid2(delta));

    // --- MASTER SCRUBBING ---
    function applyMasterTime(masterTime) {
        vid1.currentTime = masterTime;
        const t2 = masterTime + syncOffset;
        if (t2 >= 0 && t2 <= (vid2.duration || 0)) vid2.currentTime = t2;
        updateTimer(masterTime - timerOffset);
    }

    function stepMasterFrame(delta) {
        const t = Math.max(0, Math.min(vid1.currentTime + delta, masterDuration));
        applyMasterTime(t);
    }

    prevFrameBtn.addEventListener('click', () => stepMasterFrame(-frameTime));
    nextFrameBtn.addEventListener('click', () => stepMasterFrame(frameTime));

    setupJogWheel(masterJogWheel, (delta) => stepMasterFrame(delta));
});
