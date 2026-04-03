import re
import os

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Backgrounds
    content = re.sub(r'--bg:\s*#FFFFFF;', '--bg: transparent;', content)
    content = re.sub(r'--bg:\s*#F5F5F7;', '--bg: transparent;', content)
    content = re.sub(r'--surface:\s*#F5F5F7;', '--surface: rgba(255,255,255,0.05);', content)
    content = re.sub(r'--surface-hover:\s*#EBEBED;', '--surface-hover: rgba(255,255,255,0.08);', content)
    
    # 2. Text colors globally
    content = content.replace('#1D1D1F', '#FFFFFF')
    content = content.replace('#6E6E73', 'rgba(255,255,255,0.5)')
    content = content.replace('#3a3a3c', '#FFFFFF')
    
    content = content.replace('#F5F5F7', 'rgba(255,255,255,0.05)')
    content = content.replace('#F2F2F7', 'rgba(255,255,255,0.05)')
    content = content.replace('#EBEBED', 'rgba(255,255,255,0.08)')
    
    # Cards and Panels background
    content = re.sub(r'background:\s*#FFFFFF;', 'background: rgba(255,255,255,0.06);', content)
    content = re.sub(r'background:\s*white;', 'background: rgba(255,255,255,0.06);', content)
    
    # 3. Global rgba border conversions for elements using rgba(0,0,0,0.x)
    def repl_rgba(m):
        return f"rgba(255, 255, 255, 0.{m.group(1)})"
    content = re.sub(r'rgba\(0,\s*0,\s*0,\s*0\.([0-9]+)\)', repl_rgba, content)

    # 4. Box shadows (needs to stay dark)
    content = re.sub(r'box-shadow:\s*0\s*2px\s*12px\s*rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\);', 'box-shadow: 0 2px 12px rgba(0,0,0,0.3);', content)
    content = re.sub(r'box-shadow:\s*0\s*4px\s*24px\s*rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\);', 'box-shadow: 0 4px 24px rgba(0,0,0,0.3);', content)
    content = re.sub(r'box-shadow:\s*0\s*1px\s*3px\s*rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\);', 'box-shadow: 0 1px 3px rgba(0,0,0,0.3);', content)
    content = re.sub(r'box-shadow:\s*0\s*8px\s*32px\s*rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\);', 'box-shadow: 0 8px 32px rgba(0,0,0,0.4);', content)

    # 5. Hover for secondary buttons (were rgba(0,0,0,0.04) -> rbga(255,255,255,0.04), now 0.08)
    content = content.replace('rgba(255, 255, 255, 0.04)', 'rgba(255,255,255,0.08)')
    
    # 6. Primary Buttons
    # Replace background: var(--text) with new rgba rules. Since earlier replaced #1D1D1F to #FFFFFF
    content = re.sub(r'(\.btn-generate\s*\{[^}]*?)background:\s*(?:var\(--text\)|#FFFFFF);([^}]*?)\}', r'\1\2background: rgba(255,255,255,0.15);\n      border: 1px solid rgba(255,255,255,0.2);\3}', content)
    content = re.sub(r'(\.btn-generate:hover\s*\{[^}]*?)background:\s*(?:#FFFFFF);([^}]*?)\}', r'\1\2background: rgba(255,255,255,0.25);\3}', content)
    
    # 7. Inputs
    content = re.sub(r'(textarea|\.ip-input|input\.cap-inline)\s*\{([^}]*?)border:\s*none;([^}]*?)\}', r'\1 {\2border: 1px solid rgba(255,255,255,0.1);\3}', content)
    content = re.sub(r'(textarea|ip-input)::placeholder\s*\{([^}]*?)color:\s*(?:var\(--text-3\)|rgba\(255,\s*255,\s*255,\s*0\.4\));([^}]*?)\}', r'\1::placeholder {\n      color: rgba(255,255,255,0.4);\2\3}', content)
    
    # 8. Navbar
    content = re.sub(r'(\.navbar\s*\{[^}]*?)background:\s*rgba\(255,\s*255,\s*255,\s*0\.8[0-9]*\);([^}]*?border-bottom:\s*)([^;]+);', r'\1background: rgba(10,10,15,0.8);\21px solid rgba(255, 255, 255, 0.08);', content)
    
    # 9. Modales overlay
    content = re.sub(r'(\.modal-overlay[^{]*\{[^}]*?)background:\s*rgba\(255,\s*255,\s*255,\s*0\.4\);([^}]*?)\}', r'\1background: rgba(0,0,0,0.7);\2}', content)
    
    # 10. Modal tarjeta
    content = re.sub(r'(\.modal-card\s*\{[^}]*?)background:\s*(?:rgba\(255,255,255,0\.06\)|var\(--white\));([^}]*?)\}', r'\1background: rgba(20,20,30,0.95);\n      border: 1px solid rgba(255,255,255,0.1);\2}', content)

    # 11. Progress bars track
    content = re.sub(r'(\.progress-track\s*\{[^}]*?)background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\);([^}]*?)\}', r'\1background: rgba(255,255,255,0.1);\n\2}', content)
    
    # 12. Badges 
    content = re.sub(r'background:\s*rgba\((52,\s*199,\s*89|255,\s*59,\s*48|255,\s*159,\s*10|10,\s*132,\s*255),\s*0\.1[0-5]\)', r'background: rgba(\1,0.2)', content)

    # 13. Scrollbar
    content = re.sub(r'::-webkit-scrollbar\s*\{\s*\n?\s*width:\s*[0-9]+px;\s*\n?\}', '::-webkit-scrollbar {\n      width: 6px;\n    }', content)
    content = re.sub(r'::-webkit-scrollbar-track\s*\{\s*\n?\s*background:[^;]+;\s*\n?\}', '::-webkit-scrollbar-track {\n      background: transparent;\n    }', content)
    content = re.sub(r'::-webkit-scrollbar-thumb\s*\{\s*([^}]+)\}', '::-webkit-scrollbar-thumb {\n      background: rgba(255,255,255,0.2);\n      border-radius: 3px;\n    }', content)

    # 14. Body fix for z-index
    if "z-index: 1" not in content:
        content = re.sub(r'(body\s*\{[^\}]*\})', r'\1\n\n    /* ── Canvas z-index ── */\n    body > *:not(#bg-canvas) { position: relative; z-index: 1; }', content, count=1)

    # 15. Canvas Insertion
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

    # Color swatches fix logic to not be transparent!
    # well we replaced #FFFFFF with rgba(255,255,255,0.06) but color-light had value="#ffffff" which wasn't replaced since python .replace is case-sensitive! Good!
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\astorga\Desktop\PROYECT QR_1.0\index.html')
process_file(r'c:\Users\astorga\Desktop\PROYECT QR_1.0\setpoint.html')
