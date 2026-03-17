/**
 * Dynamic Form Component - JSON Schema-based form renderer
 * 
 * Features:
 * - Render forms from JSON schema
 * - Support multiple field types (text, number, select, date, signature, photo)
 * - Validation based on schema
 * - Mobile-optimized inputs
 */

import React, { useState } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Button,
  Typography,
  Grid,
  Alert,
} from '@mui/material';
import { CameraAlt, Create } from '@mui/icons-material';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { compressPhoto } from '../../utils/photo-compression';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'tel' | 'select' | 'checkbox' | 'date' | 'signature' | 'photo' | 'textarea';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

interface FormSchema {
  title: string;
  description?: string;
  fields: FormField[];
}

interface DynamicFormProps {
  schema: FormSchema;
  onSubmit: (data: Record<string, any>) => void;
  onCancel?: () => void;
  initialData?: Record<string, any>;
}

export default function DynamicForm({
  schema,
  onSubmit,
  onCancel,
  initialData = {},
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [signatureField, setSignatureField] = useState<string | null>(null);

  const handleChange = (name: string, value: any) => {
    setFormData({ ...formData, [name]: value });
    
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateField = (field: FormField, value: any): string | null => {
    if (field.required && (!value || value === '')) {
      return `${field.label} is required`;
    }

    if (field.validation) {
      const { min, max, pattern, minLength, maxLength } = field.validation;

      if (field.type === 'number') {
        const numValue = Number(value);
        if (min !== undefined && numValue < min) {
          return `${field.label} must be at least ${min}`;
        }
        if (max !== undefined && numValue > max) {
          return `${field.label} must be at most ${max}`;
        }
      }

      if (field.type === 'text' || field.type === 'textarea') {
        if (minLength !== undefined && value.length < minLength) {
          return `${field.label} must be at least ${minLength} characters`;
        }
        if (maxLength !== undefined && value.length > maxLength) {
          return `${field.label} must be at most ${maxLength} characters`;
        }
      }

      if (pattern && !new RegExp(pattern).test(value)) {
        return `${field.label} format is invalid`;
      }
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    schema.fields.forEach((field) => {
      const value = formData[field.name];
      const error = validateField(field, value);
      if (error) {
        newErrors[field.name] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const finalData = {
      ...formData,
      ...signatures,
      ...photos,
    };

    onSubmit(finalData);
  };

  const handleCapturePhoto = (fieldName: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const { compressed } = await compressPhoto(file);
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setPhotos(prev => ({ ...prev, [fieldName]: dataUrl }));
            handleChange(fieldName, dataUrl);
          };
          reader.readAsDataURL(compressed);
        } catch {
          // Fallback to uncompressed if compression fails
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setPhotos(prev => ({ ...prev, [fieldName]: dataUrl }));
            handleChange(fieldName, dataUrl);
          };
          reader.readAsDataURL(file);
        }
      }
    };
    
    input.click();
  };

  const handleCaptureSignature = (fieldName: string) => {
    setSignatureField(fieldName);
  };

  const confirmSignature = (signature?: string) => {
    if (signature && signatureField) {
      setSignatures({ ...signatures, [signatureField]: signature });
      handleChange(signatureField, signature);
    }
    setSignatureField(null);
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
        return (
          <TextField
            fullWidth
            label={field.label}
            type={field.type}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.required}
            error={!!error}
            helperText={error || field.placeholder}
            placeholder={field.placeholder}
          />
        );

      case 'textarea':
        return (
          <TextField
            fullWidth
            label={field.label}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.required}
            error={!!error}
            helperText={error || field.placeholder}
            placeholder={field.placeholder}
            multiline
            rows={4}
          />
        );

      case 'select':
        return (
          <FormControl fullWidth error={!!error}>
            <InputLabel>{field.label}</InputLabel>
            <Select
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              label={field.label}
              required={field.required}
            >
              {field.options?.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
            {error && <Typography variant="caption" color="error">{error}</Typography>}
          </FormControl>
        );

      case 'checkbox':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={!!value}
                onChange={(e) => handleChange(field.name, e.target.checked)}
              />
            }
            label={field.label}
          />
        );

      case 'date':
        return (
          <TextField
            fullWidth
            label={field.label}
            type="date"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.required}
            error={!!error}
            helperText={error}
            InputLabelProps={{ shrink: true }}
          />
        );

      case 'signature':
        return (
          <Box>
            <Button
              variant="outlined"
              startIcon={<Create />}
              onClick={() => handleCaptureSignature(field.name)}
              fullWidth
            >
              {signatures[field.name] ? 'Signature Captured ✓' : `Capture ${field.label}`}
            </Button>
            {error && <Typography variant="caption" color="error">{error}</Typography>}
          </Box>
        );

      case 'photo':
        return (
          <Box>
            <Button
              variant="outlined"
              startIcon={<CameraAlt />}
              onClick={() => handleCapturePhoto(field.name)}
              fullWidth
            >
              {photos[field.name] ? 'Photo Captured ✓' : `Capture ${field.label}`}
            </Button>
            {photos[field.name] && (
              <Box sx={{ mt: 1 }}>
                <img
                  src={photos[field.name]}
                  alt={field.label}
                  style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                />
              </Box>
            )}
            {error && <Typography variant="caption" color="error">{error}</Typography>}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" gutterBottom>
        {schema.title}
      </Typography>
      
      {schema.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {schema.description}
        </Typography>
      )}

      <Grid container spacing={2}>
        {schema.fields.map((field) => (
          <Grid item xs={12} key={field.name}>
            {renderField(field)}
          </Grid>
        ))}
      </Grid>

      <ConfirmDialog
        isOpen={signatureField !== null}
        onClose={() => setSignatureField(null)}
        onConfirm={confirmSignature}
        title="Capture Signature"
        message="Enter your signature below. In a real app, this would be a signature pad."
        confirmLabel="Save Signature"
        variant="info"
        showReasonInput
        reasonPlaceholder="Enter signature..."
        reasonRequired
      />

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        {onCancel && (
          <Button variant="outlined" onClick={onCancel} fullWidth>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="contained" fullWidth>
          Submit
        </Button>
      </Box>
    </Box>
  );
}
