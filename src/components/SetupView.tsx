'use client';

import { useEffect, useState } from 'react';
import type { AiProvider, AppConfig, BarcodeFormat, Coupon, CouponKind } from '@/lib/types';
import { BARCODE_FORMATS } from '@/lib/types';
import {
  AI_PROVIDER_LABEL,
  checkProxy,
  DEFAULT_GOOGLE_MODEL,
  normaliseServerUrl,
  resolveAiSettings,
  ScanError,
} from '@/lib/scan';
import Barcode from './Barcode';
import { CameraIcon, CloseIcon, PlusIcon, SparkleIcon, TrashIcon } from './icons';
import CodeScanner, { type PickedCode } from './scan/CodeScanner';

interface SetupViewProps {
  config: AppConfig;
  onSave: (next: AppConfig) => void;
  onReset: () => void;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-xl border border-surface-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft';

/** Which field a scan result should be written into. */
type ScanTarget =
  | { field: 'cardNumber' | 'poupaMaisNumber' }
  | { field: 'coupon'; id: string };

function newCoupon(): Coupon {
  return {
    // crypto.randomUUID is available in all modern mobile browsers
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `c-${Math.random().toString(36).slice(2)}`,
    title: 'Cupão de 15€ Combustível BP',
    discount: '15€',
    barcode: '',
    format: 'EAN13',
    startsAt: new Date().toISOString().slice(0, 10),
    expiresAt: new Date().toISOString().slice(0, 10),
    conditions: '',
    kind: 'fuel',
  };
}

/**
 * Hidden Setup/Admin screen.
 *
 * Reached via the /setup route or by tapping the profile icon 5 times in
 * quick succession. Edits are held in a local draft and only persisted to
 * localStorage when the user hits "Guardar".
 */
export default function SetupView({ config, onSave, onReset, onClose }: SetupViewProps) {
  const [draft, setDraft] = useState<AppConfig>(config);
  const [savedFlash, setSavedFlash] = useState(false);
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null);
  const ai = resolveAiSettings(draft);
  const [proxyCheck, setProxyCheck] = useState<
    { state: 'idle' } | { state: 'busy' } | { state: 'ok'; text: string } | { state: 'error'; text: string }
  >({ state: 'idle' });

  /** "Testar ligação": GET /health on the proxy with the current draft settings. */
  const testProxy = async () => {
    setProxyCheck({ state: 'busy' });
    try {
      const health = await checkProxy(ai);
      setProxyCheck({
        state: 'ok',
        text: `Ligado · ${health.provider} (${health.model})${health.requiresToken ? ' · token aceite' : ''}`,
      });
    } catch (error) {
      setProxyCheck({
        state: 'error',
        text: error instanceof ScanError ? error.message : 'Não foi possível contactar o servidor.',
      });
    }
  };

  // Re-sync the draft if the persisted config changes (e.g. after a reset)
  useEffect(() => {
    setDraft(config);
  }, [config]);

  const patch = (partial: Partial<AppConfig>) => setDraft((d) => ({ ...d, ...partial }));

  const patchCoupon = (id: string, partial: Partial<Coupon>) =>
    setDraft((d) => ({
      ...d,
      coupons: d.coupons.map((c) => (c.id === id ? { ...c, ...partial } : c)),
    }));

  const removeCoupon = (id: string) =>
    setDraft((d) => ({ ...d, coupons: d.coupons.filter((c) => c.id !== id) }));

  const handleSave = () => {
    onSave(draft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  /** Write the code the user picked in the scanner into the targeted field. */
  const applyScan = ({ candidate, result }: PickedCode) => {
    if (!scanTarget) return;
    if (scanTarget.field === 'coupon') {
      patchCoupon(scanTarget.id, {
        barcode: candidate.code,
        format: candidate.format,
        // Fill in metadata the model could read off the coupon; the fields
        // stay editable right below, so a wrong guess is a one-tap fix.
        ...(result.title ? { title: result.title } : {}),
        ...(result.discount ? { discount: result.discount } : {}),
        ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
        ...(result.couponKind ? { kind: result.couponKind } : {}),
      });
    } else {
      patch({ [scanTarget.field]: candidate.code });
      if (scanTarget.field === 'poupaMaisNumber') patch({ cardFormat: candidate.format });
    }
    setScanTarget(null);
  };

  /** Small camera button rendered inside a code input. */
  const scanButton = (target: ScanTarget, label: string) => (
    <button
      type="button"
      onClick={() => setScanTarget(target)}
      aria-label={label}
      title={label}
      className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-brand-tint text-brand-dark active:bg-brand-tintDark"
    >
      <CameraIcon className="h-5 w-5" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-surface-muted">
      {/* Sticky admin header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-ink px-4 py-3 text-white">
        <div>
          <p className="text-sm font-bold">Configuração</p>
          <p className="text-[11px] text-white/70">Ecrã oculto — apenas para o POC</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar configuração"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </header>

      <div className="mx-auto max-w-md space-y-5 px-4 py-5 pb-32">
        {/* Card configuration */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="text-sm font-bold text-ink">Cartão digital</h2>

          <div className="mt-3">
            <label className={labelClass} htmlFor="setup-username">Nome (saudação)</label>
            <input
              id="setup-username"
              className={inputClass}
              value={draft.userName}
              onChange={(e) => patch({ userName: e.target.value })}
              placeholder="Ex.: Anton"
            />
          </div>

          <div className="mt-3">
            <label className={labelClass} htmlFor="setup-cardnumber">N.º O Meu Pingo Doce</label>
            <div className="relative">
              <input
                id="setup-cardnumber"
                className={`${inputClass} pr-11`}
                inputMode="numeric"
                value={draft.cardNumber}
                onChange={(e) => patch({ cardNumber: e.target.value.trim() })}
                placeholder="Ex.: 2400000000006"
              />
              {scanButton({ field: 'cardNumber' }, 'Digitalizar n.º O Meu Pingo Doce')}
            </div>
          </div>

          <div className="mt-3">
            <label className={labelClass} htmlFor="setup-poupamais">N.º Cartão Poupa Mais</label>
            <div className="relative">
              <input
                id="setup-poupamais"
                className={`${inputClass} pr-11`}
                inputMode="numeric"
                value={draft.poupaMaisNumber}
                onChange={(e) => patch({ poupaMaisNumber: e.target.value.trim() })}
                placeholder="Ex.: 2410000000005"
              />
              {scanButton({ field: 'poupaMaisNumber' }, 'Digitalizar n.º Poupa Mais')}
            </div>
          </div>

          <div className="mt-3">
            <label className={labelClass} htmlFor="setup-cardformat">Formato do código</label>
            <select
              id="setup-cardformat"
              className={inputClass}
              value={draft.cardFormat}
              onChange={(e) => patch({ cardFormat: e.target.value as BarcodeFormat })}
            >
              {BARCODE_FORMATS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Live preview so invalid numbers are caught before saving */}
          <div className="mt-4 rounded-xl border border-dashed border-surface-line p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Pré-visualização
            </p>
            <Barcode value={draft.cardNumber} format={draft.cardFormat} height={64} />
          </div>
        </section>

        {/* Coupons configuration */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">Cupões ativos</h2>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, coupons: [...d.coupons, newCoupon()] }))}
              className="flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white active:bg-brand-dark"
            >
              <PlusIcon className="h-4 w-4" /> Adicionar
            </button>
          </div>

          {draft.coupons.length === 0 && (
            <p className="mt-3 text-sm text-ink-soft">Sem cupões configurados.</p>
          )}

          <div className="mt-3 space-y-4">
            {draft.coupons.map((coupon, index) => (
              <div key={coupon.id} className="rounded-xl border border-surface-line p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                    Cupão {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeCoupon(coupon.id)}
                    aria-label={`Remover cupão ${index + 1}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-accent-red active:bg-surface-muted"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 space-y-3">
                  <div>
                    <label className={labelClass}>Título</label>
                    <input
                      className={inputClass}
                      value={coupon.title}
                      onChange={(e) => patchCoupon(coupon.id, { title: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Desconto</label>
                      <input
                        className={inputClass}
                        value={coupon.discount}
                        onChange={(e) => patchCoupon(coupon.id, { discount: e.target.value })}
                        placeholder="10€"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Início</label>
                      <input
                        type="date"
                        className={inputClass}
                        value={coupon.startsAt ?? ''}
                        onChange={(e) => patchCoupon(coupon.id, { startsAt: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Validade</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={coupon.expiresAt}
                      onChange={(e) => patchCoupon(coupon.id, { expiresAt: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Código de barras</label>
                    <div className="relative">
                      <input
                        className={`${inputClass} pr-11`}
                        inputMode="numeric"
                        value={coupon.barcode}
                        onChange={(e) => patchCoupon(coupon.id, { barcode: e.target.value.trim() })}
                        placeholder="Número do cupão"
                      />
                      {scanButton({ field: 'coupon', id: coupon.id }, `Digitalizar cupão ${index + 1}`)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Formato</label>
                      <select
                        className={inputClass}
                        value={coupon.format}
                        onChange={(e) =>
                          patchCoupon(coupon.id, { format: e.target.value as BarcodeFormat })
                        }
                      >
                        {BARCODE_FORMATS.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Tipo</label>
                      <select
                        className={inputClass}
                        value={coupon.kind}
                        onChange={(e) =>
                          patchCoupon(coupon.id, { kind: e.target.value as CouponKind })
                        }
                      >
                        <option value="fuel">Combustível</option>
                        <option value="store">Loja</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Condições</label>
                    <textarea
                      className={`${inputClass} min-h-[72px] resize-y`}
                      value={coupon.conditions ?? ''}
                      onChange={(e) => patchCoupon(coupon.id, { conditions: e.target.value })}
                      placeholder="Termos apresentados no detalhe do cupão"
                    />
                  </div>

                  <Barcode value={coupon.barcode} format={coupon.format} height={48} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AI recognition */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center gap-2">
            <SparkleIcon className="h-5 w-5 text-brand-dark" />
            <h2 className="text-sm font-bold text-ink">Reconhecimento por IA</h2>
          </div>
          <p className="mt-1 text-[13px] text-ink-soft">
            Os botões de câmara ao lado dos códigos fotografam ou carregam uma imagem
            (cartão, cupão, talão ou texto) e extraem o número com o serviço escolhido.
          </p>

          <div className="mt-3">
            <label className={labelClass} htmlFor="setup-aiprovider">Serviço</label>
            <select
              id="setup-aiprovider"
              className={inputClass}
              value={ai.provider}
              onChange={(e) => patch({ aiProvider: e.target.value as AiProvider })}
            >
              {(Object.keys(AI_PROVIDER_LABEL) as AiProvider[]).map((p) => (
                <option key={p} value={p}>{AI_PROVIDER_LABEL[p]}</option>
              ))}
            </select>
          </div>

          {ai.provider === 'server' && (
            <>
              <div className="mt-3">
                <label className={labelClass} htmlFor="setup-serverurl">Endereço do servidor</label>
                <input
                  id="setup-serverurl"
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className={inputClass}
                  value={draft.serverUrl}
                  onChange={(e) => {
                    patch({ serverUrl: e.target.value.trim() });
                    setProxyCheck({ state: 'idle' });
                  }}
                  onBlur={(e) => patch({ serverUrl: normaliseServerUrl(e.target.value) })}
                  placeholder="https://xxxx.ngrok-free.app"
                />
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  URL público do proxy (pasta <code>server/</code> deste repositório) — por exemplo o
                  endereço que o ngrok mostra. A chave API fica nesse servidor, não no telemóvel.
                </p>
              </div>
              <div className="mt-3">
                <label className={labelClass} htmlFor="setup-servertoken">Token (opcional)</label>
                <input
                  id="setup-servertoken"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  className={inputClass}
                  value={draft.serverToken}
                  onChange={(e) => {
                    patch({ serverToken: e.target.value.trim() });
                    setProxyCheck({ state: 'idle' });
                  }}
                  placeholder="O mesmo valor que PROXY_TOKEN no servidor"
                />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={testProxy}
                  disabled={!ai.serverUrl || proxyCheck.state === 'busy'}
                  className="rounded-lg bg-brand-tint px-4 py-2 text-[13px] font-bold text-brand-dark active:bg-brand-tintDark disabled:opacity-50"
                >
                  {proxyCheck.state === 'busy' ? 'A testar…' : 'Testar ligação'}
                </button>
                {proxyCheck.state === 'ok' && (
                  <p className="text-[12px] font-semibold text-brand">{proxyCheck.text}</p>
                )}
                {proxyCheck.state === 'error' && (
                  <p className="text-[12px] font-semibold text-accent-red">{proxyCheck.text}</p>
                )}
              </div>
            </>
          )}

          {ai.provider === 'anthropic' && (
            <div className="mt-3">
              <label className={labelClass} htmlFor="setup-aikey">Chave API Anthropic</label>
              <input
                id="setup-aikey"
                type="password"
                autoComplete="off"
                spellCheck={false}
                className={inputClass}
                value={draft.aiApiKey}
                onChange={(e) => patch({ aiApiKey: e.target.value.trim() })}
                placeholder="sk-ant-…"
              />
              <p className="mt-1.5 text-[11px] text-ink-faint">
                Crie a chave em platform.claude.com.
              </p>
            </div>
          )}

          {ai.provider === 'google' && (
            <>
              <div className="mt-3">
                <label className={labelClass} htmlFor="setup-googlekey">Chave API Google AI Studio</label>
                <input
                  id="setup-googlekey"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  className={inputClass}
                  value={draft.googleApiKey}
                  onChange={(e) => patch({ googleApiKey: e.target.value.trim() })}
                  placeholder="AIza…"
                />
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  Crie a chave em aistudio.google.com → Get API key.
                </p>
              </div>
              <div className="mt-3">
                <label className={labelClass} htmlFor="setup-googlemodel">Modelo Gemini</label>
                <input
                  id="setup-googlemodel"
                  className={inputClass}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={draft.googleModel}
                  onChange={(e) => patch({ googleModel: e.target.value.trim() })}
                  placeholder={DEFAULT_GOOGLE_MODEL}
                />
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  Deixe vazio para usar {DEFAULT_GOOGLE_MODEL}. Precisa de um modelo com visão.
                </p>
              </div>
            </>
          )}

          <p className="mt-3 text-[11px] text-ink-faint">
            {ai.provider === 'server'
              ? 'Sem chave no telemóvel: as fotos vão para o servidor indicado, que chama o serviço de IA com a chave dele. Proteja o servidor com um token se o endereço for público.'
              : 'As chaves ficam guardadas apenas neste dispositivo (localStorage) e são enviadas só para o serviço escolhido. Não as partilhe nem as coloque em repositórios públicos. Use chaves dedicadas com limite de gastos e revogue-as no fim dos testes.'}
          </p>
        </section>

        <button
          type="button"
          onClick={onReset}
          className="w-full rounded-xl border border-surface-line bg-white py-3 text-sm font-semibold text-accent-red shadow-card active:bg-surface-muted"
        >
          Repor dados de demonstração
        </button>
      </div>

      {scanTarget && (
        <CodeScanner
          purpose={scanTarget.field === 'coupon' ? 'coupon' : 'card'}
          ai={ai}
          onPick={applyScan}
          onClose={() => setScanTarget(null)}
        />
      )}

      {/* Sticky save bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-10 border-t border-surface-line bg-white p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <button
          type="button"
          onClick={handleSave}
          className="mx-auto block w-full max-w-md rounded-xl bg-brand py-3.5 text-sm font-bold text-white active:bg-brand-dark"
        >
          {savedFlash ? 'Guardado ✓' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
