'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface GridDistortionProps {
  /** Samples per axis of the displacement grid. */
  grid?: number;
  /** Mouse influence radius, in grid cells. */
  mouse?: number;
  /** Displacement gain. */
  strength?: number;
  /** Per-frame decay of the displacement field. */
  relaxation?: number;
  /** Source image; its intrinsic aspect drives the plane's scale. */
  imageSrc: string;
  className?: string;
  /**
   * Accepted and ignored: call sites pass it, and the loader never used it.
   * Declared so those call sites keep type-checking.
   */
  crossOrigin?: string;
}

const vertexShader = `
uniform float time;
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `
uniform sampler2D uDataTexture;
uniform sampler2D uTexture;
uniform vec4 resolution;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec4 offset = texture2D(uDataTexture, vUv);
  gl_FragColor = texture2D(uTexture, uv - 0.02 * offset.rg);
}`;

const GridDistortion = ({
  grid = 15,
  mouse = 0.1,
  strength = 0.15,
  relaxation = 0.9,
  imageSrc,
  className = ''
}: GridDistortionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageAspectRef = useRef(1);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(0, 0, 0, 0, -1000, 1000);
    camera.position.z = 2;

    const uniforms = {
      time: { value: 0 },
      resolution: { value: new THREE.Vector4() },
      uTexture: { value: null as THREE.Texture | null },
      uDataTexture: { value: null as THREE.DataTexture | null },
    };

    // Create and configure texture loader with proper settings
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageSrc, (texture) => {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.format = THREE.RGBAFormat;
      texture.generateMipmaps = false; // Prevent making texture immutable
      imageAspectRef.current = texture.image.width / texture.image.height;
      uniforms.uTexture.value = texture;
      handleResize();
    });

    const size = grid;
    const data = new Float32Array(4 * size * size);
    for (let i = 0; i < size * size; i++) {
      const stride = i * 4;
      data[stride] = 0;     // Initialize with zeros instead of random values
      data[stride + 1] = 0; // This prevents initial jitter
      data[stride + 2] = 0;
      data[stride + 3] = 1;
    }
    // The displacement field, written per texel in the animate loop. Three
    // types `DataTexture.image.data` as a union that does not include
    // `Float32Array`, and under `noUncheckedIndexedAccess` every read of it
    // would be `| undefined`. This is the same buffer the texture was built
    // from, named once so the loop never has to re-derive it.
    const field: Float32Array = data;

    const dataTexture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    dataTexture.needsUpdate = true;
    uniforms.uDataTexture.value = dataTexture;

    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(1, 1, size - 1, size - 1);
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    const handleResize = () => {
      if (!container) return;

      const width = container.offsetWidth;
      const height = container.offsetHeight;
      const containerAspect = width / height;
      const imageAspect = imageAspectRef.current;

      renderer.setSize(width, height);

      const scale = Math.max(containerAspect / imageAspect, 1);
      plane.scale.set(imageAspect * scale, scale, 1);

      const frustumHeight = 1;
      const frustumWidth = frustumHeight * containerAspect;
      camera.left = -frustumWidth / 2;
      camera.right = frustumWidth / 2;
      camera.top = frustumHeight / 2;
      camera.bottom = -frustumHeight / 2;
      camera.updateProjectionMatrix();

      uniforms.resolution.value.set(width, height, 1, 1);
    };

    const mouseState = { x: 0, y: 0, prevX: 0, prevY: 0, vX: 0, vY: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      mouseState.vX = x - mouseState.prevX;
      mouseState.vY = y - mouseState.prevY;
      Object.assign(mouseState, { x, y, prevX: x, prevY: y });
    };

    const handleMouseLeave = () => {
      dataTexture.needsUpdate = true;
      Object.assign(mouseState, { x: 0, y: 0, prevX: 0, prevY: 0, vX: 0, vY: 0 });
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);
    handleResize();

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      uniforms.time.value += 0.05;


      for (let i = 0; i < size * size; i++) {
        const stride = i * 4;
        field[stride] = (field[stride] ?? 0) * relaxation;
        field[stride + 1] = (field[stride + 1] ?? 0) * relaxation;
      }

      const gridMouseX = size * mouseState.x;
      const gridMouseY = size * mouseState.y;
      const maxDist = size * mouse;

      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const distance = Math.pow(gridMouseX - i, 2) + Math.pow(gridMouseY - j, 2);
          if (distance < maxDist * maxDist) {
            const index = 4 * (i + size * j);
            const power = Math.min(maxDist / Math.sqrt(distance + 0.1), 10); // Added small epsilon to prevent division by zero
            field[index] = (field[index] ?? 0) + strength * 100 * mouseState.vX * power;
            field[index + 1] = (field[index + 1] ?? 0) - strength * 100 * mouseState.vY * power;
          }
        }
      }

      dataTexture.needsUpdate = true;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      dataTexture.dispose();
      if (uniforms.uTexture.value) uniforms.uTexture.value.dispose();
      if (container && rendererRef.current?.domElement) {
        container.removeChild(rendererRef.current.domElement);
      }
    };
  }, [grid, mouse, strength, relaxation, imageSrc]);

  return <div ref={containerRef} className={`w-full h-full overflow-hidden rounded-lg ${className}`} />;
};

export default GridDistortion;
