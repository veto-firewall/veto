// Toast notification component for showing feedback
export class Toast {
  private container: HTMLDivElement;
  private messageElement: HTMLDivElement;
  private timeout: number | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.messageElement = document.createElement('div');
    this.render();
  }

  /**
   * Renders the toast notification component
   */
  private render(): void {
    this.container.className = 'toast-container';
    this.container.style.display = 'none';

    this.messageElement.className = 'toast-message';

    this.container.appendChild(this.messageElement);
    document.body.appendChild(this.container);
  }

  /**
   * Shows a toast message with the specified type and duration
   * @param message - The text message to display
   * @param type - The type of toast (success, error, info)
   * @param duration - How long to show the toast in milliseconds
   */
  show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000): void {
    // Clear any existing timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    // Set message and type
    this.messageElement.textContent = message;
    this.container.className = `toast-container ${type}`;

    // Show the toast with animation
    this.container.style.display = 'flex';

    // Set timeout to hide the toast
    this.timeout = window.setTimeout(() => {
      this.hide();
    }, duration);
  }

  /**
   * Hides the toast notification
   */
  hide(): void {
    this.container.style.display = 'none';
  }
}
