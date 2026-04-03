$filePathIndex = "c:\Users\astorga\Desktop\PROYECT QR_1.0\index.html"
$filePathSetPoint = "c:\Users\astorga\Desktop\PROYECT QR_1.0\setpoint.html"

function Process-File ($path) {
    if (-not (Test-Path $path)) {
        Write-Host "File not found: $path"
        return
    }
    
    $content = [System.IO.File]::ReadAllText($path)
    
    # Variables globales
    $content = $content -replace '--bg:\s*#FFFFFF;', '--bg: transparent;'
    $content = $content -replace '--bg:\s*#F5F5F7;', '--bg: transparent;'
    $content = $content -replace '--surface:\s*#F5F5F7;', '--surface: rgba(255,255,255,0.05);'
    $content = $content -replace '--surface-hover:\s*#EBEBED;', '--surface-hover: rgba(255,255,255,0.08);'
    
    # Textos
    $content = $content.Replace('#1D1D1F', '#FFFFFF')
    $content = $content.Replace('#6E6E73', 'rgba(255,255,255,0.5)')
    $content = $content.Replace('#3a3a3c', '#FFFFFF')
    
    # Specific colors replaced directly
    $content = $content.Replace('#F5F5F7', 'rgba(255,255,255,0.05)')
    $content = $content.Replace('#F2F2F7', 'rgba(255,255,255,0.05)')
    $content = $content.Replace('#EBEBED', 'rgba(255,255,255,0.08)')
    
    # Tarjetas y paneles
    $content = $content -replace 'background:\s*#FFFFFF;', 'background: rgba(255,255,255,0.06);'
    $content = $content -replace 'background:\s*white;', 'background: rgba(255,255,255,0.06);'

    # Global border and other rgba replacements for dark theme mapping
    $content = [regex]::Replace($content, 'rgba\(0,\s*0,\s*0,\s*0\.([0-9]+)\)', 'rgba(255, 255, 255, 0.$1)')

    # Revert specific things that shouldn't have been globally modified to rgba(255,255,255,...)
    $content = [regex]::Replace($content, 'box-shadow:\s*0\s*2px\s*12px\s*rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\);', 'box-shadow: 0 2px 12px rgba(0,0,0,0.3);')
    $content = [regex]::Replace($content, 'box-shadow:\s*0\s*4px\s*24px\s*rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\);', 'box-shadow: 0 4px 24px rgba(0,0,0,0.3);')
    $content = [regex]::Replace($content, 'box-shadow:\s*0\s*1px\s*3px\s*rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\);', 'box-shadow: 0 1px 3px rgba(0,0,0,0.3);')

    # Hover for secondary buttons
    $content = $content.Replace('rgba(255, 255, 255, 0.04)', 'rgba(255,255,255,0.08)')
    
    # Primary buttons
    $content = [regex]::Replace($content, '(\.btn-generate\s*\{[^}]*?)background:\s*(?:var\(--text\)|#FFFFFF);([^}]*?\})', '$1background: rgba(255,255,255,0.15);`n      border: 1px solid rgba(255,255,255,0.2);$2')
    $content = [regex]::Replace($content, '(\.btn-generate:hover\s*\{[^}]*?)background:\s*(?:#FFFFFF);([^}]*?\})', '$1background: rgba(255,255,255,0.25);$2')

    $content = [regex]::Replace($content, '(\.btn-primary\s*\{[^}]*?)background:\s*(?:var\(--text\)|#FFFFFF);([^}]*?\})', '$1background: rgba(255,255,255,0.15);`n      border: 1px solid rgba(255,255,255,0.2);$2')
    $content = [regex]::Replace($content, '(\.btn-primary:hover\s*\{[^}]*?)background:\s*(?:#FFFFFF);([^}]*?\})', '$1background: rgba(255,255,255,0.25);$2')
    
    # Inputs
    $content = [regex]::Replace($content, '(textarea|\.ip-input|input\.cap-inline)\s*\{([^}]*?)border:\s*none;([^}]*?\})', '$1 {$2border: 1px solid rgba(255,255,255,0.1);$3')
    $content = [regex]::Replace($content, '(textarea|ip-input)::placeholder\s*\{([^}]*?)color:\s*(?:var\(--text-3\)|rgba\(255,\s*255,\s*255,\s*0\.4\));([^}]*?\})', '$1::placeholder {`n      color: rgba(255,255,255,0.4);$2$3')
    
    # Navbar
    $content = [regex]::Replace($content, '(\.navbar\s*\{[^}]*?)background:\s*rgba\(255,\s*255,\s*255,\s*0\.8[0-9]*\);([^}]*?border-bottom:\s*)([^;]+;)', '$1background: rgba(10,10,15,0.8);$21px solid rgba(255, 255, 255, 0.08);')
    
    # Modal overlay and card
    $content = [regex]::Replace($content, '(\.modal-overlay[^{]*\{[^}]*?)background:\s*rgba\(255,\s*255,\s*255,\s*0\.4\);([^}]*?\})', '$1background: rgba(0,0,0,0.7);$2')
    $content = [regex]::Replace($content, '(\.modal-card\s*\{[^}]*?)background:\s*(?:rgba\(255,255,255,0\.06\)|var\(--white\));([^}]*?\})', '$1background: rgba(20,20,30,0.95);`n      border: 1px solid rgba(255,255,255,0.1);$2')

    # Progress bars
    $content = [regex]::Replace($content, '(\.progress-track\s*\{[^}]*?)background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\);([^}]*?\})', '$1background: rgba(255,255,255,0.1);$2')
    
    # Badges
    $content = [regex]::Replace($content, 'background:\s*rgba\((52,\s*199,\s*89|255,\s*59,\s*48|255,\s*159,\s*10|10,\s*132,\s*255),\s*0\.1[0-5]\)', 'background: rgba($1,0.2)')

    # Scrollbar
    $content = [regex]::Replace($content, '::-webkit-scrollbar\s*\{\s*`n?\s*width:\s*[0-9]+px;\s*`n?\}', '::-webkit-scrollbar {`n      width: 6px;`n    }')
    $content = [regex]::Replace($content, '::-webkit-scrollbar-track\s*\{\s*`n?\s*background:[^;]+;\s*`n?\}', '::-webkit-scrollbar-track {`n      background: transparent;`n    }')
    $content = [regex]::Replace($content, '::-webkit-scrollbar-thumb\s*\{\s*([^}]+)\}', '::-webkit-scrollbar-thumb {`n      background: rgba(255,255,255,0.2);`n      border-radius: 3px;`n    }')

    # Body Z-index
    if (-not $content.Contains("z-index: 1")) {
        $content = [regex]::Replace($content, '(body\s*\{[^\}]*\})', '$1`n`n    /* ── Canvas z-index ── */`n    body > *:not(#bg-canvas) { position: relative; z-index: 1; }', 1)
    }

    # Add canvas
    $canvas_html = @"
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
            ctx.strokeStyle = ``rgba(255,255,255,`${0.1 * (1 - dist/120)})``;
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
"@

    if (-not $content.Contains('id="bg-canvas"')) {
        $content = $content.Replace('</body>', $canvas_html + "`n</body>")
    }

    [System.IO.File]::WriteAllText($path, $content)
    Write-Host "Processed $path"
}

Process-File $filePathIndex
Process-File $filePathSetPoint

