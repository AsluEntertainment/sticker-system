import re
import os

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Variables
    content = re.sub(r'--bg:\s*#FFFFFF;', '--bg: transparent;', content)
    content = re.sub(r'--bg:\s*#F5F5F7;', '--bg: transparent;', content)
    content = re.sub(r'--white:\s*#FFFFFF;', '--white: rgba(255,255,255,0.06);', content)
    
    # Text colors globally
    content = content.replace('#1D1D1F', '#FFFFFF')
    content = content.replace('#6E6E73', 'rgba(255,255,255,0.5)')
    
    content = content.replace('#F5F5F7', 'rgba(255,255,255,0.05)')
    content = content.replace('#F2F2F7', 'rgba(255,255,255,0.05)')
    content = content.replace('#EBEBED', 'rgba(255,255,255,0.08)')
    
    # rgba() global conversions
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.04\)', 'rgba(255,255,255,0.08)', content)
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.05\)', 'rgba(255,255,255,0.05)', content)
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.06\)', 'rgba(255,255,255,0.06)', content)
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.07\)', 'rgba(255,255,255,0.07)', content)
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.08\)', 'rgba(255,255,255,0.1)', content)
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.12\)', 'rgba(255,255,255,0.12)', content)
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.1[0-1]\)', 'rgba(255,255,255,0.1)', content)
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.15\)', 'rgba(255,255,255,0.2)', content)
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.2[0-5]\)', 'rgba(255,255,255,0.2)', content)
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.4\)', 'rgba(0,0,0,0.7)', content) # Modal overlay
    
    # Cards background: white
    content = re.sub(r'background:\s*#FFFFFF;', 'background: rgba(255,255,255,0.06);', content)
    content = re.sub(r'background:\s*white;', 'background: rgba(255,255,255,0.06);', content)

    # Re-apply color for backgrounds that shouldn't be dark-themed:
    content = content.replace('background: #000000', 'background: #000000') # Inputs color pickers shouldn't change... but wait, they don't have this.
    
    # Shadow adjustments
    content = re.sub(r'box-shadow:\s*0\s*2px\s*12px\s*rgba\(0,0,0,0\.[0-9]+\);', 'box-shadow: 0 2px 12px rgba(0,0,0,0.3);', content)
    content = re.sub(r'box-shadow:\s*0\s*2px\s*8px\s*rgba\(0,0,0,0\.[0-9]+\);', 'box-shadow: 0 2px 8px rgba(0,0,0,0.3);', content)

    # Badges
    content = re.sub(r'background:\s*rgba\((52,199,89|255,59,48|255,159,10|10,132,255),\s*0\.1[0-5]\)', r'background: rgba(\1,0.2)', content)

    # Navbar
    content = re.sub(r'rgba\(255,\s*255,\s*255,\s*0\.88\)', 'rgba(10,10,15,0.8)', content)

    # Scrollbar
    content = re.sub(r'::-webkit-scrollbar\s*\{\s*width:\s*[0-9]+px;\s*\}', '::-webkit-scrollbar { width: 6px; }', content)
    
    # Primary Buttons
    # The previous background was var(--text) which became #FFFFFF.
    content = re.sub(r'(\.btn-generate|\.btn-primary)\s*\{([^}]*?)background:\s*var\(--text\);([^}]*?)\}', r'\1 {\2background: rgba(255,255,255,0.15);\n      border: 1px solid rgba(255,255,255,0.2);\3}', content)
    content = re.sub(r'(\.btn-generate:hover|\.btn-primary:hover)\s*\{([^}]*?)background:\s*(#3a3a3c|rgba\(255,255,255,0\.25\));([^}]*?)\}', r'\1 {\2background: rgba(255,255,255,0.25);\3}', content)

    # Modal adjustments
    content = re.sub(r'(\.modal-card\s*\{[^}]*?)background:\s*(?:var\(--white\)|rgba\(255,255,255,0\.06\));([^}]*?)\}', r'\1background: rgba(20,20,30,0.95);\n      border: 1px solid rgba(255,255,255,0.1);\2}', content)
    
    # Inputs (textarea, input)
    content = re.sub(r'(textarea|\.ip-input|input\.cap-inline)\s*\{([^}]*?)border:\s*none;([^}]*?)\}', r'\1 {\2border: 1px solid rgba(255,255,255,0.1);\3}', content)
    content = re.sub(r'(textarea|ip-input)::placeholder\s*\{([^}]*?)color:\s*var\(--text-3\);([^}]*?)\}', r'\1::placeholder {\2color: rgba(255,255,255,0.4);\3}', content)

    # Body z-index fix
    if 'body > *:not(#bg-canvas)' not in content:
        content = re.sub(r'(body\s*\{[^\}]*\})', r'\1\n\n    /* ── Canvas z-index ── */\n    body > *:not(#bg-canvas) { position: relative; z-index: 1; }', content, count=1)

    # Canvas
    canvas_html = """
<!-- ── BACKGROUND CANVAS ── -->
<canvas id="bg-canvas" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 0; background: #0a0a0f; pointer-events: none;"></canvas>
<script>
  (function() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    const NUM_PARTICLES = 80;
    let animationId;
    let isVisible = true;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = 1;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
      }
    }

    function init() {
      resize();
      particles = [];
      for (let i = 0; i < NUM_PARTICLES; i++) {
        particles.push(new Particle());
      }
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', () => {
        isVisible = (document.visibilityState === 'visible');
        if (isVisible) loop();
        else cancelAnimationFrame(animationId);
      });
      loop();
    }

    function loop() {
      if (!isVisible) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.1 * (1 - dist/120)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      animationId = requestAnimationFrame(loop);
    }

    init();
  })();
</script>
"""
    if 'id="bg-canvas"' not in content:
        content = content.replace('</body>', canvas_html + '\n</body>')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\astorga\Desktop\PROYECT QR_1.0\index.html')
process_file(r'c:\Users\astorga\Desktop\PROYECT QR_1.0\setpoint.html')
