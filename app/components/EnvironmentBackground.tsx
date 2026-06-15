'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ENVIRONMENT_BY_ID } from '../data/environments';
import { resolveAssetUrl } from '../lib/resolveAssetUrl';
import type { EnvironmentId } from '../types/environment';

interface EnvironmentBackgroundProps {
  environmentId: EnvironmentId;
  theme: number;
  chakraPhase: number;
}

const THEME_TINTS: Record<number, string> = {
  0: 'rgba(120, 90, 220, 0.22)',
  1: 'rgba(220, 160, 60, 0.20)',
  2: 'rgba(40, 140, 200, 0.22)',
  3: 'rgba(72, 202, 228, 0.20)',
};

const CHAKRA_TINTS: Record<number, string> = {
  0: 'rgba(34, 211, 238, 0.18)',
  1: 'rgba(168, 85, 247, 0.18)',
  2: 'rgba(251, 146, 60, 0.18)',
  3: 'rgba(139, 92, 246, 0.18)',
};

interface LayerState {
  id: EnvironmentId;
  visible: boolean;
}

const EnvironmentBackground: React.FC<EnvironmentBackgroundProps> = ({
  environmentId,
  theme,
  chakraPhase,
}) => {
  const [layers, setLayers] = useState<LayerState[]>([{ id: environmentId, visible: true }]);
  const prevIdRef = useRef(environmentId);

  useEffect(() => {
    if (environmentId === prevIdRef.current) return;
    prevIdRef.current = environmentId;

    // Cross-fade state machine: fade out existing layers, fade in the new one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayers((prev) => {
      const fading = prev.map((layer) => ({ ...layer, visible: false }));
      return [...fading, { id: environmentId, visible: false }];
    });

    const raf = requestAnimationFrame(() => {
      setLayers((prev) => {
        if (!prev.length) return prev;
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], visible: true };
        return next;
      });
    });

    const cleanup = window.setTimeout(() => {
      setLayers([{ id: environmentId, visible: true }]);
    }, 1400);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(cleanup);
    };
  }, [environmentId]);

  const env = ENVIRONMENT_BY_ID[environmentId];
  const themeTint = THEME_TINTS[theme] ?? THEME_TINTS[0];
  const chakraTint = CHAKRA_TINTS[chakraPhase] ?? CHAKRA_TINTS[0];

  const hasContent = layers.some((layer) => layer.id !== 'none');
  if (!hasContent) return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#05010a]" aria-hidden>
      {layers.map((layer, index) => {
        const layerEnv = ENVIRONMENT_BY_ID[layer.id];
        if (layer.id === 'none') return null;

        const tintStyle: React.CSSProperties = {};
        if (layerEnv.tintByTheme && layerEnv.tintByChakra) {
          tintStyle.background = `linear-gradient(160deg, ${themeTint}, transparent 55%, ${chakraTint})`;
        } else if (layerEnv.tintByTheme) {
          tintStyle.background = `radial-gradient(ellipse at 50% 30%, ${themeTint}, transparent 70%)`;
        } else if (layerEnv.tintByChakra) {
          tintStyle.background = `radial-gradient(ellipse at 50% 60%, ${chakraTint}, transparent 65%)`;
        }

        return (
          <div
            key={`${layer.id}-${index}`}
            className="absolute inset-0 transition-opacity duration-[1400ms] ease-in-out"
            style={{ opacity: layer.visible ? 1 : 0 }}
          >
            {layerEnv.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveAssetUrl(layerEnv.imageSrc)}
                alt=""
                draggable={false}
                className={`absolute inset-0 h-full w-full object-cover select-none pointer-events-none ${
                  layerEnv.kenBurns ? 'env-ken-burns' : ''
                }`}
                style={{
                  opacity: layerEnv.opacity,
                  mixBlendMode: layerEnv.blendMode,
                }}
              />
            ) : layerEnv.gradientCss ? (
              <div
                className={`absolute inset-0 ${layerEnv.kenBurns ? 'env-ken-burns' : ''}`}
                style={{
                  background: layerEnv.gradientCss,
                  opacity: layerEnv.opacity,
                  mixBlendMode: layerEnv.blendMode,
                }}
              />
            ) : null}

            {(layerEnv.tintByTheme || layerEnv.tintByChakra) && (
              <div
                className="absolute inset-0 pointer-events-none transition-colors duration-700"
                style={tintStyle}
              />
            )}

            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse at center, transparent 30%, rgba(5,1,10,0.55) 100%)',
              }}
            />
          </div>
        );
      })}

      {env && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.45) 100%)',
          }}
        />
      )}
    </div>
  );
};

export default EnvironmentBackground;
