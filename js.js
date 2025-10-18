document.addEventListener('DOMContentLoaded', () => {
    // --- DOM bootstrap (use existing elements if present, otherwise create them) ---
    let startButton = document.getElementById('startButton');
    let gameContainer = document.getElementById('gameContainer');
    let canvas = document.getElementById('gameCanvas');

    // create start button only if it does not exist
    if (!startButton) {
        startButton = document.createElement('button');
        startButton.id = 'startButton';
        startButton.textContent = 'Reveal Game';
        Object.assign(startButton.style, {
            position: 'fixed',
            left: '50%',
            top: '20px',
            transform: 'translateX(-50%)',
            padding: '10px 14px',
            fontSize: '16px',
            zIndex: 100000,
            pointerEvents: 'auto',
            touchAction: 'manipulation',
            cursor: 'pointer',
            userSelect: 'none'
        });
        document.body.appendChild(startButton);
    } else {
        // ensure button is on top and clickable
        startButton.style.zIndex = '100000';
        startButton.style.pointerEvents = 'auto';
    }

    // create container if missing
    if (!gameContainer) {
        gameContainer = document.createElement('div');
        gameContainer.id = 'gameContainer';
        Object.assign(gameContainer.style, {
            width: '640px',
            maxWidth: '96%',
            margin: '80px auto 20px',
            position: 'relative'
        });
        document.body.appendChild(gameContainer);
    }

    // create canvas if missing
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'gameCanvas';
        canvas.width = 480;
        canvas.height = 480;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        gameContainer.appendChild(canvas);
    }

    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas 2D context not available.');
        return;
    }

    // --- responsive canvas ---
    function resizeCanvas() {
        const maxSize = Math.min(window.innerWidth - 40, 700);
        canvas.width = Math.max(320, Math.floor(maxSize));
        canvas.height = Math.round(canvas.width * 1);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ensure game container starts hidden
    gameContainer.style.position = 'relative';
    gameContainer.style.display = 'none';
    gameContainer.style.userSelect = 'none';

    // --- UI elements ---
    // on-screen jump button (mobile)
    const jumpBtn = document.createElement('button');
    jumpBtn.id = 'jumpBtn';
    jumpBtn.textContent = 'Jump';
    Object.assign(jumpBtn.style, {
        position: 'absolute',
        right: '12px',
        bottom: '12px',
        padding: '12px 18px',
        fontSize: '16px',
        borderRadius: '8px',
        zIndex: 40,
        display: 'none',
        opacity: '0.95',
        touchAction: 'manipulation'
    });
    gameContainer.appendChild(jumpBtn);

    // start game button (shown after Reveal Game is pressed)
    const playButton = document.createElement('button');
    playButton.id = 'playButton';
    playButton.textContent = 'Start Game';
    Object.assign(playButton.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%,-50%)',
        padding: '14px 22px',
        fontSize: '18px',
        borderRadius: '10px',
        zIndex: 60,
        display: 'none',
        cursor: 'pointer',
        pointerEvents: 'auto'
    });
    gameContainer.appendChild(playButton);

    // restart button (we'll move it into overlay box when game over)
    const restartButton = document.createElement('button');
    restartButton.id = 'restartButton';
    restartButton.textContent = 'Restart';
    Object.assign(restartButton.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%,-50%)',
        padding: '14px 22px',
        fontSize: '18px',
        borderRadius: '10px',
        zIndex: 60,
        display: 'none',
        cursor: 'pointer'
    });
    gameContainer.appendChild(restartButton);

    // overlay used for game over / pause messages
    const overlay = document.createElement('div');
    overlay.id = 'gameOverlay';
    Object.assign(overlay.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        zIndex: 55,
        pointerEvents: 'none'
    });
    gameContainer.appendChild(overlay);

    // --- inline mobile support (was mobile-support.js) ---
    // creates a full-canvas touch overlay and prevents overscroll when game active
    let touchOverlay = null;
    function enableMobileSupport() {
        // make canvas touch-friendly
        try { canvas.style.touchAction = 'none'; } catch (e) {}

        // create a transparent overlay that covers the canvas for reliable touch input
        touchOverlay = document.createElement('div');
        Object.assign(touchOverlay.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            zIndex: 50,
            background: 'transparent',
            display: 'none',
            touchAction: 'none',
            WebkitTapHighlightColor: 'transparent'
        });
        // route pointer events to jump handlers
        touchOverlay.addEventListener('pointerdown', (e) => { e.preventDefault(); tryJump(); }, { passive: false });
        touchOverlay.addEventListener('pointerup', (e) => { e.preventDefault(); endJump(); }, { passive: false });
        touchOverlay.addEventListener('touchstart', (e) => { e.preventDefault(); tryJump(); }, { passive: false });
        touchOverlay.addEventListener('touchend', (e) => { e.preventDefault(); endJump(); }, { passive: false });
        gameContainer.appendChild(touchOverlay);

        // prevent body overscroll while the game container is visible
        document.addEventListener('touchmove', (e) => {
            if (gameContainer && getComputedStyle(gameContainer).display !== 'none') {
                // only prevent when touching inside game area
                const r = gameContainer.getBoundingClientRect();
                const t = e.touches && e.touches[0];
                if (t && t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom) {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        // orientation / resize helper
        window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 120));
        window.addEventListener('resize', () => { if (gameContainer && getComputedStyle(gameContainer).display !== 'none') resizeCanvas(); });

        // page visibility -> pause on background
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (running) running = false;
            } else {
                // resume only if the game previously had been running
                if (!running && typeof last === 'number') {
                    last = performance.now();
                    running = true;
                    requestAnimationFrame(loop);
                }
            }
        });

        // request fullscreen on first user interaction (mobile)
        const requestFS = (e) => {
            try {
                if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(()=>{});
                }
            } catch (err) {}
            // remove this one-time listener
            window.removeEventListener('touchstart', requestFS, { passive: true });
        };
        window.addEventListener('touchstart', requestFS, { passive: true });
    }

    // enable mobile support immediately (safe — will bail if not needed)
    enableMobileSupport();

    // --- state ---
    let running = false;
    let last = 0;
    let player;
    let obstacles = [];
    let particles = [];
    let score = 0;
    let highScore = parseInt(localStorage.getItem('hj_highscore') || '0', 10) || 0;
    let losses = 0;
    let jumpHeld = false;
    let gameSpeed = 320;
    let spawnTimer = 0;
    let spawnInterval = 0.9;

    // --- helpers ---
    const rand = (min, max) => Math.random() * (max - min) + min;

    function resetState() {
        const groundY = canvas.height * 0.85;
        player = {
            x: canvas.width * 0.12,
            // smaller player so jumping target is harder to hit
            y: groundY - 32,
            w: Math.round(canvas.width * 0.06),
            h: Math.round(canvas.height * 0.09),
            vy: 0,
            gravity: 2400,
            jumpSpeed: -980,
            onGround: true,
            color: '#ff8a00'
        };
        obstacles = [];
        particles = [];
        score = 0;
        gameSpeed = 320;
        // space obstacles out more initially and reduce how quickly they tighten up
        spawnInterval = 1.3; // larger initial gap between obstacles
        spawnTimer = spawnInterval;
    }

    // background, spawn, draw, particles (kept similar to existing implementation)
    const bg = { clouds: [], hills: [], trees: [], fog: [], lanterns: [], moths: [] };
    function initBackground() {
        // soft clouds for depth
        bg.clouds = Array.from({ length: 5 }, () => ({
            x: rand(0, canvas.width),
            y: rand(canvas.height * 0.05, canvas.height * 0.22),
            w: rand(90, 240),
            h: rand(22, 48),
            speed: rand(6, 20),
            alpha: rand(0.06, 0.18)
        }));

        // large distant hills
        bg.hills = Array.from({ length: 3 }, (v, i) => ({
            x: i * (canvas.width * 0.7),
            y: canvas.height * 0.72 + i * 6,
            w: canvas.width * (0.85 + i * 0.12),
            h: canvas.height * (0.36 + i * 0.06),
            speed: 16 - i * 4,
            tint: 0.08 + i * 0.04
        }));

        // silhouette trees (parallax closer)
        bg.trees = Array.from({ length: 12 }, () => ({
            x: rand(0, canvas.width * 1.8),
            y: canvas.height * 0.78,
            scale: rand(0.6, 1.4),
            speed: rand(26, 90),
            sway: rand(0.6, 1.6)
        }));

        // soft fog layers for atmosphere
        bg.fog = Array.from({ length: 3 }, (_, i) => ({
            x: rand(-200, canvas.width),
            y: canvas.height * (0.45 + i * 0.1),
            w: canvas.width * (1.1 + i * 0.2),
            h: canvas.height * 0.16,
            speed: 6 + i * 8,
            alpha: 0.04 + i * 0.03
        }));

        // floating lanterns / eye-catchers
        bg.lanterns = Array.from({ length: 6 }, () => ({
            x: rand(20, canvas.width - 20),
            y: rand(canvas.height * 0.28, canvas.height * 0.75),
            vx: rand(-8, 8),
            vy: rand(-6, 6),
            size: rand(2.8, 6),
            glow: rand(0.9, 1.6)
        }));

        // tiny moth-like particles that flutter near player area
        bg.moths = Array.from({ length: 16 }, () => ({
            x: rand(0, canvas.width),
            y: rand(canvas.height * 0.35, canvas.height * 0.85),
            vx: rand(-20, 20),
            vy: rand(-8, 8),
            life: rand(3, 12),
            phase: rand(0, Math.PI * 2)
        }));
    }

    function spawnObstacle() {
        const groundY = canvas.height * 0.85;
        const type = Math.random();
        if (type < 0.6) {
            const h = rand(player.h * 0.4, player.h * 0.9);
            obstacles.push({ x: canvas.width + 10, y: groundY - h, w: rand(24, 40), h, color: '#ffffff' });
        } else {
            const h = rand(player.h * 0.8, player.h * 1.15);
            obstacles.push({ x: canvas.width + 10, y: groundY - h, w: rand(20, 32), h, color: '#f5426c' });
        }
    }

    function pushParticles(x, y, color) {
        for (let i = 0; i < 18; i++) {
            particles.push({ x, y, vx: rand(-200, 200), vy: rand(-220, -40), r: rand(1.5, 4.5), life: rand(0.4, 1.1), color });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.vy += 2200 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // draw particle effects (prevents ReferenceError in main loop)
    function drawParticles() {
        if (!ctx) return;
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            const a = Math.max(0, Math.min(1, p.life)); // life-based alpha
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = p.color || 'rgba(255,255,255,1)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r || 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function updateBackground(dt) {
        // clouds
        for (const c of bg.clouds) {
            c.x -= c.speed * dt * 0.22;
            if (c.x + c.w < -40) c.x = canvas.width + rand(10, 140);
        }
        // hills slow parallax
        for (const h of bg.hills) {
            h.x -= h.speed * dt * 0.18;
            if (h.x + h.w < -80) h.x = canvas.width + rand(10, 140);
        }
        // trees (closer, faster)
        for (const t of bg.trees) {
            t.x -= t.speed * dt * 0.5;
            if (t.x < -160) t.x = canvas.width + rand(0, 320);
        }
        // fog drift
        for (const f of bg.fog) {
            f.x -= f.speed * dt * 0.12;
            if (f.x + f.w < -80) f.x = canvas.width + rand(0, 160);
        }
        // lantern floating
        for (const L of bg.lanterns) {
            L.x += L.vx * dt;
            L.y += L.vy * dt;
            if (L.x < -20) L.x = canvas.width + rand(10, 80);
            if (L.x > canvas.width + 20) L.x = -rand(10, 80);
            if (L.y < canvas.height * 0.18) L.y = canvas.height * 0.18 + rand(0, 24);
            if (L.y > canvas.height * 0.9) L.y = canvas.height * 0.9 - rand(0, 24);
        }
        // moths flutter
        for (const m of bg.moths) {
            m.phase += dt * rand(1.5, 3.5);
            m.x += Math.cos(m.phase) * m.vx * dt * 0.6;
            m.y += Math.sin(m.phase) * m.vy * dt * 0.6;
            m.life -= dt;
            if (m.life <= 0 || m.x < -40 || m.x > canvas.width + 40) {
                m.x = rand(0, canvas.width); m.y = rand(canvas.height * 0.35, canvas.height * 0.85);
                m.vx = rand(-20, 20); m.vy = rand(-8, 8); m.life = rand(3, 12); m.phase = rand(0, Math.PI * 2);
            }
        }
    }

    function drawBackground() {
        // deep vignette gradient (Limbo-like)
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, '#03050a'); g.addColorStop(0.6, '#07101a'); g.addColorStop(1, '#061018');
        ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);

        // soft distant glow
        const glow = ctx.createRadialGradient(canvas.width * 0.85, canvas.height * 0.18, 10, canvas.width * 0.85, canvas.height * 0.18, canvas.width * 0.9);
        glow.addColorStop(0, 'rgba(200,220,255,0.04)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, canvas.height);

        // fog layers
        for (const f of bg.fog) {
            const fogGrad = ctx.createLinearGradient(f.x, f.y, f.x + f.w, f.y + f.h);
            fogGrad.addColorStop(0, `rgba(6,10,14,${f.alpha})`);
            fogGrad.addColorStop(0.5, `rgba(24,28,36,${f.alpha * 1.4})`);
            fogGrad.addColorStop(1, `rgba(6,10,14,${f.alpha})`);
            ctx.fillStyle = fogGrad;
            ctx.fillRect(f.x, f.y, f.w, f.h);
        }

        // hills silhouettes
        for (let i = 0; i < bg.hills.length; i++) {
            const h = bg.hills[i];
            ctx.fillStyle = i % 2 ? 'rgba(6,14,18,1)' : 'rgba(10,18,24,1)';
            ctx.beginPath();
            ctx.ellipse(h.x + h.w * 0.5, h.y + 20, h.w, h.h, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // trees (closer silhouettes)
        for (const t of bg.trees) {
            const treeX = t.x;
            const baseY = t.y;
            const s = t.scale;
            ctx.fillStyle = 'rgba(0,0,0,1)';
            // trunk
            const trunkW = 6 * s;
            ctx.fillRect(treeX - trunkW * 0.5, baseY - (22 * s), trunkW, 22 * s);
            // triangular foliage
            for (let k = 0; k < 3; k++) {
                ctx.beginPath();
                ctx.moveTo(treeX, baseY - (k * 10 + 6) * s - 22 * s);
                ctx.lineTo(treeX - (22 - k * 6) * s, baseY + (4 - k * 4) * s - 22 * s);
                ctx.lineTo(treeX + (22 - k * 6) * s, baseY + (4 - k * 4) * s - 22 * s);
                ctx.closePath();
                ctx.fill();
            }
        }

        // moving lanterns (glow + core)
        for (const L of bg.lanterns) {
            const halo = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 24 * L.glow);
            halo.addColorStop(0, 'rgba(220,240,255,0.95)');
            halo.addColorStop(0.12, 'rgba(190,210,230,0.35)');
            halo.addColorStop(0.4, 'rgba(120,140,160,0.08)');
            halo.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(L.x, L.y, 24 * L.glow, 0, Math.PI * 2);
            ctx.fill();
            // core
            ctx.fillStyle = 'rgba(240,250,255,0.98)';
            ctx.beginPath();
            ctx.arc(L.x, L.y, L.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // refined Limbo-like silhouette player with subtle animation & two glowing eyes
    function drawPlayer() {
        if (!player) return;
        const t = performance.now() * 0.002;
        const bob = Math.sin(t * 3) * 2;
        const px = player.x, py = player.y + bob, pw = player.w, ph = player.h;

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath();
        ctx.ellipse(px + pw * 0.5, canvas.height * 0.85 + 8, pw * 0.36, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // body silhouette
        ctx.fillStyle = '#020305';
        const radius = Math.max(4, pw * 0.12);
        ctx.beginPath();
        ctx.moveTo(px + radius, py);
        ctx.arcTo(px + pw, py, px + pw, py + ph, radius);
        ctx.arcTo(px + pw, py + ph, px, py + ph, radius);
        ctx.arcTo(px, py + ph, px, py, radius);
        ctx.arcTo(px, py, px + pw, py, radius);
        ctx.closePath();
        ctx.fill();

        // head
        ctx.beginPath();
        const headR = Math.min(pw * 0.36, ph * 0.36);
        ctx.ellipse(px + pw * 0.5, py + headR * 0.6, headR, headR, 0, 0, Math.PI * 2);
        ctx.fill();

        // glowing eyes (bright but small)
        ctx.fillStyle = 'rgba(200,230,255,0.98)';
        ctx.beginPath(); ctx.arc(px + pw * 0.62, py + headR * 0.5, Math.max(1.6, pw * 0.028), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + pw * 0.38, py + headR * 0.5, Math.max(1.3, pw * 0.025), 0, Math.PI * 2); ctx.fill();

        // simple leg/limb strokes to add life
        ctx.strokeStyle = '#010203';
        ctx.lineWidth = Math.max(2, pw * 0.07);
        ctx.lineCap = 'round';
        const swing = Math.sin(t * 8) * 6;
        ctx.beginPath();
        ctx.moveTo(px + pw * 0.28, py + ph);
        ctx.lineTo(px + pw * 0.28 + swing * 0.04, py + ph + 18 + Math.max(0, player.vy * 0.02));
        ctx.moveTo(px + pw * 0.72, py + ph);
        ctx.lineTo(px + pw * 0.72 - swing * 0.04, py + ph + 18 + Math.max(0, player.vy * 0.02));
        ctx.stroke();
    }

    // silhouette obstacles with subtle rim lighting for readability
    function drawObstacles() {
        for (const o of obstacles) {
            // main silhouette
            ctx.fillStyle = 'rgba(6,8,10,1)';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            // soft rim (top-left) to read shape on dark background
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, Math.max(4, Math.min(8, o.h * 0.12)));
        }
    }

    // --- game over / restart handling ---
    function showGameOver() {
        running = false;
        losses++;
        pushParticles(player.x + player.w * 0.5, player.y + player.h * 0.5, '#ffcf66');

        overlay.innerHTML = '';
        overlay.style.display = 'flex';
        overlay.style.pointerEvents = 'auto';

        const box = document.createElement('div');
        Object.assign(box.style, {
            background: 'rgba(0,0,0,0.72)',
            color: 'white',
            padding: '18px 22px',
            borderRadius: '10px',
            maxWidth: '90%',
            pointerEvents: 'auto',
            boxSizing: 'border-box'
        });

        const title = document.createElement('div');
        title.textContent = `Game Over — Score: ${Math.floor(score)}`;
        title.style.fontSize = '20px'; title.style.marginBottom = '8px';
        box.appendChild(title);

        const hs = document.createElement('div');
        if (score > highScore) {
            highScore = Math.floor(score);
            try { localStorage.setItem('hj_highscore', String(highScore)); } catch {}
            hs.textContent = `New Highscore: ${highScore}`;
        } else hs.textContent = `Highscore: ${highScore}`;
        hs.style.opacity = '0.95'; hs.style.marginBottom = '8px';
        box.appendChild(hs);

        if (losses >= 5) {
            const taunt = document.createElement('div');
            taunt.textContent = 'you are bunz lmao, cant even win a simple game lol';
            taunt.style.marginTop = '6px'; taunt.style.color = '#ffb3b3';
            box.appendChild(taunt);
        }

        // move restartButton into box and make it flow normally
        box.appendChild(restartButton);
        Object.assign(restartButton.style, {
            position: 'static',
            transform: '',
            marginTop: '12px',
            display: 'block',
            zIndex: '0',
            pointerEvents: 'auto'
        });

        overlay.appendChild(box);
        jumpBtn.style.display = 'none';
    }

    function hideOverlayAndRestoreRestart() {
        overlay.style.display = 'none';
        overlay.style.pointerEvents = 'none';
        // move restartButton back to gameContainer and hide it (restore absolute style)
        if (restartButton.parentNode !== gameContainer) gameContainer.appendChild(restartButton);
        Object.assign(restartButton.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            marginTop: '',
            zIndex: '60',
            display: 'none',
            pointerEvents: 'auto'
        });
    }

    // --- main loop ---
    function loop(ts) {
        const dt = Math.min(0.05, (ts - last) / 1000);
        last = ts;

        if (running) {
            player.vy += player.gravity * dt;
            player.vy = Math.min(player.vy, 2200);
            player.y += player.vy * dt;

            const groundY = canvas.height * 0.85;
            if (player.y + player.h >= groundY) {
                player.y = groundY - player.h;
                player.vy = 0;
                player.onGround = true;
            } else player.onGround = false;

            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                spawnObstacle();
                // keep obstacles more spaced out and scale down tightening rate
                spawnInterval = Math.max(0.6, 1.3 - (score / 1400));
                spawnTimer = spawnInterval + rand(-0.18, 0.18);
            }

            gameSpeed += dt * 18 * (1 + score / 600);

            for (let i = obstacles.length - 1; i >= 0; i--) {
                const o = obstacles[i];
                o.x -= gameSpeed * dt;
                if (o.x + o.w < -20) obstacles.splice(i, 1);
            }

            for (const o of obstacles) {
                if (player.x < o.x + o.w && player.x + player.w > o.x &&
                    player.y < o.y + o.h && player.y + player.h > o.y) {
                    showGameOver();
                    break;
                }
            }

            updateBackground(dt);
            updateParticles(dt);
            score += (gameSpeed / 100) * dt * 10;
        }

        // draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        drawObstacles();
        drawPlayer();
        drawParticles();

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = `${Math.max(12, canvas.width * 0.04)}px sans-serif`;
        ctx.fillText(`Score: ${Math.floor(score)}`, 12, 28);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = `${Math.max(10, canvas.width * 0.028)}px sans-serif`;
        ctx.fillText(`Losses: ${losses}`, canvas.width - 12 - ctx.measureText(`Losses: ${losses}`).width, 28);

        if (running) requestAnimationFrame(loop);
    }

    // --- input handling (consistent pointer + touch + keyboard) ---
    function tryJump() {
        if (!running) return;
        if (player.onGround) {
            player.vy = player.jumpSpeed;
            player.onGround = false;
            jumpHeld = true;
        }
    }
    function endJump() {
        if (player && player.vy < 0) player.vy *= 0.35;
        jumpHeld = false;
    }

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); tryJump(); }
        if (e.code === 'KeyP') {
            running = !running;
            if (running) { last = performance.now(); requestAnimationFrame(loop); hideOverlayAndRestoreRestart(); }
            else { overlay.style.display = 'flex'; overlay.style.pointerEvents = 'auto'; overlay.innerHTML = '<div style="background:rgba(0,0,0,0.6);color:white;padding:14px 18px;border-radius:8px">Paused — press P to resume</div>'; restartButton.style.display = 'none'; }
        }
    });
    document.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') endJump(); });

    // pointer/touch on canvas
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); tryJump(); }, { passive: false });
    canvas.addEventListener('pointerup', (e) => { e.preventDefault(); endJump(); }, { passive: false });
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); tryJump(); }, { passive: false });
    canvas.addEventListener('touchend', (e) => { e.preventDefault(); endJump(); }, { passive: false });

    // jump button (mobile)
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); tryJump(); }, { passive: false });
    jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); endJump(); }, { passive: false });
    jumpBtn.addEventListener('mousedown', tryJump);
    jumpBtn.addEventListener('mouseup', endJump);
    jumpBtn.addEventListener('mouseleave', endJump);

    // play button wiring (starts the actual game)
    // ensure playButton is clickable and above overlays
    Object.assign(playButton.style, { zIndex: '100001', pointerEvents: 'auto' });
    function onPlayStart(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        // hide the button immediately and start
        playButton.style.display = 'none';
        // ensure overlay won't block canvas input while game runs
        overlay.style.display = 'none';
        overlay.style.pointerEvents = 'none';
        startGame();
    }
    // robust handlers for click/pointer/touch/keyboard
    playButton.removeEventListener('click', onPlayStart);
    playButton.removeEventListener('pointerup', onPlayStart);
    playButton.removeEventListener('touchend', onPlayStart);
    playButton.addEventListener('click', onPlayStart);
    playButton.addEventListener('pointerup', onPlayStart);
    playButton.addEventListener('touchend', onPlayStart, { passive: false });
    playButton.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') onPlayStart(e); });

    // --- start and restart wiring ---
    function startHandler(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        // Reveal container and start immediately
        startButton.style.display = 'none';
        gameContainer.style.display = 'block';
        resizeCanvas();
        overlay.style.display = 'none';
        overlay.style.pointerEvents = 'none';
        // ensure any visible play button is hidden
        playButton.style.display = 'none';
        try { startGame(); } catch (err) {
            console.error('startGame() threw:', err);
            alert('Game failed to start — check console for details.');
        }
    }

    // make sure reveal button is visible & focusable and attach simple robust handlers
    startButton.style.display = 'block';
    startButton.style.zIndex = '100000';
    startButton.tabIndex = 0;
    startButton.setAttribute('aria-label', 'Reveal Game');

    // clear old handlers and attach
    startButton.removeEventListener('click', startHandler);
    startButton.removeEventListener('pointerup', startHandler);
    startButton.removeEventListener('touchend', startHandler);
    startButton.addEventListener('click', startHandler);
    startButton.addEventListener('pointerup', startHandler);
    startButton.addEventListener('touchend', startHandler, { passive: false });
    startButton.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startHandler(e); } });
    if (!document.body.contains(startButton)) document.body.appendChild(startButton);

    restartButton.addEventListener('click', (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        hideOverlayAndRestoreRestart();
        startGame();
    });
    restartButton.addEventListener('touchstart', (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        hideOverlayAndRestoreRestart();
        startGame();
    }, { passive: false });

    // --- startGame / initialization ---
    function isMobile() {
        return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) || window.innerWidth < 600;
    }

    function startGame() {
        // ensure the play button is hidden when the game actually starts
        playButton.style.display = 'none';
        resetState();
        initBackground();
        hideOverlayAndRestoreRestart();
        jumpBtn.style.display = isMobile() ? 'block' : 'none';
        // show the full-canvas touch overlay on mobile for reliable input
        if (touchOverlay) touchOverlay.style.display = isMobile() ? 'block' : 'none';
        running = true;
        last = performance.now();
        requestAnimationFrame(loop);
    }

    // initial setup
    resetState();
    initBackground();
});
