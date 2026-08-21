'use client';

import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import type { BarcodeFormat } from '@/lib/types';

interface BarcodeProps {
  value: string;
  format?: BarcodeFormat;
  /** Bar height in px. */
  height?: number;
  /** Single bar width in px — 2+ keeps codes scannable on phone screens. */
  barWidth?: number;
  /** Render the human-readable value under the bars. */
  displayValue?: boolean;
  className?: string;
}

/**
 * SVG barcode renderer backed by JsBarcode.
 *
 * SVG output scales crisply on any DPI, which matters for scanner
 * reliability. Invalid value/format combinations (e.g. a bad EAN-13
 * checksum) degrade to an inline error message instead of crashing.
 */
export default function Barcode({
  value,
  format = 'CODE128',
  height = 90,
  barWidth = 2,
  displayValue = false,
  className,
}: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    if (!value) {
      setError('empty');
      return;
    }
    try {
      JsBarcode(svgRef.current, value, {
        format,
        height,
        width: barWidth,
        displayValue,
        margin: 0,
        background: 'transparent',
        lineColor: '#1B1B1A',
        fontSize: 16,
        textMargin: 6,
      });
      setError(null);
    } catch {
      setError('invalid');
    }
  }, [value, format, height, barWidth, displayValue]);

  if (error) {
    return (
      <div
        className={`flex h-24 items-center justify-center rounded-lg bg-surface-muted px-4 text-center text-sm text-ink-faint ${className ?? ''}`}
      >
        {error === 'empty'
          ? 'Sem código configurado'
          : `Código inválido para o formato ${format}`}
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={`h-auto w-full max-w-full ${className ?? ''}`}
      role="img"
      aria-label={`Código de barras ${value}`}
    />
  );
}
