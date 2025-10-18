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
            y: groundY - 48,
            w: Math.round(canvas.width * 0.09),
            h: Math.round(canvas.height * 0.12),
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
        spawnInterval = 0.9;
        spawnTimer = 0;
    }

    // background, spawn, draw, particles (kept similar to existing implementation)
    const bg = { clouds: [], hills: [] };
    function initBackground() {
        bg.clouds = Array.from({ length: 6 }, () => ({
            x: rand(0, canvas.width),
            y: rand(10, canvas.height * 0.25),
            w: rand(60, 160),
            h: rand(24, 48),
            speed: rand(10, 40)
        }));
        bg.hills = Array.from({ length: 3 }, (v, i) => ({
            x: i * (canvas.width * 0.7),
            y: canvas.height * 0.7,
            w: canvas.width * 0.9,
            h: canvas.height * 0.45,
            speed: 30 - i * 6
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

    function updateBackground(dt) {
        for (const c of bg.clouds) {
            c.x -= (c.speed * dt) * (gameSpeed / 220) * 0.4;
            if (c.x + c.w < -20) c.x = canvas.width + rand(10, 80);
        }
        for (const h of bg.hills) {
            h.x -= (h.speed * dt) * (gameSpeed / 220) * 0.35;
            if (h.x + h.w < -20) h.x = canvas.width + rand(10, 80);
        }
    }

    function drawBackground() {
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#7ec8ff'); grad.addColorStop(1, '#58a0ff');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        for (const c of bg.clouds) {
            const r = Math.max(12, c.h / 2);
            ctx.beginPath();
            ctx.ellipse(c.x + c.w * 0.2, c.y, r, c.h * 0.6, 0, 0, Math.PI * 2);
            ctx.ellipse(c.x + c.w * 0.5, c.y - 6, r * 1.1, c.h * 0.7, 0, 0, Math.PI * 2);
            ctx.ellipse(c.x + c.w * 0.8, c.y, r, c.h * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = 0; i < bg.hills.length; i++) {
            const h = bg.hills[i];
            ctx.fillStyle = i % 2 ? '#3aa76d' : '#2e8f53';
            ctx.beginPath();
            ctx.ellipse(h.x + h.w * 0.5, h.y + 40, h.w, h.h, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#2b2b2b';
        ctx.fillRect(0, canvas.height * 0.85, canvas.width, canvas.height * 0.15);
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        for (let i = 0; i < 20; i++) {
            ctx.fillRect((i * 60 + (Date.now() / 40) % 60) - 60, canvas.height * 0.85, 30, 4);
        }
    }

    function drawPlayer() {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(player.x + player.w * 0.5, canvas.height * 0.85 + 6, player.w * 0.55, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = player.color;
        const radius = Math.min(12, player.w * 0.12);
        const px = player.x, py = player.y, pw = player.w, ph = player.h;
        ctx.beginPath();
        ctx.moveTo(px + radius, py);
        ctx.arcTo(px + pw, py, px + pw, py + ph, radius);
        ctx.arcTo(px + pw, py + ph, px, py + ph, radius);
        ctx.arcTo(px, py + ph, px, py, radius);
        ctx.arcTo(px, py, px + pw, py, radius);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(px + pw * 0.65, py + ph * 0.35, Math.max(2, pw * 0.04), 0, Math.PI * 2);
        ctx.fill();
    }

    function drawObstacles() {
        for (const o of obstacles) {
            ctx.fillStyle = o.color; ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, o.h - 8);
        }
    }

    function drawParticles() {
        for (const p of particles) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
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
                spawnInterval = Math.max(0.35, 0.9 - (score / 800));
                spawnTimer = spawnInterval + rand(-0.12, 0.12);
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
    playButton.addEventListener('click', (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        playButton.style.display = 'none';
        startGame();
    });
    playButton.addEventListener('touchstart', (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        playButton.style.display = 'none';
        startGame();
    }, { passive: false });

    // --- start and restart wiring ---
    function startHandler(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        console.log('Reveal button pressed');
        try {
            // Reveal the game container and show the Start Game button instead of auto-starting
            startButton.style.display = 'none';
            gameContainer.style.display = 'block';
            resizeCanvas();
            // show the play button so user can start when ready
            playButton.style.display = 'block';
            playButton.focus && playButton.focus();
        } catch (err) {
            console.error('Revealing game failed:', err);
            alert('Game failed to reveal — check console for details.');
        }
    }

    // make sure reveal button is visible & focusable
    // ensure visible/clickable and high on z-order
    startButton.style.display = 'block';
    startButton.style.zIndex = '100000';
    startButton.tabIndex = 0;
    startButton.setAttribute('aria-label', 'Reveal Game');

    // clear old handlers, then attach robust handlers for click/pointer/touch/keyboard
    ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown'].forEach(evt => {
        startButton.removeEventListener(evt, startHandler);
    });
    startButton.addEventListener('click', startHandler);
    startButton.addEventListener('pointerdown', (e) => { e.preventDefault(); }, { passive: false });
    startButton.addEventListener('pointerup', startHandler);
    startButton.addEventListener('touchend', startHandler, { passive: false });
    startButton.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startHandler(e); } });
    // ensure it's in the document body
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
        running = true;
        last = performance.now();
        requestAnimationFrame(loop);
    }

    // initial setup
    resetState();
    initBackground();
});