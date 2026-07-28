"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
import {
  targetsConfig,
  variantLabels,
  type TargetConfig,
  type VariantKey,
} from "@/lib/targets.config";

const round = (n: number) => Math.round(n * 1000) / 1000;

// The overlay is always coplanar with the print (see targets.config.ts), so
// only x / y / scale are calibrated. z and rotationY stay 0.
type LiveValues = {
  x: number;
  y: number;
  scale: number;
};

const toLiveValues = (c: TargetConfig): LiveValues => ({
  x: c.offset.x,
  y: c.offset.y,
  scale: c.scale,
});

// Calibration tweaks persist per-device in localStorage so they survive reloads
// while you tune. This never leaves the browser — to make values permanent, copy
// the config snippet and paste it into lib/targets.config.ts.
const STORAGE_KEY = "ar-calibration-v1";

function loadStoredValues(): LiveValues[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveValues[];
    if (!Array.isArray(parsed) || parsed.length !== targetsConfig.length) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function initialValues(): LiveValues[] {
  const stored = loadStoredValues();
  return targetsConfig.map((c, i) => stored?.[i] ?? toLiveValues(c));
}

/** Build a targets.config.ts-ready snippet from the current values. */
function buildSnippet(values: LiveValues[]): string {
  const entries = targetsConfig
    .map((c, i) => {
      const v = values[i];
      return `  {
    targetIndex: ${c.targetIndex},
    variants: {
      a: ${JSON.stringify(c.variants.a)},
      b: ${JSON.stringify(c.variants.b)},
    },
    offset: { x: ${round(v.x)}, y: ${round(v.y)}, z: 0 },
    scale: ${round(v.scale)},
    rotationY: 0,
  },`;
    })
    .join("\n");
  return `export const targetsConfig: TargetConfig[] = [\n${entries}\n];`;
}

export default function ARScene({
  calibrate = false,
  initialVariant = "a",
}: {
  calibrate?: boolean;
  initialVariant?: VariantKey;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mutable, per-target working values (edited live in calibration mode).
  // Seeded from any calibration saved on this device.
  const valuesRef = useRef<LiveValues[]>(initialValues());
  // Mesh + material per target index, so calibration and variant swaps can
  // update them directly without re-running the effect.
  const meshesRef = useRef<Array<THREE.Mesh | null>>(
    targetsConfig.map(() => null)
  );
  const materialsRef = useRef<Array<THREE.MeshBasicMaterial | null>>(
    targetsConfig.map(() => null)
  );
  // Cache loaded textures by src so toggling A/B doesn't refetch.
  const textureCacheRef = useRef<Map<string, THREE.Texture>>(new Map());
  const variantRef = useRef<VariantKey>(initialVariant);

  const [error, setError] = useState<string | null>(null);
  const [trackedIndex, setTrackedIndex] = useState<number | null>(null);
  const [variant, setVariant] = useState<VariantKey>(initialVariant);
  const [live, setLive] = useState<LiveValues[]>(() => valuesRef.current);
  const [loggedText, setLoggedText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(true);

  /** Apply the current working values for a target onto its mesh. */
  const applyToMesh = useCallback((index: number) => {
    const mesh = meshesRef.current[index];
    if (!mesh) return;
    const v = valuesRef.current[index];
    const aspect = (mesh.userData.aspect as number) || 1;
    // Always coplanar with the print: z = 0, no rotation.
    mesh.position.set(v.x, v.y, 0);
    mesh.rotation.set(0, 0, 0);
    // Target image is 1 unit wide; keep the avatar's aspect ratio.
    mesh.scale.set(v.scale, v.scale * aspect, 1);
  }, []);

  /** Load (or reuse) the texture for a target's active variant and show it. */
  const applyVariant = useCallback(
    (index: number, key: VariantKey) => {
      const material = materialsRef.current[index];
      const mesh = meshesRef.current[index];
      if (!material || !mesh) return;

      const src = targetsConfig[index].variants[key];

      const setTexture = (texture: THREE.Texture) => {
        // Guard against a stale async load if the variant changed again.
        if (variantRef.current !== key) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        material.map = texture;
        material.needsUpdate = true;
        const img = texture.image as { width: number; height: number };
        if (img?.width) {
          mesh.userData.aspect = img.height / img.width;
        }
        applyToMesh(index);
      };

      const cached = textureCacheRef.current.get(src);
      if (cached) {
        setTexture(cached);
        return;
      }
      new THREE.TextureLoader().load(src, (texture) => {
        textureCacheRef.current.set(src, texture);
        setTexture(texture);
      });
    },
    [applyToMesh]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mindarThree: MindARThree | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        mindarThree = new MindARThree({
          container,
          imageTargetSrc: "/targets.mind",
          maxTrack: 2,
        });

        const { renderer, scene, camera } = mindarThree;

        targetsConfig.forEach((config) => {
          const anchor = mindarThree!.addAnchor(config.targetIndex);

          const geometry = new THREE.PlaneGeometry(1, 1);
          const material = new THREE.MeshBasicMaterial({
            transparent: true,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.userData.aspect = 1;

          meshesRef.current[config.targetIndex] = mesh;
          materialsRef.current[config.targetIndex] = material;
          applyToMesh(config.targetIndex);
          applyVariant(config.targetIndex, variantRef.current);
          anchor.group.add(mesh);

          anchor.onTargetFound = () => setTrackedIndex(config.targetIndex);
          anchor.onTargetLost = () =>
            setTrackedIndex((current) =>
              current === config.targetIndex ? null : current
            );
        });

        await mindarThree.start();
        if (cancelled) {
          mindarThree.stop();
          return;
        }

        renderer.setAnimationLoop(() => {
          renderer.render(scene, camera);
        });
      } catch (err) {
        console.error("Failed to start AR:", err);
        if (cancelled) return;
        const name = (err as { name?: string })?.name;
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError(
            "Camera access was denied. Please allow camera access in your browser settings and reload this page."
          );
        } else if (name === "NotFoundError") {
          setError("No camera was found on this device.");
        } else {
          setError(
            "Could not start the camera. Make sure this page is served over HTTPS and that /targets.mind exists, then reload."
          );
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      try {
        mindarThree?.renderer.setAnimationLoop(null);
        mindarThree?.stop();
      } catch {
        // ignore teardown errors
      }
    };
  }, [applyToMesh, applyVariant]);

  /** Select the global variant and swap every target's texture live. */
  const selectVariant = (next: VariantKey) => {
    variantRef.current = next;
    setVariant(next);
    targetsConfig.forEach((c) => applyVariant(c.targetIndex, next));
  };

  /** Save the current working values to this device's localStorage. */
  const persist = () => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(valuesRef.current)
      );
    } catch {
      // storage may be unavailable (private mode, etc.) — ignore
    }
  };

  /** Update one field of the currently tracked target, live. */
  const updateValue = (field: keyof LiveValues, value: number) => {
    if (trackedIndex === null) return;
    valuesRef.current[trackedIndex] = {
      ...valuesRef.current[trackedIndex],
      [field]: value,
    };
    setLive((prev) => {
      const next = [...prev];
      next[trackedIndex] = valuesRef.current[trackedIndex];
      return next;
    });
    applyToMesh(trackedIndex);
    persist();
  };

  /** Print the config snippet to the console and show it on screen. */
  const logConfig = () => {
    const snippet = buildSnippet(valuesRef.current);
    // eslint-disable-next-line no-console
    console.log(snippet);
    setLoggedText(snippet);
  };

  /** Copy the config snippet to the clipboard (for pasting into the repo). */
  const copyConfig = async () => {
    const snippet = buildSnippet(valuesRef.current);
    setLoggedText(snippet);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the snippet is still shown below to copy manually
      setCopied(false);
    }
  };

  /** Clear saved calibration on this device and revert to the file defaults. */
  const resetConfig = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    valuesRef.current = targetsConfig.map(toLiveValues);
    setLive(valuesRef.current.map((v) => ({ ...v })));
    targetsConfig.forEach((c) => applyToMesh(c.targetIndex));
    setLoggedText(null);
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* MindAR injects the camera <video> and WebGL <canvas> into this container. */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Back link */}
      <Link
        href="/"
        className="absolute left-4 top-4 z-20 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur"
      >
        ← Back
      </Link>

      {/* Variant picker (Nate / Alissa) */}
      {!error && (
        <VariantDropdown variant={variant} onSelect={selectVariant} />
      )}

      {/* Camera error */}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 p-6">
          <div className="max-w-sm space-y-4 text-center">
            <h2 className="text-lg font-semibold text-white">Camera unavailable</h2>
            <p className="text-sm text-neutral-300">{error}</p>
            <Link
              href="/"
              className="inline-block rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
            >
              Go back
            </Link>
          </div>
        </div>
      )}

      {/* Calibration panel (with a show/hide-tools toggle) */}
      {calibrate && !error && toolsVisible && (
        <CalibrationPanel
          trackedIndex={trackedIndex}
          values={trackedIndex !== null ? live[trackedIndex] : null}
          onChange={updateValue}
          onLog={logConfig}
          onCopy={copyConfig}
          onReset={resetConfig}
          onHide={() => setToolsVisible(false)}
          copied={copied}
          loggedText={loggedText}
        />
      )}

      {/* Floating "show tools" button when the panel is hidden */}
      {calibrate && !error && !toolsVisible && (
        <button
          onClick={() => setToolsVisible(true)}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur active:scale-95"
        >
          <span aria-hidden>⤢</span> Show tools
        </button>
      )}
    </div>
  );
}

function VariantDropdown({
  variant,
  onSelect,
}: {
  variant: VariantKey;
  onSelect: (v: VariantKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(variantLabels) as VariantKey[];

  return (
    <div className="absolute right-4 top-4 z-20 w-40 text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-full bg-black/60 px-4 py-2 font-medium text-white backdrop-blur active:scale-[0.98]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{variantLabels[variant]}</span>
        <span aria-hidden className="ml-2 text-white/70">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="mt-2 overflow-hidden rounded-2xl border border-white/15 bg-black/80 backdrop-blur"
        >
          {keys.map((k) => {
            const active = k === variant;
            return (
              <li key={k} role="option" aria-selected={active}>
                <button
                  onClick={() => {
                    onSelect(k);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left text-white active:bg-white/10 ${
                    active ? "bg-white/10 font-semibold" : "font-medium"
                  }`}
                >
                  <span className="truncate">{variantLabels[k]}</span>
                  {active && <span aria-hidden>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CalibrationPanel({
  trackedIndex,
  values,
  onChange,
  onLog,
  onCopy,
  onReset,
  onHide,
  copied,
  loggedText,
}: {
  trackedIndex: number | null;
  values: LiveValues | null;
  onChange: (field: keyof LiveValues, value: number) => void;
  onLog: () => void;
  onCopy: () => void;
  onReset: () => void;
  onHide: () => void;
  copied: boolean;
  loggedText: string | null;
}) {
  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 mx-auto max-w-sm rounded-2xl border border-white/15 bg-black/70 p-4 text-white backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
          Calibration
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/70">
            {trackedIndex === null
              ? "No target in view"
              : `Editing target ${trackedIndex}`}
          </span>
          <button
            onClick={onHide}
            className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white active:scale-95"
            aria-label="Hide tools for full-screen camera"
          >
            ⤢ Hide
          </button>
        </div>
      </div>

      {values === null ? (
        <p className="text-sm text-white/60">
          Point the camera at a target to edit its avatar placement.
        </p>
      ) : (
        <div className="space-y-2">
          <Slider
            label="x (right/left)"
            value={values.x}
            min={-1}
            max={1}
            step={0.01}
            onChange={(v) => onChange("x", v)}
          />
          <Slider
            label="y (up/down)"
            value={values.y}
            min={-1}
            max={1}
            step={0.01}
            onChange={(v) => onChange("y", v)}
          />
          <Slider
            label="scale"
            value={values.scale}
            min={0.05}
            max={3}
            step={0.01}
            onChange={(v) => onChange("scale", v)}
          />
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={onCopy}
          className="flex-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black active:scale-[0.98]"
        >
          {copied ? "Copied ✓" : "Copy config"}
        </button>
        <button
          onClick={onLog}
          className="rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-white active:scale-[0.98]"
        >
          Log
        </button>
        <button
          onClick={onReset}
          className="rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-white active:scale-[0.98]"
        >
          Reset
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-white/50">
        Tweaks auto-save on this device. Tap “Copy config” and paste the snippet
        into lib/targets.config.ts to make it permanent.
      </p>

      {loggedText && (
        <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/60 p-3 text-[10px] leading-relaxed text-green-300">
          {loggedText}
        </pre>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const nudge = (delta: number) => {
    const next = Math.min(max, Math.max(min, round(value + delta)));
    onChange(next);
  };

  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="font-mono text-white">{round(value)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => nudge(-step)}
          className="h-6 w-6 shrink-0 rounded bg-white/15 text-sm leading-none text-white active:scale-95"
          aria-label={`decrease ${label}`}
        >
          −
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-1 w-full accent-white"
        />
        <button
          onClick={() => nudge(step)}
          className="h-6 w-6 shrink-0 rounded bg-white/15 text-sm leading-none text-white active:scale-95"
          aria-label={`increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
