/** Evaluated only by the isolated Electron harness, against the built renderer CSS. */
export const smokeStyles = `(() => {
  const source = document.querySelector('[data-slot="button"].button');
  if (!source) return { sourceReady: false };
  const probe = document.createElement('button');
  probe.textContent = 'Style probe';
  probe.style.cssText = 'position:fixed;left:-10000px;transition:none';
  probe.className = [...source.classList].filter((name) => name.startsWith('primitive:')).join(' ');
  document.body.append(probe);
  try {
    const defaults = getComputedStyle(probe);
    const primitiveHeight = defaults.height === '36px';
    probe.classList.add('button');
    const material = getComputedStyle(probe);
    const materialHeight = material.height === '38px';
    const materialSurface = material.backgroundImage.includes('linear-gradient') && material.boxShadow !== 'none';
    probe.classList.add('h-6.5', 'px-2', 'pt-2.5', 'pb-3', 'text-body');
    const overrides = getComputedStyle(probe);
    const utilityHeight = overrides.height === '26px';
    const utilityPadding = overrides.paddingLeft === '8px' && overrides.paddingRight === '8px' && overrides.paddingTop === '10px' && overrides.paddingBottom === '12px';
    const utilityTypography = overrides.fontSize === '13.5px';
    probe.disabled = true;
    const disabledState = getComputedStyle(probe).pointerEvents === 'none';
    return { sourceReady: true, primitiveHeight, materialHeight, materialSurface, utilityHeight, utilityPadding, utilityTypography, disabledState };
  } finally {
    probe.remove();
  }
})()`;
