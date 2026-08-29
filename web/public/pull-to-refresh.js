/**
 * Pull-to-Refresh für Web — entspricht der Phase 3 App-Funktionalität
 * Nutzer zieht vom oberen Rand nach unten um Inhalte neu zu laden
 */

class PullToRefresh {
  constructor(options = {}) {
    this.container = options.container || document.querySelector('.main');
    this.threshold = options.threshold || 80;
    this.onRefresh = options.onRefresh || (() => Promise.resolve());
    this.isRefreshing = false;
    this.startY = 0;
    this.currentY = 0;

    this.createIndicator();
    this.attachListeners();
  }

  createIndicator() {
    this.indicator = document.createElement('div');
    this.indicator.className = 'ptr-indicator';
    this.indicator.innerHTML = `
      <div class="ptr-spinner"></div>
      <div class="ptr-text">Zum Aktualisieren loslassen</div>
    `;
    this.container.parentElement.insertBefore(this.indicator, this.container);
  }

  attachListeners() {
    this.container.addEventListener('touchstart', (e) => this.handleStart(e));
    this.container.addEventListener('touchmove', (e) => this.handleMove(e));
    this.container.addEventListener('touchend', (e) => this.handleEnd(e));
  }

  handleStart(e) {
    if (this.isRefreshing) return;
    // Nur wenn user bei oberen Kante anfängt
    if (this.container.scrollTop === 0) {
      this.startY = e.touches[0].clientY;
    }
  }

  handleMove(e) {
    if (this.isRefreshing || this.container.scrollTop > 0) return;
    if (this.startY === 0) return;

    this.currentY = e.touches[0].clientY - this.startY;
    if (this.currentY < 0) return;

    this.indicator.style.transform = `translateY(${this.currentY * 0.5}px)`;
    this.indicator.classList.toggle('ptr-ready', this.currentY > this.threshold);
  }

  handleEnd(e) {
    if (this.isRefreshing || this.startY === 0) {
      this.reset();
      return;
    }

    if (this.currentY > this.threshold) {
      this.refresh();
    } else {
      this.reset();
    }
  }

  async refresh() {
    this.isRefreshing = true;
    this.indicator.classList.add('ptr-active');

    try {
      await this.onRefresh();
      this.indicator.classList.add('ptr-success');

      setTimeout(() => {
        this.reset();
      }, 600);
    } catch (error) {
      console.error('Refresh error:', error);
      this.reset();
    }
  }

  reset() {
    this.isRefreshing = false;
    this.startY = 0;
    this.currentY = 0;
    this.indicator.style.transform = '';
    this.indicator.classList.remove('ptr-ready', 'ptr-active', 'ptr-success');
  }
}

// Export
window.PullToRefresh = PullToRefresh;
