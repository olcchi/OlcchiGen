"use client";

import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";

/**
 * Line Forward animation page - displays a 3D folding line with one end locked at screen center
 * Uses p5.js WEBGL renderer for 3D effects
 */
export default function Maze() {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<import('p5') | null>(null);
  const [zoomValue, setZoomValue] = useState([1.0]);
  const zoomLevelRef = useRef(1.0);
  const updateOrthographicProjectionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Dynamically import p5.js to avoid SSR issues
    const loadLibraries = async () => {
      const p5 = (await import("p5")).default;

      if (!containerRef.current) return;

      const sketch = (p: import('p5')) => {
        // Animation parameters
        const moveSpeed = 3;
        const stepsBeforeTurn = 20; // steps before turning

        // Current position and direction of the line head
        let headPosition = { x: 0, y: 0, z: 0 };
        let direction = { x: 1, y: 0, z: 0 };

        // Key points array to store only turning points and segment endpoints
        let keyPoints: { x: number; y: number; z: number }[] = [];

        // Direction change parameters
        let stepCounter = 0;

        // Zoom control
        const minZoom = 0.1;
        const maxZoom = 5.0;
        const zoomSpeed = 0.1;

        // Possible 90-degree directions in 3D space
        const possibleDirections = [
          { x: 1, y: 0, z: 0 },   // +X
          { x: -1, y: 0, z: 0 },  // -X
          { x: 0, y: 1, z: 0 },   // +Y
          { x: 0, y: -1, z: 0 },  // -Y
          { x: 0, y: 0, z: 1 },   // +Z
          { x: 0, y: 0, z: -1 }   // -Z
        ];

        p.setup = () => {
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            p.createCanvas(rect.width, rect.height, p.WEBGL);
          } else {
            p.createCanvas(480, 360, p.WEBGL);
          }

          // Use orthographic projection for isometric view
          updateOrthographicProjection();

          // Initialize trail
          initializeTrail();
        };

        const updateOrthographicProjection = () => {
          const orthoSize = 200 / zoomLevelRef.current;
          p.ortho(-orthoSize, orthoSize, -orthoSize, orthoSize, -1000, 1000);
        };

        // Expose updateOrthographicProjection to external scope
        updateOrthographicProjectionRef.current = updateOrthographicProjection;

        const initializeTrail = () => {
          keyPoints = [];
          headPosition = { x: 0, y: 0, z: 0 };
          // Start with a random 90-degree direction
          const randomIndex = Math.floor(Math.random() * possibleDirections.length);
          direction = { ...possibleDirections[randomIndex] };
          stepCounter = 0;
          // Add initial point
          keyPoints.push({ ...headPosition });
        };

        const updateMovement = () => {
          // Update step counter
          stepCounter++;

          // Change direction after fixed number of steps with 90-degree turns
          if (stepCounter >= stepsBeforeTurn) {
            // Add current position as a key point (end of current segment)
            keyPoints.push({ ...headPosition });
            
            // Filter out the opposite direction to avoid going backwards
            const oppositeDirection = { x: -direction.x, y: -direction.y, z: -direction.z };
            const validDirections = possibleDirections.filter(dir =>
              !(dir.x === oppositeDirection.x && dir.y === oppositeDirection.y && dir.z === oppositeDirection.z)
            );

            // Choose a random direction from valid directions (no backtracking)
            const randomIndex = Math.floor(Math.random() * validDirections.length);
            direction = { ...validDirections[randomIndex] };

            stepCounter = 0;
            
            // Keep all segments for complete trail history
          }

          // Move head position in current direction
          headPosition.x += direction.x * moveSpeed;
          headPosition.y += direction.y * moveSpeed;
          headPosition.z += direction.z * moveSpeed;
        };

        const drawTrail = () => {
          if (keyPoints.length < 1) return;

          p.stroke(0); // Black line
          p.strokeWeight(2);
          p.noFill();

          // Draw line segments connecting key points
          p.beginShape();
          p.noFill();
          
          // Draw all key points
          for (let i = 0; i < keyPoints.length; i++) {
            const point = keyPoints[i];
            // Transform point relative to head position (head is always at origin)
            const relativeX = point.x - headPosition.x;
            const relativeY = point.y - headPosition.y;
            const relativeZ = point.z - headPosition.z;
            p.vertex(relativeX, relativeY, relativeZ);
          }
          
          // Draw current segment from last key point to current head position
          if (keyPoints.length > 0) {
            const relativeX = 0; // Head is always at origin
            const relativeY = 0;
            const relativeZ = 0;
            p.vertex(relativeX, relativeY, relativeZ);
          }
          
          p.endShape();
        };

        p.draw = () => {
          p.background(255);

          // Update movement and trail
          updateMovement();

          // Set camera to 45-degree isometric view
          p.camera(
            100, -100, 100,  // camera position (45-degree angle)
            0, 0, 0,          // look at center
            0, 1, 0           // up vector
          );

          // Draw the simple line trail
          drawTrail();

          // Basic lighting
          p.ambientLight(200);
        };

        p.mouseWheel = (event: { delta: number }) => {
          // Handle mouse wheel zoom
          const delta = event.delta;
          if (delta > 0) {
            zoomLevelRef.current = Math.max(minZoom, zoomLevelRef.current - zoomSpeed);
          } else {
            zoomLevelRef.current = Math.min(maxZoom, zoomLevelRef.current + zoomSpeed);
          }
          setZoomValue([zoomLevelRef.current]);
          updateOrthographicProjection();
          return false; // Prevent page scrolling
        };

        p.windowResized = () => {
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            p.resizeCanvas(rect.width, rect.height);
            // Reset orthographic projection for new canvas size
            updateOrthographicProjection();
            initializeTrail();
          }
        };
      };

      // Create p5 instance
      p5InstanceRef.current = new p5(sketch, containerRef.current);
    };

    loadLibraries();

    // Cleanup function
    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  }, []);

  // Update zoom level when slider changes
  useEffect(() => {
    zoomLevelRef.current = zoomValue[0];
    // Trigger orthographic projection update
    if (updateOrthographicProjectionRef.current) {
      updateOrthographicProjectionRef.current();
    }
  }, [zoomValue]);

  // Handle zoom change from slider
  const handleZoomChange = (value: number[]) => {
    setZoomValue(value);
    zoomLevelRef.current = value[0];
  };

  return (
    <>
      <h1 className="text-sm font-mono font-bold mb-4">Maze</h1>
      <div className="w-80 h-80 xl:w-100 xl:h-100 border border-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>
      <div className="w-full max-w-xs mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-mono text-gray-600">缩放/zoom</label>
          <span className="text-xs font-mono text-gray-600">{zoomValue[0].toFixed(1)}x</span>
        </div>
        <Slider
          value={zoomValue}
          onValueChange={handleZoomChange}
          min={0.5}
          max={5.0}
          step={0.1}
          className="w-full"
        />
      </div>
    </>
  );
}