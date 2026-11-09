import { useId, useState, type ReactNode } from 'react';

// A smooth displacement field bends the whole image like convex glass.
// It is generated once and shared by the three phosphor channels.
function createCurvatureMap(): string | undefined {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  const image = context.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const horizontal = (x / (size - 1)) * 2 - 1;
      const vertical = (y / (size - 1)) * 2 - 1;
      const radius = (horizontal ** 2 + vertical ** 2) / 2;
      const offset = (y * size + x) * 4;
      image.data[offset] = Math.round(127.5 + 127.5 * horizontal * radius);
      image.data[offset + 1] = Math.round(127.5 + 127.5 * vertical * radius);
      image.data[offset + 2] = 128;
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function CrtScreen({ children }: { children: ReactNode }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const curve = `crt-curve-${id}`;
  const edge = `crt-edge-${id}`;
  const [map] = useState(createCurvatureMap);

  return <div className="crt-screen" style={{ clipPath: `url(#${edge})` }}>
    <svg className="crt-optics" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={edge} clipPathUnits="objectBoundingBox">
          <path d="M .075 .025 C .32 -.002 .68 -.002 .925 .025 C .953 .028 .965 .045 .973 .085 C 1.002 .32 1.002 .68 .973 .915 C .965 .955 .953 .972 .925 .975 C .68 1.002 .32 1.002 .075 .975 C .047 .972 .035 .955 .027 .915 C -.002 .68 -.002 .32 .027 .085 C .035 .045 .047 .028 .075 .025 Z" />
        </clipPath>
        {map && <filter id={curve} x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
          <feImage href={map} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="curvature" />
          {/* Different beam convergence gives the glass a colored fringe. */}
          <feDisplacementMap in="SourceGraphic" in2="curvature" scale="0.054" xChannelSelector="R" yChannelSelector="G" result="red-curve" />
          <feOffset in="red-curve" dx="0.0012" result="red-offset" />
          <feColorMatrix in="red-offset" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
          <feDisplacementMap in="SourceGraphic" in2="curvature" scale="0.045" xChannelSelector="R" yChannelSelector="G" result="green-curve" />
          <feColorMatrix in="green-curve" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
          <feDisplacementMap in="SourceGraphic" in2="curvature" scale="0.036" xChannelSelector="R" yChannelSelector="G" result="blue-curve" />
          <feOffset in="blue-curve" dx="-0.0012" result="blue-offset" />
          <feColorMatrix in="blue-offset" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
          <feBlend in="red" in2="green" mode="screen" result="red-green" />
          <feBlend in="red-green" in2="blue" mode="screen" />
        </filter>}
      </defs>
    </svg>
    <div className="crt-content" style={{ filter: map ? `url(#${curve})` : undefined }}>
      {children}
    </div>
    <div className="crt-raster" aria-hidden="true" />
  </div>;
}
