'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'fixpro:install-dismissed';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // armazenamento indisponível: o aviso apenas reaparece na próxima visita
  }
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone || readDismissed()) {
      return;
    }

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const iosTimer = isIos ? window.setTimeout(() => setShowIosHint(true), 0) : undefined;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setShowIosHint(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.clearTimeout(iosTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!installEvent && !showIosHint) {
    return null;
  }

  const dismiss = () => {
    writeDismissed();
    setInstallEvent(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!installEvent) return;

    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Instalar o aplicativo"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-sm text-slate-100 shadow-xl shadow-slate-950/60 backdrop-blur"
    >
      <p className="font-semibold text-white">Instale o FixPro</p>
      <p className="mt-1 text-slate-300">
        {installEvent
          ? 'Acesse as ordens de serviço direto da tela inicial, inclusive sem internet.'
          : 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início” para usar o app, inclusive sem internet.'}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800"
        >
          Agora não
        </button>
        {installEvent ? (
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Instalar
          </button>
        ) : null}
      </div>
    </div>
  );
}
