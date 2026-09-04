'use client';

import { useEffect, useRef, useState } from 'react';
import {
  extractCodes,
  ScanError,
  type ScanCandidate,
  type ScanPurpose,
  type ScanResult,
} from '@/lib/scan';
import Barcode from '../Barcode';
import { CameraIcon, CloseIcon, ImageIcon, SparkleIcon } from '../icons';

/** What the caller receives when the user picks a recognised code. */
export interface PickedCode {
  candidate: ScanCandidate;
  result: ScanResult;
}

interface CodeScannerProps {
  purpose: ScanPurpose;
  apiKey: string;
  onPick: (picked: PickedCode) => void;
  onClose: () => void;
  /** Shown when no API key is configured — opens the setup screen. */
  onOpenSettings?: () => void;
}

type Stage =
  | { name: 'choose' }
  | { name: 'processing'; preview: string }
  | { name: 'result'; preview: string; result: ScanResult }
  | { name: 'error'; preview: string | null; message: string; retryable: boolean };

const CONFIDENCE_LABEL: Record<ScanCandidate['confidence'], string> = {
  high: 'Leitura clara',
  medium: 'Leitura provável',
  low: 'Leitura incerta',
};

/**
 * Bottom sheet that lets the user photograph or upload an image of a card,
 * coupon, receipt or free text and picks the code(s) out of it with AI.
 *
 * Camera capture uses the native file input with `capture` so it works in the
 * installed PWA on iOS and Android without any camera-permission plumbing.
 */
export default function CodeScanner({
  purpose,
  apiKey,
  onPick,
  onClose,
  onOpenSettings,
}: CodeScannerProps) {
  const [stage, setStage] = useState<Stage>({ name: 'choose' });
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);

  // Release the preview object URL when the sheet closes
  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const preview = URL.createObjectURL(file);
    previewUrl.current = preview;
    setStage({ name: 'processing', preview });

    try {
      const result = await extractCodes(file, apiKey, purpose);
      setStage({ name: 'result', preview, result });
    } catch (error) {
      const message =
        error instanceof ScanError
          ? error.message
          : 'Ocorreu um erro inesperado durante o reconhecimento.';
      const retryable = error instanceof ScanError ? error.retryable : true;
      setStage({ name: 'error', preview, message, retryable });
    }
  };

  const reset = () => setStage({ name: 'choose' });

  const title = purpose === 'card' ? 'Digitalizar cartão' : 'Digitalizar cupão';
  const hint =
    purpose === 'card'
      ? 'Fotografe o cartão físico ou um ecrã com o número. A IA extrai o número do cartão.'
      : 'Fotografe o cupão, o talão ou um texto com o código. A IA extrai o número do cupão.';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/45"
      />

      <div
        className="relative flex max-h-[92vh] w-full max-w-md flex-col animate-sheet-up rounded-t-3xl bg-white shadow-sheet"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-surface-line" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar digitalização"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-ink-soft"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        <div className="overflow-y-auto px-5 pt-3">
          <div className="flex items-center gap-2 text-brand-dark">
            <SparkleIcon className="h-5 w-5" />
            <h2 className="text-[20px] font-extrabold text-ink">{title}</h2>
          </div>

          {/* Hidden native inputs: one opens the camera, the other the gallery */}
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          {stage.name === 'choose' && (
            <>
              <p className="mt-1 text-sm text-ink-soft">{hint}</p>

              {!apiKey ? (
                <div className="mt-4 rounded-2xl bg-brand-tint p-4">
                  <p className="text-sm font-semibold text-brand-dark">Chave API em falta</p>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    O reconhecimento usa a API da Anthropic. Introduza uma chave na secção
                    “Reconhecimento por IA” do ecrã de configuração.
                  </p>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="mt-3 rounded-lg bg-brand px-4 py-2 text-[13px] font-bold text-white active:bg-brand-dark"
                    >
                      Abrir configuração
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <SourceTile
                    icon={<CameraIcon className="h-7 w-7" />}
                    label="Tirar foto"
                    onClick={() => cameraInput.current?.click()}
                  />
                  <SourceTile
                    icon={<ImageIcon className="h-7 w-7" />}
                    label="Carregar imagem"
                    onClick={() => fileInput.current?.click()}
                  />
                </div>
              )}
            </>
          )}

          {stage.name !== 'choose' && stage.preview && (
            <div className="relative mt-3 overflow-hidden rounded-2xl bg-surface-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={stage.preview}
                alt="Imagem a analisar"
                className={`mx-auto max-h-48 w-auto object-contain ${
                  stage.name === 'processing' ? 'opacity-60' : ''
                }`}
              />
              {stage.name === 'processing' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/60 border-t-brand" />
                </div>
              )}
            </div>
          )}

          {stage.name === 'processing' && (
            <p className="mt-3 text-center text-sm font-semibold text-brand-dark">
              A reconhecer o código…
            </p>
          )}

          {stage.name === 'error' && (
            <div className="mt-3">
              <div className="rounded-2xl border border-accent-red/30 bg-accent-red/5 p-4">
                <p className="text-sm font-semibold text-accent-red">Não foi possível reconhecer</p>
                <p className="mt-1 text-[13px] text-ink-soft">{stage.message}</p>
              </div>
              <div className="mt-3 flex gap-3">
                {stage.retryable ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 rounded-xl bg-brand py-3 text-sm font-bold text-white active:bg-brand-dark"
                  >
                    Tentar outra imagem
                  </button>
                ) : (
                  onOpenSettings && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="flex-1 rounded-xl bg-brand py-3 text-sm font-bold text-white active:bg-brand-dark"
                    >
                      Abrir configuração
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-surface-line bg-white py-3 text-sm font-semibold text-ink active:bg-surface-muted"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {stage.name === 'result' && (
            <ResultList
              result={stage.result}
              onPick={(candidate) => onPick({ candidate, result: stage.result })}
              onRetry={reset}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SourceTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[104px] flex-col items-center justify-center gap-2 rounded-2xl bg-brand-tint text-brand-dark transition-transform duration-100 active:scale-[0.98]"
    >
      {icon}
      <span className="text-[14px] font-bold">{label}</span>
    </button>
  );
}

function ResultList({
  result,
  onPick,
  onRetry,
}: {
  result: ScanResult;
  onPick: (candidate: ScanCandidate) => void;
  onRetry: () => void;
}) {
  const { candidates } = result;

  return (
    <div className="mt-3">
      {candidates.length === 0 ? (
        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="text-sm font-semibold text-ink">Nenhum código encontrado</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            {result.notes ?? 'Aproxime a câmara do código e garanta boa iluminação.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            {candidates.length === 1
              ? 'Código encontrado. Confirme antes de usar.'
              : `${candidates.length} códigos encontrados. Escolha o correto.`}
          </p>
          {result.notes && <p className="mt-1 text-[12px] text-ink-faint">{result.notes}</p>}

          <ul className="mt-3 space-y-3">
            {candidates.map((candidate) => (
              <li key={candidate.code} className="rounded-2xl border border-surface-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-ink-soft">{candidate.label}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      candidate.confidence === 'high'
                        ? 'bg-brand-tint text-brand-dark'
                        : candidate.confidence === 'medium'
                          ? 'bg-surface-muted text-ink-soft'
                          : 'bg-accent-red/10 text-accent-red'
                    }`}
                  >
                    {CONFIDENCE_LABEL[candidate.confidence]}
                  </span>
                </div>
                <p className="mt-1.5 break-all font-mono text-lg tracking-[0.1em] text-ink">
                  {candidate.code}
                </p>
                <div className="mt-2">
                  <Barcode value={candidate.code} format={candidate.format} height={44} />
                </div>
                <button
                  type="button"
                  onClick={() => onPick(candidate)}
                  className="mt-3 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white active:bg-brand-dark"
                >
                  Usar este código
                </button>
              </li>
            ))}
          </ul>

          {(result.title || result.discount || result.expiresAt) && (
            <p className="mt-3 text-[12px] text-ink-faint">
              Também detetado:{' '}
              {[result.title, result.discount, result.expiresAt && `validade ${result.expiresAt}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onRetry}
        className="mt-3 w-full rounded-xl border border-surface-line bg-white py-3 text-sm font-semibold text-ink active:bg-surface-muted"
      >
        Tentar outra imagem
      </button>
    </div>
  );
}
