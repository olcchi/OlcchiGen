"use client";

import { useEffect, useRef } from "react";
import { Dices } from 'lucide-react'

export default function Bubble() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Canvas configuration constants
    const CANVAS_SIZE = 400; // Canvas size
    const MIN_SHAPE_SIZE = 120; // Minimum shape size
    const MAX_SHAPE_SIZE = 200; // Maximum shape size
    const MAX_COLLISION_ATTEMPTS = 100; // Maximum attempts to prevent infinite loops
    const FALLBACK_RADIUS_RATIO = 0.2; // Fallback position radius ratio
    const FALLBACK_SIZE = 100; // Fallback shape size

    // Define color palette
    const colors = [
        '#FF7C4F',
        '#F3ABED',
        '#107DCB',
        // '#91989F',
        '#FFB11B',
        '#EEA9A9',
        '#FEDFE1',
        '#BEC23F'
    ];

    // Canvas initialization function
    const initializeCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas dimensions
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;

        // Randomly select a color from the array as background color
        const backgroundColorIndex = Math.floor(Math.random() * colors.length);
        const backgroundColor = colors[backgroundColorIndex];

        // Create color array excluding background color for shapes
        const availableColors = colors.filter((_, index) => index !== backgroundColorIndex);

        // Set background color
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Randomly shuffle available colors array to ensure different color assignments each time
        const shuffledColors = [...availableColors].sort(() => Math.random() - 0.5);

        // Define shape type interface
        interface Shape {
            centerX: number; // Shape center X coordinate
            centerY: number; // Shape center Y coordinate
            size: number;    // Shape size
            color: string;   // Shape color
            type: 'circle' | 'square' | 'triangle'; // Shape type: circle, square, triangle
            direction?: number; // Triangle direction: 0=up, 1=right, 2=down, 3=left
        }

        // Store all generated shapes
        const shapes: Shape[] = [];

        // Define available shape types
        const SHAPE_TYPES: ('circle' | 'square' | 'triangle')[] = ['circle', 'square', 'triangle'];

        // Generate a shape for each available color, using collision detection to ensure shapes don't overlap
        for (let i = 0; i < availableColors.length; i++) {
            let validPosition = false; // Whether a valid position is found
            let attempts = 0;          // Attempt counter
            let centerX: number = 0;   // Shape center X coordinate
            let centerY: number = 0;   // Shape center Y coordinate
            let shapeSize: number = 0; // Shape size

            // Randomly select shape type (circle, square, or triangle)
            const shapeType = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];

            // Try to find a position that doesn't overlap with existing shapes
            while (!validPosition && attempts < MAX_COLLISION_ATTEMPTS) {
                // Generate more diverse random sizes (between 80-220 pixels, increased variation range)
                const sizeVariation = 0.3 + Math.random() * 0.7; // 0.3-1.0 variation coefficient
                shapeSize = MIN_SHAPE_SIZE + sizeVariation * (MAX_SHAPE_SIZE - MIN_SHAPE_SIZE);

                // Generate random position, ensuring shape is completely within canvas
                const margin = shapeSize * 1.2; // Increase margin to avoid shapes being too close to edges
                centerX = margin + Math.random() * (CANVAS_SIZE - 2 * margin);
                centerY = margin + Math.random() * (CANVAS_SIZE - 2 * margin);

                // Check if current shape overlaps with existing shapes
                validPosition = true;
                for (const existingShape of shapes) {
                    const dx = centerX - existingShape.centerX;
                    const dy = centerY - existingShape.centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    // Increase minimum distance to reduce overlap, considering shape type effects
                    const minDistance = (shapeSize + existingShape.size) * 1.3;

                    // If distance is less than minimum distance, overlap occurs
                    if (distance < minDistance) {
                        validPosition = false;
                        break;
                    }
                }

                attempts++;
            }

            // If no valid position can be found, use fallback position strategy
            if (!validPosition) {
                // Calculate circular distribution fallback positions based on shape index
                const angle = (i * 2 * Math.PI) / availableColors.length;
                const fallbackRadius = CANVAS_SIZE * FALLBACK_RADIUS_RATIO;
                const fallbackPositions = {
                    x: CANVAS_SIZE * 0.5 + Math.cos(angle) * fallbackRadius,
                    y: CANVAS_SIZE * 0.5 + Math.sin(angle) * fallbackRadius
                };
                centerX = fallbackPositions.x;
                centerY = fallbackPositions.y;
                shapeSize = FALLBACK_SIZE; // Use smaller fallback size
            }

            // Add random direction property for triangles
            const triangleDirection = Math.floor(Math.random() * 4); // 0:up, 1:right, 2:down, 3:left

            // Add generated shape to array
            shapes.push({
                centerX,
                centerY,
                size: shapeSize,
                color: shuffledColors[i],
                type: shapeType,
                direction: shapeType === 'triangle' ? triangleDirection : 0 // Only triangles need direction
            });
        }



        // Noise generation configuration constants
        const NOISE_CONFIG = {
            DENSE_AREA_THRESHOLD: 0.6,    // Dense area threshold (inner 80%)
            BASE_NOISE_INTENSITY: 0.05,   // Base noise intensity
            MAX_NOISE_INTENSITY: 0.6     // Maximum noise intensity
        };

        /**
     * Calculate distance from point to shape edge
     * @param x Point's X coordinate
     * @param y Point's Y coordinate
     * @param shape Shape object
     * @returns Distance to edge, 0 means outside the shape
     */
        const getDistanceToShapeEdge = (x: number, y: number, shape: Shape): number => {
            const dx = x - shape.centerX; // X direction offset
            const dy = y - shape.centerY; // Y direction offset

            switch (shape.type) {
                case 'circle':
                    // Circle: calculate distance to center, then subtract radius
                    const circleDistance = Math.sqrt(dx * dx + dy * dy);
                    return Math.max(0, shape.size - circleDistance);

                case 'square':
                    // Square: calculate distance to nearest edge
                    const squareDistanceX = Math.max(0, shape.size - Math.abs(dx));
                    const squareDistanceY = Math.max(0, shape.size - Math.abs(dy));
                    return Math.min(squareDistanceX, squareDistanceY);

                case 'triangle':
                    // Equilateral triangle, supports four directions
                    const height = shape.size * Math.sqrt(3) / 2; // Triangle height
                    const direction = shape.direction || 0;

                    let vertices: { x: number, y: number }[] = [];

                    // Calculate triangle vertices based on direction
                    switch (direction) {
                        case 0: // Upward
                            vertices = [
                                { x: shape.centerX, y: shape.centerY - height * 2 / 3 }, // Top vertex
                                { x: shape.centerX - shape.size, y: shape.centerY + height * 1 / 3 }, // Bottom left
                                { x: shape.centerX + shape.size, y: shape.centerY + height * 1 / 3 }  // Bottom right
                            ];
                            break;
                        case 1: // Rightward
                            vertices = [
                                { x: shape.centerX + height * 2 / 3, y: shape.centerY }, // Right vertex
                                { x: shape.centerX - height * 1 / 3, y: shape.centerY - shape.size }, // Top left
                                { x: shape.centerX - height * 1 / 3, y: shape.centerY + shape.size }  // Bottom left
                            ];
                            break;
                        case 2: // Downward
                            vertices = [
                                { x: shape.centerX, y: shape.centerY + height * 2 / 3 }, // Bottom vertex
                                { x: shape.centerX - shape.size, y: shape.centerY - height * 1 / 3 }, // Top left
                                { x: shape.centerX + shape.size, y: shape.centerY - height * 1 / 3 }  // Top right
                            ];
                            break;
                        case 3: // Leftward
                            vertices = [
                                { x: shape.centerX - height * 2 / 3, y: shape.centerY }, // Left vertex
                                { x: shape.centerX + height * 1 / 3, y: shape.centerY - shape.size }, // Top right
                                { x: shape.centerX + height * 1 / 3, y: shape.centerY + shape.size }  // Bottom right
                            ];
                            break;
                    }

                    // Check if point is inside triangle
                    function isPointInTriangle(px: number, py: number, v0: { x: number, y: number }, v1: { x: number, y: number }, v2: { x: number, y: number }): boolean {
                        const denom = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);
                        const a = ((v1.y - v2.y) * (px - v2.x) + (v2.x - v1.x) * (py - v2.y)) / denom;
                        const b = ((v2.y - v0.y) * (px - v2.x) + (v0.x - v2.x) * (py - v2.y)) / denom;
                        const c = 1 - a - b;
                        return a >= 0 && b >= 0 && c >= 0;
                    }

                    if (!isPointInTriangle(x, y, vertices[0], vertices[1], vertices[2])) return 0;

                    // Calculate shortest distance to triangle edges
                    function distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
                        const A = px - x1;
                        const B = py - y1;
                        const C = x2 - x1;
                        const D = y2 - y1;

                        const dot = A * C + B * D;
                        const lenSq = C * C + D * D;
                        let param = -1;
                        if (lenSq !== 0) param = dot / lenSq;

                        let xx, yy;
                        if (param < 0) {
                            xx = x1;
                            yy = y1;
                        } else if (param > 1) {
                            xx = x2;
                            yy = y2;
                        } else {
                            xx = x1 + param * C;
                            yy = y1 + param * D;
                        }

                        const dx = px - xx;
                        const dy = py - yy;
                        return Math.sqrt(dx * dx + dy * dy);
                    }

                    const dist1 = distanceToLineSegment(x, y, vertices[0].x, vertices[0].y, vertices[1].x, vertices[1].y);
                    const dist2 = distanceToLineSegment(x, y, vertices[1].x, vertices[1].y, vertices[2].x, vertices[2].y);
                    const dist3 = distanceToLineSegment(x, y, vertices[2].x, vertices[2].y, vertices[0].x, vertices[0].y);

                    return Math.min(dist1, dist2, dist3);

                default:
                    return 0;
            }
        };

        // Draw noise shapes on background
        shapes.forEach(shape => {
            // Calculate shape's bounding box, ensuring it doesn't exceed canvas bounds
            const minX = Math.max(0, Math.floor(shape.centerX - shape.size));
            const maxX = Math.min(CANVAS_SIZE - 1, Math.floor(shape.centerX + shape.size));
            const minY = Math.max(0, Math.floor(shape.centerY - shape.size));
            const maxY = Math.min(CANVAS_SIZE - 1, Math.floor(shape.centerY + shape.size));

            // Use grid method to precisely control noise distribution
            // Iterate through each pixel point within the shape's bounding box
            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    // Calculate distance from current point to shape edge
                    const distanceToEdge = getDistanceToShapeEdge(x, y, shape);

                    // Only process points inside the shape (distance > 0)
                    if (distanceToEdge > 0) {
                        // Normalize distance: 0 means at edge, 1 means at center
                        const normalizedDistance = distanceToEdge / shape.size;

                        // Calculate noise intensity based on distance to edge
                        // Closer to edge = sparser noise (higher intensity)
                        // Closer to center = denser noise (lower intensity)
                        const edgeFactor = 1 - normalizedDistance;
                        let noiseIntensity;

                        if (normalizedDistance >= NOISE_CONFIG.DENSE_AREA_THRESHOLD) {
                            // Inner area: very dense noise
                            noiseIntensity = edgeFactor * edgeFactor * NOISE_CONFIG.BASE_NOISE_INTENSITY;
                        } else {
                            // Outer area: gradually sparse noise
                            const outerFactor = (NOISE_CONFIG.DENSE_AREA_THRESHOLD - normalizedDistance) / NOISE_CONFIG.DENSE_AREA_THRESHOLD;
                            noiseIntensity = NOISE_CONFIG.BASE_NOISE_INTENSITY + outerFactor * outerFactor * NOISE_CONFIG.MAX_NOISE_INTENSITY;
                        }

                        // Generate noise: draw pixel when random number is greater than or equal to noise intensity
                        if (Math.random() >= noiseIntensity) {
                            ctx.fillStyle = shape.color;
                            ctx.fillRect(x, y, 1, 1); // Draw 1x1 pixel
                        }
                    }
                }
            }
        });
    };

    useEffect(() => {
        initializeCanvas();
    }, []); // Empty dependency array ensures effect runs only once when component mounts

    return (
        <>
            {/* Component title */}
            <h1 className="text-sm font-mono font-bold mb-4">Bubble</h1>

            {/* Canvas container */}
            <div className="w-80 h-80 xl:w-100 xl:h-100 border border-black">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full cursor-pointer"
                    style={{ imageRendering: 'pixelated' }} // Maintain pixelated rendering effect
                    onClick={initializeCanvas} // Click canvas to reinitialize
                />
            </div>

            {/* Description text */}
            <p className="text-xs">
                也许是波普 / Maybe bubble
            </p>
            <button
                className="text-xs flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                onClick={initializeCanvas} // Click button to reinitialize
            >
                <Dices className="w-5 h-5" />
                <p>随机 / Random </p>
            </button>
        </>
    );
}