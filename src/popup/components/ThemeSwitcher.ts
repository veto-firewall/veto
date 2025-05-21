export class ThemeSwitcher {
  private container: HTMLDivElement;
  private lightButton: HTMLButtonElement;
  private darkButton: HTMLButtonElement;
  private currentTheme: 'light' | 'dark';

  constructor() {
    this.container = document.createElement('div');
    this.lightButton = document.createElement('button');
    this.darkButton = document.createElement('button');

    // Get current theme from storage or default to light
    const savedTheme = localStorage.getItem('veto-theme') as 'light' | 'dark' | 'system';
    this.currentTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'light';

    this.render();
    this.applyTheme();
  }

  /**
   * Renders the theme switcher component
   */
  private render(): void {
    this.container.className = 'theme-switch';

    // Light theme button
    this.lightButton.className = 'theme-btn light';
    this.lightButton.textContent = '☀️';
    this.lightButton.setAttribute('aria-label', 'Switch to light theme');
    this.lightButton.addEventListener('click', () => this.setTheme('light'));

    // Dark theme button
    this.darkButton.className = 'theme-btn dark';
    this.darkButton.textContent = '🌙';
    this.darkButton.setAttribute('aria-label', 'Switch to dark theme');
    this.darkButton.addEventListener('click', () => this.setTheme('dark'));

    // Add buttons to container
    this.container.appendChild(this.lightButton);
    this.container.appendChild(this.darkButton);

    // Update active state
    this.updateActiveState();
  }

  /**
   * Set theme and save to storage
   * @param theme - The theme to apply: light or dark
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
    localStorage.setItem('veto-theme', theme);

    this.applyTheme();
    this.updateActiveState();
  }

  /**
   * Apply the current theme to the document
   */
  private applyTheme(): void {
    if (this.currentTheme === 'light') {
      document.documentElement.classList.remove('dark-theme');
      document.documentElement.classList.add('light-theme');
    } else {
      // Dark theme
      document.documentElement.classList.remove('light-theme');
      document.documentElement.classList.add('dark-theme');
    }
  }

  /**
   * Update active state of buttons
   */
  private updateActiveState(): void {
    this.lightButton.classList.toggle('active', this.currentTheme === 'light');
    this.darkButton.classList.toggle('active', this.currentTheme === 'dark');
  }

  /**
   * Get the DOM element for this component
   * @returns The rendered HTML element
   */
  getElement(): HTMLDivElement {
    return this.container;
  }
}
