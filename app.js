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
    const frameTime = 0.033; // Approx 1 frame at 30fps

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
    resetBtn.addEventListener('click', () => {
        // fje only reset the time
        // vid1.currentTime = 0.01;
        // vid2.currentTime = 0.01;
        // slider1.value = 0;
        // slider2.value = 0;
        // masterSlider.value = 0;
        // syncOffset = 0; 
        updateTimer(0);
    });

    // --- INDIVIDUAL SCRUBBING (SLIDERS) ---
    slider1.addEventListener('input', (e) => {
        const newTime = parseFloat(e.target.value);
        vid1.currentTime = newTime;
        masterSlider.value = newTime; 
        syncOffset = vid2.currentTime - vid1.currentTime;
        updateTimer(newTime);
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
        updateTimer(newTime);
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

        updateTimer(masterTime);
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
