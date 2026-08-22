/** Ensures a round has exactly one terminal outcome. */
export class RoundGate {
  constructor() {
    this.generation = 0;
    this.reset();
  }

  claim(outcome) {
    if (this.pending) return null;
    this.pending = true;
    this.outcome = outcome;
    return { outcome, generation: this.generation };
  }

  isCurrent(token) {
    return Boolean(
      token
      && this.pending
      && token.generation === this.generation
      && token.outcome === this.outcome,
    );
  }

  reset() {
    this.generation++;
    this.pending = false;
    this.outcome = null;
  }
}
