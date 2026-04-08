// coaching.js — Ollama integration and coaching feedback
// Exposes window.Coaching

(function () {
    const OLLAMA_BASE = 'http://localhost:11434';
    const MODEL = 'llama3.2:3b';
    const CONF = 0.3;

    // Returns true if Ollama is reachable, false otherwise.
    async function checkOllama() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
            clearTimeout(timeout);
            return res.ok;
        } catch {
            return false;
        }
    }

    // Angle of the line from point a to point b, relative to horizontal (degrees).
    function angleDeg(a, b) {
        return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
    }

    // Extract key biomechanical metrics from a pose timeline.
    function computeMetrics(timeline) {
        if (!timeline || timeline.length < 2) return null;

        const impactTime = window.AutoSync.findImpactTime(timeline);

        // Nearest frame to impact
        const impactFrame = timeline.reduce((best, f) =>
            Math.abs(f.time - impactTime) < Math.abs(best.time - impactTime) ? f : best
        );

        // Top of backswing: frame where combined wrist Y is lowest (highest position)
        const backswingFrame = timeline.reduce((best, f) => {
            const kp = f.keypoints;
            const wristY = (kp[9].score > CONF ? kp[9].y : Infinity) +
                           (kp[10].score > CONF ? kp[10].y : Infinity);
            const bestY  = (best.keypoints[9].score > CONF ? best.keypoints[9].y : Infinity) +
                           (best.keypoints[10].score > CONF ? best.keypoints[10].y : Infinity);
            return wristY < bestY ? f : best;
        });

        const ikp = impactFrame.keypoints;
        const bkp = backswingFrame.keypoints;

        return {
            impactTime: impactTime.toFixed(2),
            shoulderTilt: (ikp[5].score > CONF && ikp[6].score > CONF)
                ? angleDeg(ikp[5], ikp[6]).toFixed(1) : null,
            hipTilt: (ikp[11].score > CONF && ikp[12].score > CONF)
                ? angleDeg(ikp[11], ikp[12]).toFixed(1) : null,
            leadWristAtImpact: ikp[9].score > CONF
                ? ikp[9].y.toFixed(0) : null,
            leadWristAtTop: bkp[9].score > CONF
                ? bkp[9].y.toFixed(0) : null,
        };
    }

    function metricLine(label, val, unit = '') {
        return val !== null ? `- ${label}: ${val}${unit}` : `- ${label}: not detected`;
    }

    function buildPrompt(m1, m2) {
        return `You are an expert PGA golf coach analyzing a swing comparison. \
Below is biomechanical data extracted from two swings at the moment of impact. \
Pixel values are relative to the video frame height — lower numbers mean higher position.

Video 1 (Reference swing):
${metricLine('Shoulder tilt at impact', m1.shoulderTilt, '°')}
${metricLine('Hip tilt at impact', m1.hipTilt, '°')}
${metricLine('Lead wrist height at impact', m1.leadWristAtImpact, 'px')}
${metricLine('Lead wrist height at top of backswing', m1.leadWristAtTop, 'px')}
${metricLine('Time from start to impact', m1.impactTime, 's')}

Video 2 (Student swing):
${metricLine('Shoulder tilt at impact', m2.shoulderTilt, '°')}
${metricLine('Hip tilt at impact', m2.hipTilt, '°')}
${metricLine('Lead wrist height at impact', m2.leadWristAtImpact, 'px')}
${metricLine('Lead wrist height at top of backswing', m2.leadWristAtTop, 'px')}
${metricLine('Time from start to impact', m2.impactTime, 's')}

In 3–4 plain English sentences, describe what the student (Video 2) is doing differently \
from the reference (Video 1), and give one specific actionable drill to address the most \
significant difference. Write for a 15-handicap golfer. Avoid jargon without explanation. \
Do not mention pixel values or numbers from the data above.`;
    }

    async function queryOllama(prompt) {
        const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: MODEL, prompt, stream: false })
        });
        if (!res.ok) throw new Error(`Ollama error ${res.status}`);
        const data = await res.json();
        return data.response;
    }

    // Full analysis: compute metrics from both timelines, call Ollama, return text.
    async function analyze(timeline1, timeline2) {
        const m1 = computeMetrics(timeline1);
        const m2 = computeMetrics(timeline2);
        if (!m1 || !m2) throw new Error('Not enough pose data to compare swings.');
        const prompt = buildPrompt(m1, m2);
        return await queryOllama(prompt);
    }

    window.Coaching = { checkOllama, analyze };
})();
