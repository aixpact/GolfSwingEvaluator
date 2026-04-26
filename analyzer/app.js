document.addEventListener('DOMContentLoaded', () => {

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const upload1 = document.getElementById('upload1');
    const upload2 = document.getElementById('upload2');

    const vid1 = document.getElementById('vid1');
    const vid2 = document.getElementById('vid2');

    const canvas1 = document.getElementById('canvas1');
    const ctx1    = canvas1.getContext('2d');
    const canvas2 = document.getElementById('canvas2');
    const ctx2    = canvas2.getContext('2d');

    const slider1      = document.getElementById('slider1');
    const slider2      = document.getElementById('slider2');
    const masterSlider = document.getElementById('masterSlider');

    const prevFrameBtn1 = document.getElementById('prevFrameBtn1');
    const nextFrameBtn1 = document.getElementById('nextFrameBtn1');
    const prevFrameBtn2 = document.getElementById('prevFrameBtn2');
    const nextFrameBtn2 = document.getElementById('nextFrameBtn2');

    const timerDisplay = document.getElementById('timer');
    const resetBtn     = document.getElementById('resetBtn');
    const prevFrameBtn = document.getElementById('prevFrameBtn');
    const nextFrameBtn = document.getElementById('nextFrameBtn');

    const analyseBtn     = document.getElementById('analyseBtn');
    const progressPanel  = document.getElementById('progressPanel');
    const progressStep   = document.getElementById('progressStep');
    const progressFill   = document.getElementById('progressFill');
    const feedbackPanel  = document.getElementById('feedbackPanel');
    const feedbackText   = document.getElementById('feedbackText');
    const apiDot         = document.getElementById('apiDot');
    const apiLabel       = document.getElementById('apiLabel');
    const keyToggleBtn   = document.getElementById('keyToggleBtn');
    const keyPanel       = document.getElementById('keyPanel');
    const apiKeyInput    = document.getElementById('apiKeyInput');
    const saveKeyBtn     = document.getElementById('saveKeyBtn');

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

    // ── State ─────────────────────────────────────────────────────────────────
    let syncOffset  = 0;
    let timerOffset = 0;
    const frameTime = 0.033;

    let video1Loaded = false;
    let video2Loaded = false;

    // Stored timelines from the last analysis scan
    let timeline1 = null;
    let timeline2 = null;

    // ── API key UI ────────────────────────────────────────────────────────────
    function refreshKeyStatus() {
        const hasKey = window.Coaching.hasApiKey();
        apiDot.className   = 'status-dot ' + (hasKey ? 'ready' : 'error');
        apiLabel.textContent  = hasKey ? 'Claude AI ready' : 'No API key';
        keyToggleBtn.textContent = hasKey ? 'Change key' : 'Set key';
    }

    refreshKeyStatus();

    keyToggleBtn.addEventListener('click', () => {
        const isVisible = keyPanel.style.display !== 'none';
        keyPanel.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) {
            // Pre-fill with masked placeholder if key already exists
            apiKeyInput.value = '';
            apiKeyInput.placeholder = window.Coaching.hasApiKey()
                ? 'Enter new key to replace…'
                : 'sk-ant-api03-…';
            apiKeyInput.focus();
        }
    });

    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (!key) return;
        window.Coaching.saveApiKey(key);
        apiKeyInput.value = '';
        keyPanel.style.display = 'none';
        refreshKeyStatus();
    });

    // Save on Enter
    apiKeyInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveKeyBtn.click();
    });

    // ── MoveNet initialisation ────────────────────────────────────────────────
    window.PoseAnalyzer.init().catch(() => {
        // Pose init failure is non-fatal; skeleton overlay will be skipped silently
    });

    // ── Canvas render loop ────────────────────────────────────────────────────
    // Draws video frames continuously. Skeleton is overlaid from cached poses
    // updated by a separate polling interval (see below) so this loop stays sync.
    function renderCanvasLoop() {
        if (vid1.readyState >= 2) {
            ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
            ctx1.save();
            ctx1.translate(t1.x, t1.y);
            ctx1.scale(t1.scale, t1.scale);
            ctx1.drawImage(vid1, 0, 0, canvas1.width, canvas1.height);
            const pose1 = window.PoseAnalyzer.getLastPose(0);
            if (pose1) window.PoseAnalyzer.drawSkeleton(ctx1, pose1);
            ctx1.restore();
        }
        if (vid2.readyState >= 2) {
            ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
            ctx2.save();
            ctx2.translate(t2.x, t2.y);
            ctx2.scale(t2.scale, t2.scale);
            ctx2.drawImage(vid2, 0, 0, canvas2.width, canvas2.height);
            const pose2 = window.PoseAnalyzer.getLastPose(1);
            if (pose2) window.PoseAnalyzer.drawSkeleton(ctx2, pose2);
            ctx2.restore();
        }
        requestAnimationFrame(renderCanvasLoop);
    }
    requestAnimationFrame(renderCanvasLoop);

    // Pose polling: runs inference every 80 ms and caches results.
    // Kept separate from rAF so the render loop stays synchronous.
    setInterval(async () => {
        if (vid1.readyState >= 2) {
            const p = await window.PoseAnalyzer.detect(vid1);
            if (p) window.PoseAnalyzer.setLastPose(0, p);
        }
        if (vid2.readyState >= 2) {
            const p = await window.PoseAnalyzer.detect(vid2);
            if (p) window.PoseAnalyzer.setLastPose(1, p);
        }
    }, 80);

    // ── Timer ─────────────────────────────────────────────────────────────────
    function updateTimer(t) {
        if (isNaN(t)) return;
        const m  = Math.floor(t / 60).toString().padStart(2, '0');
        const s  = Math.floor(t % 60).toString().padStart(2, '0');
        const ms = Math.floor((t % 1) * 100).toString().padStart(2, '0');
        timerDisplay.innerText = `${m}:${s}.${ms}`;
    }

    // ── Upload handling ───────────────────────────────────────────────────────
    function handleUpload(event, videoEl, canvasEl, sliderEl, isVideo1) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('video/')) return;

        videoEl.src = URL.createObjectURL(file);
        videoEl.load();

        videoEl.onloadedmetadata = () => {
            canvasEl.width  = videoEl.videoWidth  || 600;
            canvasEl.height = videoEl.videoHeight || 800;
            const drawEl = isVideo1 ? drawCanvas1 : drawCanvas2;
            drawEl.width  = canvasEl.width;
            drawEl.height = canvasEl.height;

            sliderEl.max      = videoEl.duration;
            sliderEl.disabled = false;

            if (isVideo1) {
                masterSlider.max      = videoEl.duration;
                masterSlider.disabled = false;
                resetBtn.disabled     = false;
                prevFrameBtn.disabled = false;
                nextFrameBtn.disabled = false;
                prevFrameBtn1.disabled = false;
                nextFrameBtn1.disabled = false;
                video1Loaded = true;
            } else {
                prevFrameBtn2.disabled = false;
                nextFrameBtn2.disabled = false;
                video2Loaded = true;
            }

            videoEl.pause();
            videoEl.currentTime = 0.01;

            // Enable Analyse button once both videos are loaded
            if (video1Loaded && video2Loaded) {
                analyseBtn.disabled = false;
            }
        };
    }

    upload1.addEventListener('change', e => handleUpload(e, vid1, canvas1, slider1, true));
    upload2.addEventListener('change', e => handleUpload(e, vid2, canvas2, slider2, false));

    // ── Reset ─────────────────────────────────────────────────────────────────
    resetBtn.addEventListener('click', () => {
        timerOffset = vid1.currentTime;
        updateTimer(0);
    });

    // ── Per-video scrubbing ───────────────────────────────────────────────────
    slider1.addEventListener('input', e => {
        const t = parseFloat(e.target.value);
        vid1.currentTime = t;
        masterSlider.value = t;
        syncOffset = vid2.currentTime - vid1.currentTime;
        updateTimer(t - timerOffset);
    });

    slider2.addEventListener('input', e => {
        const t = parseFloat(e.target.value);
        vid2.currentTime = t;
        syncOffset = vid2.currentTime - vid1.currentTime;
    });

    function stepVid1(delta) {
        const t = Math.max(0, Math.min(vid1.currentTime + delta, vid1.duration));
        vid1.currentTime = t;
        slider1.value = t;
        masterSlider.value = t;
        syncOffset = vid2.currentTime - vid1.currentTime;
        updateTimer(t - timerOffset);
    }

    function stepVid2(delta) {
        const t = Math.max(0, Math.min(vid2.currentTime + delta, vid2.duration));
        vid2.currentTime = t;
        slider2.value = t;
        syncOffset = vid2.currentTime - vid1.currentTime;
    }

    prevFrameBtn1.addEventListener('click', () => stepVid1(-frameTime));
    nextFrameBtn1.addEventListener('click', () => stepVid1(frameTime));
    prevFrameBtn2.addEventListener('click', () => stepVid2(-frameTime));
    nextFrameBtn2.addEventListener('click', () => stepVid2(frameTime));

    // ── Master scrubbing ──────────────────────────────────────────────────────
    function applyMasterTime(t) {
        vid1.currentTime   = t;
        slider1.value      = t;
        masterSlider.value = t;

        const t2 = t + syncOffset;
        if (t2 >= 0 && t2 <= vid2.duration) {
            vid2.currentTime = t2;
            slider2.value    = t2;
        }
        updateTimer(t - timerOffset);
    }

    masterSlider.addEventListener('input', e => applyMasterTime(parseFloat(e.target.value)));

    function stepMaster(delta) {
        const t = Math.max(0, Math.min(parseFloat(masterSlider.value) + delta, masterSlider.max));
        applyMasterTime(t);
    }

    prevFrameBtn.addEventListener('click', () => stepMaster(-frameTime));
    nextFrameBtn.addEventListener('click', () => stepMaster(frameTime));

    // ── Progress helpers ──────────────────────────────────────────────────────
    function showProgress(stepText, pct) {
        progressPanel.style.display = 'block';
        progressStep.textContent    = stepText;
        progressFill.style.width    = `${Math.round(pct)}%`;
    }

    function hideProgress() {
        progressPanel.style.display = 'none';
        progressFill.style.width    = '0%';
    }

    function showFeedback(html) {
        feedbackPanel.style.display = 'block';
        feedbackText.innerHTML      = html;
    }

    // ── Analyse pipeline ──────────────────────────────────────────────────────
    analyseBtn.addEventListener('click', async () => {
        analyseBtn.disabled = true;
        feedbackPanel.style.display = 'none';
        timeline1 = null;
        timeline2 = null;

        try {
            // Step 1 — scan Video 1
            showProgress('Finding impact in Video 1…', 0);
            timeline1 = await window.AutoSync.scanVideo(
                vid1, canvas1, ctx1, 0,
                (done, total) => showProgress(
                    `Scanning Video 1… (${done}/${total} frames)`,
                    (done / total) * 45
                )
            );

            // Step 2 — scan Video 2
            showProgress('Finding impact in Video 2…', 45);
            timeline2 = await window.AutoSync.scanVideo(
                vid2, canvas2, ctx2, 1,
                (done, total) => showProgress(
                    `Scanning Video 2… (${done}/${total} frames)`,
                    45 + (done / total) * 45
                )
            );

            // Step 3 — align at impact
            showProgress('Aligning swings at impact…', 90);
            const impact1 = window.AutoSync.findImpactTime(timeline1);
            const impact2 = window.AutoSync.findImpactTime(timeline2);
            syncOffset = impact2 - impact1;
            applyMasterTime(impact1);

            // Step 4 — coaching (only if API key is set)
            if (window.Coaching.hasApiKey()) {
                showProgress('Generating coaching feedback…', 95);
                const feedback = await window.Coaching.analyze(timeline1, timeline2);
                showFeedback(feedback.replace(/\n/g, '<br>'));
            } else {
                showFeedback(
                    '<span class="feedback-error">Swings aligned at impact. ' +
                    'To get AI coaching feedback, enter your Anthropic API key ' +
                    'using the <strong>Set key</strong> button above, then tap Re-Analyse.</span>'
                );
            }

        } catch (err) {
            showFeedback(`<span class="feedback-error">Analysis failed: ${err.message}</span>`);
        } finally {
            hideProgress();
            analyseBtn.disabled = false;
            analyseBtn.textContent = 'Re-Analyse';
        }
    });

    // ── AppState export (for external module access if needed) ────────────────
    window.AppState = {
        get syncOffset()  { return syncOffset; },
        set syncOffset(v) { syncOffset = v; },
        applyMasterTime
    };
});
