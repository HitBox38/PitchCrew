import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { RuntimeAuthInteraction, RuntimeAuthResponse } from '@pitchcrew/core';
import { terminalTheme } from '../terminal-theme.ts';
import { terminalBufferText } from '../terminal-buffer.ts';

export const useAuthTerminalSurface = (
  interaction: Extract<RuntimeAuthInteraction, { type: 'terminal' }>,
  send: (response: Extract<RuntimeAuthResponse, { type: 'terminal' }>) => void,
  enabled: boolean,
  copy: (text: string) => void,
) => {
  const element = useRef<HTMLElement>(null);
  const surface = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const written = useRef(0);
  const [text, setText] = useState('');
  useEffect(() => {
    if (!element.current) return;
    const host = element.current;
    const terminal = new Terminal({
      rows: 14,
      cols: 80,
      fontSize: 13,
      scrollback: 200,
      screenReaderMode: true,
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: false,
      minimumContrastRatio: 4.5,
      theme: terminalTheme(host),
      linkHandler: { activate: () => {} },
    });
    const addon = new FitAddon();
    terminal.loadAddon(addon);
    terminal.open(host);
    surface.current = terminal;
    fit.current = addon;
    terminal.attachCustomKeyEventHandler((event) => {
      if (
        event.key.toLowerCase() === 'c' &&
        (event.ctrlKey || event.metaKey) &&
        terminal.hasSelection()
      ) {
        if (event.type === 'keydown') copy(terminal.getSelection());
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      if (event.key === 'Escape') event.stopPropagation();
      return event.key !== 'Tab';
    });
    const data = terminal.onData((data) => send({ type: 'terminal', data }));
    const resize = terminal.onResize(({ cols, rows }) => {
      setText(terminalBufferText(terminal));
      send({
        type: 'terminal',
        data: '',
        size: { cols: Math.min(500, cols), rows: Math.min(200, rows) },
      });
    });
    const observer = new ResizeObserver(() => {
      if (host.clientWidth && host.clientHeight) addon.fit();
    });
    observer.observe(host);
    const retheme = () => {
      terminal.options.theme = terminalTheme(host);
    };
    const themeObserver = new MutationObserver(retheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    const colorScheme = matchMedia('(prefers-color-scheme: dark)');
    colorScheme.addEventListener('change', retheme);
    if (host.clientWidth) addon.fit();
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      colorScheme.removeEventListener('change', retheme);
      data.dispose();
      resize.dispose();
      terminal.dispose();
      surface.current = null;
      fit.current = null;
      written.current = 0;
    };
  }, [send, copy]);
  useEffect(() => {
    const terminal = surface.current;
    if (!terminal) return;
    const offset = interaction.outputOffset ?? interaction.output.length;
    const delta = offset - written.current;
    const rendered = () => {
      if (surface.current === terminal) setText(terminalBufferText(terminal));
    };
    if (interaction.outputOffset === undefined) {
      terminal.reset();
      terminal.write(interaction.output, rendered);
    } else if (delta > 0 && delta <= interaction.output.length)
      terminal.write(interaction.output.slice(-delta), rendered);
    else if (delta !== 0) {
      terminal.reset();
      terminal.write(interaction.output, rendered);
    }
    written.current = offset;
  }, [interaction.output, interaction.outputOffset]);
  useEffect(() => {
    if (surface.current) surface.current.options.disableStdin = !enabled;
    if (enabled && element.current?.clientWidth) {
      fit.current?.fit();
      surface.current?.focus();
    }
  }, [enabled]);
  return { element, text };
};
