export interface FormField {
  name: string;
  type: string;
  label?: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface FormData {
  action: string;
  method: string;
  fields: FormField[];
}

export interface FilledForm {
  action: string;
  method: string;
  values: Record<string, string>;
}

export class FormFiller {
  extractForms(html: string): FormData[] {
    const forms: FormData[] = [];
    const formRegex = /<form[^>]*(?:action=["']([^"']*)["'])?[^>]*(?:method=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/form>/gi;
    let match;

    while ((match = formRegex.exec(html)) !== null) {
      const fields = this.extractFields(match[3] ?? '');
      forms.push({
        action: match[1] ?? '',
        method: (match[2] ?? 'GET').toUpperCase(),
        fields,
      });
    }

    return forms;
  }

  fillForm(form: FormData, data: Record<string, string>): FilledForm {
    const values: Record<string, string> = {};

    for (const field of form.fields) {
      if (data[field.name] !== undefined) {
        values[field.name] = data[field.name];
      } else if (field.required) {
        values[field.name] = this.generateDefault(field);
      }
    }

    return { action: form.action, method: form.method, values };
  }

  autoFill(form: FormData, context: Record<string, string>): FilledForm {
    const values: Record<string, string> = {};
    const contextLower = Object.fromEntries(
      Object.entries(context).map(([k, v]) => [k.toLowerCase(), v]),
    );

    for (const field of form.fields) {
      const name = field.name.toLowerCase();

      if (contextLower[name]) { values[field.name] = contextLower[name]; continue; }
      if (name.includes('email') && contextLower['email']) { values[field.name] = contextLower['email']; continue; }
      if (name.includes('name') && contextLower['name']) { values[field.name] = contextLower['name']; continue; }
      if (name.includes('password') && contextLower['password']) { values[field.name] = contextLower['password']; continue; }
      if (name.includes('url') && contextLower['url']) { values[field.name] = contextLower['url']; continue; }
      if (field.required) values[field.name] = this.generateDefault(field);
    }

    return { action: form.action, method: form.method, values };
  }

  private extractFields(formHtml: string): FormField[] {
    const fields: FormField[] = [];

    const inputRegex = /<input[^>]*>/gi;
    let match;
    while ((match = inputRegex.exec(formHtml)) !== null) {
      const tag = match[0];
      const name = this.attr(tag, 'name');
      if (!name) continue;

      fields.push({
        name,
        type: this.attr(tag, 'type') ?? 'text',
        label: this.attr(tag, 'aria-label'),
        required: tag.includes('required'),
        placeholder: this.attr(tag, 'placeholder'),
      });
    }

    const selectRegex = /<select[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi;
    while ((match = selectRegex.exec(formHtml)) !== null) {
      const options: string[] = [];
      const optRegex = /<option[^>]*value=["']([^"']+)["']/g;
      let optMatch;
      while ((optMatch = optRegex.exec(match[2])) !== null) {
        options.push(optMatch[1]);
      }
      fields.push({ name: match[1], type: 'select', required: false, options });
    }

    const textareaRegex = /<textarea[^>]*name=["']([^"']+)["'][^>]*>/gi;
    while ((match = textareaRegex.exec(formHtml)) !== null) {
      fields.push({ name: match[1], type: 'textarea', required: false });
    }

    return fields;
  }

  private attr(tag: string, name: string): string | undefined {
    const regex = new RegExp(`${name}=["']([^"']+)["']`);
    return tag.match(regex)?.[1];
  }

  private generateDefault(field: FormField): string {
    if (field.options && field.options.length > 0) return field.options[0];
    if (field.type === 'email') return 'user@example.com';
    if (field.type === 'number') return '0';
    if (field.type === 'url') return 'https://example.com';
    return field.placeholder ?? '';
  }
}
