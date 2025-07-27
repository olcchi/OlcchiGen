'use client'

import { useEffect, useRef } from 'react'

/**
 * WebGL Water Ripples simulation - realistic water surface with interactive ripples
 * Based on Evan Wallace's WebGL Water demo
 */
export default function RipplesPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(null)
  const waterRef = useRef<Water | null>(null)
  const rendererRef = useRef<WaterRenderer | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize WebGL context
    const canvas = canvasRef.current
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

    if (!gl || !(gl instanceof WebGLRenderingContext)) {
      console.error('WebGL not supported')
      return
    }

    // Check for required extensions
    const floatExt = gl.getExtension('OES_texture_float')
    if (!floatExt) {
      console.error('OES_texture_float extension not supported')
      return
    }

    // Initialize water simulation and renderer
    const water = new Water(gl)
    const renderer = new WaterRenderer(gl)

    waterRef.current = water
    rendererRef.current = renderer

    // Set canvas size with high DPI support
    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (container) {
        const rect = container.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1

        // Set actual canvas size in memory (scaled by DPR)
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr

        // Scale canvas back down using CSS to fit container exactly
        canvas.style.width = rect.width + 'px'
        canvas.style.height = rect.height + 'px'
        canvas.style.maxWidth = '100%'
        canvas.style.maxHeight = '100%'
        canvas.style.objectFit = 'contain'

        // Set WebGL viewport to match the scaled canvas
        gl.viewport(0, 0, canvas.width, canvas.height)
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Add some initial ripples
    for (let i = 0; i < 5; i++) {
      water.addDrop(
        (Math.random() - 0.5) * 1.8,
        (Math.random() - 0.5) * 1.8,
        0.03,
        (i & 1) ? 0.01 : -0.01
      )
    }

    // Mouse and touch interaction
    let isInteracting = false

    const handleMouseDown = (e: MouseEvent) => {
      isInteracting = true
      addRippleAtPosition(e.clientX, e.clientY)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isInteracting) {
        addRippleAtPosition(e.clientX, e.clientY)
      }
    }

    const handleMouseUp = () => {
      isInteracting = false
    }

    // Touch event handlers
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault() // Prevent scrolling and other default behaviors
      isInteracting = true
      const touch = e.touches[0]
      addRippleAtPosition(touch.clientX, touch.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault() // Prevent scrolling
      if (isInteracting && e.touches.length > 0) {
        const touch = e.touches[0]
        addRippleAtPosition(touch.clientX, touch.clientY)
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      isInteracting = false
    }

    const addRippleAtPosition = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      // Calculate normalized coordinates (0 to 1) based on CSS size
      const x = ((clientX - rect.left) / rect.width) * 2 - 1
      const y = -((clientY - rect.top) / rect.height) * 2 + 1
      water.addDrop(x, y, 0.05, 0.01)
    }

    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseUp)

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false })

    // Animation loop
    const animate = () => {
      // Update water simulation
      water.stepSimulation()
      water.stepSimulation() // Run twice for stability
      water.updateNormals()

      // Render
      renderer.render(water)

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', resizeCanvas)

      // Remove mouse events
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseUp)

      // Remove touch events
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchcancel', handleTouchEnd)

      water.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <>
      <h1 className="text-sm font-mono font-bold mb-4">Ripples</h1>
      <div className="w-80 h-80 xl:w-100 xl:h-100 border border-black">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer"
          style={{
            display: 'block',
            boxSizing: 'border-box',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />
      </div>
      <div className='flex flex-col items-center gap-2'>
        <p className="text-xs text-gray-600 mt-2">点击，拖拽，或触摸创造涟漪 / Click, drag, or touch to create water ripples</p>
        <div className="h-12"></div>
      </div>
    </>
  )
}

// WebGL Water simulation class
class Water {
  private gl: WebGLRenderingContext
  private textureA: WebGLTexture
  private textureB: WebGLTexture
  private framebufferA: WebGLFramebuffer
  private framebufferB: WebGLFramebuffer
  private dropShader: WebGLProgram
  private updateShader: WebGLProgram
  private normalShader: WebGLProgram
  private quadBuffer: WebGLBuffer
  private size = 256

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl

    // Create textures for ping-pong rendering
    this.textureA = this.createTexture()
    this.textureB = this.createTexture()

    // Create framebuffers
    this.framebufferA = this.createFramebuffer(this.textureA)
    this.framebufferB = this.createFramebuffer(this.textureB)

    // Create shaders
    this.dropShader = this.createDropShader()
    this.updateShader = this.createUpdateShader()
    this.normalShader = this.createNormalShader()

    // Create quad for rendering
    this.quadBuffer = this.createQuad()
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.size, this.size, 0, gl.RGBA, gl.FLOAT, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    const gl = this.gl
    const framebuffer = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    return framebuffer
  }

  private createShader(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vertexShader, vertexSource)
    gl.compileShader(vertexShader)

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fragmentShader, fragmentSource)
    gl.compileShader(fragmentShader)

    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    return program
  }

  private createDropShader(): WebGLProgram {
    const vertexSource = `
      attribute vec2 position;
      varying vec2 coord;
      void main() {
        coord = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fragmentSource = `
      precision mediump float;
      uniform sampler2D texture;
      uniform vec2 center;
      uniform float radius;
      uniform float strength;
      varying vec2 coord;
      
      void main() {
        vec4 info = texture2D(texture, coord);
        float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);
        drop = 0.5 - cos(drop * 3.141592653589793) * 0.5;
        info.r += drop * strength;
        gl_FragColor = info;
      }
    `

    return this.createShader(vertexSource, fragmentSource)
  }

  private createUpdateShader(): WebGLProgram {
    const vertexSource = `
      attribute vec2 position;
      varying vec2 coord;
      void main() {
        coord = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fragmentSource = `
      precision mediump float;
      uniform sampler2D texture;
      uniform vec2 delta;
      varying vec2 coord;
      
      void main() {
        vec4 info = texture2D(texture, coord);
        
        vec2 dx = vec2(delta.x, 0.0);
        vec2 dy = vec2(0.0, delta.y);
        float average = (
          texture2D(texture, coord - dx).r +
          texture2D(texture, coord - dy).r +
          texture2D(texture, coord + dx).r +
          texture2D(texture, coord + dy).r
        ) * 0.25;
        
        info.g += (average - info.r) * 2.0;
        info.g *= 0.995;
        info.r += info.g;
        
        gl_FragColor = info;
      }
    `

    return this.createShader(vertexSource, fragmentSource)
  }

  private createNormalShader(): WebGLProgram {
    const vertexSource = `
      attribute vec2 position;
      varying vec2 coord;
      void main() {
        coord = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fragmentSource = `
      precision mediump float;
      uniform sampler2D texture;
      uniform vec2 delta;
      varying vec2 coord;
      
      void main() {
        vec4 info = texture2D(texture, coord);
        
        vec3 dx = vec3(delta.x, texture2D(texture, vec2(coord.x + delta.x, coord.y)).r - info.r, 0.0);
        vec3 dy = vec3(0.0, texture2D(texture, vec2(coord.x, coord.y + delta.y)).r - info.r, delta.y);
        vec3 normal = normalize(cross(dy, dx));
        info.ba = normal.xz;
        
        gl_FragColor = info;
      }
    `

    return this.createShader(vertexSource, fragmentSource)
  }

  private createQuad(): WebGLBuffer {
    const gl = this.gl
    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW)
    return buffer
  }

  addDrop(x: number, y: number, radius: number, strength: number) {
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferB)
    gl.viewport(0, 0, this.size, this.size)

    gl.useProgram(this.dropShader)
    gl.bindTexture(gl.TEXTURE_2D, this.textureA)

    const centerLoc = gl.getUniformLocation(this.dropShader, 'center')
    const radiusLoc = gl.getUniformLocation(this.dropShader, 'radius')
    const strengthLoc = gl.getUniformLocation(this.dropShader, 'strength')
    const textureLoc = gl.getUniformLocation(this.dropShader, 'texture')

    if (centerLoc) gl.uniform2f(centerLoc, x, y)
    if (radiusLoc) gl.uniform1f(radiusLoc, radius)
    if (strengthLoc) gl.uniform1f(strengthLoc, strength)
    if (textureLoc) gl.uniform1i(textureLoc, 0)

    this.drawQuad()
    this.swapTextures()
  }

  stepSimulation() {
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferB)
    gl.viewport(0, 0, this.size, this.size)

    gl.useProgram(this.updateShader)
    gl.bindTexture(gl.TEXTURE_2D, this.textureA)

    const deltaLoc = gl.getUniformLocation(this.updateShader, 'delta')
    const textureLoc = gl.getUniformLocation(this.updateShader, 'texture')

    if (deltaLoc) gl.uniform2f(deltaLoc, 1 / this.size, 1 / this.size)
    if (textureLoc) gl.uniform1i(textureLoc, 0)

    this.drawQuad()
    this.swapTextures()
  }

  updateNormals() {
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferB)
    gl.viewport(0, 0, this.size, this.size)

    gl.useProgram(this.normalShader)
    gl.bindTexture(gl.TEXTURE_2D, this.textureA)

    const deltaLoc = gl.getUniformLocation(this.normalShader, 'delta')
    const textureLoc = gl.getUniformLocation(this.normalShader, 'texture')

    if (deltaLoc) gl.uniform2f(deltaLoc, 1 / this.size, 1 / this.size)
    if (textureLoc) gl.uniform1i(textureLoc, 0)

    this.drawQuad()
    this.swapTextures()
  }

  private drawQuad() {
    const gl = this.gl

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram
    const positionLoc = gl.getAttribLocation(currentProgram, 'position')
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private swapTextures() {
    [this.textureA, this.textureB] = [this.textureB, this.textureA];
    [this.framebufferA, this.framebufferB] = [this.framebufferB, this.framebufferA]
  }

  getTexture(): WebGLTexture {
    return this.textureA
  }

  dispose() {
    const gl = this.gl
    gl.deleteTexture(this.textureA)
    gl.deleteTexture(this.textureB)
    gl.deleteFramebuffer(this.framebufferA)
    gl.deleteFramebuffer(this.framebufferB)
    gl.deleteProgram(this.dropShader)
    gl.deleteProgram(this.updateShader)
    gl.deleteProgram(this.normalShader)
    gl.deleteBuffer(this.quadBuffer)
  }
}

// Water renderer class
class WaterRenderer {
  private gl: WebGLRenderingContext
  private renderShader: WebGLProgram
  private quadBuffer: WebGLBuffer

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl
    this.renderShader = this.createRenderShader()
    this.quadBuffer = this.createQuad()
  }

  private createShader(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vertexShader, vertexSource)
    gl.compileShader(vertexShader)

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fragmentShader, fragmentSource)
    gl.compileShader(fragmentShader)

    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    return program
  }

  private createRenderShader(): WebGLProgram {
    const vertexSource = `
      attribute vec2 position;
      varying vec2 coord;
      void main() {
        coord = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fragmentSource = `
      precision mediump float;
      uniform sampler2D waterTexture;
      uniform float time;
      varying vec2 coord;
      
      void main() {
        vec4 info = texture2D(waterTexture, coord);
        
        // Water height and normal
        float height = info.r;
        vec2 normal = info.ba;
        
        // Water material properties
        vec3 waterColor = vec3(1.0, 1.0, 1.0);  // Clear colorless water
        vec3 deepWaterColor = vec3(0.9, 0.9, 0.9);  // Slightly tinted deep water
        
        // Calculate water depth and transparency
        float depth = 1.0 - length(coord - 0.5) * 2.0;
        depth = clamp(depth, 0.0, 1.0);
        depth = smoothstep(0.0, 1.0, depth);
        
        // Water surface reflection with chromatic dispersion (enhanced normals)
         vec3 viewDir = normalize(vec3(coord - 0.5, 1.0));
         vec3 surfaceNormal = normalize(vec3(normal * 4.0, 1.0));
         float fresnel = pow(1.0 - max(0.0, dot(viewDir, surfaceNormal)), 3.0);
         
         // Chromatic dispersion - different refractive indices for RGB (enhanced)
         float dispersionStrength = 0.04;
         vec2 dispersionR = normal * (0.25 + dispersionStrength);
         vec2 dispersionG = normal * 0.25;
         vec2 dispersionB = normal * (0.25 - dispersionStrength);
         
         // Sample background with chromatic aberration
         vec2 refractedCoordR = coord + dispersionR;
         vec2 refractedCoordG = coord + dispersionG;
         vec2 refractedCoordB = coord + dispersionB;
         
         // Recalculate caustics for each color channel
         float causticsR = (sin(refractedCoordR.x * 20.0 + time * 2.0) * sin(refractedCoordR.y * 15.0 + time * 1.5) +
                           sin(refractedCoordR.x * 25.0 - time * 1.8) * sin(refractedCoordR.y * 18.0 - time * 2.2)) * 0.5;
         float causticsG = (sin(refractedCoordG.x * 20.0 + time * 2.0) * sin(refractedCoordG.y * 15.0 + time * 1.5) +
                           sin(refractedCoordG.x * 25.0 - time * 1.8) * sin(refractedCoordG.y * 18.0 - time * 2.2)) * 0.5;
         float causticsB = (sin(refractedCoordB.x * 20.0 + time * 2.0) * sin(refractedCoordB.y * 15.0 + time * 1.5) +
                           sin(refractedCoordB.x * 25.0 - time * 1.8) * sin(refractedCoordB.y * 18.0 - time * 2.2)) * 0.5;
         
         causticsR = smoothstep(-0.5, 0.5, causticsR);
         causticsG = smoothstep(-0.5, 0.5, causticsG);
         causticsB = smoothstep(-0.5, 0.5, causticsB);
         
         // Simple grid pattern with chromatic dispersion - no gradients
         vec2 gridCoordR = refractedCoordR * 12.0;
         vec2 gridCoordG = refractedCoordG * 12.0;
         vec2 gridCoordB = refractedCoordB * 12.0;
         
         vec2 gridPosR = fract(gridCoordR);
         vec2 gridPosG = fract(gridCoordG);
         vec2 gridPosB = fract(gridCoordB);
         
         // Simple border detection - no smoothstep gradients
         float borderWidthChromatic = 0.03;
         float borderR = max(step(gridPosR.x, borderWidthChromatic) + step(1.0 - borderWidthChromatic, gridPosR.x),
                            step(gridPosR.y, borderWidthChromatic) + step(1.0 - borderWidthChromatic, gridPosR.y));
         float borderG = max(step(gridPosG.x, borderWidthChromatic) + step(1.0 - borderWidthChromatic, gridPosG.x),
                            step(gridPosG.y, borderWidthChromatic) + step(1.0 - borderWidthChromatic, gridPosG.y));
         float borderB = max(step(gridPosB.x, borderWidthChromatic) + step(1.0 - borderWidthChromatic, gridPosB.x),
                            step(gridPosB.y, borderWidthChromatic) + step(1.0 - borderWidthChromatic, gridPosB.y));
         
         borderR = min(borderR, 1.0);
         borderG = min(borderG, 1.0);
         borderB = min(borderB, 1.0);
         
         // Pure colors - background or border, no mixing
         vec3 gridBg = vec3(0.412, 0.690, 0.675);  // #69B0AC
         vec3 gridBd = vec3(0.4, 0.6, 0.631);      // #6699A1
         
         vec3 backgroundColorDispersed;
         backgroundColorDispersed.r = (borderR > 0.5) ? gridBd.r + causticsR * 0.3 : gridBg.r + causticsR * 0.3;
         backgroundColorDispersed.g = (borderG > 0.5) ? gridBd.g + causticsG * 0.3 : gridBg.g + causticsG * 0.3;
         backgroundColorDispersed.b = (borderB > 0.5) ? gridBd.b + causticsB * 0.3 : gridBg.b + causticsB * 0.3;
         
         // Sky reflection with prismatic effect at edges
         vec3 skyColor = vec3(0.5, 0.7, 1.0);
         float edgeDistance = length(coord - 0.5);
         float prismEffect = smoothstep(0.3, 0.5, edgeDistance) * fresnel;
         
         // Add rainbow colors at high fresnel angles
         vec3 prismColors = vec3(
           0.5 + 0.5 * sin(fresnel * 10.0 + time + 0.0),
           0.5 + 0.5 * sin(fresnel * 10.0 + time + 2.094),
           0.5 + 0.5 * sin(fresnel * 10.0 + time + 4.188)
         );
         
         vec3 reflectionColor = mix(skyColor, prismColors, prismEffect * 0.6);
         
         // Water transparency based on depth and angle
         float transparency = mix(0.05, 0.2, depth) * (1.0 - fresnel * 0.7);
         
         // Mix dispersed background through water with water color
         vec3 underwaterColor = mix(backgroundColorDispersed, waterColor, transparency);
         underwaterColor = mix(underwaterColor, deepWaterColor, (1.0 - depth) * 0.1);
         
         // Add surface reflection with chromatic effects (reduced intensity)
         vec3 finalColor = mix(underwaterColor, reflectionColor, fresnel * 0.2);
        
        // Subtle ripple highlights on surface (reduced intensity)
        float rippleIntensity = abs(height) * 30.0;
        rippleIntensity = smoothstep(0.2, 0.8, rippleIntensity);
        vec3 rippleHighlight = vec3(0.9, 0.95, 1.0);
        finalColor = mix(finalColor, rippleHighlight, rippleIntensity * 0.15);
        
        // Add subtle foam effect at ripple peaks
        float foam = smoothstep(0.7, 1.0, rippleIntensity);
        finalColor = mix(finalColor, vec3(0.85, 0.9, 0.95), foam * 0.25);
        
        // Enhance water clarity and depth
        finalColor = mix(finalColor, waterColor, 0.02);
        
        // Final gamma correction
        finalColor = pow(finalColor, vec3(0.85));
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `

    return this.createShader(vertexSource, fragmentSource)
  }

  private createQuad(): WebGLBuffer {
    const gl = this.gl
    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW)
    return buffer
  }

  render(water: Water) {
    const gl = this.gl

    // Render to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.renderShader)
    gl.bindTexture(gl.TEXTURE_2D, water.getTexture())

    const waterTextureLoc = gl.getUniformLocation(this.renderShader, 'waterTexture')
    const timeLoc = gl.getUniformLocation(this.renderShader, 'time')

    if (waterTextureLoc) gl.uniform1i(waterTextureLoc, 0)
    if (timeLoc) gl.uniform1f(timeLoc, Date.now() * 0.001)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    const positionLoc = gl.getAttribLocation(this.renderShader, 'position')
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  dispose() {
    const gl = this.gl
    gl.deleteProgram(this.renderShader)
    gl.deleteBuffer(this.quadBuffer)
  }
}