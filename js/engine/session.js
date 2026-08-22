export function createSessionState() {
  return {
    phase: 'hub',
    deploymentId: 0,
    mapId: null,
    wave: 1,
    score: 0,
  };
}

function normalizeSessionState(state) {
  const defaults = createSessionState();
  return {
    phase: state?.phase ?? defaults.phase,
    deploymentId: state?.deploymentId ?? defaults.deploymentId,
    mapId: state?.mapId ?? defaults.mapId,
    wave: state?.wave ?? defaults.wave,
    score: state?.score ?? defaults.score,
  };
}

export function beginDeployment(state, operation) {
  const current = normalizeSessionState(state);
  return {
    ...current,
    phase: 'active',
    deploymentId: current.deploymentId + 1,
    mapId: operation?.id ?? null,
    wave: 1,
    score: 0,
  };
}

export function returnToHub(state) {
  const current = normalizeSessionState(state);
  return {
    ...current,
    phase: 'hub',
    deploymentId: current.deploymentId + 1,
    mapId: null,
    wave: 1,
    score: 0,
  };
}

export function resetRunState(state) {
  const current = normalizeSessionState(state);
  return {
    ...current,
    phase: 'active',
    deploymentId: current.deploymentId + 1,
    wave: 1,
    score: 0,
  };
}

export function isDeploymentCurrent(state, deploymentId) {
  const current = normalizeSessionState(state);
  return current.phase === 'active' && current.deploymentId === deploymentId;
}

export function groupHitsByEntity(hits) {
  if (!Array.isArray(hits)) return [];

  const groups = new Map();
  for (const hit of hits) {
    if (!hit?.entity || !Number.isFinite(hit.damage)) continue;
    const group = groups.get(hit.entity) ?? {
      entity: hit.entity,
      damage: 0,
      anyHeadshot: false,
    };
    group.damage += hit.damage;
    group.anyHeadshot ||= hit.isHeadshot === true;
    groups.set(hit.entity, group);
  }
  return [...groups.values()];
}

export function createInitializeOnce(initializer) {
  let initialized = false;
  let result;
  return () => {
    if (initialized) return result;
    result = initializer();
    initialized = true;
    return result;
  };
}

export function findWeaponIndexById(weapons, id) {
  if (!Array.isArray(weapons)) return -1;
  return weapons.findIndex(weapon => weapon?.id === id);
}

export function createRuntimeSessionController({
  resolveDeployment,
  createRuntimeBase,
  createInput,
  completeRuntime,
  requestFrame,
  onActiveUpdate = () => {},
  onActiveRender = () => {},
  onDeploy = () => {},
  onReturn = () => {},
}) {
  let state = createSessionState();
  let runtime;

  function runFrame(timestamp) {
    // Never let a single-frame exception kill the animation loop. If update
    // or render throws, log it and keep scheduling the next frame so the
    // game never hard-freezes (a stuck rAF chain looks like a full hang).
    try {
      if (state.phase === 'active') {
        onActiveUpdate({ runtime, state, timestamp });
        onActiveRender({ runtime, state, timestamp });
      }
    } catch (error) {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[pixstrike] frame error:', error);
      }
    }
    requestFrame(runFrame);
  }

  const initialize = createInitializeOnce(() => {
    const runtimeBase = createRuntimeBase();
    const input = createInput();
    runtime = completeRuntime({ runtimeBase, input });
    requestFrame(runFrame);
    return runtime;
  });

  function activate(mapId, reset) {
    if (reset ? state.phase !== 'active' : state.phase !== 'hub') {
      return { ok: false, message: 'deployment phase does not allow activation' };
    }

    const resolved = resolveDeployment(mapId);
    if (!resolved?.ok) return resolved;

    initialize();
    state = reset
      ? resetRunState(state)
      : beginDeployment(state, resolved.definition);
    const context = { runtime, state, deployment: resolved };
    onDeploy(context);
    return { ...resolved, state };
  }

  return {
    initialize,
    deploy(mapId) {
      return activate(mapId, false);
    },
    redeploy() {
      return activate(state.mapId, true);
    },
    returnToOperations() {
      state = returnToHub(state);
      onReturn({ runtime, state });
      return state;
    },
    setRunProgress(progress) {
      if (state.phase !== 'active') return state;
      state = {
        ...state,
        wave: progress?.wave ?? state.wave,
        score: progress?.score ?? state.score,
      };
      return state;
    },
    isDeploymentCurrent(deploymentId) {
      return isDeploymentCurrent(state, deploymentId);
    },
    get state() {
      return state;
    },
    get runtime() {
      return runtime;
    },
  };
}
