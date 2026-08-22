/** Load fallible resources before registering long-lived browser listeners. */
export async function loadBeforeInitialize(loadResources, initialize) {
  const resources = await loadResources();
  return initialize(resources);
}
