// Component for rule groups (allowed/blocked rules)
export class RuleGroup {
  private container: HTMLDivElement;
  private textarea: HTMLTextAreaElement;
  private terminatingCheckbox: HTMLInputElement;
  private readonly _id: string;
  private readonly _title: string;
  private readonly _type: 'allowed' | 'blocked' | 'neutral';
  private readonly _placeholder: string;
  private readonly _terminatingDefault: boolean;

  /**
   * Creates a new rule group component
   *
   * @param id - Identifier for the rule group
   * @param title - Title to display for the rule group
   * @param type - Visual style of the rule group
   * @param placeholder - Placeholder text for the textarea
   * @param terminatingDefault - Default state of terminating checkbox
   */
  constructor(
    id: string,
    title: string,
    type: 'allowed' | 'blocked' | 'neutral',
    placeholder: string,
    terminatingDefault = true,
  ) {
    this._id = id;
    this._title = title;
    this._type = type;
    this._placeholder = placeholder;
    this._terminatingDefault = terminatingDefault;

    this.container = document.createElement('div');
    this.textarea = document.createElement('textarea');
    this.terminatingCheckbox = document.createElement('input');
    this.render();
  }

  private render(): void {
    // Create rule group container with appropriate class
    this.container.className = `rule-group ${this._type}`;

    // Add heading
    const heading = document.createElement('h3');
    heading.textContent = this._title;
    this.container.appendChild(heading);

    // Add rule options
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'rule-options';

    // Add terminating checkbox
    this.terminatingCheckbox.type = 'checkbox';
    this.terminatingCheckbox.id = `${this._id}-terminating`;
    this.terminatingCheckbox.checked = this._terminatingDefault;

    const label = document.createElement('label');
    label.htmlFor = `${this._id}-terminating`;
    label.textContent = 'Terminating (Final) Rule';

    optionsDiv.appendChild(this.terminatingCheckbox);
    optionsDiv.appendChild(label);
    this.container.appendChild(optionsDiv);

    // Add textarea
    this.textarea.id = this._id;
    this.textarea.placeholder = this._placeholder;
    this.container.appendChild(this.textarea);

    // Add buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'rule-actions';

    const saveButton = document.createElement('button');
    saveButton.id = `save-${this._id}`;
    saveButton.textContent = 'Save';
    saveButton.setAttribute('aria-label', `Save ${this._title}`);

    const exportButton = document.createElement('button');
    exportButton.id = `export-${this._id}`;
    exportButton.textContent = 'Export';
    exportButton.setAttribute('aria-label', `Export ${this._title}`);

    actionsDiv.appendChild(saveButton);
    actionsDiv.appendChild(exportButton);
    this.container.appendChild(actionsDiv);
  }

  /**
   * Get the DOM element for this component
   * @returns The rendered HTML element
   */
  getElement(): HTMLDivElement {
    return this.container;
  }

  /**
   * Set the value of the textarea
   * @param value - The string value to set
   */
  setValue(value: string): void {
    this.textarea.value = value;
  }

  /**
   * Set terminating checkbox value
   * @param isTerminating - Whether the rule is terminating
   */
  setTerminating(isTerminating: boolean): void {
    this.terminatingCheckbox.checked = isTerminating;
  }
}
