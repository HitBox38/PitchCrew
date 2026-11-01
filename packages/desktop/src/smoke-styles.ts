/** Evaluated only by the isolated Electron harness, against the built renderer CSS. */
export const smokeStyles = `(() => {
  // Any shared default Button supplies the primitive recipe; the probe adds the .button material.
  const source = document.querySelector('[data-slot="button"].button, [data-slot="button"][data-variant="default"][data-size="default"]');
  if (!source) return { sourceReady: false };
  const probe = document.createElement('button');
  probe.textContent = 'Style probe';
  probe.style.cssText = 'position:fixed;left:-10000px;transition:none';
  probe.className = [...source.classList].filter((name) => name.startsWith('primitive:')).join(' ');
  document.body.append(probe);
  try {
    const defaults = getComputedStyle(probe);
    const primitiveHeight = defaults.height === '38px';
    const primitiveSurface = defaults.backgroundImage.includes('linear-gradient') && defaults.boxShadow !== 'none';
    probe.classList.add('button');
    const material = getComputedStyle(probe);
    const materialHeight = material.height === '38px';
    const materialSurface = material.backgroundImage.includes('linear-gradient') && material.boxShadow !== 'none';
    // Utilities the renderer already uses, so the built stylesheet contains them.
    probe.classList.add('h-8', 'px-2', 'pt-2', 'pb-3', 'text-body');
    const overrides = getComputedStyle(probe);
    const utilityHeight = overrides.height === '32px';
    const utilityPadding = overrides.paddingLeft === '8px' && overrides.paddingRight === '8px' && overrides.paddingTop === '8px' && overrides.paddingBottom === '12px';
    const utilityTypography = overrides.fontSize === '14px';
    probe.disabled = true;
    const disabledState = getComputedStyle(probe).pointerEvents === 'none';
    return { sourceReady: true, primitiveHeight, primitiveSurface, materialHeight, materialSurface, utilityHeight, utilityPadding, utilityTypography, disabledState };
  } finally {
    probe.remove();
  }
})()`;
