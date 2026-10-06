export async function loadActivityResources() {
  if (window.OminiResources) return window.OminiResources;
  if (window.__omniResourcesLoading) return window.__omniResourcesLoading;
  window.__omniResourcesLoading = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = new URL('./browser.css?v=20261004-9', import.meta.url).href;
    const script = document.createElement('script');
    script.src = new URL('./browser.js?v=20261004-9', import.meta.url).href;
    script.onload = () => resolve(window.OminiResources);
    script.onerror = () => { window.__omniResourcesLoading = null; reject(new Error('Não foi possível carregar os recursos visuais. Atualize a página para tentar novamente.')); };
    document.head.append(link, script);
  });
  return window.__omniResourcesLoading;
}
