document.addEventListener('DOMContentLoaded', () => {
    const upload1 = document.getElementById('upload1');
    const upload2 = document.getElementById('upload2');
    
    const vid1 = document.getElementById('vid1');
    const vid2 = document.getElementById('vid2');
    
    const canvas1 = document.getElementById('canvas1');
    const ctx1 = canvas1.getContext('2d');
    const canvas2 = document.getElementById('canvas2');
    const ctx2 = canvas2.getContext('2d');
    
    const slider1 = document.getElementById('slider1');
    const slider2 = document.getElementById('slider2');
    const masterSlider = document.getElementById('masterSlider');
    
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

    // ── Drawing overlay ───────────────────────────────────────────────────────
    const drawCanvas1  = document.getElementById('drawCanvas1');
    const drawCanvas2  = document.getElementById('drawCanvas2');
    const drawModeBtn  = document.getElementById('drawModeBtn');
    const strokeColor  = document.getElementById('strokeColor');
    const strokeWidth  = document.getElementById('strokeWidth');
    const clearDrawBtn = document.getElementById('clearDrawBtn');

    let drawMode    = false;
    let isDrawing   = false;
    let lastX = 0, lastY = 0;
    let activeDrawEl = null;

    function getDrawPos(canvas, e) {
        const rect = canvas.getBoundingClientRect();
        const src  = e.touches ? e.touches[0] : e;
        return {
            x: (src.clientX - rect.left) * (canvas.width  / rect.width),
            y: (src.clientY - rect.top)  * (canvas.height / rect.height)
        };
    }

    function setupDrawEvents(dc, vc) {
        function onStart(e) {
            if (!drawMode) return;
            e.preventDefault();
            if (dc.width !== vc.width || dc.height !== vc.height) {
                dc.width  = vc.width;
                dc.height = vc.height;
            }
            isDrawing    = true;
            activeDrawEl = dc;
            const p    = getDrawPos(dc, e);
            lastX = p.x;
            lastY = p.y;
            const dCtx = dc.getContext('2d');
            dCtx.beginPath();
            dCtx.arc(p.x, p.y, strokeWidth.value / 2, 0, Math.PI * 2);
            dCtx.fillStyle = strokeColor.value;
            dCtx.fill();
        }
        function onMove(e) {
            if (!isDrawing || activeDrawEl !== dc) return;
            e.preventDefault();
            const p    = getDrawPos(dc, e);
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
        }
        function onStop() { isDrawing = false; activeDrawEl = null; }

        dc.addEventListener('mousedown',  onStart);
        dc.addEventListener('mousemove',  onMove);
        dc.addEventListener('mouseup',    onStop);
        dc.addEventListener('mouseleave', onStop);
        dc.addEventListener('touchstart', onStart, { passive: false });
        dc.addEventListener('touchmove',  onMove,  { passive: false });
        dc.addEventListener('touchend',   onStop);
    }

    setupDrawEvents(drawCanvas1, canvas1);
    setupDrawEvents(drawCanvas2, canvas2);

    drawModeBtn.addEventListener('click', () => {
        drawMode = !drawMode;
        drawModeBtn.textContent = drawMode ? '✏️ Drawing' : '✏️ Draw';
        drawModeBtn.classList.toggle('active', drawMode);
        const pe = drawMode ? 'auto' : 'none';
        const cu = drawMode ? 'crosshair' : 'default';
        drawCanvas1.style.pointerEvents = pe;
        drawCanvas2.style.pointerEvents = pe;
        drawCanvas1.style.cursor = cu;
        drawCanvas2.style.cursor = cu;
    });

    clearDrawBtn.addEventListener('click', () => {
        drawCanvas1.getContext('2d').clearRect(0, 0, drawCanvas1.width, drawCanvas1.height);
        drawCanvas2.getContext('2d').clearRect(0, 0, drawCanvas2.width, drawCanvas2.height);
    });

    // --- THE CANVAS RENDERER ---
    function renderCanvasLoop() {
        if (vid1.readyState >= 2) {
            ctx1.drawImage(vid1, 0, 0, canvas1.width, canvas1.height);
        }
        if (vid2.readyState >= 2) {
            ctx2.drawImage(vid2, 0, 0, canvas2.width, canvas2.height);
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
    function handleUpload(event, videoElement, canvasElement, sliderElement, isVideo1) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type.startsWith('video/')) {
            const fileURL = URL.createObjectURL(file);
            videoElement.src = fileURL;
            
            videoElement.load();
            
            videoElement.onloadedmetadata = () => {
                canvasElement.width = videoElement.videoWidth || 600;
                canvasElement.height = videoElement.videoHeight || 800;
                const drawEl = isVideo1 ? drawCanvas1 : drawCanvas2;
                drawEl.width  = canvasElement.width;
                drawEl.height = canvasElement.height;
                
                sliderElement.max = videoElement.duration;
                sliderElement.disabled = false;
                
                if (isVideo1) {
                    masterSlider.max = videoElement.duration;
                    masterSlider.disabled = false;
                    resetBtn.disabled = false;
                    prevFrameBtn.disabled = false;
                    nextFrameBtn.disabled = false;
                    
                    // Enable Vid 1 specific buttons
                    prevFrameBtn1.disabled = false;
                    nextFrameBtn1.disabled = false;
                } else {
                    // Enable Vid 2 specific buttons
                    prevFrameBtn2.disabled = false;
                    nextFrameBtn2.disabled = false;
                }

                videoElement.pause();
                videoElement.currentTime = 0.01;
            };
        }
    }

    upload1.addEventListener('change', (e) => handleUpload(e, vid1, canvas1, slider1, true));
    upload2.addEventListener('change', (e) => handleUpload(e, vid2, canvas2, slider2, false));

    // --- RESET FUNCTIONALITY ---
    // Resets the timer to zero from the current position; video frames are preserved
    resetBtn.addEventListener('click', () => {
        timerOffset = vid1.currentTime;
        updateTimer(0);
    });

    // --- INDIVIDUAL SCRUBBING (SLIDERS) ---
    slider1.addEventListener('input', (e) => {
        const newTime = parseFloat(e.target.value);
        vid1.currentTime = newTime;
        masterSlider.value = newTime;
        syncOffset = vid2.currentTime - vid1.currentTime;
        updateTimer(newTime - timerOffset);
    });

    slider2.addEventListener('input', (e) => {
        const newTime = parseFloat(e.target.value);
        vid2.currentTime = newTime;
        syncOffset = vid2.currentTime - vid1.currentTime;
    });

    // --- INDIVIDUAL SCRUBBING (BUTTONS) ---
    function stepVid1(directionAmount) {
        let newTime = vid1.currentTime + directionAmount;
        if (newTime < 0) newTime = 0;
        if (newTime > vid1.duration) newTime = vid1.duration;
        
        vid1.currentTime = newTime;
        slider1.value = newTime;
        masterSlider.value = newTime;
        syncOffset = vid2.currentTime - vid1.currentTime;
        updateTimer(newTime - timerOffset);
    }

    function stepVid2(directionAmount) {
        let newTime = vid2.currentTime + directionAmount;
        if (newTime < 0) newTime = 0;
        if (newTime > vid2.duration) newTime = vid2.duration;
        
        vid2.currentTime = newTime;
        slider2.value = newTime;
        syncOffset = vid2.currentTime - vid1.currentTime;
    }

    prevFrameBtn1.addEventListener('click', () => stepVid1(-frameTime));
    nextFrameBtn1.addEventListener('click', () => stepVid1(frameTime));
    
    prevFrameBtn2.addEventListener('click', () => stepVid2(-frameTime));
    nextFrameBtn2.addEventListener('click', () => stepVid2(frameTime));

    // --- MASTER SCRUBBING ---
    function applyMasterTime(masterTime) {
        vid1.currentTime = masterTime;
        slider1.value = masterTime;
        masterSlider.value = masterTime;
        
        const vid2TargetTime = masterTime + syncOffset;
        
        if (vid2TargetTime >= 0 && vid2TargetTime <= vid2.duration) {
            vid2.currentTime = vid2TargetTime;
            slider2.value = vid2TargetTime;
        }

        updateTimer(masterTime - timerOffset);
    }

    masterSlider.addEventListener('input', (e) => {
        applyMasterTime(parseFloat(e.target.value));
    });

    function stepMasterFrame(directionAmount) {
        let currentMasterTime = parseFloat(masterSlider.value);
        let newTime = currentMasterTime + directionAmount;
        
        if (newTime < 0) newTime = 0;
        if (newTime > masterSlider.max) newTime = masterSlider.max;
        
        applyMasterTime(newTime);
    }

    prevFrameBtn.addEventListener('click', () => stepMasterFrame(-frameTime));
    nextFrameBtn.addEventListener('click', () => stepMasterFrame(frameTime));
});
