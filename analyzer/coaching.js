// coaching.js — Claude API integration and coaching feedback
// Exposes window.Coaching

(function () {
    const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
    const MODEL     = 'claude-opus-4-6';
    const CONF      = 0.3;

    // ── API key management (stored in localStorage) ───────────────────────────
    function getApiKey()     { return localStorage.getItem('claude_api_key') || ''; }
    function saveApiKey(key) { localStorage.setItem('claude_api_key', key.trim()); }
    function hasApiKey()     { return !!getApiKey(); }

    // ── Biomechanical metric extraction ───────────────────────────────────────
    function angleDeg(a, b) {
        return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
    }

    function computeMetrics(timeline) {
        if (!timeline || timeline.length < 2) return null;

        const impactTime = window.AutoSync.findImpactTime(timeline);

        const impactFrame = timeline.reduce((best, f) =>
            Math.abs(f.time - impactTime) < Math.abs(best.time - impactTime) ? f : best
        );

        // Top of backswing = frame where combined wrist Y is lowest (highest position)
        const backswingFrame = timeline.reduce((best, f) => {
            const kp = f.keypoints;
            const wristY = (kp[9].score  > CONF ? kp[9].y  : Infinity) +
                           (kp[10].score > CONF ? kp[10].y : Infinity);
            const bestY  = (best.keypoints[9].score  > CONF ? best.keypoints[9].y  : Infinity) +
                           (best.keypoints[10].score > CONF ? best.keypoints[10].y : Infinity);
            return wristY < bestY ? f : best;
        });

        const ikp = impactFrame.keypoints;
        const bkp = backswingFrame.keypoints;

        return {
            impactTime:           impactTime.toFixed(2),
            shoulderTilt:         (ikp[5].score > CONF && ikp[6].score > CONF)
                                      ? angleDeg(ikp[5], ikp[6]).toFixed(1) : null,
            hipTilt:              (ikp[11].score > CONF && ikp[12].score > CONF)
                                      ? angleDeg(ikp[11], ikp[12]).toFixed(1) : null,
            leadWristAtImpact:    ikp[9].score > CONF ? ikp[9].y.toFixed(0) : null,
            leadWristAtTop:       bkp[9].score > CONF ? bkp[9].y.toFixed(0) : null,
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

    // ── Claude API call ───────────────────────────────────────────────────────
    async function queryClaude(prompt) {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('No API key set. Enter your Anthropic API key above.');

        const res = await fetch(CLAUDE_API, {
            method: 'POST',
            headers: {
                'x-api-key':                              apiKey,
                'anthropic-version':                      '2023-06-01',
                'content-type':                           'application/json',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model:      MODEL,
                max_tokens: 400,
                messages:   [{ role: 'user', content: prompt }]
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err.error?.message || `API error ${res.status}`;
            throw new Error(msg);
        }

        const data = await res.json();
        return data.content[0].text;
    }

    // Full analysis pipeline
    async function analyze(timeline1, timeline2) {
        const m1 = computeMetrics(timeline1);
        const m2 = computeMetrics(timeline2);
        if (!m1 || !m2) throw new Error('Not enough pose data to compare swings.');
        return await queryClaude(buildPrompt(m1, m2));
    }

    window.Coaching = { hasApiKey, getApiKey, saveApiKey, analyze };
})();
