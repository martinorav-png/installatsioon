import { useId } from 'react';
import './DappledLight.css';

// Original SVG geometry, drawn from the supplied visual reference.
// Light, occlusion, depth and grain are separate layers; no images or WebGL.
const leaves = [
  [144, 174, 12, 1.25], [124, 224, -128, 1.04],
  [206, 237, 36, 1.18], [222, 249, 158, 1.13],
  [322, 268, 44, 1.26], [327, 272, 161, 1.04],
  [442, 294, 62, 1.32], [448, 300, 151, 0.94],
  [561, 322, 53, 0.96], [562, 328, 164, 0.91],
  [675, 356, 115, 1.08], [295, 400, 128, 0.94],
] as const;

const distantLeaves = [
  [68, 239, 4, 1.4], [187, 225, 130, 1.22],
  [280, 230, -29, 1.3], [300, 351, 99, 1.17],
  [118, 381, -25, 1.5], [316, 439, 76, 1.2],
] as const;

// CRTWarp's supplied phosphor() response: dimmer light loses green first,
// moving through deep violet before reaching the pink phosphor highlight.
const phosphor = [199 / 255, 85 / 255, 247 / 255] as const;
const phosphorExponent = (channel: number) => 1 + 0.7 * (1 - channel / phosphor[2]);

export function DappledLight() {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ref = (name: string) => `${name}-${id}`;
  const url = (name: string) => `url(#${ref(name)})`;

  return <div className="dappled-light" aria-hidden="true">
    <svg viewBox="0 0 1600 820" preserveAspectRatio="xMinYMid slice" focusable="false">
      <defs>
        <linearGradient id={ref('light')} x1="0" y1="0" x2="1050" y2="680" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.48" stopColor="#f3f3f3" />
          <stop offset="1" stopColor="#dddddd" />
        </linearGradient>
        <filter id={ref('phosphor')} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="gamma" amplitude={phosphor[0]} exponent={phosphorExponent(phosphor[0])} offset="0" />
            <feFuncG type="gamma" amplitude={phosphor[1]} exponent={phosphorExponent(phosphor[1])} offset="0" />
            <feFuncB type="gamma" amplitude={phosphor[2]} exponent={phosphorExponent(phosphor[2])} offset="0" />
          </feComponentTransfer>
        </filter>
        <filter id={ref('penumbra')} x="-35%" y="-45%" width="170%" height="190%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id={ref('bloom')} x="-40%" y="-50%" width="180%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="54" result="halo" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="22" result="window-interior" />
          <feComposite in="halo" in2="window-interior" operator="out" />
        </filter>
        <filter id={ref('near')} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={ref('far')} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id={ref('grain')} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch" seed="8" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.6" intercept="-0.3" />
            <feFuncG type="linear" slope="1.6" intercept="-0.3" />
            <feFuncB type="linear" slope="1.6" intercept="-0.3" />
            <feFuncA type="linear" slope="0" intercept="1" />
          </feComponentTransfer>
        </filter>
        <path id={ref('window')} d="M -425 -370 L 1125 350 L 780 795 L -700 -100 Z" />
        <path id={ref('leaf')} d="M 0 0 C -45 -17 -61 -76 0 -120 C 49 -91 48 -34 0 0 Z" />
        <mask id={ref('window-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="820">
          <g filter={url('penumbra')}>
            <use href={`#${ref('window')}`} fill="white" />
            <path d="M -440 -145 L 1000 535" fill="none" stroke="black" strokeWidth="47" />
            <path d="M 444 -220 L 95 330 L 410 710" fill="none" stroke="black" strokeWidth="34" strokeLinejoin="round" />
          </g>
        </mask>
      </defs>

      <g className="dappled-light__illumination">
        <use href={`#${ref('window')}`} fill="#3e54ed" opacity="0.58" filter={url('bloom')} />
      </g>

      <g filter={url('phosphor')}>
      <g className="dappled-light__illumination">
        <rect width="1600" height="820" fill={url('light')} mask={url('window-mask')} />
      </g>

      <g mask={url('window-mask')}>
        <g className="dappled-light__far" fill="#151515" opacity="0.20" filter={url('far')}>
          <path d="M -50 328 Q 154 315 354 477 M 70 328 Q 96 192 268 75" fill="none" stroke="#161616" strokeWidth="6" />
          {distantLeaves.map(([x, y, angle, scale], index) =>
            <use key={index} href={`#${ref('leaf')}`} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} />)}
        </g>
        <g className="dappled-light__branch" fill="#141414" opacity="0.36" filter={url('near')}>
          <g fill="none" stroke="#1b1b1b" strokeLinecap="round">
            <path d="M -80 273 Q 169 204 451 298 Q 587 324 675 356" strokeWidth="4.2" />
            <path d="M 55 247 Q 114 220 144 174 M 143 234 Q 225 171 331 116" strokeWidth="3.2" />
            <path d="M -28 183 Q 121 309 295 400 M 405 286 Q 546 308 561 322" strokeWidth="2.6" />
          </g>
          {leaves.map(([x, y, angle, scale], index) =>
            <g key={index} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
              <g className="dappled-light__leaf" style={{ animationDelay: `${-index * 1.7}s` }}>
                <use href={`#${ref('leaf')}`} />
              </g>
            </g>)}
        </g>
      </g>

      <rect className="dappled-light__grain" width="1600" height="820" filter={url('grain')} mask={url('window-mask')} />
      </g>
    </svg>
  </div>;
}
