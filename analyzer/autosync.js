// autosync.js — impact frame detection via wrist velocity
// Exposes window.AutoSync

(function () {
    const SCAN_STEP = 0.1; // seconds between sampled frames

    // Seek videoEl to time t and wait for the seek to settle.
    function seekTo(videoEl, t) {
        return new Promise(resolve => {
            const onSeeked = () => { videoEl.removeEventListener('seeked', onSeeked); resolve(); };
            videoEl.addEventListener('seeked', onSeeked);
            videoEl.currentTime = t;
        });
    }

    // Scan an entire video, running pose detection at each sample frame.
    // onProgress(doneFrames, totalFrames) is called after each frame.
    // Returns a timeline array: [{time, keypoints}]
    async function scanVideo(videoEl, canvasEl, ctx, videoIndex, onProgress) {
        const duration = videoEl.duration;
        if (!isFinite(duration) || duration <= 0) return [];

        const totalFrames = Math.ceil(duration / SCAN_STEP);
        const timeline = [];

        for (let i = 0; i <= totalFrames; i++) {
            const t = Math.min(i * SCAN_STEP, duration);
            await seekTo(videoEl, t);

            // Guard: frame must be decodable
            if (videoEl.readyState >= 2) {
                ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
                const pose = await window.PoseAnalyzer.detect(videoEl);
                if (pose) {
                    window.PoseAnalyzer.setLastPose(videoIndex, pose);
                    timeline.push({ time: t, keypoints: pose.keypoints });
                }
            }

            if (onProgress) onProgress(i + 1, totalFrames + 1);
        }

        return timeline;
    }

    // Returns the timestamp of the estimated impact frame.
    // Impact = frame with peak combined downward wrist velocity (Y increases downward).
    function findImpactTime(timeline) {
        if (timeline.length < 3) return timeline[0]?.time ?? 0;

        const WRIST_L = 9, WRIST_R = 10;
        const CONF = 0.3;

        // Compute per-frame wrist velocity (raw)
        const velocities = [];
        for (let i = 1; i < timeline.length; i++) {
            const prev = timeline[i - 1];
            const curr = timeline[i];
            const dt = curr.time - prev.time;
            if (dt === 0) { velocities.push(0); continue; }

            let vel = 0, count = 0;
            const lw = curr.keypoints[WRIST_L], plw = prev.keypoints[WRIST_L];
            const rw = curr.keypoints[WRIST_R], prw = prev.keypoints[WRIST_R];

            if (lw.score > CONF && plw.score > CONF) { vel += (lw.y - plw.y) / dt; count++; }
            if (rw.score > CONF && prw.score > CONF) { vel += (rw.y - prw.y) / dt; count++; }

            velocities.push(count > 0 ? vel / count : 0);
        }

        // 3-frame rolling mean to suppress single-frame noise
        const smoothed = velocities.map((_, i) => {
            const slice = velocities.slice(Math.max(0, i - 1), i + 2);
            return slice.reduce((a, b) => a + b, 0) / slice.length;
        });

        // Peak downward velocity = impact
        const peakIdx = smoothed.indexOf(Math.max(...smoothed));
        return timeline[Math.min(peakIdx + 1, timeline.length - 1)].time;
    }

    window.AutoSync = { scanVideo, findImpactTime };
})();
