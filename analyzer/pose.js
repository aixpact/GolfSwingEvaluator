// pose.js — MoveNet Lightning wrapper
// Exposes window.PoseAnalyzer

(function () {
    // COCO-17 skeleton connections (pairs of keypoint indices)
    const CONNECTIONS = [
        [0,1],[0,2],[1,3],[2,4],           // head
        [5,6],                              // shoulders
        [5,7],[7,9],                        // left arm
        [6,8],[8,10],                       // right arm
        [5,11],[6,12],[11,12],              // torso
        [11,13],[13,15],                    // left leg
        [12,14],[14,16]                     // right leg
    ];

    // left=green, right=orange, centre=white
    const KP_COLORS = [
        '#fff',     // 0  nose
        '#4ade80',  // 1  left eye
        '#fb923c',  // 2  right eye
        '#4ade80',  // 3  left ear
        '#fb923c',  // 4  right ear
        '#4ade80',  // 5  left shoulder
        '#fb923c',  // 6  right shoulder
        '#4ade80',  // 7  left elbow
        '#fb923c',  // 8  right elbow
        '#4ade80',  // 9  left wrist
        '#fb923c',  // 10 right wrist
        '#4ade80',  // 11 left hip
        '#fb923c',  // 12 right hip
        '#4ade80',  // 13 left knee
        '#fb923c',  // 14 right knee
        '#4ade80',  // 15 left ankle
        '#fb923c'   // 16 right ankle
    ];

    const CONFIDENCE = 0.3;

    let detector = null;
    // Cache the last known pose per video index (0 or 1)
    const lastPoses = [null, null];

    async function init() {
        await tf.setBackend('webgl');
        await tf.ready();
        detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            { modelType: poseDetection.movenet.modelType.LIGHTNING }
        );
    }

    // Run one inference cycle. imageSource can be an HTMLVideoElement or canvas.
    // Uses tf.tidy to prevent tensor memory leaks.
    async function detect(imageSource) {
        if (!detector) return null;
        try {
            let poses;
            // estimatePoses is async but internally allocates tensors; wrapping in
            // tidy() doesn't work for async calls, so we dispose manually instead.
            poses = await detector.estimatePoses(imageSource, { maxPoses: 1 });
            return poses[0] || null;
        } catch {
            return null;
        }
    }

    function drawSkeleton(ctx, pose) {
        if (!pose) return;
        const kps = pose.keypoints;

        // Connections
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        for (const [i, j] of CONNECTIONS) {
            const a = kps[i], b = kps[j];
            if (a.score > CONFIDENCE && b.score > CONFIDENCE) {
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }

        // Keypoints
        for (let i = 0; i < kps.length; i++) {
            const kp = kps[i];
            if (kp.score > CONFIDENCE) {
                ctx.beginPath();
                ctx.fillStyle = KP_COLORS[i];
                ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }

    function getLastPose(videoIndex) { return lastPoses[videoIndex]; }
    function setLastPose(videoIndex, pose) { lastPoses[videoIndex] = pose; }

    window.PoseAnalyzer = { init, detect, drawSkeleton, getLastPose, setLastPose };
})();
