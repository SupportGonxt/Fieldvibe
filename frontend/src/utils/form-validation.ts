// ENH-18: Form Validation Rules (Zod-like schema validation)
// ENH-19: Dependent Field Cascading
// ENH-20: Duplicate Detection

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'email' | 'phone' | 'custom'
  value?: number | string | RegExp
  message: string
  validate?: (value: unknown, formData?: Record<string, unknown>) => boolean
}

export interface FieldSchema {
  name: string
  label: string
  rules: ValidationRule[]
  dependsOn?: string
  cascadeOptions?: (parentValue: string) => Array<{ value: string; label: string }>
}

export interface ValidationError {
  field: string
  message: string
}

export interface FormSchema {
  fields: FieldSchema[]
}

// Validate a single field
export function validateField(value: unknown, rules: ValidationRule[], formData?: Record<string, unknown>): string | null {
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
          return rule.message
        }
        break
      case 'minLength':
        if (typeof value === 'string' && value.length < (rule.value as number)) {
          return rule.message
        }
        break
      case 'maxLength':
        if (typeof value === 'string' && value.length > (rule.value as number)) {
          return rule.message
        }
        break
      case 'min':
        if (typeof value === 'number' && value < (rule.value as number)) {
          return rule.message
        }
        break
      case 'max':
        if (typeof value === 'number' && value > (rule.value as number)) {
          return rule.message
        }
        break
      case 'pattern':
        if (typeof value === 'string' && !(rule.value as RegExp).test(value)) {
          return rule.message
        }
        break
      case 'email':
        if (typeof value === 'string' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return rule.message
        }
        break
      case 'phone':
        if (typeof value === 'string' && value && !/^[+]?[\d\s()-]{7,20}$/.test(value)) {
          return rule.message
        }
        break
      case 'custom':
        if (rule.validate && !rule.validate(value, formData)) {
          return rule.message
        }
        break
    }
  }
  return null
}

// Validate entire form
export function validateForm(formData: Record<string, unknown>, schema: FormSchema): ValidationError[] {
  const errors: ValidationError[] = []
  for (const field of schema.fields) {
    const error = validateField(formData[field.name], field.rules, formData)
    if (error) {
      errors.push({ field: field.name, message: error })
    }
  }
  return errors
}

// ENH-19: Get cascaded options based on parent field value
export function getCascadedOptions(
  fieldName: string,
  parentValue: string,
  schema: FormSchema
): Array<{ value: string; label: string }> {
  const field = schema.fields.find(f => f.name === fieldName)
  if (field?.cascadeOptions) {
    return field.cascadeOptions(parentValue)
  }
  return []
}

// ENH-20: Duplicate Detection
export interface DuplicateCheckResult {
  isDuplicate: boolean
  matches: Array<{ id: string; field: string; value: string; similarity: number }>
}

export function checkForDuplicates(
  newRecord: Record<string, string>,
  existingRecords: Array<Record<string, string>>,
  fieldsToCheck: string[],
  threshold: number = 0.8
): DuplicateCheckResult {
  const matches: DuplicateCheckResult['matches'] = []

  for (const existing of existingRecords) {
    for (const field of fieldsToCheck) {
      const newVal = (newRecord[field] || '').toLowerCase().trim()
      const existVal = (existing[field] || '').toLowerCase().trim()

      if (!newVal || !existVal) continue

      const similarity = calculateSimilarity(newVal, existVal)
      if (similarity >= threshold) {
        matches.push({
          id: existing.id || '',
          field,
          value: existing[field] || '',
          similarity
        })
      }
    }
  }

  return {
    isDuplicate: matches.length > 0,
    matches: matches.sort((a, b) => b.similarity - a.similarity)
  }
}

// Levenshtein distance-based similarity
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  const maxLen = Math.max(a.length, b.length)
  return 1 - matrix[b.length][a.length] / maxLen
}

// Common form schemas
export const customerFormSchema: FormSchema = {
  fields: [
    { name: 'name', label: 'Customer Name', rules: [
      { type: 'required', message: 'Customer name is required' },
      { type: 'minLength', value: 2, message: 'Name must be at least 2 characters' },
      { type: 'maxLength', value: 100, message: 'Name must not exceed 100 characters' },
    ]},
    { name: 'email', label: 'Email', rules: [
      { type: 'email', message: 'Please enter a valid email address' },
    ]},
    { name: 'phone', label: 'Phone', rules: [
      { type: 'phone', message: 'Please enter a valid phone number' },
    ]},
    { name: 'type', label: 'Customer Type', rules: [
      { type: 'required', message: 'Customer type is required' },
    ]},
  ]
}

export const orderFormSchema: FormSchema = {
  fields: [
    { name: 'customer_id', label: 'Customer', rules: [
      { type: 'required', message: 'Please select a customer' },
    ]},
    { name: 'order_date', label: 'Order Date', rules: [
      { type: 'required', message: 'Order date is required' },
    ]},
    { name: 'payment_method', label: 'Payment Method', rules: [
      { type: 'required', message: 'Payment method is required' },
    ]},
  ]
}

export const productFormSchema: FormSchema = {
  fields: [
    { name: 'name', label: 'Product Name', rules: [
      { type: 'required', message: 'Product name is required' },
      { type: 'minLength', value: 2, message: 'Name must be at least 2 characters' },
    ]},
    { name: 'code', label: 'Product Code', rules: [
      { type: 'required', message: 'Product code is required' },
      { type: 'pattern', value: /^[A-Z0-9-]+$/i, message: 'Code must be alphanumeric with hyphens only' },
    ]},
    { name: 'selling_price', label: 'Selling Price', rules: [
      { type: 'required', message: 'Selling price is required' },
      { type: 'min', value: 0, message: 'Price must be non-negative' },
    ]},
    { name: 'category', label: 'Category', rules: [
      { type: 'required', message: 'Category is required' },
    ],
    dependsOn: 'brand',
    cascadeOptions: (brandValue: string) => {
      const categoryMap: Record<string, Array<{ value: string; label: string }>> = {
        'beverages': [
          { value: 'soft-drinks', label: 'Soft Drinks' },
          { value: 'juices', label: 'Juices' },
          { value: 'water', label: 'Water' },
          { value: 'energy', label: 'Energy Drinks' },
        ],
        'snacks': [
          { value: 'chips', label: 'Chips' },
          { value: 'biscuits', label: 'Biscuits' },
          { value: 'chocolate', label: 'Chocolate' },
          { value: 'nuts', label: 'Nuts' },
        ],
        'dairy': [
          { value: 'milk', label: 'Milk' },
          { value: 'cheese', label: 'Cheese' },
          { value: 'yogurt', label: 'Yogurt' },
        ],
      }
      return categoryMap[brandValue] || []
    }},
  ]
}

// Inline validation hook helper
export function useFormValidation(schema: FormSchema) {
  const errors: Record<string, string> = {}

  function validate(formData: Record<string, unknown>): boolean {
    const validationErrors = validateForm(formData, schema)
    for (const error of validationErrors) {
      errors[error.field] = error.message
    }
    return validationErrors.length === 0
  }

  function validateSingleField(fieldName: string, value: unknown, formData?: Record<string, unknown>): string | null {
    const field = schema.fields.find(f => f.name === fieldName)
    if (!field) return null
    return validateField(value, field.rules, formData)
  }

  return { errors, validate, validateSingleField }
}
