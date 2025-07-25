"use client";

import { useEffect, useRef, useMemo } from "react";

/**
 * Rust Diffusion animation page - simulates rust spreading using cellular automata
 * Based on pixel-level rust intensity matrix for realistic rust growth patterns
 */
export default function RustDiffusion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Vector type
  type Vector = [number, number];

  // Animation state
  const tickRef = useRef(0);
  const maxTicks = 5000;
  const iterations = 3;
  const animationStarted = useRef(false);

  // Color palette for rust effect (RGB values) - memoized to prevent re-renders
  const rustPalette = useMemo(() => [
    [255, 255, 255], // White
    [247, 235, 190], // Light cream
    [242, 211, 153], // Beige
    [242, 172, 87],  // Light orange
    [242, 127, 61],  // Orange  
    [140, 65, 48],   // Dark brown
    [89, 42, 42],    // Dark red-brown
  ], []);

  // Color palette for moss effect - memoized to prevent re-renders
  const mossPalette = useMemo(() => [
    [200, 220, 180], // Light moss green
    [180, 200, 160], // Pale moss
    [160, 180, 140], // Medium light moss
    [140, 160, 120], // Medium moss
    [120, 140, 100], // Medium dark moss
    [100, 120, 80],  // Dark moss
    [80, 100, 60],   // Deep moss
    [60, 80, 40],    // Darkest moss
  ] as [number, number, number][], []);


  // Utility functions
  const { trunc } = Math;
  const random = (min = 0, max = 1) => Math.random() * (max - min) + min;
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);

  // Sample size function (simplified lodash sampleSize)
  const sampleSize = <T,>(array: T[], size: number): T[] => {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
  };

  // Color interpolation function
  const colorInterpolation = (palette: number[][], value: number): [number, number, number] => {
    const clampedValue = Math.max(0, Math.min(1, value));
    const scaledValue = clampedValue * (palette.length - 1);
    const index = Math.floor(scaledValue);
    const fraction = scaledValue - index;

    if (index >= palette.length - 1) {
      return palette[palette.length - 1] as [number, number, number];
    }

    const color1 = palette[index];
    const color2 = palette[index + 1];

    return [
      Math.round(color1[0] + (color2[0] - color1[0]) * fraction),
      Math.round(color1[1] + (color2[1] - color1[1]) * fraction),
      Math.round(color1[2] + (color2[2] - color1[2]) * fraction),
    ];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size - reduced for better performance
    const width = 400;
    const height = 400;
    canvas.width = width;
    canvas.height = height;

    // Create image data for pixel manipulation
    const imageData = ctx.createImageData(width, height);

    // Initialize rustness matrix
    let rustness = range(width).map(() =>
      Array.from({ length: height }, () => 0)
    );

    // Boundary check function
    const inbound = ([x, y]: Vector) => x >= 0 && x < width && y >= 0 && y < height;

    // Generate random vectors
    const randomVectors = (n = 5): Vector[] => {
      return range(n).map(() => [trunc(random(0, width)), trunc(random(0, height))]);
    };

    // Track dirty regions for optimized rendering
    const dirtyRegions = new Set<string>();

    // Update canvas with current rustness data (optimized)
    const updateCanvas = () => {
      // Full update for initial render or when too many dirty regions
      if (dirtyRegions.size === 0 || dirtyRegions.size > width * height * 0.05) {
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            const rust = rustness[x][y];
            const [r, g, b] = colorInterpolation(rustPalette, rust);

            const pixelIndex = (y * width + x) * 4;
            imageData.data[pixelIndex] = r;     // Red
            imageData.data[pixelIndex + 1] = g; // Green
            imageData.data[pixelIndex + 2] = b; // Blue
            imageData.data[pixelIndex + 3] = 255; // Alpha
          }
        }
        dirtyRegions.clear();
      } else {
        // Update only dirty regions
        dirtyRegions.forEach(key => {
          const [x, y] = key.split(',').map(Number);
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const rust = rustness[x][y];
            const [r, g, b] = colorInterpolation(rustPalette, rust);

            const pixelIndex = (y * width + x) * 4;
            imageData.data[pixelIndex] = r;     // Red
            imageData.data[pixelIndex + 1] = g; // Green
            imageData.data[pixelIndex + 2] = b; // Blue
            imageData.data[pixelIndex + 3] = 255; // Alpha
          }
        });
        dirtyRegions.clear();
      }

      ctx.putImageData(imageData, 0, 0);
    };

    // Clear rust function
    const clear = () => {
      rustness = rustness.map(col => col.map(() => 0));
      dirtyRegions.clear();
      updateCanvas();
    };

    // Stain class for rust growth
    class Stain {
      constructor(
        public activePoints: Vector[],
        public iterations: number = 5
      ) { }

      next() {
        if (!this.iterations) {
          // Check if there are still unrusted areas
          const hasUnrustedAreas = rustness.some(col => col.some(cell => cell < 0.9));
          if (hasUnrustedAreas) {
            // Reset iterations to continue spreading
            this.iterations = 50;
            // Add random points to ensure coverage
            const randomPoints = range(5).map(() => [
              trunc(random(0, width)),
              trunc(random(0, height))
            ] as Vector).filter(([x, y]) => rustness[x][y] < 0.5);
            this.activePoints.push(...randomPoints);
          } else {
            return;
          }
        }
        this.iterations -= 1;

        const newPoints: Vector[] = [];

        this.activePoints.forEach((point) => {
          const [x, y] = point;

          // Add rust intensity to current point
          if (inbound([x, y])) {
            rustness[x][y] = Math.min(1, rustness[x][y] + random(0.05, 0.15));
            dirtyRegions.add(`${x},${y}`);
          }

          // Get neighboring points (8-directional)
          const points: Vector[] = [
            [x, y],
            [x, y + 1],
            [x + 1, y],
            [x, y - 1],
            [x - 1, y],
            [x + 1, y + 1],
            [x + 1, y - 1],
            [x - 1, y + 1],
            [x - 1, y - 1],
          ];

          // Filter and add valid new points
          newPoints.push(
            ...points
              .filter(v => !newPoints.some(n => n[0] === v[0] && n[1] === v[1]))
              .filter(v => inbound(v))
              .filter(([px, py]) => {
                const currentRust = rustness[px][py];
                if (currentRust === 0) return true;
                if (currentRust >= 1) return false;
                // Increase probability to ensure complete coverage
                if (currentRust > 0.8) return random() > 0.3;
                else return random() > 0.1;
              })
          );
        });

        // Limit active points but allow more for better coverage
        this.activePoints = sampleSize(newPoints, Math.min(100, newPoints.length));
      }
    }

    let stains: Stain[] = [];

    // Animation frame function
    const frame = () => {
      tickRef.current += 1;

      // Update stains with reduced frequency
      for (let i = 0; i < iterations; i++) {
        stains.forEach((stain) => {
          stain.next();
        });
      }

      updateCanvas();

      // Continue animation if not finished
      if (tickRef.current < maxTicks) {
        animationRef.current = requestAnimationFrame(frame);
      }
    };

    // Start function
    const start = (initialPoint?: Vector) => {
      tickRef.current = 0;
      animationStarted.current = true;

      // Cancel existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      clear();

      // Create stain sources - start from user click point if provided
      if (initialPoint) {
        stains = [
          new Stain([initialPoint], maxTicks * iterations),
        ];
      } else {
        // Default stain sources for restart
        stains = [
          new Stain([
            [0, trunc(random(0, height))],
            [trunc(random(0, width)), 0],
            [width - 1, trunc(random(0, height))],
            [trunc(random(0, width)), height - 1],
          ], maxTicks * iterations),
          new Stain(randomVectors(10), Math.floor(maxTicks * iterations / 2)),
          new Stain(randomVectors(1), Math.floor(maxTicks * iterations / 1.5)),
        ];
      }

      // Start animation
      animationRef.current = requestAnimationFrame(frame);
    };

    // Handle canvas click
    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(event.clientX - rect.left);
      const y = Math.floor(event.clientY - rect.top);

      if (x >= 0 && x < width && y >= 0 && y < height) {
        // If animation hasn't started yet, start from click point
        if (!animationStarted.current) {
          start([x, y]);
        } else if (tickRef.current >= maxTicks) {
          // If animation is complete, restart
          start();
        } else {
          // Add new stain at click location
          const newStain = new Stain(
            [[x, y]],
            Math.floor(maxTicks * iterations / 3)
          );
          stains.push(newStain);
        }
      }
    };

    // Add event listener
    canvas.addEventListener('click', handleClick);

    // Initialize canvas but don't start animation
    clear();

    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      canvas.removeEventListener('click', handleClick);
    };
  }, [rustPalette, mossPalette, trunc]);



  return (
    <>
      <h1 className="text-sm font-mono font-bold mb-4">Rust Diffusion</h1>
      <div className="w-80 h-80 xl:w-100 xl:h-100 border border-black">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      <div className="text-xs font-mono text-gray-500 mt-2">
        点击选择锈源 / Click to select rust sources
      </div>
    </>
  );
}